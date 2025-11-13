-- Create atomic wallet operation function
CREATE OR REPLACE FUNCTION public.process_wallet_operation(
  _user_id uuid,
  _operation text,
  _amount numeric,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance_before numeric;
  _balance_after numeric;
  _transaction_id uuid;
BEGIN
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

  -- Get current balance with row lock to prevent race conditions
  SELECT balance INTO _balance_before
  FROM profiles 
  WHERE id = _user_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
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

  -- Update balance
  UPDATE profiles 
  SET balance = _balance_after, updated_at = now()
  WHERE id = _user_id;

  -- Insert transaction record (both operations in same transaction)
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
    _metadata
  )
  RETURNING id INTO _transaction_id;

  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', _transaction_id,
    'balance_before', _balance_before,
    'balance_after', _balance_after,
    'operation', _operation,
    'amount', _amount
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Any error rolls back the entire transaction
    RAISE EXCEPTION 'Wallet operation failed: %', SQLERRM;
END;
$$;

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own rate limits
CREATE POLICY "Users can view own rate limits"
  ON public.rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can manage rate limits (for edge functions)
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limits
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create index for efficient rate limit lookups
CREATE INDEX idx_rate_limits_user_operation 
  ON public.rate_limits(user_id, operation_type, window_start);

-- Create function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _operation_type text,
  _max_attempts integer DEFAULT 10,
  _window_minutes integer DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_count integer;
  _window_start timestamptz;
  _is_allowed boolean;
BEGIN
  -- Clean up old rate limit records (older than window)
  DELETE FROM rate_limits 
  WHERE user_id = _user_id 
    AND operation_type = _operation_type
    AND window_start < (now() - (_window_minutes || ' minutes')::interval);

  -- Get current count within window
  SELECT attempt_count, window_start INTO _current_count, _window_start
  FROM rate_limits
  WHERE user_id = _user_id
    AND operation_type = _operation_type
    AND window_start >= (now() - (_window_minutes || ' minutes')::interval)
  ORDER BY window_start DESC
  LIMIT 1;

  -- If no record exists, create new one
  IF NOT FOUND THEN
    INSERT INTO rate_limits (user_id, operation_type, attempt_count, window_start)
    VALUES (_user_id, _operation_type, 1, now());
    
    RETURN jsonb_build_object(
      'allowed', true,
      'attempts_remaining', _max_attempts - 1,
      'reset_at', now() + (_window_minutes || ' minutes')::interval
    );
  END IF;

  -- Check if limit exceeded
  IF _current_count >= _max_attempts THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'attempts_remaining', 0,
      'reset_at', _window_start + (_window_minutes || ' minutes')::interval,
      'message', 'Rate limit exceeded. Please try again later.'
    );
  END IF;

  -- Increment counter
  UPDATE rate_limits
  SET attempt_count = attempt_count + 1,
      updated_at = now()
  WHERE user_id = _user_id
    AND operation_type = _operation_type
    AND window_start = _window_start;

  RETURN jsonb_build_object(
    'allowed', true,
    'attempts_remaining', _max_attempts - _current_count - 1,
    'reset_at', _window_start + (_window_minutes || ' minutes')::interval
  );
END;
$$;

-- Add trigger for updated_at on rate_limits
CREATE TRIGGER update_rate_limits_updated_at
  BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();