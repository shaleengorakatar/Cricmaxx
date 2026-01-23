# RapidPred Load Testing

This directory contains k6 load testing scripts for stress testing the RapidPred platform.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Windows (chocolatey)
choco install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Running Tests

### Quick Test (2 minutes, 100 users)
```bash
k6 run load-tests/k6-quick-test.js
```

### Full Stress Test (16+ minutes, up to 1000 users)
```bash
k6 run load-tests/k6-stress-test.js
```

### With Custom Environment
```bash
k6 run \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_ANON_KEY=your-anon-key \
  load-tests/k6-stress-test.js
```

### Docker
```bash
docker run --rm -i grafana/k6 run - <load-tests/k6-quick-test.js
```

## Test Scenarios

### k6-quick-test.js
- **Duration**: ~2 minutes
- **Max Users**: 100 concurrent
- **Use Case**: Quick validation, CI/CD pipelines

### k6-stress-test.js
Contains multiple scenarios:

| Scenario | Duration | Max VUs | Purpose |
|----------|----------|---------|---------|
| Smoke | 30s | 5 | Verify system works |
| Load | 5m | 100 | Normal expected load |
| Stress | 9m | 1000 | Push beyond limits |
| Spike | 1m20s | 500 | Sudden traffic surge |

## Metrics & Thresholds

### Default Thresholds
- **P95 Response Time**: < 1000ms
- **P99 Response Time**: < 2000ms
- **Error Rate**: < 5%
- **Order Latency P95**: < 1500ms
- **Read Latency P95**: < 500ms

### Custom Metrics
- `order_latency`: Time for rate limit checks (simulating order placement)
- `read_latency`: Time for market data reads
- `errors`: Failed request rate

## Interpreting Results

After a test run, k6 outputs a summary:

```
     ✓ status is 200
     ✓ response has data
     ✓ response time < 500ms

     checks.........................: 100.00% ✓ 15000     ✗ 0
     data_received..................: 12 MB   98 kB/s
     data_sent......................: 1.5 MB  12 kB/s
     http_req_duration..............: avg=234ms min=45ms med=198ms max=1.2s p(90)=456ms p(95)=678ms
     http_reqs......................: 5000    41.67/s
     iterations.....................: 5000    41.67/s
     vus............................: 100     min=0       max=100
     vus_max........................: 100     min=100     max=100
```

### Key Metrics to Watch
- **http_req_duration p(95)**: Should be < 1s for good UX
- **http_reqs**: Requests per second throughput
- **checks**: Percentage of assertions passing
- **vus**: Virtual users (concurrent connections)

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Load Test
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: load-tests/k6-quick-test.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

## Capacity Planning

Based on test results:

| Daily Active Users | Peak Concurrent | Required Throughput |
|-------------------|-----------------|---------------------|
| 1,000 | ~50 | 50 req/s |
| 10,000 | ~500 | 200 req/s |
| 100,000 | ~5,000 | 1,000 req/s |

Current system capacity: **~400+ req/s** with sub-second P95 latency.
