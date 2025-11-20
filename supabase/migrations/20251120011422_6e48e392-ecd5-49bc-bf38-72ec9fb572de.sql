-- Add username to profiles table if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS share_trades_with_friends BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- Create index on username for fast lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));

-- Create friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ensure no duplicate friendships
  CONSTRAINT unique_friendship UNIQUE (user_id, friend_id),
  -- Ensure user cannot friend themselves
  CONSTRAINT no_self_friendship CHECK (user_id != friend_id)
);

-- Create invite tokens table
CREATE TABLE IF NOT EXISTS public.friend_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create positions table for tracking trades
CREATE TABLE IF NOT EXISTS public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  size NUMERIC NOT NULL CHECK (size > 0),
  entry_price NUMERIC NOT NULL CHECK (entry_price >= 0 AND entry_price <= 1),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  pnl NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- Friendships RLS Policies
CREATE POLICY "Users can view their own friendships"
ON public.friendships FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendships"
ON public.friendships FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friendships"
ON public.friendships FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their own friendships"
ON public.friendships FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Admins can manage all friendships"
ON public.friendships FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Friend invite tokens RLS Policies
CREATE POLICY "Users can view their own invite tokens"
ON public.friend_invite_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invite tokens"
ON public.friend_invite_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view valid unexpired tokens"
ON public.friend_invite_tokens FOR SELECT
USING (expires_at > now() AND used_at IS NULL);

-- Positions RLS Policies
CREATE POLICY "Users can view their own positions"
ON public.positions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends' positions if sharing enabled"
ON public.positions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.friendships f
    INNER JOIN public.profiles p ON p.id = positions.user_id
    WHERE f.status = 'accepted'
    AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
    AND (f.user_id = positions.user_id OR f.friend_id = positions.user_id)
    AND p.share_trades_with_friends = true
  )
);

CREATE POLICY "Users can create their own positions"
ON public.positions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions"
ON public.positions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all positions"
ON public.positions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON public.friend_invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires ON public.friend_invite_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON public.positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_market_id ON public.positions(market_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON public.positions(status);

-- Create trigger for friendships updated_at
CREATE TRIGGER update_friendships_updated_at
BEFORE UPDATE ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for positions updated_at
CREATE TRIGGER update_positions_updated_at
BEFORE UPDATE ON public.positions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update last_active_at on user actions
CREATE OR REPLACE FUNCTION public.update_user_last_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_active_at = now() 
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Add trigger to update last_active_at when trades happen
CREATE TRIGGER update_last_active_on_position
AFTER INSERT ON public.positions
FOR EACH ROW
EXECUTE FUNCTION public.update_user_last_active();