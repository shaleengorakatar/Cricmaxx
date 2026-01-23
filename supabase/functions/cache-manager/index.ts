import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache TTL configurations (in seconds)
const CACHE_CONFIG = {
  market_prices: 5,      // 5 seconds for real-time prices
  leaderboard: 60,       // 1 minute for leaderboard
  market_list: 30,       // 30 seconds for market listings
  user_position: 10,     // 10 seconds for user positions
};

interface CacheRequest {
  action: 'get' | 'set' | 'invalidate' | 'get_market_prices' | 'get_leaderboard' | 'cleanup';
  key?: string;
  data?: unknown;
  ttl?: number;
  marketId?: string;
  limit?: number;
}

function getCacheKey(type: string, identifier?: string): string {
  return identifier ? `${type}:${identifier}` : type;
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
        
        // Check distributed cache first
        const { data: cacheResult, error: cacheError } = await supabaseAdmin
          .rpc('cache_get_or_set', {
            _cache_key: cacheKey,
            _cache_type: 'market_prices',
            _ttl_seconds: CACHE_CONFIG.market_prices
          });

        if (!cacheError && cacheResult?.hit) {
          return new Response(
            JSON.stringify({ success: true, data: cacheResult.data, cached: true }),
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

        // Store in distributed cache
        await supabaseAdmin.rpc('cache_set', {
          _cache_key: cacheKey,
          _cache_type: 'market_prices',
          _data: market,
          _ttl_seconds: CACHE_CONFIG.market_prices
        });

        return new Response(
          JSON.stringify({ success: true, data: market, cached: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_leaderboard': {
        const cacheKey = getCacheKey('leaderboard', `top_${limit}`);
        
        // Check distributed cache first
        const { data: cacheResult, error: cacheError } = await supabaseAdmin
          .rpc('cache_get_or_set', {
            _cache_key: cacheKey,
            _cache_type: 'leaderboard',
            _ttl_seconds: CACHE_CONFIG.leaderboard
          });

        if (!cacheError && cacheResult?.hit) {
          return new Response(
            JSON.stringify({ success: true, data: cacheResult.data, cached: true }),
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

        // Store in distributed cache
        await supabaseAdmin.rpc('cache_set', {
          _cache_key: cacheKey,
          _cache_type: 'leaderboard',
          _data: leaderboard,
          _ttl_seconds: CACHE_CONFIG.leaderboard
        });

        return new Response(
          JSON.stringify({ success: true, data: leaderboard, cached: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get': {
        if (!key) throw new Error('key required for get action');
        
        const { data: cacheResult } = await supabaseAdmin
          .rpc('cache_get_or_set', {
            _cache_key: key,
            _cache_type: 'custom',
            _ttl_seconds: 60
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: cacheResult?.data ?? null, 
            found: cacheResult?.hit ?? false 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'set': {
        if (!key || data === undefined) {
          throw new Error('key and data required for set action');
        }
        
        const cacheTtl = ttl || 60;
        
        await supabaseAdmin.rpc('cache_set', {
          _cache_key: key,
          _cache_type: 'custom',
          _data: data,
          _ttl_seconds: cacheTtl
        });
        
        return new Response(
          JSON.stringify({ success: true, message: 'Cached successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'invalidate': {
        if (!key) throw new Error('key required for invalidate action');
        
        const { data: deletedCount } = await supabaseAdmin
          .rpc('cache_invalidate', { _key_prefix: key });
        
        return new Response(
          JSON.stringify({ success: true, message: 'Cache invalidated', deleted: deletedCount }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cleanup': {
        const { data: deletedCount } = await supabaseAdmin
          .rpc('cache_cleanup');
        
        return new Response(
          JSON.stringify({ success: true, message: 'Expired cache entries cleaned', deleted: deletedCount }),
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
