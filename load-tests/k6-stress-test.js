// k6 Load Test Script for RapidPred Platform
// Run with: k6 run load-tests/k6-stress-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const orderLatency = new Trend('order_latency');
const readLatency = new Trend('read_latency');

// Configuration - Update these with your actual values
const BASE_URL = __ENV.SUPABASE_URL || 'https://zuwnpyvzrvrhwnryaqhd.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1d25weXZ6cnZyaHducnlhcWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5Mjc5ODYsImV4cCI6MjA3ODUwMzk4Nn0.fxkRE-vPnKOgylS2BZnPqtMw9yXkzOG5zbYfKenoMwo';

// Test scenarios
export const options = {
  scenarios: {
    // Smoke test - verify system works
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      startTime: '0s',
      tags: { test_type: 'smoke' },
    },
    // Load test - normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },  // Ramp up to 100 users
        { duration: '3m', target: 100 },  // Stay at 100 users
        { duration: '1m', target: 0 },    // Ramp down
      ],
      startTime: '30s',
      tags: { test_type: 'load' },
    },
    // Stress test - push beyond normal limits
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },  // Ramp up to 200 users
        { duration: '3m', target: 500 },  // Push to 500 users
        { duration: '2m', target: 1000 }, // Extreme: 1000 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      startTime: '5m30s',
      tags: { test_type: 'stress' },
    },
    // Spike test - sudden traffic surge
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },  // Instant spike
        { duration: '1m', target: 500 },   // Hold spike
        { duration: '10s', target: 0 },    // Instant drop
      ],
      startTime: '15m',
      tags: { test_type: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // 95% under 1s, 99% under 2s
    errors: ['rate<0.05'], // Error rate under 5%
    order_latency: ['p(95)<1500'],
    read_latency: ['p(95)<500'],
  },
};

// Headers for Supabase requests
const headers = {
  'Content-Type': 'application/json',
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
};

// Get active markets for testing
let marketIds = [];

export function setup() {
  // Fetch active markets to use in tests
  const res = http.post(
    `${BASE_URL}/rest/v1/rpc/get_market_stats_cached`,
    JSON.stringify({ _status: 'approved', _limit: 10 }),
    { headers }
  );
  
  if (res.status === 200) {
    try {
      const data = JSON.parse(res.body);
      if (data && data.markets) {
        marketIds = data.markets.map(m => m.market_id);
      }
    } catch (e) {
      console.log('Using fallback market fetching');
    }
  }
  
  // Fallback: fetch directly from markets table
  if (marketIds.length === 0) {
    const fallbackRes = http.get(
      `${BASE_URL}/rest/v1/markets?status=in.(approved,open)&limit=10&select=id`,
      { headers }
    );
    if (fallbackRes.status === 200) {
      try {
        const markets = JSON.parse(fallbackRes.body);
        marketIds = markets.map(m => m.id);
      } catch (e) {
        console.log('Failed to parse markets');
      }
    }
  }
  
  console.log(`Setup complete. Found ${marketIds.length} markets for testing.`);
  return { marketIds };
}

export default function (data) {
  const markets = data.marketIds || [];
  
  // Randomly choose operation type (70% reads, 30% writes)
  const isRead = Math.random() < 0.7;
  
  if (isRead) {
    testReadMarket(markets);
  } else {
    testRateLimitCheck();
  }
  
  // Realistic user think time
  sleep(Math.random() * 2 + 0.5);
}

function testReadMarket(markets) {
  if (markets.length === 0) {
    // Fallback to listing markets
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/rest/v1/markets?status=in.(approved,open)&limit=5&select=id,question,yes_price,no_price,volume`,
      { headers }
    );
    readLatency.add(Date.now() - start);
    
    const success = check(res, {
      'market list status 200': (r) => r.status === 200,
      'market list has data': (r) => r.body.length > 2,
    });
    errorRate.add(!success);
    return;
  }
  
  const marketId = markets[Math.floor(Math.random() * markets.length)];
  const start = Date.now();
  
  const res = http.post(
    `${BASE_URL}/rest/v1/rpc/get_market_detail`,
    JSON.stringify({ _market_id: marketId }),
    { headers }
  );
  
  readLatency.add(Date.now() - start);
  
  const success = check(res, {
    'market detail status 200': (r) => r.status === 200,
    'market detail has data': (r) => r.body && r.body.length > 10,
  });
  
  errorRate.add(!success);
}

function testRateLimitCheck() {
  const userId = generateUUID();
  const start = Date.now();
  
  const res = http.post(
    `${BASE_URL}/rest/v1/rpc/check_rate_limit_fast`,
    JSON.stringify({
      _user_id: userId,
      _operation_type: 'k6_load_test',
      _max_attempts: 100,
      _window_minutes: 1,
    }),
    { headers }
  );
  
  orderLatency.add(Date.now() - start);
  
  const success = check(res, {
    'rate limit check status 200': (r) => r.status === 200,
  });
  
  errorRate.add(!success);
}

// Helper function to generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function teardown(data) {
  console.log('Load test complete. Cleaning up test rate limit entries...');
  
  // Note: Cleanup would typically be done via admin API or service role
  // The edge function already handles cleanup for load_test_order entries
}
