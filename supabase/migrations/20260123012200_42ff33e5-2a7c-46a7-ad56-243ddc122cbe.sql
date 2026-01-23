-- =====================================================
-- MATERIALIZED VIEWS FOR HIGH-TRAFFIC AGGREGATIONS
-- =====================================================

-- Materialized view for leaderboard (expensive query, refresh periodically)
CREATE MATERIALIZED VIEW public.mv_leaderboard AS
SELECT 
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.rating_score,
  p.predictions_total,
  p.predictions_correct,
  p.show_on_leaderboard,
  CASE 
    WHEN p.predictions_total > 0 
    THEN ROUND((p.predictions_correct::numeric / p.predictions_total::numeric) * 100, 2)
    ELSE 0
  END as win_rate,
  RANK() OVER (ORDER BY p.rating_score DESC) as rank
FROM profiles p
WHERE p.show_on_leaderboard = true
  AND p.predictions_total > 0
ORDER BY p.rating_score DESC;

-- Index for fast leaderboard queries
CREATE UNIQUE INDEX idx_mv_leaderboard_id ON public.mv_leaderboard(id);
CREATE INDEX idx_mv_leaderboard_rank ON public.mv_leaderboard(rank);

-- Materialized view for market statistics
CREATE MATERIALIZED VIEW public.mv_market_stats AS
SELECT 
  m.id as market_id,
  m.question,
  m.category,
  m.status,
  m.yes_price,
  m.no_price,
  m.volume,
  COUNT(DISTINCT o.user_id) as unique_traders,
  COUNT(o.id) as total_orders,
  COALESCE(SUM(CASE WHEN o.status = 'filled' THEN o.filled_quantity ELSE 0 END), 0) as filled_volume,
  m.created_at,
  m.updated_at
FROM markets m
LEFT JOIN orders o ON o.market_id = m.id
GROUP BY m.id, m.question, m.category, m.status, m.yes_price, m.no_price, m.volume, m.created_at, m.updated_at;

CREATE UNIQUE INDEX idx_mv_market_stats_id ON public.mv_market_stats(market_id);
CREATE INDEX idx_mv_market_stats_category ON public.mv_market_stats(category);
CREATE INDEX idx_mv_market_stats_status ON public.mv_market_stats(status);

-- =====================================================
-- OPTIMIZED BATCH QUERY FUNCTIONS
-- =====================================================

-- Batch fetch multiple markets by IDs (single round-trip)
CREATE OR REPLACE FUNCTION public.batch_get_markets(_market_ids UUID[])
RETURNS TABLE(
  id UUID,
  question TEXT,
  description TEXT,
  category TEXT,
  status TEXT,
  yes_price NUMERIC,
  no_price NUMERIC,
  volume NUMERIC,
  expiry_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    m.id, m.question, m.description, m.category, m.status,
    m.yes_price, m.no_price, m.volume, m.expiry_time, m.created_at
  FROM markets m
  WHERE m.id = ANY(_market_ids);
$$;

-- Batch fetch user positions across multiple markets
CREATE OR REPLACE FUNCTION public.batch_get_positions(_user_id UUID, _market_ids UUID[])
RETURNS TABLE(
  market_id UUID,
  side TEXT,
  size NUMERIC,
  entry_price NUMERIC,
  current_value NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.market_id,
    p.side,
    p.size,
    p.entry_price,
    CASE 
      WHEN p.side = 'yes' THEN p.size * m.yes_price
      ELSE p.size * m.no_price
    END as current_value
  FROM positions p
  JOIN markets m ON m.id = p.market_id
  WHERE p.user_id = _user_id
    AND p.market_id = ANY(_market_ids)
    AND p.status = 'open'
    AND p.size > 0;
$$;

-- Optimized user dashboard data (single query for all dashboard stats)
CREATE OR REPLACE FUNCTION public.get_user_dashboard(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _profile RECORD;
  _positions JSONB;
  _recent_trades JSONB;
  _active_orders JSONB;
BEGIN
  -- Get profile in one query
  SELECT id, username, display_name, balance, rating_score, 
         predictions_total, predictions_correct, version
  INTO _profile
  FROM profiles
  WHERE id = _user_id;

  -- Get active positions with market info
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'market_id', p.market_id,
      'market_question', m.question,
      'side', p.side,
      'size', p.size,
      'entry_price', p.entry_price,
      'current_price', CASE WHEN p.side = 'yes' THEN m.yes_price ELSE m.no_price END,
      'unrealized_pnl', (CASE WHEN p.side = 'yes' THEN m.yes_price ELSE m.no_price END - p.entry_price) * p.size
    )
  ), '[]'::jsonb) INTO _positions
  FROM positions p
  JOIN markets m ON m.id = p.market_id
  WHERE p.user_id = _user_id AND p.status = 'open' AND p.size > 0;

  -- Get recent trades (last 10)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'market_id', t.market_id,
      'market_question', m.question,
      'buyer_side', t.buyer_side,
      'quantity', t.quantity,
      'price', t.price,
      'created_at', t.created_at
    ) ORDER BY t.created_at DESC
  ), '[]'::jsonb) INTO _recent_trades
  FROM (
    SELECT * FROM trades WHERE buyer_id = _user_id OR seller_id = _user_id ORDER BY created_at DESC LIMIT 10
  ) t
  JOIN markets m ON m.id = t.market_id;

  -- Get active orders
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'market_id', o.market_id,
      'market_question', m.question,
      'side', o.side,
      'order_type', o.order_type,
      'price', o.price,
      'quantity', o.quantity,
      'filled_quantity', o.filled_quantity,
      'status', o.status,
      'created_at', o.created_at
    )
  ), '[]'::jsonb) INTO _active_orders
  FROM orders o
  JOIN markets m ON m.id = o.market_id
  WHERE o.user_id = _user_id AND o.status IN ('pending', 'partial');

  -- Build complete result
  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', _profile.id,
      'username', _profile.username,
      'display_name', _profile.display_name,
      'balance', _profile.balance,
      'rating_score', _profile.rating_score,
      'predictions_total', _profile.predictions_total,
      'predictions_correct', _profile.predictions_correct,
      'version', _profile.version
    ),
    'positions', _positions,
    'recent_trades', _recent_trades,
    'active_orders', _active_orders,
    'total_positions', jsonb_array_length(_positions),
    'total_active_orders', jsonb_array_length(_active_orders)
  );
