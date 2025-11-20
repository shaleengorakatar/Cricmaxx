import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CricketProxyRequest {
  endpoint: 'currentMatches' | 'series' | 'match_info';
  params?: Record<string, string | number>;
}

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Rate limiting: Track requests per user
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_HOUR = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const userLimit = rateLimits.get(userId);

  // Reset if window expired
  if (!userLimit || now > userLimit.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimits.set(userId, { count: 1, resetAt });
    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - 1, resetAt };
  }

  // Check if limit exceeded
  if (userLimit.count >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, remaining: 0, resetAt: userLimit.resetAt };
  }

  // Increment counter
  userLimit.count++;
  return { 
    allowed: true, 
    remaining: MAX_REQUESTS_PER_HOUR - userLimit.count, 
    resetAt: userLimit.resetAt 
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      throw new Error('Unauthorized');
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetAt).toISOString();
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: `Maximum ${MAX_REQUESTS_PER_HOUR} requests per hour. Resets at ${resetDate}`,
          resetAt: resetDate
        }),
        {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': MAX_REQUESTS_PER_HOUR.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString()
          },
          status: 429,
        }
      );
    }

    // Parse request
    const { endpoint, params = {} }: CricketProxyRequest = await req.json();

    // Validate endpoint
    const validEndpoints = ['currentMatches', 'series', 'match_info'];
    if (!validEndpoints.includes(endpoint)) {
      throw new Error(`Invalid endpoint: ${endpoint}`);
    }

    // Build cache key
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    const now = Date.now();

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && now < cached.expires) {
      console.log(`Cache hit for ${cacheKey}`);
      return new Response(JSON.stringify(cached.data), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-RateLimit-Limit': MAX_REQUESTS_PER_HOUR.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString()
        },
        status: 200,
      });
    }

    // Get API key from secrets (NOT exposed to client)
    const apiKey = Deno.env.get('CRICAPI_KEY');
    if (!apiKey) {
      console.error('CRICAPI_KEY not configured');
      throw new Error('CricAPI key not configured');
    }

    // Build URL with server-side secret
    const baseUrl = `https://api.cricapi.com/v1/${endpoint}`;
    const urlParams = new URLSearchParams({ apikey: apiKey, ...params as any });
    const url = `${baseUrl}?${urlParams}`;

    console.log(`Fetching from CricAPI: ${endpoint} with params:`, params);

    // Make request to CricAPI
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CricAPI returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Store in cache
    cache.set(cacheKey, { data, expires: now + CACHE_TTL_MS });
    console.log(`Cached response for ${cacheKey} (TTL: ${CACHE_TTL_MS}ms)`);

    // Clean up old cache entries periodically
    if (cache.size > 100) {
      for (const [key, value] of cache.entries()) {
        if (now > value.expires) {
          cache.delete(key);
        }
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-RateLimit-Limit': MAX_REQUESTS_PER_HOUR.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetAt.toString()
      },
      status: 200,
    });

  } catch (error) {
    console.error('Cricket proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: errorMessage === 'Unauthorized' ? 401 : 400,
      }
    );
  }
});
