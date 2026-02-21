
-- Void contest: refund all participants
CREATE OR REPLACE FUNCTION public.void_contest(_contest_id UUID, _admin_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry RECORD;
  _buy_in NUMERIC;
  _contest_title TEXT;
  _refunded INTEGER := 0;
BEGIN
  SELECT buy_in_amount, title INTO _buy_in, _contest_title
  FROM prediction_contests WHERE id = _contest_id AND status IN ('open', 'closed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found or already resolved/voided'; END IF;

  FOR _entry IN SELECT user_id FROM contest_entries WHERE contest_id = _contest_id
  LOOP
    UPDATE profiles SET balance = balance + _buy_in, updated_at = now() WHERE id = _entry.user_id;
    INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, metadata)
    SELECT _entry.user_id, 'deposit', _buy_in, p.balance - _buy_in, p.balance, 'completed',
      jsonb_build_object('source', 'contest_void_refund', 'contest_id', _contest_id)
    FROM profiles p WHERE p.id = _entry.user_id;
    INSERT INTO resolution_notifications (user_id, contest_id, notification_type, title, message, outcome, payout_amount)
    VALUES (_entry.user_id, _contest_id, 'void', 'Contest Voided',
      'Contest "' || _contest_title || '" has been voided by admin. Your ' || _buy_in || ' token buy-in has been refunded.',
      'void', _buy_in);
    _refunded := _refunded + 1;
  END LOOP;

  UPDATE prediction_contests SET status = 'voided', resolved_at = now(), resolved_by = _admin_id WHERE id = _contest_id;
  RETURN jsonb_build_object('success', true, 'refunded', _refunded, 'amount_each', _buy_in);
END;
$$;

-- Void poll: refund all voters
CREATE OR REPLACE FUNCTION public.void_poll(_poll_id UUID, _admin_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _voter RECORD;
  _refunded INTEGER := 0;
  _total_refunded NUMERIC := 0;
  _poll_question TEXT;
BEGIN
  SELECT question INTO _poll_question FROM prediction_polls WHERE id = _poll_id AND status IN ('open', 'closed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll not found or already resolved/voided'; END IF;

  FOR _voter IN SELECT user_id, amount FROM poll_votes WHERE poll_id = _poll_id
  LOOP
    UPDATE profiles SET balance = balance + _voter.amount, updated_at = now() WHERE id = _voter.user_id;
    INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, metadata)
    SELECT _voter.user_id, 'deposit', _voter.amount, p.balance - _voter.amount, p.balance, 'completed',
      jsonb_build_object('source', 'poll_void_refund', 'poll_id', _poll_id)
    FROM profiles p WHERE p.id = _voter.user_id;
    INSERT INTO resolution_notifications (user_id, poll_id, notification_type, title, message, outcome, payout_amount)
    VALUES (_voter.user_id, _poll_id, 'void', 'Poll Voided',
      'Poll "' || LEFT(_poll_question, 50) || '" has been voided by admin. Your ' || _voter.amount || ' token stake has been refunded.',
      'void', _voter.amount);
    _refunded := _refunded + 1;
    _total_refunded := _total_refunded + _voter.amount;
  END LOOP;

  UPDATE prediction_polls SET status = 'voided', resolved_at = now(), resolved_by = _admin_id WHERE id = _poll_id;
  RETURN jsonb_build_object('success', true, 'refunded', _refunded, 'total_refunded', _total_refunded);
END;
$$;
