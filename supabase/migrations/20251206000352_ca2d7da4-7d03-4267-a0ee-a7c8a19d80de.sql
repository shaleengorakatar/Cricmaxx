-- Drop the overly permissive public leaderboard policy that exposes emails
DROP POLICY IF EXISTS "Anyone can view public leaderboard profiles" ON public.profiles;

-- Create a secure leaderboard view that only exposes non-sensitive data
CREATE OR REPLACE VIEW public.leaderboard_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  rating_score,
  predictions_total,
  predictions_correct,
  show_on_leaderboard
FROM public.profiles
WHERE show_on_leaderboard = true;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.leaderboard_profiles TO authenticated;
GRANT SELECT ON public.leaderboard_profiles TO anon;