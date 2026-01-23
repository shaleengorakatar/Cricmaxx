-- =====================================================
-- 1. ADD DATABASE INDEXES ON FREQUENTLY QUERIED COLUMNS
-- =====================================================

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_market_id ON public.orders(market_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_market_status ON public.orders(market_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders(user_id, status);

-- Positions table indexes
CREATE INDEX IF NOT EXISTS idx_positions_market_id ON public.positions(market_id);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON public.positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_user_market ON public.positions(user_id, market_id);

-- Trades table indexes
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON public.trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_buyer_id ON public.trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller_id ON public.trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON public.trades(created_at DESC);

-- Markets table indexes (using created_by instead of creator_id)
CREATE INDEX IF NOT EXISTS idx_markets_status ON public.markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_category ON public.markets(category);
CREATE INDEX IF NOT EXISTS idx_markets_created_by ON public.markets(created_by);
CREATE INDEX IF NOT EXISTS idx_markets_expire ON public.markets(expiry_time);
CREATE INDEX IF NOT EXISTS idx_markets_status_expire ON public.markets(status, expiry_time);

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON public.transactions(user_id, type);

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_prediction_rating ON public.profiles(rating_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_show_leaderboard ON public.profiles(show_on_leaderboard) WHERE show_on_leaderboard = true;

-- =====================================================
-- 2. ADD VERSION COLUMN FOR OPTIMISTIC LOCKING
-- =====================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- =====================================================
-- 3. IDEMPOTENCY KEYS TABLE FOR REQUEST DEDUPLICATION
-- =====================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_data JSONB,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE(idempotency_key, user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup 
ON public.idempotency_keys(idempotency_key, user_id);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires 
ON public.idempotency_keys(expires_at);

-- RLS policies
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own idempotency keys"
ON public.idempotency_keys FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own idempotency keys"
ON public.idempotency_keys FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. ORDER QUEUE TABLE FOR BURST HANDLING
-- =====================================================

CREATE TABLE IF NOT EXISTS public.order_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL,
  order_type TEXT NOT NULL,
  side TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_order_queue_status ON public.order_queue(status);
CREATE INDEX IF NOT EXISTS idx_order_queue_priority ON public.order_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_order_queue_pending ON public.order_queue(status, priority DESC, created_at ASC) 
WHERE status = 'pending';

-- RLS policies
ALTER TABLE public.order_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queued orders"
ON public.order_queue FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queued orders"
ON public.order_queue FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 5. CACHE METADATA TABLE FOR TRACKING CACHE STATE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.cache_metadata (
  cache_key TEXT PRIMARY KEY,
  cache_type TEXT NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  ttl_seconds INTEGER NOT NULL DEFAULT 60,
  metadata JSONB DEFAULT '{}'
);

-- =====================================================
-- 6. UPDATE WALLET OPERATION FUNCTION WITH OPTIMISTIC LOCKING
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_wallet_operation_v2(
  _user_id uuid, 
  _operation text, 
  _amount numeric, 
  _expected_version integer,
  _idempotency_key text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _balance_before numeric;
  _balance_after numeric;
  _current_version integer;
  _transaction_id uuid;
  _existing_response jsonb;
  _response jsonb;
BEGIN
  -- Check for existing idempotency key
  IF _idempotency_key IS NOT NULL THEN
    SELECT response_data INTO _existing_response
    FROM idempotency_keys
    WHERE idempotency_key = _idempotency_key 
      AND user_id = _user_id
      AND status = 'completed'
      AND expires_at > now();
    
    IF FOUND THEN
      RETURN _existing_response || jsonb_build_object('cached', true);
    END IF;
    
    -- Insert idempotency key as processing
    INSERT INTO idempotency_keys (idempotency_key, user_id, operation_type, request_hash, status)
    VALUES (_idempotency_key, _user_id, _operation, md5(_amount::text || _operation), 'processing')
    ON CONFLICT (idempotency_key, user_id) DO NOTHING;
  END IF;

  -- Validate operation type
  IF _operation NOT IN ('deposit', 'withdrawal') THEN
    RAISE EXCEPTION 'Invalid operation type. Must be deposit or withdrawal';
  END IF;

  -- Validate amount
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF _amount > 1000000 THEN
    RAISE EXCEPTION 'Amount exceeds maximum limit of 1,000,000 credits';
  END IF;

  -- Get current balance and version with row lock
  SELECT balance, version INTO _balance_before, _current_version
  FROM profiles 
  WHERE id = _user_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Optimistic locking check
  IF _expected_version IS NOT NULL AND _current_version != _expected_version THEN
    RAISE EXCEPTION 'Concurrent modification detected. Please retry. Expected version: %, Current version: %', _expected_version, _current_version;
  END IF;

  -- Calculate new balance
  IF _operation = 'deposit' THEN
    _balance_after := _balance_before + _amount;
  ELSE
    IF _balance_before < _amount THEN
      RAISE EXCEPTION 'Insufficient funds. Current balance: %, Withdrawal amount: %', _balance_before, _amount;
    END IF;
    _balance_after := _balance_before - _amount;
  END IF;

  -- Update balance AND increment version
  UPDATE profiles 
  SET balance = _balance_after, 
      version = version + 1,
      updated_at = now()
  WHERE id = _user_id;

  -- Insert transaction record
  INSERT INTO transactions (
    user_id, 
    type, 
    amount, 
    balance_before, 
    balance_after, 
    status,
    metadata
  )
  VALUES (
    _user_id, 
    _operation, 
    _amount, 
    _balance_before, 
    _balance_after,
    'completed',
    _metadata || jsonb_build_object('idempotency_key', _idempotency_key)
  )
  RETURNING id INTO _transaction_id;

  -- Build response
  _response := jsonb_build_object(
    'success', true,
    'transaction_id', _transaction_id,
    'balance_before', _balance_before,
    'balance_after', _balance_after,
    'new_version', _current_version + 1,
    'operation', _operation,
    'amount', _amount
  );

  -- Update idempotency key with response
  IF _idempotency_key IS NOT NULL THEN
    UPDATE idempotency_keys
    SET status = 'completed',
        response_data = _response
    WHERE idempotency_key = _idempotency_key AND user_id = _user_id;
  END IF;

  RETURN _response;

EXCEPTION
  WHEN OTHERS THEN
    -- Mark idempotency key as failed
    IF _idempotency_key IS NOT NULL THEN
      UPDATE idempotency_keys
      SET status = 'failed',
          response_data = jsonb_build_object('error', SQLERRM)
      WHERE idempotency_key = _idempotency_key AND user_id = _user_id;
    END IF;
    RAISE EXCEPTION 'Wallet operation failed: %', SQLERRM;
END;
$$;

-- =====================================================
-- 7. QUEUE PROCESSOR FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_order_queue(batch_size integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order RECORD;
  _processed_count integer := 0;
  _success_count integer := 0;
  _error_count integer := 0;
BEGIN
  -- Get batch of pending orders with lock
  FOR _order IN
    SELECT * FROM order_queue
    WHERE status = 'pending'
      AND retry_count < max_retries
    ORDER BY priority DESC, created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Mark as processing
      UPDATE order_queue
      SET status = 'processing', processed_at = now()
      WHERE id = _order.id;

      -- Here you would call the actual order processing logic
      -- For now, we'll just mark it as completed
      -- In production, this would call the order-book function
      
      UPDATE order_queue
      SET status = 'completed', completed_at = now()
      WHERE id = _order.id;

      _success_count := _success_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        UPDATE order_queue
        SET status = CASE 
              WHEN retry_count + 1 >= max_retries THEN 'failed'
              ELSE 'pending'
            END,
            retry_count = retry_count + 1,
            error_message = SQLERRM
        WHERE id = _order.id;
        
        _error_count := _error_count + 1;
    END;
    
    _processed_count := _processed_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', _processed_count,
    'success', _success_count,
    'errors', _error_count,
    'timestamp', now()
  );
END;
$$;

-- =====================================================
-- 8. CLEANUP FUNCTION FOR EXPIRED RECORDS
-- =====================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _deleted_idempotency integer;
  _deleted_rate_limits integer;
BEGIN
  -- Clean expired idempotency keys
  DELETE FROM idempotency_keys WHERE expires_at < now();
  GET DIAGNOSTICS _deleted_idempotency = ROW_COUNT;
  
  -- Clean old rate limit records
  DELETE FROM rate_limits WHERE window_start < (now() - interval '2 hours');
  GET DIAGNOSTICS _deleted_rate_limits = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'deleted_idempotency_keys', _deleted_idempotency,
    'deleted_rate_limits', _deleted_rate_limits,
    'timestamp', now()
  );
END;
$$;