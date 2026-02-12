
-- Prediction Contests (the event/competition)
CREATE TABLE public.prediction_contests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  buy_in_amount NUMERIC NOT NULL DEFAULT 10,
  total_points INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, open, closed, resolved, voided
  match_id TEXT, -- optional link to a cricket match
  match_name TEXT, -- optional match name
  closes_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  tiebreaker_question_id UUID, -- admin picks one question as tiebreaker
  min_participants INTEGER NOT NULL DEFAULT 3,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contest Questions
CREATE TABLE public.contest_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES public.prediction_contests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'yes_no', -- yes_no, multiple_choice, subjective
  options JSONB, -- for multiple_choice: ["Option A", "Option B", ...]
  points INTEGER NOT NULL DEFAULT 1,
  correct_answer TEXT, -- set by admin before/during resolution
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contest Entries (user buy-in)
CREATE TABLE public.contest_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES public.prediction_contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  payout NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contest_id, user_id)
);

-- Contest Answers (user predictions)
CREATE TABLE public.contest_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES public.prediction_contests(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.contest_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  answer TEXT NOT NULL,
  is_correct BOOLEAN,
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contest_id, question_id, user_id)
);

-- Enable RLS
ALTER TABLE public.prediction_contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_answers ENABLE ROW LEVEL SECURITY;

-- prediction_contests policies
CREATE POLICY "Anyone can view open/closed/resolved contests" ON public.prediction_contests
  FOR SELECT USING (status IN ('open', 'closed', 'resolved'));

CREATE POLICY "Admins can view all contests" ON public.prediction_contests
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert contests" ON public.prediction_contests
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update contests" ON public.prediction_contests
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- contest_questions policies
CREATE POLICY "Anyone can view questions for visible contests" ON public.contest_questions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM prediction_contests WHERE id = contest_questions.contest_id
    AND status IN ('open', 'closed', 'resolved')
  ));

CREATE POLICY "Admins can view all questions" ON public.contest_questions
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert questions" ON public.contest_questions
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update questions" ON public.contest_questions
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete questions" ON public.contest_questions
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- contest_entries policies
CREATE POLICY "Users can view entries for visible contests" ON public.contest_entries
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM prediction_contests WHERE id = contest_entries.contest_id
    AND status IN ('open', 'closed', 'resolved')
  ));

CREATE POLICY "Admins can view all entries" ON public.contest_entries
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own entry" ON public.contest_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- contest_answers policies
CREATE POLICY "Users can view own answers" ON public.contest_answers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view answers after contest resolved" ON public.contest_answers
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM prediction_contests WHERE id = contest_answers.contest_id
    AND status = 'resolved'
  ));

CREATE POLICY "Admins can view all answers" ON public.contest_answers
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own answers" ON public.contest_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own answers before close" ON public.contest_answers
  FOR UPDATE USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM prediction_contests WHERE id = contest_answers.contest_id AND status = 'open'
  ));

CREATE POLICY "Admins can update answers" ON public.contest_answers
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_prediction_contests_updated_at
  BEFORE UPDATE ON public.prediction_contests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC to join a contest (atomic buy-in)
