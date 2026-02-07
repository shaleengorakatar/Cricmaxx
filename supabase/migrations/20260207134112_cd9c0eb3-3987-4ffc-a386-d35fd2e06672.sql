-- Fix trades table RLS policies
-- Current problem: ALL policies are RESTRICTIVE, which means ALL must pass simultaneously.
-- The "Deny anonymous access" policy uses `false`, blocking everyone including admins.

-- Drop all existing SELECT policies
DROP POLICY IF EXISTS "Admins can view all trades" ON public.trades;
DROP POLICY IF EXISTS "Buyers can view own trades" ON public.trades;
DROP POLICY IF EXISTS "Sellers can view own trades" ON public.trades;
DROP POLICY IF EXISTS "Deny anonymous access to trades" ON public.trades;

-- Recreate as PERMISSIVE (default) — any ONE passing grants access

-- Admins can see everything
CREATE POLICY "Admins can view all trades"
ON public.trades FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Buyers can see their own trades
CREATE POLICY "Buyers can view own trades"
ON public.trades FOR SELECT
USING (auth.uid() = buyer_id);

-- Sellers can see their own trades
CREATE POLICY "Sellers can view own trades"
ON public.trades FOR SELECT
USING (auth.uid() = seller_id);

-- All authenticated users can view trade data for active markets
-- (needed for live trade feeds, price calculations, activity feeds)
-- Anonymous users are excluded by auth.uid() IS NOT NULL
CREATE POLICY "Authenticated users can view trades for active markets"
ON public.trades FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM markets
    WHERE markets.id = trades.market_id
    AND markets.status IN ('approved', 'open', 'closed', 'resolved')
  )
);