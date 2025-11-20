-- Create price alerts table
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  market_id UUID NOT NULL,
  target_price NUMERIC NOT NULL CHECK (target_price >= 0.01 AND target_price <= 0.99),
  side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  condition TEXT NOT NULL CHECK (condition IN ('above', 'below')),
  triggered BOOLEAN NOT NULL DEFAULT false,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_price_alerts_user_id ON public.price_alerts(user_id);
CREATE INDEX idx_price_alerts_market_id ON public.price_alerts(market_id);
CREATE INDEX idx_price_alerts_triggered ON public.price_alerts(triggered) WHERE NOT triggered;

-- Enable RLS
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own alerts
CREATE POLICY "Users can view own alerts"
  ON public.price_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own alerts
CREATE POLICY "Users can create own alerts"
  ON public.price_alerts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own alerts
CREATE POLICY "Users can update own alerts"
  ON public.price_alerts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own alerts
CREATE POLICY "Users can delete own alerts"
  ON public.price_alerts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_price_alerts_updated_at
  BEFORE UPDATE ON public.price_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();