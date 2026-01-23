
-- ==============================================
-- SCALABILITY IMPROVEMENTS FOR 10,000+ USERS
-- ==============================================

-- 1. Create analytics-optimized functions (read-replica ready)
CREATE OR REPLACE FUNCTION public.get_platform_analytics_readonly(_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM profiles),
      'active_24h', (SELECT COUNT(*) FROM profiles WHERE last_active_at > now() - interval '24 hours'),
      'active_7d', (SELECT COUNT(*) FROM profiles WHERE last_active_at > now() - interval '7 days'),
      'with_balance', (SELECT COUNT(*) FROM profiles WHERE balance > 0),
      'avg_balance', (SELECT ROUND(AVG(balance)::numeric, 2) FROM profiles WHERE balance > 0)
    ),
    'markets', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM markets),
      'active', (SELECT COUNT(*) FROM markets WHERE status = 'active'),
      'pending', (SELECT COUNT(*) FROM markets WHERE status = 'pending'),
      'resolved', (SELECT COUNT(*) FROM markets WHERE status = 'resolved'),
      'total_volume', (SELECT COALESCE(SUM(volume), 0) FROM markets)
    ),
    'trading', jsonb_build_object(
      'trades_24h', (SELECT COUNT(*) FROM trades WHERE created_at > now() - (_hours || ' hours')::interval),
      'volume_24h', (SELECT COALESCE(SUM(quantity * price), 0) FROM trades WHERE created_at > now() - (_hours || ' hours')::interval),
      'unique_traders_24h', (SELECT COUNT(DISTINCT COALESCE(buyer_id, seller_id)) FROM trades WHERE created_at > now() - (_hours || ' hours')::interval),
      'orders_24h', (SELECT COUNT(*) FROM orders WHERE created_at > now() - (_hours || ' hours')::interval)
    ),
    'transactions', jsonb_build_object(
      'count_24h', (SELECT COUNT(*) FROM transactions WHERE created_at > now() - (_hours || ' hours')::interval),
      'deposits_24h', (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'deposit' AND created_at > now() - (_hours || ' hours')::interval),
      'withdrawals_24h', (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'withdrawal' AND created_at > now() - (_hours || ' hours')::interval)
    ),
    'generated_at', now()
  );
$$;

-- Rate limit stats for monitoring
CREATE OR REPLACE FUNCTION public.get_rate_limit_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'active_limits', (SELECT COUNT(*) FROM rate_limits WHERE window_start > now() - interval '1 hour'),
    'users_rate_limited', (SELECT COUNT(DISTINCT user_id) FROM rate_limits WHERE attempt_count >= 10 AND window_start > now() - interval '1 hour'),
    'by_operation', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'operation_type', operation_type,
        'total_attempts', total_attempts,
        'users_affected', users_count,
        'max_attempts', max_attempts
      )), '[]'::jsonb)
      FROM (
        SELECT 
          operation_type,
          SUM(attempt_count) as total_attempts,
          COUNT(DISTINCT user_id) as users_count,
          MAX(attempt_count) as max_attempts
        FROM rate_limits
        WHERE window_start > now() - interval '1 hour'
        GROUP BY operation_type
      ) t
    ),
    'generated_at', now()
  );
$$;

