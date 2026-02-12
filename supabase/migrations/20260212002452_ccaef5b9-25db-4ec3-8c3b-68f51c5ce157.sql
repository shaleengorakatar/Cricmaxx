
-- Prediction Polls
CREATE TABLE public.prediction_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  created_by UUID NOT NULL,
  closes_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  winning_option_id UUID,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  total_pool NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Poll Options
CREATE TABLE public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.prediction_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Poll Votes
CREATE TABLE public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.prediction_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount IN (5, 10, 15, 20)),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Enable RLS
ALTER TABLE public.prediction_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Prediction Polls RLS
CREATE POLICY "Anyone can view open/resolved polls" ON public.prediction_polls
  FOR SELECT USING (status IN ('open', 'closed', 'resolved'));

CREATE POLICY "Admins can view all polls" ON public.prediction_polls
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create polls" ON public.prediction_polls
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update polls" ON public.prediction_polls
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Poll Options RLS
CREATE POLICY "Anyone can view poll options" ON public.poll_options
  FOR SELECT USING (true);

CREATE POLICY "Poll creators can add options" ON public.poll_options
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM prediction_polls WHERE id = poll_id AND created_by = auth.uid())
  );

-- Poll Votes RLS
CREATE POLICY "Users can view all votes" ON public.poll_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON public.poll_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all votes" ON public.poll_votes
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Function to resolve a poll and distribute winnings
CREATE OR REPLACE FUNCTION public.resolve_poll(_poll_id UUID, _winning_option_id UUID, _admin_id UUID)
RETURNS JSONB
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

  -- Verify winning option belongs to this poll
  IF NOT EXISTS (SELECT 1 FROM poll_options WHERE id = _winning_option_id AND poll_id = _poll_id) THEN
    RAISE EXCEPTION 'Invalid winning option for this poll';
  END IF;

  -- Calculate pools
  SELECT COALESCE(SUM(amount), 0) INTO _total_pool FROM poll_votes WHERE poll_id = _poll_id;
  SELECT COALESCE(SUM(amount), 0) INTO _winning_pool FROM poll_votes WHERE poll_id = _poll_id AND option_id = _winning_option_id;
  _losing_pool := _total_pool - _winning_pool;

  -- Distribute winnings to winners proportionally
  IF _winning_pool > 0 THEN
    FOR _winner IN
      SELECT user_id, amount FROM poll_votes WHERE poll_id = _poll_id AND option_id = _winning_option_id
    LOOP
      -- Each winner gets: their stake back + proportional share of losing pool
      _payout := _winner.amount + (_winner.amount / _winning_pool) * _losing_pool;
      
      -- Credit balance
      UPDATE profiles SET balance = balance + _payout, updated_at = now() WHERE id = _winner.user_id;
      
      -- Record transaction
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

  -- Mark poll as resolved
  UPDATE prediction_polls 
  SET status = 'resolved', winning_option_id = _winning_option_id, resolved_by = _admin_id, resolved_at = now(), total_pool = _total_pool
  WHERE id = _poll_id;

  RETURN jsonb_build_object(
    'success', true,
    'total_pool', _total_pool,
    'winning_pool', _winning_pool,
    'losing_pool', _losing_pool,
    'winners_paid', _winners_paid
  );
END;
$$;

-- Trigger to update total_pool on vote
CREATE OR REPLACE FUNCTION public.update_poll_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE prediction_polls SET total_pool = (
    SELECT COALESCE(SUM(amount), 0) FROM poll_votes WHERE poll_id = NEW.poll_id
  ), updated_at = now()
  WHERE id = NEW.poll_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_poll_total_on_vote
AFTER INSERT ON public.poll_votes
FOR EACH ROW EXECUTE FUNCTION public.update_poll_total();