CREATE OR REPLACE FUNCTION public.join_contest(_contest_id UUID, _user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _buy_in NUMERIC;
  _status TEXT;
  _closes_at TIMESTAMPTZ;
  _balance NUMERIC;
BEGIN
  -- Get contest info
  SELECT buy_in_amount, status, closes_at INTO _buy_in, _status, _closes_at
  FROM prediction_contests WHERE id = _contest_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF _status != 'open' THEN RAISE EXCEPTION 'Contest is not open'; END IF;
  IF _closes_at <= now() THEN RAISE EXCEPTION 'Contest has closed'; END IF;

  -- Check if already joined
  IF EXISTS (SELECT 1 FROM contest_entries WHERE contest_id = _contest_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Already joined this contest';
  END IF;

  -- Check and deduct balance
  SELECT balance INTO _balance FROM profiles WHERE id = _user_id FOR UPDATE;
  IF _balance < _buy_in THEN RAISE EXCEPTION 'Insufficient tokens. Need % tokens.', _buy_in; END IF;

  UPDATE profiles SET balance = balance - _buy_in, updated_at = now() WHERE id = _user_id;

  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, metadata)
  VALUES (_user_id, 'withdrawal', _buy_in, _balance, _balance - _buy_in, 'completed',
    jsonb_build_object('source', 'contest_buyin', 'contest_id', _contest_id));

  -- Create entry
  INSERT INTO contest_entries (contest_id, user_id) VALUES (_contest_id, _user_id);

  RETURN jsonb_build_object('success', true, 'buy_in', _buy_in, 'new_balance', _balance - _buy_in);
END;
$$;

-- RPC to resolve a contest
CREATE OR REPLACE FUNCTION public.resolve_contest(_contest_id UUID, _admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _entry RECORD;
  _question RECORD;
  _answer RECORD;
  _participant_count INTEGER;
  _min_participants INTEGER;
  _buy_in NUMERIC;
  _total_pot NUMERIC;
  _tiebreaker_qid UUID;
  _ranked RECORD;
  _payout NUMERIC;
  _winners_paid INTEGER := 0;
BEGIN
  -- Verify contest
  SELECT buy_in_amount, min_participants, tiebreaker_question_id
  INTO _buy_in, _min_participants, _tiebreaker_qid
  FROM prediction_contests WHERE id = _contest_id AND status IN ('open', 'closed');

  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found or already resolved'; END IF;

  -- Count participants
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

  -- Calculate scores for each entry
  FOR _entry IN SELECT id, user_id FROM contest_entries WHERE contest_id = _contest_id
  LOOP
    UPDATE contest_entries
    SET score = COALESCE((
      SELECT SUM(points_earned) FROM contest_answers
      WHERE contest_id = _contest_id AND user_id = _entry.user_id
    ), 0),
    total_points = COALESCE((
      SELECT SUM(points) FROM contest_questions WHERE contest_id = _contest_id AND correct_answer IS NOT NULL
    ), 0)
    WHERE id = _entry.id;
  END LOOP;

  -- If fewer than min participants, void and refund
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

  -- Rank participants: by score DESC, then tiebreaker (if they got tiebreaker right)
  -- Tiebreaker: among tied scores, those who got the tiebreaker question correct rank higher
  WITH ranked AS (
    SELECT ce.id, ce.user_id, ce.score,
      COALESCE((SELECT is_correct FROM contest_answers WHERE contest_id = _contest_id AND question_id = _tiebreaker_qid AND user_id = ce.user_id), false) as tiebreaker_correct,
      ROW_NUMBER() OVER (ORDER BY ce.score DESC, 
        COALESCE((SELECT is_correct FROM contest_answers WHERE contest_id = _contest_id AND question_id = _tiebreaker_qid AND user_id = ce.user_id), false) DESC,
        ce.created_at ASC
      ) as rank
    FROM contest_entries ce WHERE ce.contest_id = _contest_id
  )
  UPDATE contest_entries ce SET rank = r.rank
  FROM ranked r WHERE ce.id = r.id;

  -- Pay out: 1st 50%, 2nd 30%, 3rd 20%
  FOR _ranked IN
    SELECT user_id, rank FROM contest_entries WHERE contest_id = _contest_id AND rank <= 3 ORDER BY rank
  LOOP
    _payout := CASE _ranked.rank
      WHEN 1 THEN _total_pot * 0.50
      WHEN 2 THEN _total_pot * 0.30
      WHEN 3 THEN _total_pot * 0.20
      ELSE 0
    END;

    UPDATE contest_entries SET payout = _payout WHERE contest_id = _contest_id AND user_id = _ranked.user_id;
    UPDATE profiles SET balance = balance + _payout, updated_at = now() WHERE id = _ranked.user_id;

    INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, metadata)
    SELECT _ranked.user_id, 'deposit', _payout, p.balance - _payout, p.balance, 'completed',
      jsonb_build_object('source', 'contest_payout', 'contest_id', _contest_id, 'rank', _ranked.rank)
    FROM profiles p WHERE p.id = _ranked.user_id;

    _winners_paid := _winners_paid + 1;
  END LOOP;

  -- Mark resolved
  UPDATE prediction_contests SET status = 'resolved', resolved_at = now(), resolved_by = _admin_id WHERE id = _contest_id;

  RETURN jsonb_build_object('success', true, 'total_pot', _total_pot, 'participants', _participant_count, 'winners_paid', _winners_paid);
END;
$$;
