-- Drop and recreate materialized view with 'name' column
DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard;

CREATE MATERIALIZED VIEW mv_leaderboard AS
SELECT 
  id,
  username,
  display_name,
  name,
  avatar_url,
  rating_score,
  predictions_total,
  predictions_correct,
  show_on_leaderboard,
  CASE
    WHEN predictions_total > 0 THEN round(predictions_correct::numeric / predictions_total::numeric * 100::numeric, 2)
    ELSE 0::numeric
  END AS win_rate,
  rank() OVER (ORDER BY rating_score DESC) AS rank
FROM profiles p
WHERE show_on_leaderboard = true AND predictions_total > 0
ORDER BY rating_score DESC;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS mv_leaderboard_id_idx ON mv_leaderboard (id);

-- Update the RPC to use COALESCE(display_name, name) for display
CREATE OR REPLACE FUNCTION get_leaderboard_cached(_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'username', username,
        'display_name', COALESCE(display_name, name),
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

-- Update refresh function
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard;
END;
$$;