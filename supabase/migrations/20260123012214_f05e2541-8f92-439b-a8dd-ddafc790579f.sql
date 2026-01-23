-- Secure materialized views by revoking public access and using RLS-protected functions
REVOKE ALL ON public.mv_leaderboard FROM anon, authenticated;
REVOKE ALL ON public.mv_market_stats FROM anon, authenticated;

-- Grant access only to service_role
GRANT SELECT ON public.mv_leaderboard TO service_role;
GRANT SELECT ON public.mv_market_stats TO service_role;

-- Create secure accessor functions for client access
CREATE OR REPLACE FUNCTION public.get_leaderboard_cached(_limit INTEGER DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'username', username,
        'display_name', display_name,
        'avatar_url', avatar_url,
        'rating_score', rating_score,
        'predictions_total', predictions_total,
        'predictions_correct', predictions_correct,
        'win_rate', win_rate,
        'rank', rank
      )
    )
    FROM (SELECT * FROM mv_leaderboard ORDER BY rank LIMIT _limit) l
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_market_stats_cached(_category TEXT DEFAULT NULL, _status TEXT DEFAULT NULL, _limit INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'market_id', market_id,
        'question', question,
        'category', category,
        'status', status,
        'yes_price', yes_price,
        'no_price', no_price,
        'volume', volume,
        'unique_traders', unique_traders,
        'total_orders', total_orders,
        'filled_volume', filled_volume
      )
    )
    FROM (
      SELECT * FROM mv_market_stats
      WHERE (_category IS NULL OR category = _category)
        AND (_status IS NULL OR status = _status)
      ORDER BY volume DESC
      LIMIT _limit
    ) m
  ), '[]'::jsonb);
END;
$$;