const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CricketProxyRequest {
  endpoint: 'currentMatches' | 'series' | 'match_info' | 'series_info';
  params?: Record<string, string | number>;
}

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Rate limiting: Track requests per IP
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_HOUR = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 10000; // 10 seconds

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const clientLimit = rateLimits.get(clientId);

  // Reset if window expired
  if (!clientLimit || now > clientLimit.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimits.set(clientId, { count: 1, resetAt });
    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - 1, resetAt };
  }

  // Check if limit exceeded
  if (clientLimit.count >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, remaining: 0, resetAt: clientLimit.resetAt };
  }

  // Increment counter
  clientLimit.count++;
  return { 
    allowed: true, 
    remaining: MAX_REQUESTS_PER_HOUR - clientLimit.count, 
    resetAt: clientLimit.resetAt 
  };
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Shariz-Platform/1.0',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (retries > 0) {
      console.log(`Fetch failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`, error);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (MAX_RETRIES - retries + 1)));
      return fetchWithRetry(url, retries - 1);
    }
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client identifier for rate limiting (use IP or a header)
    const clientId = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown-client';

    // Check rate limit
    const rateLimit = checkRateLimit(clientId);
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
    const validEndpoints = ['currentMatches', 'series', 'match_info', 'series_info'];
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

    // Make request to CricAPI with retry logic
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`CricAPI error response (${response.status}):`, errorText);
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
