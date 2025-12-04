-- Add liquidity pool columns to markets table
ALTER TABLE public.markets 
ADD COLUMN liquidity_pool numeric NOT NULL DEFAULT 1000,
ADD COLUMN pool_yes_shares numeric NOT NULL DEFAULT 1000,
ADD COLUMN pool_no_shares numeric NOT NULL DEFAULT 1000;

-- Comment explaining the columns
COMMENT ON COLUMN public.markets.liquidity_pool IS 'Initial liquidity funding for AMM markets';
COMMENT ON COLUMN public.markets.pool_yes_shares IS 'Number of YES shares in the liquidity pool';
COMMENT ON COLUMN public.markets.pool_no_shares IS 'Number of NO shares in the liquidity pool';