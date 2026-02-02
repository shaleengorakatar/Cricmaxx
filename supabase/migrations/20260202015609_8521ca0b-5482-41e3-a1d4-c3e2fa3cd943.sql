-- Allow public read access to the order_book_aggregated view
-- This view only contains aggregated market data (price levels and quantities)
-- and does not expose any user information

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON order_book_aggregated TO anon;
GRANT SELECT ON order_book_aggregated TO authenticated;

-- The view is based on the orders table, so we need to ensure the view
-- can read from orders even when the user can't directly access orders.
-- We'll create a security definer function instead.

-- Create a function that can be called by anyone to get order book data
CREATE OR REPLACE FUNCTION public.get_order_book_aggregated(market_ids uuid[])
RETURNS TABLE (
  market_id uuid,
  side text,
  price numeric,
  total_quantity numeric,
  order_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.market_id,
    o.side,
    o.price,
    SUM(o.quantity - o.filled_quantity) as total_quantity,
    COUNT(*) as order_count
  FROM orders o
  WHERE o.market_id = ANY(market_ids)
    AND o.status IN ('pending', 'partial')
    AND (o.quantity - o.filled_quantity) > 0
  GROUP BY o.market_id, o.side, o.price
  ORDER BY o.market_id, o.side, o.price;
$$;

-- Grant execute permission to everyone
GRANT EXECUTE ON FUNCTION public.get_order_book_aggregated(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_book_aggregated(uuid[]) TO authenticated;