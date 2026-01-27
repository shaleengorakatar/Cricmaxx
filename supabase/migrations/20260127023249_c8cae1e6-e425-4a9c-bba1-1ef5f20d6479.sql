-- Add explicit denial policy for anonymous users on trades table
-- This prevents any unauthenticated access attempts

CREATE POLICY "Deny anonymous access to trades"
ON public.trades
FOR SELECT
TO anon
USING (false);

-- Note: The existing policies already restrict authenticated users to:
-- 1. Buyers can view own trades (buyer_id = auth.uid())
-- 2. Sellers can view own trades (seller_id = auth.uid())
-- 3. Admins can view all trades (has_role check)
-- These are RESTRICTIVE policies that work together to prevent data leakage