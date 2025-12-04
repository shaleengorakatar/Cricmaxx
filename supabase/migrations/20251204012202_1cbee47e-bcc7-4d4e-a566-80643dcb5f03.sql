-- Create orders table for order book
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit')),
  price NUMERIC CHECK (price > 0 AND price < 1),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  filled_quantity NUMERIC NOT NULL DEFAULT 0,
  avg_fill_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'filled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create trades table to record matched trades
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  buy_order_id UUID NOT NULL REFERENCES public.orders(id),
  sell_order_id UUID NOT NULL REFERENCES public.orders(id),
  price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  buyer_side TEXT NOT NULL CHECK (buyer_side IN ('yes', 'no')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "Users can view all orders in a market"
ON public.orders FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create their own orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
ON public.orders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Trades policies
CREATE POLICY "Users can view all trades"
ON public.trades FOR SELECT
TO authenticated
USING (true);

-- Indexes for performance
CREATE INDEX idx_orders_market_status ON public.orders(market_id, status);
CREATE INDEX idx_orders_market_side_price ON public.orders(market_id, side, price);
CREATE INDEX idx_trades_market ON public.trades(market_id);

-- Enable realtime for order book
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();