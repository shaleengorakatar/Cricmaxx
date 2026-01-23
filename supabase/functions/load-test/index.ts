import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LoadTestConfig {
  concurrentUsers: number;
  operationsPerUser: number;
  testType: 'orders' | 'reads' | 'mixed';
  durationMs?: number;
}

interface TestResult {
  operation: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  statusCode?: number;
  userId?: string;
}

interface LoadTestReport {
  config: LoadTestConfig;
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    rateLimited: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    requestsPerSecond: number;
    durationMs: number;
  };
  byOperation: Record<string, {
    count: number;
    success: number;
    failed: number;
    avgLatencyMs: number;
  }>;
  errors: Array<{ error: string; count: number }>;
  rateLimitingEffectiveness: {
    usersHitLimit: number;
    totalRateLimitResponses: number;
    avgAttemptsBeforeLimit: number;
  };
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      
      if (user) {
        const { data: isAdmin } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const config: LoadTestConfig = await req.json();
    const { 
      concurrentUsers = 100, 
      operationsPerUser = 5, 
      testType = 'mixed' 
    } = config;

    // Cap for safety
    const safeUsers = Math.min(concurrentUsers, 1000);
    const safeOps = Math.min(operationsPerUser, 10);

    console.log(`Starting load test: ${safeUsers} users x ${safeOps} ops = ${safeUsers * safeOps} total requests`);

    // Get test markets (check multiple valid statuses)
    const { data: markets } = await supabase
      .from('markets')
      .select('id')
      .in('status', ['active', 'approved', 'open'])
      .limit(10);

    const marketIds = markets?.map(m => m.id) || [];
    
    if (marketIds.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No active markets for testing. Create some markets first.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create test users (simulate with UUIDs)
    const testUsers = Array.from({ length: safeUsers }, (_, i) => ({
      id: crypto.randomUUID(),
      index: i
    }));

    const results: TestResult[] = [];
    const startTime = performance.now();

    // Simulate concurrent operations
    const userPromises = testUsers.map(async (user) => {
      const userResults: TestResult[] = [];
      
      for (let op = 0; op < safeOps; op++) {
        const marketId = marketIds[Math.floor(Math.random() * marketIds.length)];
        
        let operation: string;
        let testFn: () => Promise<TestResult>;

        if (testType === 'reads' || (testType === 'mixed' && op % 3 !== 0)) {
          // Read operations (market data, prices)
          operation = 'read_market';
          testFn = async () => {
            const opStart = performance.now();
            try {
              const { data, error } = await supabase.rpc('get_market_detail', {
                _market_id: marketId
              });
              const latency = performance.now() - opStart;
              return {
                operation,
                latencyMs: latency,
                success: !error,
                error: error?.message,
                userId: user.id
              };
            } catch (e) {
              return {
                operation,
                latencyMs: performance.now() - opStart,
                success: false,
                error: e instanceof Error ? e.message : 'Unknown error',
                userId: user.id
              };
            }
          };
        } else {
          // Write operations (simulated order via rate limit check)
          operation = 'place_order_ratelimit';
          testFn = async () => {
            const opStart = performance.now();
            try {
              // Test rate limiting behavior
              const { data, error } = await supabase.rpc('check_rate_limit_fast', {
                _user_id: user.id,
                _operation_type: 'load_test_order',
                _max_attempts: 10,
                _window_minutes: 1
              });
              const latency = performance.now() - opStart;
              
              const isRateLimited = data && !data.allowed;
              
              return {
                operation,
                latencyMs: latency,
                success: !error,
                error: isRateLimited ? 'rate_limited' : error?.message,
                statusCode: isRateLimited ? 429 : 200,
                userId: user.id
              };
            } catch (e) {
              return {
                operation,
                latencyMs: performance.now() - opStart,
                success: false,
                error: e instanceof Error ? e.message : 'Unknown error',
                userId: user.id
              };
            }
          };
        }

        const result = await testFn();
        userResults.push(result);

        // Small delay between ops to simulate real usage
        await new Promise(r => setTimeout(r, Math.random() * 50));
      }
      
      return userResults;
    });

    // Execute all user simulations concurrently (in batches to avoid overwhelming)
    const batchSize = 50;
    for (let i = 0; i < userPromises.length; i += batchSize) {
      const batch = userPromises.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch);
      batchResults.forEach(userResults => results.push(...userResults));
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    // Calculate metrics
    const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
    const successfulResults = results.filter(r => r.success && r.error !== 'rate_limited');
    const failedResults = results.filter(r => !r.success);
    const rateLimitedResults = results.filter(r => r.error === 'rate_limited');

    const percentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    };

    // Group by operation
    const byOperation: Record<string, { count: number; success: number; failed: number; avgLatencyMs: number }> = {};
    results.forEach(r => {
      if (!byOperation[r.operation]) {
        byOperation[r.operation] = { count: 0, success: 0, failed: 0, avgLatencyMs: 0 };
      }
      byOperation[r.operation].count++;
      if (r.success && r.error !== 'rate_limited') {
        byOperation[r.operation].success++;
      } else {
        byOperation[r.operation].failed++;
      }
    });
    
    // Calculate avg latency per operation
    Object.keys(byOperation).forEach(op => {
      const opResults = results.filter(r => r.operation === op);
      byOperation[op].avgLatencyMs = opResults.reduce((sum, r) => sum + r.latencyMs, 0) / opResults.length;
    });

    // Error aggregation
    const errorCounts: Record<string, number> = {};
    failedResults.forEach(r => {
      const err = r.error || 'unknown';
      errorCounts[err] = (errorCounts[err] || 0) + 1;
    });

    // Rate limiting effectiveness
    const usersWithRateLimits = new Set(rateLimitedResults.map(r => r.userId)).size;
    const attemptsByUser: Record<string, number> = {};
    results.filter(r => r.operation === 'place_order_ratelimit').forEach(r => {
      if (r.userId) {
        attemptsByUser[r.userId] = (attemptsByUser[r.userId] || 0) + 1;
      }
    });
    
    const avgAttempts = Object.values(attemptsByUser).length > 0 
      ? Object.values(attemptsByUser).reduce((a, b) => a + b, 0) / Object.values(attemptsByUser).length
      : 0;

    const report: LoadTestReport = {
      config: { concurrentUsers: safeUsers, operationsPerUser: safeOps, testType },
      summary: {
        totalRequests: results.length,
        successfulRequests: successfulResults.length,
        failedRequests: failedResults.length,
        rateLimited: rateLimitedResults.length,
        avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
        p50LatencyMs: Math.round(percentile(latencies, 50)),
        p95LatencyMs: Math.round(percentile(latencies, 95)),
        p99LatencyMs: Math.round(percentile(latencies, 99)),
        minLatencyMs: Math.round(latencies[0] || 0),
        maxLatencyMs: Math.round(latencies[latencies.length - 1] || 0),
        requestsPerSecond: Math.round((results.length / durationMs) * 1000),
        durationMs: Math.round(durationMs)
      },
      byOperation,
      errors: Object.entries(errorCounts).map(([error, count]) => ({ error, count })),
      rateLimitingEffectiveness: {
        usersHitLimit: usersWithRateLimits,
        totalRateLimitResponses: rateLimitedResults.length,
        avgAttemptsBeforeLimit: Math.round(avgAttempts * 10) / 10
      },
      timestamp: new Date().toISOString()
    };

    // Clean up test rate limit entries
    await supabase
      .from('rate_limits')
      .delete()
      .eq('operation_type', 'load_test_order');

    console.log(`Load test complete: ${report.summary.requestsPerSecond} req/s, ${report.summary.avgLatencyMs}ms avg latency`);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Load test error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Load test failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
