-- Add platform_fee_percent column to markets table with default 3%
ALTER TABLE public.markets 
ADD COLUMN platform_fee_percent numeric NOT NULL DEFAULT 3.00;

-- Add creator_fee_percent column for tracking creator's share (default 2%)
ALTER TABLE public.markets 
ADD COLUMN creator_fee_percent numeric NOT NULL DEFAULT 2.00;

COMMENT ON COLUMN public.markets.platform_fee_percent IS 'Platform fee percentage per trade (default 3%)';
COMMENT ON COLUMN public.markets.creator_fee_percent IS 'Creator fee percentage per trade (default 2%, but 0 if creator is admin)';