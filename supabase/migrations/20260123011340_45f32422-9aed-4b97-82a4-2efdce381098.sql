-- Fix cache_metadata to only allow service role (more restrictive policy)
DROP POLICY IF EXISTS "Service role manages cache" ON public.cache_metadata;

-- This table should only be accessed by edge functions with service role
-- Regular users cannot access this table at all
CREATE POLICY "No public access to cache metadata"
ON public.cache_metadata FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);