-- 2. Standard indexes (no time-based predicates)
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
ON rate_limits (user_id, operation_type, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_orders_matching 
ON orders (market_id, side, status, price) 
WHERE status IN ('pending', 'partial');

CREATE INDEX IF NOT EXISTS idx_trades_recent 
ON trades (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trades_by_market 
ON trades (market_id, created_at DESC);

-- 3. Batch functions for connection efficiency
CREATE OR REPLACE FUNCTION public.batch_check_order_status(_order_ids uuid[])
RETURNS TABLE(order_id uuid, status text, filled_quantity numeric, avg_fill_price numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, status, filled_quantity, avg_fill_price
  FROM orders
  WHERE id = ANY(_order_ids);
$$;

CREATE OR REPLACE FUNCTION public.batch_get_market_prices(_market_ids uuid[])
RETURNS TABLE(market_id uuid, yes_price numeric, no_price numeric, volume numeric, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, yes_price, no_price, volume, updated_at
  FROM markets
  WHERE id = ANY(_market_ids);
$$;

-- 4. High-performance rate limit check
CREATE OR REPLACE FUNCTION public.check_rate_limit_fast(_user_id uuid, _operation_type text, _max_attempts integer DEFAULT 10, _window_minutes integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_count integer;
  _window_start timestamptz;
  _cutoff timestamptz;
BEGIN
  _cutoff := now() - (_window_minutes || ' minutes')::interval;
  
  -- Fast read to check current state
  SELECT attempt_count, window_start INTO _current_count, _window_start
  FROM rate_limits
  WHERE user_id = _user_id
    AND operation_type = _operation_type
    AND window_start >= _cutoff
  ORDER BY window_start DESC
  LIMIT 1;

  -- If no record, create new one
  IF NOT FOUND THEN
    INSERT INTO rate_limits (user_id, operation_type, attempt_count, window_start)
    VALUES (_user_id, _operation_type, 1, now());
    
    RETURN jsonb_build_object(
      'allowed', true,
      'attempts_used', 1,
      'attempts_remaining', _max_attempts - 1,
      'reset_at', now() + (_window_minutes || ' minutes')::interval
    );
  END IF;

  -- Check if limit exceeded
  IF _current_count >= _max_attempts THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'attempts_used', _current_count,
      'attempts_remaining', 0,
      'reset_at', _window_start + (_window_minutes || ' minutes')::interval,
      'retry_after_seconds', GREATEST(0, EXTRACT(EPOCH FROM (_window_start + (_window_minutes || ' minutes')::interval - now()))::integer)
    );
  END IF;

  -- Under limit - increment
  UPDATE rate_limits
  SET attempt_count = attempt_count + 1, updated_at = now()
  WHERE user_id = _user_id
    AND operation_type = _operation_type
    AND window_start = _window_start;

  RETURN jsonb_build_object(
    'allowed', true,
    'attempts_used', _current_count + 1,
    'attempts_remaining', _max_attempts - _current_count - 1,
    'reset_at', _window_start + (_window_minutes || ' minutes')::interval
  );
END;
$function$;

-- 5. Connection pool friendly wallet operation
CREATE OR REPLACE FUNCTION public.process_wallet_operation_pooled(_user_id uuid, _operation text, _amount numeric, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _balance_before numeric;
  _balance_after numeric;
  _transaction_id uuid;
  _affected_rows integer;
BEGIN
  IF _operation NOT IN ('deposit', 'withdrawal') THEN
    RAISE EXCEPTION 'Invalid operation type';
  END IF;

  IF _amount <= 0 OR _amount > 1000000 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Single atomic update with RETURNING (minimal lock time)
  IF _operation = 'deposit' THEN
    UPDATE profiles 
    SET balance = balance + _amount, updated_at = now()
    WHERE id = _user_id
    RETURNING balance - _amount, balance INTO _balance_before, _balance_after;
  ELSE
    UPDATE profiles 
    SET balance = balance - _amount, updated_at = now()
    WHERE id = _user_id AND balance >= _amount
    RETURNING balance + _amount, balance INTO _balance_before, _balance_after;
  END IF;

  GET DIAGNOSTICS _affected_rows = ROW_COUNT;

  IF _affected_rows = 0 THEN
    IF _operation = 'withdrawal' THEN
      RAISE EXCEPTION 'Insufficient funds';
    ELSE
      RAISE EXCEPTION 'User not found';
    END IF;
  END IF;

  INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, metadata)
  VALUES (_user_id, _operation, _amount, _balance_before, _balance_after, 'completed', _metadata)
  RETURNING id INTO _transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', _transaction_id,
    'balance_before', _balance_before,
    'balance_after', _balance_after
  );
END;
$function$;
