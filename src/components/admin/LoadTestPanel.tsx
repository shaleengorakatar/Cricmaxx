import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  Play, 
  BarChart3, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Activity
} from "lucide-react";

interface LoadTestReport {
  config: {
    concurrentUsers: number;
    operationsPerUser: number;
    testType: string;
  };
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

const LoadTestPanel = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<LoadTestReport | null>(null);
  const [config, setConfig] = useState({
    concurrentUsers: 100,
    operationsPerUser: 5,
    testType: 'mixed' as 'orders' | 'reads' | 'mixed'
  });

  const runLoadTest = async () => {
    setIsRunning(true);
    setReport(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('load-test', {
        body: config,
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : undefined
      });

      if (response.error) {
        throw new Error(response.error.message || 'Load test failed');
      }

      setReport(response.data);
      
      toast({
        title: "Load Test Complete",
        description: `${response.data.summary.totalRequests} requests processed at ${response.data.summary.requestsPerSecond} req/s`,
      });
    } catch (error) {
      console.error('Load test error:', error);
      toast({
        title: "Load Test Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 50) return 'text-green-600';
    if (latency < 200) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSuccessRate = () => {
    if (!report) return 0;
    return (report.summary.successfulRequests / report.summary.totalRequests) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Load Test Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="users">Concurrent Users</Label>
              <Input
                id="users"
                type="number"
                min={10}
                max={1000}
                value={config.concurrentUsers}
                onChange={(e) => setConfig(c => ({ ...c, concurrentUsers: parseInt(e.target.value) || 100 }))}
                disabled={isRunning}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ops">Operations per User</Label>
              <Input
                id="ops"
                type="number"
                min={1}
                max={10}
                value={config.operationsPerUser}
                onChange={(e) => setConfig(c => ({ ...c, operationsPerUser: parseInt(e.target.value) || 5 }))}
                disabled={isRunning}
              />
            </div>
            <div className="space-y-2">
              <Label>Test Type</Label>
              <Select
                value={config.testType}
                onValueChange={(value) => setConfig(c => ({ ...c, testType: value as 'orders' | 'reads' | 'mixed' }))}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed (Orders + Reads)</SelectItem>
                  <SelectItem value="orders">Order Placement Only</SelectItem>
                  <SelectItem value="reads">Read Operations Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Total requests: <strong>{config.concurrentUsers * config.operationsPerUser}</strong>
            </p>
            <Button onClick={runLoadTest} disabled={isRunning} size="lg">
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Load Test...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Load Test
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Throughput</span>
                </div>
                <p className="text-2xl font-bold">{report.summary.requestsPerSecond}</p>
                <p className="text-xs text-muted-foreground">requests/second</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Avg Latency</span>
                </div>
                <p className={`text-2xl font-bold ${getLatencyColor(report.summary.avgLatencyMs)}`}>
                  {report.summary.avgLatencyMs}ms
                </p>
                <p className="text-xs text-muted-foreground">p95: {report.summary.p95LatencyMs}ms</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Success Rate</span>
                </div>
                <p className={`text-2xl font-bold ${getSuccessRate() >= 99 ? 'text-green-600' : getSuccessRate() >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {getSuccessRate().toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">{report.summary.successfulRequests} / {report.summary.totalRequests}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Rate Limited</span>
                </div>
                <p className="text-2xl font-bold">{report.summary.rateLimited}</p>
                <p className="text-xs text-muted-foreground">{report.rateLimitingEffectiveness.usersHitLimit} users hit limit</p>
              </CardContent>
            </Card>
          </div>

          {/* Latency Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Latency Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Min</p>
                  <p className="text-lg font-bold">{report.summary.minLatencyMs}ms</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">P50</p>
                  <p className="text-lg font-bold">{report.summary.p50LatencyMs}ms</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Avg</p>
                  <p className={`text-lg font-bold ${getLatencyColor(report.summary.avgLatencyMs)}`}>{report.summary.avgLatencyMs}ms</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">P95</p>
                  <p className={`text-lg font-bold ${getLatencyColor(report.summary.p95LatencyMs)}`}>{report.summary.p95LatencyMs}ms</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">P99</p>
                  <p className={`text-lg font-bold ${getLatencyColor(report.summary.p99LatencyMs)}`}>{report.summary.p99LatencyMs}ms</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Success Rate</span>
                  <span>{getSuccessRate().toFixed(1)}%</span>
                </div>
                <Progress value={getSuccessRate()} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* By Operation */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By Operation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(report.byOperation).map(([op, stats]) => (
                    <div key={op} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <p className="font-medium text-sm">{op.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {stats.success} success, {stats.failed} failed
                        </p>
                      </div>
                      <Badge variant={stats.avgLatencyMs < 100 ? "default" : "secondary"}>
                        {Math.round(stats.avgLatencyMs)}ms avg
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Rate Limiting Effectiveness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Users Hit Limit</p>
                    <p className="text-xl font-bold">{report.rateLimitingEffectiveness.usersHitLimit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">429 Responses</p>
                    <p className="text-xl font-bold">{report.rateLimitingEffectiveness.totalRateLimitResponses}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Attempts Before Limit</p>
                  <p className="text-xl font-bold">{report.rateLimitingEffectiveness.avgAttemptsBeforeLimit}</p>
                </div>

                {report.errors.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-2">Errors</p>
                    {report.errors.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{e.error}</span>
                        <Badge variant="destructive">{e.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Test Summary */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">
                Test completed in <strong>{(report.summary.durationMs / 1000).toFixed(2)}s</strong> at{' '}
                {new Date(report.timestamp).toLocaleString()}. 
                Simulated <strong>{report.config.concurrentUsers}</strong> concurrent users with{' '}
                <strong>{report.config.operationsPerUser}</strong> operations each ({report.config.testType} mode).
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default LoadTestPanel;
