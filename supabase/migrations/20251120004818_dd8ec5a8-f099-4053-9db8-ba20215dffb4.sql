-- Create markets table to store all prediction markets
CREATE TABLE public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('orderbook', 'amm')),
  yes_price NUMERIC NOT NULL DEFAULT 0.50 CHECK (yes_price >= 0 AND yes_price <= 1),
  no_price NUMERIC NOT NULL DEFAULT 0.50 CHECK (no_price >= 0 AND no_price <= 1),
  volume NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'open', 'closed', 'resolved')),
  expiry_time TIMESTAMPTZ NOT NULL,
  resolution_time TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('yes', 'no', 'void')),
  image_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT markets_prices_sum CHECK (yes_price + no_price = 1)
);

-- Create oracle rules table for automated market resolution
CREATE TABLE public.market_oracle_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  event_template TEXT NOT NULL,
  match_id TEXT NOT NULL,
  match_name TEXT NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('player', 'team')),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  stat_field TEXT NOT NULL,
  comparison_operator TEXT NOT NULL CHECK (comparison_operator IN ('>', '>=', '==', '<', '<=')),
  threshold_value NUMERIC NOT NULL,
  outcome_if_true TEXT NOT NULL CHECK (outcome_if_true IN ('yes', 'no')),
  outcome_if_false TEXT NOT NULL CHECK (outcome_if_false IN ('yes', 'no')),
  data_source_url TEXT NOT NULL,
  resolution_status TEXT NOT NULL DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'failed', 'manual_review')),
  resolved_at TIMESTAMPTZ,
  resolution_value NUMERIC,
  resolution_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_oracle_rules ENABLE ROW LEVEL SECURITY;

-- Markets policies
CREATE POLICY "Anyone can view approved/open markets"
ON public.markets FOR SELECT
USING (status IN ('approved', 'open', 'closed', 'resolved'));

CREATE POLICY "Creators can create markets"
ON public.markets FOR INSERT
WITH CHECK (has_role(auth.uid(), 'creator'));

CREATE POLICY "Creators can view own pending markets"
ON public.markets FOR SELECT
USING (created_by = auth.uid());

CREATE POLICY "Admins can view all markets"
ON public.markets FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update markets"
ON public.markets FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Oracle rules policies
CREATE POLICY "Creators can create oracle rules"
ON public.market_oracle_rules FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.markets 
  WHERE id = market_id AND created_by = auth.uid()
));

CREATE POLICY "Anyone can view oracle rules for approved markets"
ON public.market_oracle_rules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.markets 
  WHERE id = market_id AND status IN ('approved', 'open', 'closed', 'resolved')
));

CREATE POLICY "Admins can manage oracle rules"
ON public.market_oracle_rules FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_markets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for markets
CREATE TRIGGER update_markets_updated_at
BEFORE UPDATE ON public.markets
FOR EACH ROW
EXECUTE FUNCTION public.update_markets_updated_at();

-- Add trigger for oracle rules
CREATE TRIGGER update_oracle_rules_updated_at
BEFORE UPDATE ON public.market_oracle_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();