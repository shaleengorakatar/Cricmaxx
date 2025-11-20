-- Fix RLS policies: Convert RESTRICTIVE to PERMISSIVE by adding TO authenticated

-- 1. FIX POSITIONS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view their own positions" ON public.positions;
DROP POLICY IF EXISTS "Users can view friends' positions if sharing enabled" ON public.positions;
DROP POLICY IF EXISTS "Admins can view all positions" ON public.positions;

CREATE POLICY "Users can view their own positions"
ON public.positions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends' positions if sharing enabled"
ON public.positions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.friendships f
    INNER JOIN public.profiles p ON p.id = positions.user_id
    WHERE f.status = 'accepted'
    AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
    AND (f.user_id = positions.user_id OR f.friend_id = positions.user_id)
    AND p.share_trades_with_friends = true
  )
);

CREATE POLICY "Admins can view all positions"
ON public.positions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. FIX MARKETS TABLE POLICIES
DROP POLICY IF EXISTS "Anyone can view approved/open markets" ON public.markets;
DROP POLICY IF EXISTS "Creators can view own pending markets" ON public.markets;
DROP POLICY IF EXISTS "Admins can view all markets" ON public.markets;

CREATE POLICY "Anyone can view approved/open markets"
ON public.markets FOR SELECT
TO authenticated
USING (status IN ('approved', 'open', 'closed', 'resolved'));

CREATE POLICY "Creators can view own pending markets"
ON public.markets FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Admins can view all markets"
ON public.markets FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. FIX FRIEND_INVITE_TOKENS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view their own invite tokens" ON public.friend_invite_tokens;

CREATE POLICY "Users can view their own invite tokens"
ON public.friend_invite_tokens FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Note: "Anyone can view valid unexpired tokens" policy remains as-is for public invite link access

-- 4. FIX EXTENSION IN PUBLIC SCHEMA WARNING
-- Move extensions to dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Note: Extensions are typically managed by Supabase. This creates the schema structure.
-- If specific extensions need to be moved, they would be altered here like:
-- ALTER EXTENSION extension_name SET SCHEMA extensions;