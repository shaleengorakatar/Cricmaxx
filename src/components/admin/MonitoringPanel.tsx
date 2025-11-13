import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";

interface FraudAlert {
  id: string;
  user_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'reviewed' | 'resolved' | 'false_positive';
  description: string;
  created_at: string;
  reviewed_at?: string | null;
  threshold_value?: number | null;
  actual_value?: number | null;
  profiles?: { name: string; email: string } | null;
}

const MonitoringPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch fraud alerts
  const { data: fraudAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['fraud-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fraud_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch profiles separately to avoid foreign key issues
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(alert => alert.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        return data.map(alert => ({
          ...alert,
          profiles: profileMap.get(alert.user_id) || null
        })) as FraudAlert[];
      }

      return data as FraudAlert[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mutation to mark alert as reviewed
  const markReviewedMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('fraud_alerts')
        .update({ 
          status: 'reviewed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] });
      toast({
        title: "Alert marked as reviewed",
        description: "The fraud alert has been marked as reviewed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark alert as reviewed.",
        variant: "destructive",
      });
      console.error('Error marking alert as reviewed:', error);
    },
  });

  const getSeverityBadge = (severity: FraudAlert["severity"]) => {
    const colors = {
      low: "bg-blue-500",
      medium: "bg-yellow-500",
      high: "bg-orange-500",
      critical: "bg-red-600",
    };
    return <Badge className={colors[severity]}>{severity.toUpperCase()}</Badge>;
  };

  const handleMarkReviewed = (alertId: string) => {
    markReviewedMutation.mutate(alertId);
  };

  if (alertsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const pendingAlerts = fraudAlerts?.filter(a => a.status === 'pending') || [];
  const reviewedAlerts = fraudAlerts?.filter(a => a.status !== 'pending') || [];

  return (
    <div className="space-y-6">
      {/* Fraud Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Fraud Detection Alerts
            </span>
            <Badge variant="secondary">{pendingAlerts.length} Pending</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {fraudAlerts && fraudAlerts.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-muted-foreground">No fraud alerts detected</p>
                <p className="text-sm text-muted-foreground mt-2">
                  System is monitoring transactions for suspiciou patterns
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pending Alerts Section */}
                {pendingAlerts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-orange-600">
                      Pending Review ({pendingAlerts.length})
                    </h3>
                    <div className="space-y-3">
                      {pendingAlerts.map((alert) => (
                        <Card key={alert.id} className="border-l-4 border-l-orange-500">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              {getSeverityBadge(alert.severity)}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                            <h4 className="font-semibold mb-1">
                              {alert.profiles?.name || 'Unknown User'}
                            </h4>
                            <p className="text-xs text-muted-foreground mb-1">
                              {alert.profiles?.email}
                            </p>
                            <p className="text-sm mb-2">{alert.description}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground mb-3">
                              <span>Type: {alert.alert_type.replace(/_/g, ' ')}</span>
                              {alert.threshold_value && (
                                <span>• Threshold: ${alert.threshold_value.toLocaleString()}</span>
                              )}
                              {alert.actual_value && (
                                <span>• Actual: ${alert.actual_value.toLocaleString()}</span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkReviewed(alert.id)}
                              disabled={markReviewedMutation.isPending}
                            >
                              {markReviewedMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Mark as Reviewed'
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviewed Alerts Section */}
                {reviewedAlerts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                      Recently Reviewed ({reviewedAlerts.length})
                    </h3>
                    <div className="space-y-3">
                      {reviewedAlerts.slice(0, 10).map((alert) => (
                        <Card key={alert.id} className="opacity-60">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              {getSeverityBadge(alert.severity)}
                              <Badge variant="outline" className="text-xs">
                                {alert.status}
                              </Badge>
                            </div>
                            <h4 className="font-semibold text-sm mb-1">
                              {alert.profiles?.name || 'Unknown User'}
                            </h4>
                            <p className="text-xs text-muted-foreground">{alert.description}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Reviewed: {alert.reviewed_at ? format(new Date(alert.reviewed_at), 'MMM d, h:mm a') : 'N/A'}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            AML/Fraud Detection System
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            Industry-standard monitoring with configurable thresholds detecting:
          </p>
          <ul className="text-xs space-y-1 text-muted-foreground">
            <li>• High volume deposits/withdrawals ($10,000+ in 24 hours)</li>
            <li>• Rapid transaction patterns (20+ transactions/hour)</li>
            <li>• Multiple withdrawal attempts (5+ in 24 hours)</li>
            <li>• Large single transactions ($5,000+)</li>
            <li>• Structuring patterns (transactions just below reporting thresholds)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitoringPanel;
