-- Fix order book exposure: restrict orders visibility to own orders only
-- While maintaining market transparency through aggregated views

-- Drop the overly permissive policy that allows viewing all orders
DROP POLICY IF EXISTS "Users can view all orders in a market" ON public.orders;

-- Create proper restrictive policies for orders table
-- Users can only view their own orders
CREATE POLICY "Users can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all orders for monitoring
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create an aggregated order book view without user_id for market transparency
-- This allows showing order depth without exposing who placed the orders
CREATE OR REPLACE VIEW public.order_book_aggregated
WITH (security_invoker = on)
AS
SELECT 
  market_id,
  side,
  price,
  SUM(quantity - filled_quantity) as total_quantity,
  COUNT(*) as order_count
FROM public.orders
WHERE status IN ('pending', 'partial')
  AND (quantity - filled_quantity) > 0
GROUP BY market_id, side, price
ORDER BY 
  market_id,
  side,
  CASE WHEN side = 'yes' THEN price END DESC,
  CASE WHEN side = 'no' THEN price END ASC;

-- Grant access to the aggregated view for authenticated users
GRANT SELECT ON public.order_book_aggregated TO authenticated;

-- Add comment explaining the security design
COMMENT ON VIEW public.order_book_aggregated IS 'Aggregated order book view that provides market transparency without exposing individual user trading patterns. Shows total quantity and order count at each price level without user identification.';