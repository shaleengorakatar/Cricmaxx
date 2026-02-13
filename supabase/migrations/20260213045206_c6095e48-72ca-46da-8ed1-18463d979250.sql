
-- Update resolve_contest to insert notifications for participants
CREATE OR REPLACE FUNCTION public.resolve_contest(_contest_id UUID, _admin_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry RECORD;
  _question RECORD;
  _participant_count INTEGER;
  _min_participants INTEGER;
  _buy_in NUMERIC;
  _total_pot NUMERIC;
  _tiebreaker_qid UUID;
  _tiebreaker_qid_2 UUID;
  _winners_paid INTEGER := 0;
  _r RECORD;
  _payout NUMERIC;
  _group_payout NUMERIC;
  _slots_used INTEGER;
  _group_size INTEGER;
  _i INTEGER;
  _contest_title TEXT;
BEGIN
  -- Verify contest
  SELECT buy_in_amount, min_participants, tiebreaker_question_id, tiebreaker_question_id_2, title
  INTO _buy_in, _min_participants, _tiebreaker_qid, _tiebreaker_qid_2, _contest_title
  FROM prediction_contests WHERE id = _contest_id AND status IN ('open', 'closed');

  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found or already resolved'; END IF;

  SELECT COUNT(*) INTO _participant_count FROM contest_entries WHERE contest_id = _contest_id;
  _total_pot := _participant_count * _buy_in;

  -- Grade all answers
  FOR _question IN SELECT id, correct_answer, points FROM contest_questions WHERE contest_id = _contest_id AND correct_answer IS NOT NULL
  LOOP
    UPDATE contest_answers
    SET is_correct = (LOWER(TRIM(answer)) = LOWER(TRIM(_question.correct_answer))),
        points_earned = CASE WHEN LOWER(TRIM(answer)) = LOWER(TRIM(_question.correct_answer)) THEN _question.points ELSE 0 END
    WHERE contest_id = _contest_id AND question_id = _question.id;
  END LOOP;

  -- Calculate scores
  FOR _entry IN SELECT id, user_id FROM contest_entries WHERE contest_id = _contest_id
  LOOP
    UPDATE contest_entries
    SET score = COALESCE((SELECT SUM(points_earned) FROM contest_answers WHERE contest_id = _contest_id AND user_id = _entry.user_id), 0),
    total_points = COALESCE((SELECT SUM(points) FROM contest_questions WHERE contest_id = _contest_id AND correct_answer IS NOT NULL), 0)
    WHERE id = _entry.id;
  END LOOP;

  -- Void if too few participants
  IF _participant_count < _min_participants THEN
    FOR _entry IN SELECT user_id FROM contest_entries WHERE contest_id = _contest_id
    LOOP
      UPDATE profiles SET balance = balance + _buy_in, updated_at = now() WHERE id = _entry.user_id;
      INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, metadata)
      SELECT _entry.user_id, 'deposit', _buy_in, p.balance - _buy_in, p.balance, 'completed',
        jsonb_build_object('source', 'contest_refund', 'contest_id', _contest_id)
      FROM profiles p WHERE p.id = _entry.user_id;
      
      -- Notify about voided contest
      INSERT INTO resolution_notifications (user_id, market_id, notification_type, title, message, outcome, payout_amount)
      VALUES (_entry.user_id, _contest_id, 'void', 'Contest Voided', 
        'Contest "' || _contest_title || '" was voided due to insufficient participants. Your ' || _buy_in || ' token buy-in has been refunded.',
        'void', _buy_in);
    END LOOP;
    UPDATE prediction_contests SET status = 'voided', resolved_at = now(), resolved_by = _admin_id WHERE id = _contest_id;
    RETURN jsonb_build_object('success', true, 'voided', true, 'reason', 'Not enough participants', 'refunded', _participant_count);
  END IF;

  -- Rank using DENSE_RANK
  WITH ranked AS (
    SELECT ce.id, ce.user_id, ce.score,
      DENSE_RANK() OVER (ORDER BY ce.score DESC,
        COALESCE((SELECT is_correct FROM contest_answers WHERE contest_id = _contest_id AND question_id = _tiebreaker_qid AND user_id = ce.user_id), false) DESC,
        COALESCE((SELECT is_correct FROM contest_answers WHERE contest_id = _contest_id AND question_id = _tiebreaker_qid_2 AND user_id = ce.user_id), false) DESC
      ) as dense_rank
    FROM contest_entries ce WHERE ce.contest_id = _contest_id
  )
  UPDATE contest_entries ce SET rank = r.dense_rank FROM ranked r WHERE ce.id = r.id;

  -- Pay out prizes
  _slots_used := 0;

  FOR _r IN
    SELECT rank, array_agg(user_id) as user_ids, COUNT(*) as cnt
    FROM contest_entries
    WHERE contest_id = _contest_id
    GROUP BY rank
    ORDER BY rank
  LOOP
    IF _slots_used >= 3 THEN EXIT; END IF;

    _group_size := _r.cnt;
    _group_payout := 0;
    FOR _i IN (_slots_used + 1)..LEAST(_slots_used + _group_size, 3)
    LOOP
      _group_payout := _group_payout + CASE _i
        WHEN 1 THEN _total_pot * 0.50
        WHEN 2 THEN _total_pot * 0.30
        WHEN 3 THEN _total_pot * 0.20
        ELSE 0
      END;
    END LOOP;

    IF _group_payout = 0 THEN
      _slots_used := _slots_used + _group_size;
      CONTINUE;
    END IF;

    _payout := ROUND(_group_payout / _group_size, 2);

    FOR _i IN 1.._group_size
    LOOP
      UPDATE profiles SET balance = balance + _payout, updated_at = now() WHERE id = _r.user_ids[_i];
      INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, metadata)
      SELECT _r.user_ids[_i], 'deposit', _payout, p.balance - _payout, p.balance, 'completed',
        jsonb_build_object('source', 'contest_winnings', 'contest_id', _contest_id, 'rank', _r.rank)
      FROM profiles p WHERE p.id = _r.user_ids[_i];

      UPDATE contest_entries SET payout = _payout WHERE contest_id = _contest_id AND user_id = _r.user_ids[_i];
      _winners_paid := _winners_paid + 1;
      
      -- Notify winner
      INSERT INTO resolution_notifications (user_id, market_id, notification_type, title, message, outcome, payout_amount)
      VALUES (_r.user_ids[_i], _contest_id, 'resolution', 
        '🏆 You won in "' || _contest_title || '"!',
        'Congratulations! You placed #' || _r.rank || ' and won ' || _payout || ' tokens!',
        'yes', _payout);
    END LOOP;

    _slots_used := _slots_used + _group_size;
  END LOOP;

  -- Notify non-winners
  FOR _entry IN 
    SELECT user_id FROM contest_entries 
    WHERE contest_id = _contest_id AND (payout IS NULL OR payout = 0)
  LOOP
    INSERT INTO resolution_notifications (user_id, market_id, notification_type, title, message, outcome, payout_amount)
    VALUES (_entry.user_id, _contest_id, 'resolution',
      'Contest "' || _contest_title || '" Resolved',
      'The contest has been resolved. Unfortunately you did not place in the top 3 this time. Better luck next time!',
      'no', 0);
  END LOOP;

  UPDATE prediction_contests SET status = 'resolved', resolved_at = now(), resolved_by = _admin_id WHERE id = _contest_id;
  RETURN jsonb_build_object('success', true, 'total_pot', _total_pot, 'winners_paid', _winners_paid, 'participants', _participant_count);
END;
$$;

-- Update resolve_poll to insert notifications for participants
CREATE OR REPLACE FUNCTION public.resolve_poll(_poll_id UUID, _admin_id UUID, _winning_option_ids UUID[])
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
      
      -- Notify winner
      INSERT INTO resolution_notifications (user_id, market_id, notification_type, title, message, outcome, payout_amount)
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
    END LOOP;
  END IF;

  -- Notify losers
  FOR _winner IN
    SELECT DISTINCT user_id FROM poll_votes 
    WHERE poll_id = _poll_id AND option_id != ALL(_winning_option_ids)
    AND user_id NOT IN (SELECT user_id FROM poll_votes WHERE poll_id = _poll_id AND option_id = ANY(_winning_option_ids))
  LOOP
    INSERT INTO resolution_notifications (user_id, market_id, notification_type, title, message, outcome, payout_amount)
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
    'losing_pool', _losing_pool,
    'winners_paid', _winners_paid,
    'winning_options_count', array_length(_winning_option_ids, 1)
  );
END;
$$;
