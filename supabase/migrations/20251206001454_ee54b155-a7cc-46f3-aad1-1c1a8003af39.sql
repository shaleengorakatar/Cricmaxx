-- Fix profiles exposure: friends should NOT see email or balance
-- Create a secure view for friend profiles with only safe fields

-- Drop the policy that allows friends to see full profile data
DROP POLICY IF EXISTS "Friends can view each other profiles" ON public.profiles;

-- Create a secure view for friend profile data (no email, no balance)
CREATE OR REPLACE VIEW public.friend_profiles
WITH (security_invoker = true)
AS
SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.rating_score,
    p.predictions_total,
    p.predictions_correct,
    p.share_trades_with_friends,
    p.last_active_at
FROM profiles p
WHERE EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
    AND ((f.user_id = auth.uid() AND f.friend_id = p.id)
      OR (f.friend_id = auth.uid() AND f.user_id = p.id))
);

-- Grant access only to authenticated users
REVOKE ALL ON public.friend_profiles FROM anon;
REVOKE ALL ON public.friend_profiles FROM public;
GRANT SELECT ON public.friend_profiles TO authenticated;

-- Also revoke anon access from profiles table for extra safety
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;