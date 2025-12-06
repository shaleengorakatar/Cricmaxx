-- Fix trades table RLS policy - restrict to trade participants only
-- Currently allows any authenticated user to view all trades

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all trades" ON public.trades;

-- Create policies that restrict visibility to trade participants and admins

-- Buyers can view their own trades
CREATE POLICY "Buyers can view own trades"
ON public.trades
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id);

-- Sellers can view their own trades
CREATE POLICY "Sellers can view own trades"
ON public.trades
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = seller_id);

-- Admins can view all trades for oversight
CREATE POLICY "Admins can view all trades"
ON public.trades
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Revoke direct access from anon
REVOKE ALL ON public.trades FROM anon;
REVOKE ALL ON public.trades FROM public;