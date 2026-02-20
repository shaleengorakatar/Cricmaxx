
-- Add poll_id column to resolution_notifications
ALTER TABLE public.resolution_notifications
  ADD COLUMN IF NOT EXISTS poll_id uuid REFERENCES public.prediction_polls(id);

-- Update resolve_poll to use poll_id instead of market_id
CREATE OR REPLACE FUNCTION public.resolve_poll(_poll_id UUID, _winning_option_ids UUID[],  _admin_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_pool NUMERIC;
  _winning_pool NUMERIC;
  _losing_pool NUMERIC;
  _winner RECORD;
  _payout NUMERIC;
  _winners_paid INTEGER := 0;
  _poll_question TEXT;
  _winning_text TEXT;
BEGIN
  -- Verify poll exists and is open/closed
  IF NOT EXISTS (SELECT 1 FROM prediction_polls WHERE id = _poll_id AND status IN ('open', 'closed')) THEN
    RAISE EXCEPTION 'Poll not found or already resolved';
  END IF;

  -- Get poll question
  SELECT question INTO _poll_question FROM prediction_polls WHERE id = _poll_id;

  -- Get winning option text
  SELECT string_agg(option_text, ', ') INTO _winning_text FROM poll_options WHERE id = ANY(_winning_option_ids);

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
      
      -- Notify winner using poll_id column
      INSERT INTO resolution_notifications (user_id, poll_id, notification_type, title, message, outcome, payout_amount)
      VALUES (_winner.user_id, _poll_id, 'resolution',
        '🎉 You won on "' || LEFT(_poll_question, 50) || '"!',
        'The winning answer was "' || _winning_text || '". You won ' || ROUND(_payout, 2) || ' tokens!',
        'yes', ROUND(_payout, 2));
      
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
      
      -- Notify refund
      INSERT INTO resolution_notifications (user_id, poll_id, notification_type, title, message, outcome, payout_amount)
      VALUES (_winner.user_id, _poll_id, 'void',
        'Poll Refund',
        'No winners for "' || LEFT(_poll_question, 50) || '". Your ' || _winner.amount || ' token stake has been refunded.',
        'void', _winner.amount);
    END LOOP;
  END IF;

  -- Notify losers
  FOR _winner IN
    SELECT DISTINCT user_id FROM poll_votes 
    WHERE poll_id = _poll_id AND option_id != ALL(_winning_option_ids)
    AND user_id NOT IN (SELECT user_id FROM poll_votes WHERE poll_id = _poll_id AND option_id = ANY(_winning_option_ids))
  LOOP
    INSERT INTO resolution_notifications (user_id, poll_id, notification_type, title, message, outcome, payout_amount)
    VALUES (_winner.user_id, _poll_id, 'resolution',
      'Poll "' || LEFT(_poll_question, 50) || '" Resolved',
      'The winning answer was "' || _winning_text || '". Unfortunately your prediction was incorrect.',
      'no', 0);
  END LOOP;

  -- Mark poll as resolved
  UPDATE prediction_polls 
  SET status = 'resolved', winning_option_id = _winning_option_ids[1], resolved_by = _admin_id, resolved_at = now(), total_pool = _total_pool
  WHERE id = _poll_id;

  RETURN jsonb_build_object(
    'success', true,
    'total_pool', _total_pool,
    'winning_pool', _winning_pool,
    'winners_paid', _winners_paid,
    'winning_options', _winning_text
  );
END;
$$;
