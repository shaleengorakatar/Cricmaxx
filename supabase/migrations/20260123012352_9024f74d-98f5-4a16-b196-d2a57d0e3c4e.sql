-- Create system metrics table to track performance data
CREATE TABLE public.system_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient metric queries
CREATE INDEX idx_system_metrics_type_time ON public.system_metrics(metric_type, recorded_at DESC);
CREATE INDEX idx_system_metrics_name_time ON public.system_metrics(metric_name, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

-- Only service role can write metrics
CREATE POLICY "Service role can manage metrics"
  ON public.system_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read metrics
CREATE POLICY "Admins can read metrics"
  ON public.system_metrics
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Function to get comprehensive system health metrics
CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cache_stats JSONB;
  _queue_stats JSONB;
  _db_stats JSONB;
  _user_stats JSONB;
  _market_stats JSONB;
BEGIN
  -- Cache statistics
  SELECT jsonb_build_object(
    'total_entries', COUNT(*),
    'active_entries', COUNT(*) FILTER (WHERE expires_at > now()),
    'expired_entries', COUNT(*) FILTER (WHERE expires_at <= now()),
    'by_type', jsonb_object_agg(cache_type, type_count)
  ) INTO _cache_stats
  FROM (
    SELECT cache_type, COUNT(*) as type_count
    FROM distributed_cache
    GROUP BY cache_type
  ) types
  CROSS JOIN (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE expires_at > now()) as active,
      COUNT(*) FILTER (WHERE expires_at <= now()) as expired
    FROM distributed_cache
  ) totals;

  -- Queue statistics
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'processing', COUNT(*) FILTER (WHERE status = 'processing'),
    'completed', COUNT(*) FILTER (WHERE status = 'completed'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'avg_retry_count', ROUND(AVG(retry_count)::numeric, 2),
    'oldest_pending', MIN(created_at) FILTER (WHERE status = 'pending')
  ) INTO _queue_stats
  FROM order_queue;

  -- Database table stats
  SELECT jsonb_build_object(
    'markets_count', (SELECT COUNT(*) FROM markets),
    'active_markets', (SELECT COUNT(*) FROM markets WHERE status = 'active'),
    'orders_count', (SELECT COUNT(*) FROM orders),
    'pending_orders', (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'partial')),
    'positions_count', (SELECT COUNT(*) FROM positions WHERE status = 'open'),
    'trades_today', (SELECT COUNT(*) FROM trades WHERE created_at > now() - interval '24 hours'),
    'transactions_today', (SELECT COUNT(*) FROM transactions WHERE created_at > now() - interval '24 hours')
  ) INTO _db_stats;

  -- User statistics
  SELECT jsonb_build_object(
    'total_users', COUNT(*),
    'active_today', COUNT(*) FILTER (WHERE last_active_at > now() - interval '24 hours'),
    'active_week', COUNT(*) FILTER (WHERE last_active_at > now() - interval '7 days'),
    'with_balance', COUNT(*) FILTER (WHERE balance > 0),
    'total_balance', COALESCE(SUM(balance), 0)
  ) INTO _user_stats
  FROM profiles;

  -- Market activity
  SELECT jsonb_build_object(
    'total_volume_24h', COALESCE(SUM(t.quantity * t.price), 0),
    'unique_traders_24h', COUNT(DISTINCT COALESCE(t.buyer_id, t.seller_id)),
    'avg_trade_size', ROUND(AVG(t.quantity)::numeric, 2)
  ) INTO _market_stats
  FROM trades t
  WHERE t.created_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'cache', COALESCE(_cache_stats, '{}'::jsonb),
    'queue', COALESCE(_queue_stats, '{}'::jsonb),
    'database', COALESCE(_db_stats, '{}'::jsonb),
    'users', COALESCE(_user_stats, '{}'::jsonb),
    'market_activity', COALESCE(_market_stats, '{}'::jsonb),
    'timestamp', now()
  );
END;
$$;

-- Function to get detailed cache analytics
CREATE OR REPLACE FUNCTION public.get_cache_analytics(_hours INTEGER DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'entries_by_type', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', cache_type,
        'count', cnt,
        'avg_ttl_remaining', ttl_remaining
      )), '[]'::jsonb)
      FROM (
        SELECT 
          cache_type,
          COUNT(*) as cnt,
          ROUND(AVG(EXTRACT(EPOCH FROM (expires_at - now())))::numeric, 0) as ttl_remaining
        FROM distributed_cache
        WHERE expires_at > now()
        GROUP BY cache_type
      ) t
    ),
    'hourly_activity', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'hour', hour,
        'entries_created', cnt
      ) ORDER BY hour), '[]'::jsonb)
      FROM (
        SELECT 
          date_trunc('hour', created_at) as hour,
          COUNT(*) as cnt
        FROM distributed_cache
        WHERE created_at > now() - (_hours || ' hours')::interval
        GROUP BY date_trunc('hour', created_at)
      ) t
    ),
    'total_active', (SELECT COUNT(*) FROM distributed_cache WHERE expires_at > now()),
    'total_expired', (SELECT COUNT(*) FROM distributed_cache WHERE expires_at <= now())
  ) INTO _result;

  RETURN _result;
END;
$$;

-- Function to get queue analytics
CREATE OR REPLACE FUNCTION public.get_queue_analytics(_hours INTEGER DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN jsonb_build_object(
    'status_breakdown', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'status', status,
        'count', cnt,
        'avg_retries', avg_retries
      )), '[]'::jsonb)
      FROM (
        SELECT 
          status,
          COUNT(*) as cnt,
          ROUND(AVG(retry_count)::numeric, 2) as avg_retries
        FROM order_queue
        GROUP BY status
      ) t
    ),
    'hourly_throughput', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'hour', hour,
        'processed', processed,
        'failed', failed
      ) ORDER BY hour), '[]'::jsonb)
      FROM (
        SELECT 
          date_trunc('hour', completed_at) as hour,
          COUNT(*) FILTER (WHERE status = 'completed') as processed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM order_queue
        WHERE completed_at > now() - (_hours || ' hours')::interval
        GROUP BY date_trunc('hour', completed_at)
      ) t
    ),
    'avg_processing_time_ms', (
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - processed_at)) * 1000)::numeric, 0)
      FROM order_queue
      WHERE status = 'completed' AND completed_at > now() - (_hours || ' hours')::interval
    ),
    'failure_rate', (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE status = 'failed')::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
        2
      )
      FROM order_queue
      WHERE completed_at > now() - (_hours || ' hours')::interval
    )
  );
END;
$$;