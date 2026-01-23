-- Add creator tier to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS creator_tier text DEFAULT 'bronze' CHECK (creator_tier IN ('bronze', 'silver', 'gold', 'platinum')),
ADD COLUMN IF NOT EXISTS creator_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS total_creator_earnings numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_creator_volume numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS markets_created integer DEFAULT 0;

-- Create function to get creator analytics
CREATE OR REPLACE FUNCTION get_creator_analytics(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_volume', COALESCE(SUM(m.volume), 0),
    'total_earnings', COALESCE(SUM(m.volume * m.creator_fee_percent / 100), 0),
    'markets_created', COUNT(m.id),
    'markets_resolved', COUNT(m.id) FILTER (WHERE m.status = 'resolved'),
    'markets_pending', COUNT(m.id) FILTER (WHERE m.status = 'pending'),
    'markets_open', COUNT(m.id) FILTER (WHERE m.status IN ('approved', 'open')),
    'avg_volume_per_market', COALESCE(AVG(m.volume), 0),
    'top_market', (
      SELECT json_build_object('id', id, 'question', question, 'volume', volume)
      FROM markets
      WHERE created_by = _user_id
      ORDER BY volume DESC
      LIMIT 1
    ),
    'monthly_earnings', (
      SELECT COALESCE(json_agg(monthly_data ORDER BY month DESC), '[]'::json)
      FROM (
        SELECT 
          date_trunc('month', created_at)::date as month,
          SUM(volume * creator_fee_percent / 100) as earnings,
          SUM(volume) as volume,
          COUNT(*) as markets
        FROM markets
        WHERE created_by = _user_id
        GROUP BY date_trunc('month', created_at)
        ORDER BY month DESC
        LIMIT 6
      ) monthly_data
    ),
    'category_breakdown', (
      SELECT COALESCE(json_agg(cat_data), '[]'::json)
      FROM (
        SELECT 
          category,
          COUNT(*) as count,
          SUM(volume) as volume
        FROM markets
        WHERE created_by = _user_id
        GROUP BY category
      ) cat_data
    )
  ) INTO result
  FROM markets m
  WHERE m.created_by = _user_id;
  
  RETURN result;
END;
$$;

-- Create function to calculate and update creator tier
CREATE OR REPLACE FUNCTION update_creator_tier(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_vol numeric;
  market_count integer;
  new_tier text;
  base_fee numeric := 2.00;
  tier_bonus numeric := 0;
BEGIN
  -- Calculate totals
  SELECT COALESCE(SUM(volume), 0), COUNT(*)
  INTO total_vol, market_count
  FROM markets
  WHERE created_by = _user_id AND status IN ('open', 'resolved', 'closed');
  
  -- Determine tier based on volume and market count
  -- Platinum: $1M+ volume, 50+ markets
  -- Gold: $100K+ volume, 20+ markets  
  -- Silver: $10K+ volume, 5+ markets
  -- Bronze: default
  IF total_vol >= 1000000 AND market_count >= 50 THEN
    new_tier := 'platinum';
    tier_bonus := 1.0; -- +1% fee bonus
  ELSIF total_vol >= 100000 AND market_count >= 20 THEN
    new_tier := 'gold';
    tier_bonus := 0.5; -- +0.5% fee bonus
  ELSIF total_vol >= 10000 AND market_count >= 5 THEN
    new_tier := 'silver';
    tier_bonus := 0.25; -- +0.25% fee bonus
  ELSE
    new_tier := 'bronze';
    tier_bonus := 0;
  END IF;
  
  -- Update profile with tier and stats
  UPDATE profiles
  SET 
    creator_tier = new_tier,
    total_creator_volume = total_vol,
    total_creator_earnings = (
      SELECT COALESCE(SUM(volume * creator_fee_percent / 100), 0)
      FROM markets WHERE created_by = _user_id
    ),
    markets_created = market_count
  WHERE id = _user_id;
  
  RETURN new_tier;
END;
$$;

-- Create function to get creator info for market display
CREATE OR REPLACE FUNCTION get_market_creator_info(_market_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'user_id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'creator_tier', p.creator_tier,
    'creator_verified', p.creator_verified,
    'markets_created', p.markets_created,
    'total_volume', p.total_creator_volume
  ) INTO result
  FROM markets m
  JOIN profiles p ON p.id = m.created_by
  WHERE m.id = _market_id;
  
  RETURN result;
END;
$$;