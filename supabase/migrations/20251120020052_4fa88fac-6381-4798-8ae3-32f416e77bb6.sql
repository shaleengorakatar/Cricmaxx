-- Fix RESTRICTIVE RLS policies by explicitly creating AS PERMISSIVE policies
-- This migration corrects the incomplete fix from 20251120014740

-- ============================================
-- 1. POSITIONS TABLE - Fix all SELECT policies
-- ============================================

DROP POLICY IF EXISTS "Users can view their own positions" ON public.positions;
DROP POLICY IF EXISTS "Users can view friends' positions if sharing enabled" ON public.positions;
DROP POLICY IF EXISTS "Admins can view all positions" ON public.positions;

CREATE POLICY "Users can view their own positions"
ON public.positions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends' positions if sharing enabled"
ON public.positions
AS PERMISSIVE
FOR SELECT
TO authenticated
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

CREATE POLICY "Admins can view all positions"
ON public.positions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- 2. MARKETS TABLE - Fix all SELECT policies
-- ============================================

DROP POLICY IF EXISTS "Anyone can view approved/open markets" ON public.markets;
DROP POLICY IF EXISTS "Creators can view own pending markets" ON public.markets;
DROP POLICY IF EXISTS "Admins can view all markets" ON public.markets;

CREATE POLICY "Anyone can view approved/open markets"
ON public.markets
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (status IN ('approved', 'open', 'closed', 'resolved'));

CREATE POLICY "Creators can view own pending markets"
ON public.markets
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Admins can view all markets"
ON public.markets
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- 3. FRIEND_INVITE_TOKENS TABLE - Fix SELECT policy
-- ============================================

DROP POLICY IF EXISTS "Users can view their own invite tokens" ON public.friend_invite_tokens;

CREATE POLICY "Users can view their own invite tokens"
ON public.friend_invite_tokens
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Note: "Anyone can view valid unexpired tokens" policy remains as-is for public invite access