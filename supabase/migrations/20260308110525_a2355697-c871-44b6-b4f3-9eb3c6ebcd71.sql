
-- Update resolve_contest function for top 4 prize distribution: 40/25/20/15
CREATE OR REPLACE FUNCTION public.resolve_contest(_contest_id uuid, _admin_id uuid)
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
      INSERT INTO resolution_notifications (user_id, contest_id, notification_type, title, message, outcome, payout_amount)
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

  -- Pay out prizes: Top 4 (40/25/20/15)
  _slots_used := 0;

  FOR _r IN
    SELECT rank, array_agg(user_id) as user_ids, COUNT(*) as cnt
    FROM contest_entries
    WHERE contest_id = _contest_id
    GROUP BY rank
    ORDER BY rank
  LOOP
    IF _slots_used >= 4 THEN EXIT; END IF;

    _group_size := _r.cnt;
    _group_payout := 0;
    FOR _i IN (_slots_used + 1)..LEAST(_slots_used + _group_size, 4)
    LOOP
      _group_payout := _group_payout + CASE _i
        WHEN 1 THEN _total_pot * 0.40
        WHEN 2 THEN _total_pot * 0.25
        WHEN 3 THEN _total_pot * 0.20
        WHEN 4 THEN _total_pot * 0.15
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
      INSERT INTO resolution_notifications (user_id, contest_id, notification_type, title, message, outcome, payout_amount)
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
    INSERT INTO resolution_notifications (user_id, contest_id, notification_type, title, message, outcome, payout_amount)
    VALUES (_entry.user_id, _contest_id, 'resolution',
      'Contest "' || _contest_title || '" Resolved',
      'The contest has been resolved. Unfortunately you did not place in the top 4 this time. Better luck next time!',
      'no', 0);
  END LOOP;

  UPDATE prediction_contests SET status = 'resolved', resolved_at = now(), resolved_by = _admin_id WHERE id = _contest_id;
  RETURN jsonb_build_object('success', true, 'total_pot', _total_pot, 'winners_paid', _winners_paid, 'participants', _participant_count);
END;
$$;
