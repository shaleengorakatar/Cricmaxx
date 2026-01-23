import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache with TTL
const memoryCache = new Map<string, { data: unknown; expires: number }>();

// Cache TTL configurations (in seconds)
const CACHE_CONFIG = {
  market_prices: 5,      // 5 seconds for real-time prices
  leaderboard: 60,       // 1 minute for leaderboard
  market_list: 30,       // 30 seconds for market listings
  user_position: 10,     // 10 seconds for user positions
};

interface CacheRequest {
  action: 'get' | 'set' | 'invalidate' | 'get_market_prices' | 'get_leaderboard';
  key?: string;
  data?: unknown;
  ttl?: number;
  marketId?: string;
  limit?: number;
}

function getCacheKey(type: string, identifier?: string): string {
  return identifier ? `${type}:${identifier}` : type;
}

function getFromMemory(key: string): unknown | null {
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  memoryCache.delete(key);
  return null;
}

function setInMemory(key: string, data: unknown, ttlSeconds: number): void {
  memoryCache.set(key, {
    data,
    expires: Date.now() + (ttlSeconds * 1000)
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { action, key, data, ttl, marketId, limit = 20 }: CacheRequest = await req.json();

    switch (action) {
      case 'get_market_prices': {
        if (!marketId) {
          throw new Error('marketId required for get_market_prices');
        }

        const cacheKey = getCacheKey('market_prices', marketId);
        const cached = getFromMemory(cacheKey);
        
        if (cached) {
          return new Response(
            JSON.stringify({ success: true, data: cached, cached: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch from database
        const { data: market, error } = await supabaseAdmin
          .from('markets')
          .select('id, yes_price, no_price, volume, pool_yes_shares, pool_no_shares, updated_at')
          .eq('id', marketId)
          .single();

        if (error) throw error;

        // Cache the result
        setInMemory(cacheKey, market, CACHE_CONFIG.market_prices);

        // Update cache metadata
        await supabaseAdmin
          .from('cache_metadata')
          .upsert({
            cache_key: cacheKey,
            cache_type: 'market_prices',
            last_updated: new Date().toISOString(),
            ttl_seconds: CACHE_CONFIG.market_prices
          });

        return new Response(
          JSON.stringify({ success: true, data: market, cached: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_leaderboard': {
        const cacheKey = getCacheKey('leaderboard', `top_${limit}`);
        const cached = getFromMemory(cacheKey);
        
        if (cached) {
          return new Response(
            JSON.stringify({ success: true, data: cached, cached: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch from secure view
        const { data: leaderboard, error } = await supabaseAdmin
          .from('leaderboard_profiles')
          .select('*')
          .order('rating_score', { ascending: false })
          .limit(limit);

        if (error) throw error;

        // Cache the result
        setInMemory(cacheKey, leaderboard, CACHE_CONFIG.leaderboard);

        // Update cache metadata
        await supabaseAdmin
          .from('cache_metadata')
          .upsert({
            cache_key: cacheKey,
            cache_type: 'leaderboard',
            last_updated: new Date().toISOString(),
            ttl_seconds: CACHE_CONFIG.leaderboard
          });

        return new Response(
          JSON.stringify({ success: true, data: leaderboard, cached: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get': {
        if (!key) throw new Error('key required for get action');
        
        const cached = getFromMemory(key);
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: cached, 
            found: cached !== null 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'set': {
        if (!key || data === undefined) {
          throw new Error('key and data required for set action');
        }
        
        const cacheTtl = ttl || 60;
        setInMemory(key, data, cacheTtl);
        
        return new Response(
          JSON.stringify({ success: true, message: 'Cached successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'invalidate': {
        if (!key) throw new Error('key required for invalidate action');
        
        // Invalidate matching keys
        for (const [k] of memoryCache) {
          if (k.startsWith(key)) {
            memoryCache.delete(k);
          }
        }
        
        return new Response(
          JSON.stringify({ success: true, message: 'Cache invalidated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Cache manager error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
