-- Add rating fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS rating_score integer NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS predictions_total integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS predictions_correct integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS show_on_leaderboard boolean NOT NULL DEFAULT true;

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_profiles_rating_score ON public.profiles(rating_score DESC) WHERE show_on_leaderboard = true;

-- Add RLS policy for viewing leaderboard profiles
CREATE POLICY "Anyone can view public leaderboard profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (show_on_leaderboard = true);

-- Enable realtime for profiles rating updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;