END;
$$;

-- Optimized market detail with all related data
CREATE OR REPLACE FUNCTION public.get_market_detail(_market_id UUID, _user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _market RECORD;
  _user_position JSONB;
  _order_book JSONB;
  _recent_trades JSONB;
BEGIN
  -- Get market details
  SELECT * INTO _market
  FROM markets
  WHERE id = _market_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Market not found');
  END IF;

  -- Get user position if user_id provided
  IF _user_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'yes_size', COALESCE(SUM(CASE WHEN side = 'yes' THEN size ELSE 0 END), 0),
      'no_size', COALESCE(SUM(CASE WHEN side = 'no' THEN size ELSE 0 END), 0),
      'yes_entry_price', COALESCE(AVG(CASE WHEN side = 'yes' THEN entry_price END), 0),
      'no_entry_price', COALESCE(AVG(CASE WHEN side = 'no' THEN entry_price END), 0)
    ) INTO _user_position
    FROM positions
    WHERE market_id = _market_id AND user_id = _user_id AND status = 'open' AND size > 0;
  END IF;

  -- Get aggregated order book (top 5 each side)
  SELECT jsonb_build_object(
    'bids', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('price', price, 'total', total_quantity) ORDER BY price DESC)
      FROM (
        SELECT price, SUM(quantity - filled_quantity) as total_quantity
        FROM orders
        WHERE market_id = _market_id AND side = 'yes' AND status IN ('pending', 'partial')
        GROUP BY price
        ORDER BY price DESC
        LIMIT 5
      ) bids
    ), '[]'::jsonb),
    'asks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('price', price, 'total', total_quantity) ORDER BY price ASC)
      FROM (
        SELECT price, SUM(quantity - filled_quantity) as total_quantity
        FROM orders
        WHERE market_id = _market_id AND side = 'no' AND status IN ('pending', 'partial')
        GROUP BY price
        ORDER BY price ASC
        LIMIT 5
      ) asks
    ), '[]'::jsonb)
  ) INTO _order_book;

  -- Get recent trades (last 20)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'buyer_side', buyer_side,
      'quantity', quantity,
      'price', price,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ), '[]'::jsonb) INTO _recent_trades
  FROM (
    SELECT id, buyer_side, quantity, price, created_at
    FROM trades
    WHERE market_id = _market_id
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  -- Build complete result
  RETURN jsonb_build_object(
    'market', jsonb_build_object(
      'id', _market.id,
      'question', _market.question,
      'description', _market.description,
      'category', _market.category,
      'status', _market.status,
      'yes_price', _market.yes_price,
      'no_price', _market.no_price,
      'volume', _market.volume,
      'pool_yes_shares', _market.pool_yes_shares,
      'pool_no_shares', _market.pool_no_shares,
      'expiry_time', _market.expiry_time,
      'created_at', _market.created_at,
      'updated_at', _market.updated_at
    ),
    'user_position', COALESCE(_user_position, '{}'::jsonb),
    'order_book', _order_book,
    'recent_trades', _recent_trades
  );
END;
$$;

-- =====================================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- =====================================================

CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_market_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_stats;
END;
$$;

-- =====================================================
-- QUERY HINTS AND PLANNER OPTIMIZATIONS
-- =====================================================

-- Add statistics targets for frequently filtered columns
ALTER TABLE markets ALTER COLUMN status SET STATISTICS 1000;
ALTER TABLE markets ALTER COLUMN category SET STATISTICS 1000;
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 1000;
ALTER TABLE positions ALTER COLUMN user_id SET STATISTICS 1000;

-- Analyze tables to update statistics
ANALYZE markets;
ANALYZE orders;
ANALYZE positions;
ANALYZE trades;
ANALYZE profiles;