// k6 Quick Load Test - Single scenario for fast validation
// Run with: k6 run load-tests/k6-quick-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('request_latency');

const BASE_URL = __ENV.SUPABASE_URL || 'https://zuwnpyvzrvrhwnryaqhd.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1d25weXZ6cnZyaHducnlhcWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5Mjc5ODYsImV4cCI6MjA3ODUwMzk4Nn0.fxkRE-vPnKOgylS2BZnPqtMw9yXkzOG5zbYfKenoMwo';

export const options = {
  // Quick ramp-up to 100 concurrent users
  stages: [
    { duration: '30s', target: 100 },  // Ramp up
    { duration: '1m', target: 100 },   // Hold
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    errors: ['rate<0.01'],
  },
};

const headers = {
  'Content-Type': 'application/json',
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
};

export default function () {
  const start = Date.now();
  
  // Test market listing endpoint
  const res = http.get(
    `${BASE_URL}/rest/v1/markets?status=in.(approved,open)&limit=10&select=id,question,yes_price,no_price,volume,category`,
    { headers }
  );
  
  latency.add(Date.now() - start);
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => r.body && r.body.length > 2,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  errorRate.add(!success);
  
  sleep(Math.random() * 1 + 0.5);
}
