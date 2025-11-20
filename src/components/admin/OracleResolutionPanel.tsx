import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const OracleResolutionPanel = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<any>(null);

  const triggerAutoResolution = async () => {
    setIsRunning(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("You must be logged in");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-auto-resolver`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ triggered_by: 'admin_manual' })
        }
      );

      const result = await response.json();

      if (result.success) {
        setLastRun(result);
        toast.success(
          `Resolution complete: ${result.summary.resolved} resolved, ${result.summary.failed} failed, ${result.summary.manual_review} need review`
        );
      } else {
        toast.error(result.error || "Auto-resolution failed");
      }

    } catch (error: any) {
      console.error('Error triggering auto-resolution:', error);
      toast.error(error.message || "Failed to trigger auto-resolution");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Oracle Auto-Resolution
        </CardTitle>
        <CardDescription>
          Manually trigger auto-resolution for oracle-based markets
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Scheduled Cron</p>
            <p className="text-xs text-muted-foreground">
              Auto-runs every 15 minutes
            </p>
          </div>
          <Badge variant="secondary">Active</Badge>
        </div>

        <Button
          onClick={triggerAutoResolution}
          disabled={isRunning}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running Resolution...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run Auto-Resolution Now
            </>
          )}
        </Button>

        {lastRun && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Last Run Results:</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Processed:</span>
                <span className="font-medium">{lastRun.summary.total_processed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resolved:</span>
                <span className="font-medium text-green-600">{lastRun.summary.resolved}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Failed:</span>
                <span className="font-medium text-red-600">{lastRun.summary.failed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Needs Review:</span>
                <span className="font-medium text-yellow-600">{lastRun.summary.manual_review}</span>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground p-3 bg-primary/5 rounded border border-primary/10">
          <p className="font-medium mb-1">How it works:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Checks all pending oracle markets past resolution time</li>
            <li>Fetches live data from Cricket API</li>
            <li>Compares actual stats vs threshold</li>
            <li>Auto-resolves market and pays out winners</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default OracleResolutionPanel;
