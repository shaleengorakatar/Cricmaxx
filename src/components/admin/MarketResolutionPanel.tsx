import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminMarket } from "@/types/admin";
import { Flag, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MarketResolutionPanelProps {
  markets: AdminMarket[];
  onResolve: (id: string, outcome: "yes" | "no" | "void") => void;
}

const MarketResolutionPanel = ({ markets, onResolve }: MarketResolutionPanelProps) => {
  const [resolutions, setResolutions] = useState<Record<string, "yes" | "no" | "void">>({});
  const { toast } = useToast();

  const handleResolve = (market: AdminMarket) => {
    const outcome = resolutions[market.id];
    if (!outcome) {
      toast({
        title: "Select outcome",
        description: "Please select an outcome before settling",
        variant: "destructive",
      });
      return;
    }

    onResolve(market.id, outcome);
    toast({
      title: "Market resolved",
      description: `Market settled with outcome: ${outcome.toUpperCase()}. Payouts will be processed.`,
    });
  };

  if (markets.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No markets to resolve</h3>
          <p className="text-sm text-muted-foreground">
            All markets are either open or already resolved
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <span className="font-medium">Important:</span> Resolving a market will immediately process payouts. 
            Yes winners receive $1.00 per share, No winners receive $1.00 per share, and Void refunds all positions.
          </p>
        </div>
      </div>

      {markets.map(market => (
        <Card key={market.id} className="p-5">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground text-base mb-3">
                {market.question}
              </h3>
              
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge variant="secondary">{market.status}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Volume: </span>
                  <span className="text-foreground font-medium">{market.volume.toLocaleString()} shares</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Expired: </span>
                  <span className="text-foreground">{format(new Date(market.expiryTime), "MMM dd, yyyy 'at' HH:mm")}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select Outcome
                </label>
                <Select 
                  value={resolutions[market.id] || ""} 
                  onValueChange={(value: "yes" | "no" | "void") => 
                    setResolutions(prev => ({ ...prev, [market.id]: value }))
                  }
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Choose outcome" />
                  </SelectTrigger>
                  <SelectContent className="bg-card z-50">
                    <SelectItem value="yes">YES - Yes holders win $1.00</SelectItem>
                    <SelectItem value="no">NO - No holders win $1.00</SelectItem>
                    <SelectItem value="void">VOID - Refund all positions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <Flag className="h-4 w-4 mr-2" />
                    Settle Market
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Settle Market</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to settle this market with outcome: <strong>{resolutions[market.id]?.toUpperCase() || "NONE"}</strong>?
                      This action cannot be undone and will immediately process payouts.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleResolve(market)}>
                      Confirm Settlement
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default MarketResolutionPanel;
