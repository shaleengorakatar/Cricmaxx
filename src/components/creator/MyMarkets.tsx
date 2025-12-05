import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreatorMarket } from "@/types/creator";
import { TrendingUp, Clock, CheckCircle, Flag, Eye, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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

interface MyMarketsProps {
  markets: CreatorMarket[];
  onMarketResolved?: () => void;
}

const MyMarkets = ({ markets, onMarketResolved }: MyMarketsProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, "yes" | "no" | "void">>({});

  const getStatusBadge = (status: CreatorMarket["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "approved":
      case "open":
        return (
          <Badge className="flex items-center gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Open
          </Badge>
        );
      case "resolved":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Flag className="h-3 w-3" />
            Resolved
          </Badge>
        );
    }
  };

  const handleEarlyClose = async (market: CreatorMarket) => {
    const outcome = resolutions[market.id];
    if (!outcome) {
      toast({
        title: "Select outcome",
        description: "Please select an outcome before closing the market",
        variant: "destructive",
      });
      return;
    }

    setResolving(market.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('market-resolver', {
        body: { marketId: market.id, outcome },
      });

      if (error) throw error;

      toast({
        title: "Market closed successfully!",
        description: `Outcome: ${outcome.toUpperCase()}. Processed ${data.positionsProcessed} positions.`,
      });

      onMarketResolved?.();
    } catch (error: any) {
      console.error('Resolution error:', error);
      toast({
        title: "Failed to close market",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setResolving(null);
    }
  };

  if (markets.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No markets yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first market using the form above
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {markets.map(market => {
        const isOpen = market.status === "approved" || market.status === "open";
        
        return (
          <Card key={market.id} className="p-4 md:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-2 line-clamp-2">
                  {market.question}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Created {format(new Date(market.createdAt), "MMM dd, yyyy")}</span>
                </div>
              </div>
              {getStatusBadge(market.status)}
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Volume</p>
                <p className="text-sm font-semibold text-foreground">
                  {market.volume.toLocaleString()} shares
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Fees Earned</p>
                <p className="text-sm font-semibold text-green-600">
                  ${market.feesEarned.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {market.status}
                </p>
              </div>
              {market.outcome && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Outcome</p>
                  <Badge variant={market.outcome === "yes" ? "default" : "secondary"}>
                    {market.outcome.toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>

            {/* Early Close Section for Open Markets */}
            {isOpen && (
              <div className="border-t border-border pt-4 mb-4">
                <p className="text-xs text-muted-foreground mb-2">Close Market Early</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select 
                    value={resolutions[market.id] || ""} 
                    onValueChange={(value: "yes" | "no" | "void") => 
                      setResolutions(prev => ({ ...prev, [market.id]: value }))
                    }
                    disabled={resolving === market.id}
                  >
                    <SelectTrigger className="bg-card h-10 flex-1">
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent className="bg-card z-50">
                      <SelectItem value="yes">YES wins</SelectItem>
                      <SelectItem value="no">NO wins</SelectItem>
                      <SelectItem value="void">VOID (refund all)</SelectItem>
                    </SelectContent>
                  </Select>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm"
                        variant="destructive"
                        className="h-10"
                        disabled={resolving === market.id || !resolutions[market.id]}
                      >
                        {resolving === market.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Close Early"
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Close Market Early</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to close this market with outcome: <strong>{resolutions[market.id]?.toUpperCase()}</strong>?
                          This will immediately process payouts and cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleEarlyClose(market)}>
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => navigate(`/market/${market.id}`)}
                className="flex-1 h-10 md:h-9 active:scale-95 transition-transform"
              >
                <Eye className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">View Details</span>
                <span className="sm:hidden">View</span>
              </Button>
              {market.status === "pending" && (
                <Button size="sm" variant="ghost" className="h-10 md:h-9 text-destructive active:scale-95 transition-transform">
                  Cancel
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default MyMarkets;