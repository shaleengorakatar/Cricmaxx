-- Drop the existing view
DROP VIEW IF EXISTS public.leaderboard_profiles;

-- Recreate the view with SECURITY INVOKER (uses caller's permissions)
-- This ensures only authenticated users with proper profiles access can query it
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
FROM profiles
WHERE show_on_leaderboard = true;

-- Grant access only to authenticated users
REVOKE ALL ON public.leaderboard_profiles FROM anon;
REVOKE ALL ON public.leaderboard_profiles FROM public;
GRANT SELECT ON public.leaderboard_profiles TO authenticated;