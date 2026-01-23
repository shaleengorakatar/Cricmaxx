-- Create distributed cache table for persistent caching across edge function instances
CREATE TABLE public.distributed_cache (
  cache_key TEXT PRIMARY KEY,
  cache_type TEXT NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient cleanup of expired entries
CREATE INDEX idx_distributed_cache_expires_at ON public.distributed_cache(expires_at);

-- Index for cache type queries
CREATE INDEX idx_distributed_cache_type ON public.distributed_cache(cache_type);

-- Enable RLS (service role only access)
ALTER TABLE public.distributed_cache ENABLE ROW LEVEL SECURITY;

-- Only service role can access cache
CREATE POLICY "Service role only access to distributed cache"
  ON public.distributed_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to get or set cache with atomic upsert
CREATE OR REPLACE FUNCTION public.cache_get_or_set(
  _cache_key TEXT,
  _cache_type TEXT,
  _ttl_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cached_data JSONB;
  _expires TIMESTAMPTZ;
BEGIN
  -- Try to get valid cached data
  SELECT data INTO _cached_data
  FROM distributed_cache
  WHERE cache_key = _cache_key
    AND expires_at > now();
  
  IF FOUND THEN
    RETURN jsonb_build_object('hit', true, 'data', _cached_data);
  END IF;
  
  -- Return miss - caller should fetch and set
  RETURN jsonb_build_object('hit', false, 'data', null);
END;
$$;

-- Function to set cache entry
CREATE OR REPLACE FUNCTION public.cache_set(
  _cache_key TEXT,
  _cache_type TEXT,
  _data JSONB,
  _ttl_seconds INTEGER DEFAULT 60
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO distributed_cache (cache_key, cache_type, data, expires_at, updated_at)
  VALUES (_cache_key, _cache_type, _data, now() + (_ttl_seconds || ' seconds')::interval, now())
  ON CONFLICT (cache_key) DO UPDATE
  SET data = EXCLUDED.data,
      cache_type = EXCLUDED.cache_type,
      expires_at = EXCLUDED.expires_at,
      updated_at = now();
END;
$$;

-- Function to invalidate cache by key prefix
CREATE OR REPLACE FUNCTION public.cache_invalidate(_key_prefix TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _deleted_count INTEGER;
BEGIN
  DELETE FROM distributed_cache
  WHERE cache_key LIKE _key_prefix || '%';
  
  GET DIAGNOSTICS _deleted_count = ROW_COUNT;
  RETURN _deleted_count;
END;
$$;

-- Function to clean expired cache entries (called by cron)
CREATE OR REPLACE FUNCTION public.cache_cleanup()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _deleted_count INTEGER;
BEGIN
  DELETE FROM distributed_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS _deleted_count = ROW_COUNT;
  RETURN _deleted_count;
END;
$$;