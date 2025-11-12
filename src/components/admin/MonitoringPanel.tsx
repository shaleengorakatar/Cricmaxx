import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FraudAlert, RecentActivity } from "@/types/admin";
import { AlertTriangle, Activity, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface MonitoringPanelProps {
  alerts: FraudAlert[];
  recentActivity: RecentActivity[];
  onMarkAlertReviewed: (id: string) => void;
}

const MonitoringPanel = ({ alerts, recentActivity, onMarkAlertReviewed }: MonitoringPanelProps) => {
  const { toast } = useToast();

  const getSeverityBadge = (severity: FraudAlert["severity"]) => {
    switch (severity) {
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-600">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  const handleMarkReviewed = (alert: FraudAlert) => {
    onMarkAlertReviewed(alert.id);
    toast({
      title: "Alert marked as reviewed",
      description: `Alert for ${alert.userName} has been reviewed`,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Fraud Alerts */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Fraud Alerts
        </h3>
        
        {alerts.length === 0 ? (
          <Card className="p-6">
            <div className="text-center">
              <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No active alerts</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <Card key={alert.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getSeverityBadge(alert.severity)}
                      <span className="text-sm font-medium text-foreground">{alert.userName}</span>
                    </div>
                    <p className="text-sm text-foreground mb-1">{alert.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(alert.timestamp), "MMM dd, yyyy 'at' HH:mm")}
                    </p>
                  </div>
                  {alert.status === "pending" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleMarkReviewed(alert)}
                    >
                      Mark Reviewed
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-4 bg-muted rounded-lg p-3 text-xs text-muted-foreground">
          <p>
            <strong>Note:</strong> Alerts are generated based on predefined thresholds and are for review purposes only. 
            Investigate flagged activity before taking action.
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" />
          Recent Activity
        </h3>
        
        <Card className="p-4">
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {recentActivity.map(activity => (
              <div key={activity.id} className="pb-3 border-b border-border last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground">{activity.action}</p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(activity.timestamp), "HH:mm")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{activity.details}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">User:</span>
                  <span className="text-foreground font-medium">{activity.userName}</span>
                  {activity.amount && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-accent font-medium">{activity.amount} credits</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MonitoringPanel;
