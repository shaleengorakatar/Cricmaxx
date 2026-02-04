-- Revert duplicate INSERT policies on trades table
-- The original policies "Service role can insert trades" and "System can insert trades" already existed

DROP POLICY IF EXISTS "System can insert trades" ON public.trades;
DROP POLICY IF EXISTS "Service role can insert trades" ON public.trades;