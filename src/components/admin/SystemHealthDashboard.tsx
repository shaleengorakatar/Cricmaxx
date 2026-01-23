import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  Loader2, 
  Database, 
  Zap, 
  Users, 
  TrendingUp, 
  Clock, 
  Server,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

interface SystemHealth {
  cache: {
    total_entries: number;
    active_entries: number;
    expired_entries: number;
    by_type: Record<string, number>;
  };
  queue: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    avg_retry_count: number;
    oldest_pending: string | null;
  };
  database: {
    markets_count: number;
    active_markets: number;
    orders_count: number;
    pending_orders: number;
    positions_count: number;
    trades_today: number;
    transactions_today: number;
  };
  users: {
    total_users: number;
    active_today: number;
    active_week: number;
    with_balance: number;
    total_balance: number;
  };
  market_activity: {
    total_volume_24h: number;
    unique_traders_24h: number;
    avg_trade_size: number;
  };
  timestamp: string;
}

interface RateLimitStats {
  active_limits: number;
  users_rate_limited: number;
  by_operation: Array<{
    operation_type: string;
    total_attempts: number;
    users_affected: number;
    max_attempts: number;
  }>;
  generated_at: string;
}

interface CacheAnalytics {
  entries_by_type: Array<{
    type: string;
    count: number;
    avg_ttl_remaining: number;
  }>;
  hourly_activity: Array<{
    hour: string;
    entries_created: number;
  }>;
  total_active: number;
  total_expired: number;
}

interface QueueAnalytics {
  status_breakdown: Array<{
    status: string;
    count: number;
    avg_retries: number;
  }>;
  hourly_throughput: Array<{
    hour: string;
    processed: number;
    failed: number;
  }>;
  avg_processing_time_ms: number;
  failure_rate: number;
}

