
-- Update resolve_contest to support dual tiebreakers and pot sharing
CREATE OR REPLACE FUNCTION public.resolve_contest(_contest_id UUID, _admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  _i INTEGER;
  _prize_count INTEGER;
BEGIN
  -- Verify contest
  SELECT buy_in_amount, min_participants, tiebreaker_question_id, tiebreaker_question_id_2
  INTO _buy_in, _min_participants, _tiebreaker_qid, _tiebreaker_qid_2
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
    END LOOP;
    UPDATE prediction_contests SET status = 'voided', resolved_at = now(), resolved_by = _admin_id WHERE id = _contest_id;
    RETURN jsonb_build_object('success', true, 'voided', true, 'reason', 'Not enough participants', 'refunded', _participant_count);
  END IF;

  -- Assign preliminary ranks: score DESC, tb1 DESC, tb2 DESC, entry time ASC
  WITH ranked AS (
    SELECT ce.id, ce.user_id, ce.score,
      COALESCE((SELECT is_correct FROM contest_answers WHERE contest_id = _contest_id AND question_id = _tiebreaker_qid AND user_id = ce.user_id), false) as tb1,
      COALESCE((SELECT is_correct FROM contest_answers WHERE contest_id = _contest_id AND question_id = _tiebreaker_qid_2 AND user_id = ce.user_id), false) as tb2,
      ROW_NUMBER() OVER (ORDER BY ce.score DESC,
        COALESCE((SELECT is_correct FROM contest_answers WHERE contest_id = _contest_id AND question_id = _tiebreaker_qid AND user_id = ce.user_id), false) DESC,
        COALESCE((SELECT is_correct FROM contest_answers WHERE contest_id = _contest_id AND question_id = _tiebreaker_qid_2 AND user_id = ce.user_id), false) DESC,
        ce.created_at ASC
      ) as preliminary_rank
    FROM contest_entries ce WHERE ce.contest_id = _contest_id
  )
  UPDATE contest_entries ce SET rank = r.preliminary_rank FROM ranked r WHERE ce.id = r.id;

  -- Handle pot sharing: group by (score, tb1, tb2) among top 3
  -- Tied users share the combined prize of the ranks they occupy
  FOR _r IN
    WITH entry_data AS (
      SELECT ce.user_id, ce.rank, ce.score,
        COALESCE((SELECT is_correct FROM contest_answers WHERE contest_id = _contest_id AND question_id = _tiebreaker_qid AND user_id = ce.user_id), false) as tb1,
        COALESCE((SELECT is_correct FROM contest_answers WHERE contest_id = _contest_id AND question_id = _tiebreaker_qid_2 AND user_id = ce.user_id), false) as tb2
      FROM contest_entries ce
      WHERE ce.contest_id = _contest_id AND ce.rank <= 3
    ),
    tie_groups AS (
      SELECT score, tb1, tb2,
        array_agg(user_id ORDER BY rank) as user_ids,
        array_agg(rank ORDER BY rank) as ranks,
        COUNT(*) as cnt
      FROM entry_data
      GROUP BY score, tb1, tb2
    )
    SELECT user_ids, ranks, cnt FROM tie_groups
  LOOP
    -- Sum up the prize pool for all ranks this group occupies
    _group_payout := 0;
    _prize_count := array_length(_r.ranks, 1);
    FOR _i IN 1.._prize_count
    LOOP
      _group_payout := _group_payout + CASE _r.ranks[_i]
        WHEN 1 THEN _total_pot * 0.50
        WHEN 2 THEN _total_pot * 0.30
        WHEN 3 THEN _total_pot * 0.20
        ELSE 0
      END;
    END LOOP;

    IF _prize_count = 0 OR _group_payout = 0 THEN CONTINUE; END IF;

    -- Split equally among tied users
    _payout := ROUND(_group_payout / _prize_count, 2);

    FOR _i IN 1.._prize_count
    LOOP
      UPDATE contest_entries SET payout = _payout WHERE contest_id = _contest_id AND user_id = _r.user_ids[_i];
      UPDATE profiles SET balance = balance + _payout, updated_at = now() WHERE id = _r.user_ids[_i];

      INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, metadata)
      SELECT _r.user_ids[_i], 'deposit', _payout, p.balance - _payout, p.balance, 'completed',
        jsonb_build_object('source', 'contest_payout', 'contest_id', _contest_id, 'rank', _r.ranks[_i], 'shared', _prize_count > 1)
      FROM profiles p WHERE p.id = _r.user_ids[_i];

      _winners_paid := _winners_paid + 1;
    END LOOP;
  END LOOP;

  UPDATE prediction_contests SET status = 'resolved', resolved_at = now(), resolved_by = _admin_id WHERE id = _contest_id;
  RETURN jsonb_build_object('success', true, 'total_pot', _total_pot, 'participants', _participant_count, 'winners_paid', _winners_paid);
END;
$$;
