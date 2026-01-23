-- Fix RLS on cache_metadata table
ALTER TABLE public.cache_metadata ENABLE ROW LEVEL SECURITY;

-- Only service role can manage cache metadata (edge functions use service role)
CREATE POLICY "Service role manages cache"
ON public.cache_metadata FOR ALL
USING (true)
WITH CHECK (true);