const SystemHealthDashboard = () => {
  const { toast } = useToast();

  // Fetch system health
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: async (): Promise<SystemHealth | null> => {
      const { data, error } = await supabase.rpc('get_system_health');
      if (error) throw error;
      return data as unknown as SystemHealth;
    },
    refetchInterval: 30000,
  });

  // Fetch cache analytics
  const { data: cacheAnalytics, isLoading: cacheLoading } = useQuery({
    queryKey: ['cache-analytics'],
    queryFn: async (): Promise<CacheAnalytics | null> => {
      const { data, error } = await supabase.rpc('get_cache_analytics', { _hours: 24 });
      if (error) throw error;
      return data as unknown as CacheAnalytics;
    },
    refetchInterval: 60000,
  });

  // Fetch queue analytics
  const { data: queueAnalytics, isLoading: queueLoading } = useQuery({
    queryKey: ['queue-analytics'],
    queryFn: async (): Promise<QueueAnalytics | null> => {
      const { data, error } = await supabase.rpc('get_queue_analytics', { _hours: 24 });
      if (error) throw error;
      return data as unknown as QueueAnalytics;
    },
    refetchInterval: 30000,
  });

  // Fetch rate limit stats
  const { data: rateLimitStats } = useQuery({
    queryKey: ['rate-limit-stats'],
    queryFn: async (): Promise<RateLimitStats | null> => {
      const { data, error } = await supabase.rpc('get_rate_limit_stats');
      if (error) throw error;
      return data as unknown as RateLimitStats;
    },
    refetchInterval: 30000,
  });

  const handleRefresh = () => {
    refetchHealth();
    toast({
      title: "Refreshing metrics",
      description: "System health data is being updated...",
    });
  };

  const getHealthStatus = () => {
    if (!health) return 'unknown';
    const failureRate = queueAnalytics?.failure_rate ?? 0;
    const pendingQueue = health.queue.pending ?? 0;
    
    if (failureRate > 10 || pendingQueue > 100) return 'critical';
    if (failureRate > 5 || pendingQueue > 50) return 'warning';
    return 'healthy';
  };

  const healthStatus = getHealthStatus();

  if (healthLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Status Header */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Status
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant={healthStatus === 'healthy' ? 'default' : healthStatus === 'warning' ? 'secondary' : 'destructive'}
                className="flex items-center gap-1"
              >
                {healthStatus === 'healthy' && <CheckCircle className="h-3 w-3" />}
                {healthStatus === 'warning' && <AlertCircle className="h-3 w-3" />}
                {healthStatus === 'critical' && <XCircle className="h-3 w-3" />}
                {healthStatus.toUpperCase()}
              </Badge>
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Last updated: {health?.timestamp ? format(new Date(health.timestamp), 'MMM d, h:mm:ss a') : 'Unknown'}
          </p>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Active Users</span>
            </div>
            <p className="text-2xl font-bold">{health?.users.active_today ?? 0}</p>
            <p className="text-xs text-muted-foreground">of {health?.users.total_users ?? 0} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">24h Volume</span>
            </div>
            <p className="text-2xl font-bold">
              ${(health?.market_activity.total_volume_24h ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {health?.market_activity.unique_traders_24h ?? 0} traders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Active Markets</span>
            </div>
            <p className="text-2xl font-bold">{health?.database.active_markets ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {health?.database.pending_orders ?? 0} pending orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Trades Today</span>
            </div>
            <p className="text-2xl font-bold">{health?.database.trades_today ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              avg ${(health?.market_activity.avg_trade_size ?? 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cache & Queue Status */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Cache Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Distributed Cache
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Active Entries</p>
                <p className="text-xl font-bold text-green-600">
                  {cacheAnalytics?.total_active ?? health?.cache.active_entries ?? 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-xl font-bold text-muted-foreground">
                  {cacheAnalytics?.total_expired ?? health?.cache.expired_entries ?? 0}
                </p>
              </div>
            </div>

            {cacheAnalytics?.entries_by_type && cacheAnalytics.entries_by_type.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">By Type</p>
                {cacheAnalytics.entries_by_type.map((entry) => (
                  <div key={entry.type} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{entry.type}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{entry.count}</Badge>
                      <span className="text-xs text-muted-foreground">
                        TTL: {Math.round(entry.avg_ttl_remaining)}s
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(!cacheAnalytics?.entries_by_type || cacheAnalytics.entries_by_type.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active cache entries
              </p>
            )}
          </CardContent>
        </Card>

        {/* Queue Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Order Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-bold text-yellow-600">
                  {health?.queue.pending ?? 0}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Processing</p>
                <p className="text-lg font-bold text-blue-600">
                  {health?.queue.processing ?? 0}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-lg font-bold text-red-600">
                  {health?.queue.failed ?? 0}
                </p>
              </div>
            </div>

            {queueAnalytics && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Processing Time</span>
                    <span className="font-medium">
                      {queueAnalytics.avg_processing_time_ms ?? 0}ms
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Failure Rate (24h)</span>
                    <span className={`font-medium ${(queueAnalytics.failure_rate ?? 0) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                      {queueAnalytics.failure_rate ?? 0}%
                    </span>
                  </div>
                </div>

                {(queueAnalytics.failure_rate ?? 0) > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Failure Rate</p>
                    <Progress 
                      value={Math.min(queueAnalytics.failure_rate ?? 0, 100)} 
                      className="h-2"
                    />
                  </div>
                )}
              </>
            )}

            {health?.queue.oldest_pending && (
              <div className="text-xs text-muted-foreground">
                Oldest pending: {format(new Date(health.queue.oldest_pending), 'MMM d, h:mm a')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Database Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Markets</p>
              <p className="text-xl font-bold">{health?.database.markets_count ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-xl font-bold">{health?.database.orders_count ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open Positions</p>
              <p className="text-xl font-bold">{health?.database.positions_count ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transactions (24h)</p>
              <p className="text-xl font-bold">{health?.database.transactions_today ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Statistics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-xl font-bold">{health?.users.total_users ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Today</p>
              <p className="text-xl font-bold text-green-600">{health?.users.active_today ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active (7d)</p>
              <p className="text-xl font-bold">{health?.users.active_week ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">With Balance</p>
              <p className="text-xl font-bold">{health?.users.with_balance ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <p className="text-xl font-bold">
                ${(health?.users.total_balance ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting & Scalability Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Rate Limiting & Scalability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Active Rate Limits</p>
              <p className="text-xl font-bold">{rateLimitStats?.active_limits ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Users Rate Limited</p>
              <p className={`text-xl font-bold ${(rateLimitStats?.users_rate_limited ?? 0) > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                {rateLimitStats?.users_rate_limited ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Queue Pending</p>
              <p className={`text-xl font-bold ${(health?.queue.pending ?? 0) > 10 ? 'text-yellow-600' : ''}`}>
                {health?.queue.pending ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Processing</p>
              <p className="text-xl font-bold">{queueAnalytics?.avg_processing_time_ms ?? 0}ms</p>
            </div>
          </div>

          {rateLimitStats?.by_operation && rateLimitStats.by_operation.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Rate Limits by Operation</p>
              <div className="grid gap-2">
                {rateLimitStats.by_operation.map((op) => (
                  <div key={op.operation_type} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                    <span className="font-medium">{op.operation_type.replace('_', ' ')}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{op.users_affected} users</span>
                      <Badge variant={op.max_attempts >= 10 ? "destructive" : "secondary"}>
                        {op.total_attempts} attempts
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Scalability Config:</strong> Rate limit: 10 orders/min per user • 
              Read-replica ready analytics • Optimized connection pooling • 
              Batch query functions for high throughput
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemHealthDashboard;