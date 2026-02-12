
-- Drop and recreate resolve_poll to accept multiple winning option IDs
CREATE OR REPLACE FUNCTION public.resolve_poll(_poll_id uuid, _winning_option_ids uuid[], _admin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _total_pool NUMERIC;
  _winning_pool NUMERIC;
  _losing_pool NUMERIC;
  _winner RECORD;
  _payout NUMERIC;
  _winners_paid INTEGER := 0;
BEGIN
  -- Verify poll exists and is open/closed
  IF NOT EXISTS (SELECT 1 FROM prediction_polls WHERE id = _poll_id AND status IN ('open', 'closed')) THEN
    RAISE EXCEPTION 'Poll not found or already resolved';
  END IF;

  -- Verify all winning options belong to this poll
  IF EXISTS (
    SELECT 1 FROM unnest(_winning_option_ids) wid
    WHERE NOT EXISTS (SELECT 1 FROM poll_options WHERE id = wid AND poll_id = _poll_id)
  ) THEN
    RAISE EXCEPTION 'One or more invalid winning options for this poll';
  END IF;

  -- Calculate pools
  SELECT COALESCE(SUM(amount), 0) INTO _total_pool FROM poll_votes WHERE poll_id = _poll_id;
  SELECT COALESCE(SUM(amount), 0) INTO _winning_pool FROM poll_votes WHERE poll_id = _poll_id AND option_id = ANY(_winning_option_ids);
  _losing_pool := _total_pool - _winning_pool;

  -- Distribute winnings to winners proportionally
  IF _winning_pool > 0 THEN
    FOR _winner IN
      SELECT user_id, amount FROM poll_votes WHERE poll_id = _poll_id AND option_id = ANY(_winning_option_ids)
    LOOP
      _payout := _winner.amount + (_winner.amount / _winning_pool) * _losing_pool;
      
      UPDATE profiles SET balance = balance + _payout, updated_at = now() WHERE id = _winner.user_id;
      
      INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, metadata)
      SELECT _winner.user_id, 'deposit', _payout, p.balance - _payout, p.balance, 'completed',
        jsonb_build_object('source', 'poll_winnings', 'poll_id', _poll_id)
      FROM profiles p WHERE p.id = _winner.user_id;
      
      _winners_paid := _winners_paid + 1;
    END LOOP;
  END IF;

  -- If no winners, refund everyone
  IF _winning_pool = 0 THEN
    FOR _winner IN
      SELECT user_id, amount FROM poll_votes WHERE poll_id = _poll_id
    LOOP
      UPDATE profiles SET balance = balance + _winner.amount, updated_at = now() WHERE id = _winner.user_id;
      INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, metadata)
      SELECT _winner.user_id, 'deposit', _winner.amount, p.balance - _winner.amount, p.balance, 'completed',
        jsonb_build_object('source', 'poll_refund', 'poll_id', _poll_id)
      FROM profiles p WHERE p.id = _winner.user_id;
    END LOOP;
  END IF;

  -- Mark poll as resolved (store first winning option for backward compat)
  UPDATE prediction_polls 
  SET status = 'resolved', winning_option_id = _winning_option_ids[1], resolved_by = _admin_id, resolved_at = now(), total_pool = _total_pool
  WHERE id = _poll_id;

  RETURN jsonb_build_object(
    'success', true,
    'total_pool', _total_pool,
    'winning_pool', _winning_pool,
    'losing_pool', _losing_pool,
    'winners_paid', _winners_paid,
    'winning_options_count', array_length(_winning_option_ids, 1)
  );
END;
$$;
