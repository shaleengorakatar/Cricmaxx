-- Recreate the view with explicit SECURITY INVOKER to use the querying user's permissions
DROP VIEW IF EXISTS public.leaderboard_profiles;

CREATE VIEW public.leaderboard_profiles 
WITH (security_invoker = true)
AS
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

-- Grant access to the view
GRANT SELECT ON public.leaderboard_profiles TO authenticated;
GRANT SELECT ON public.leaderboard_profiles TO anon;