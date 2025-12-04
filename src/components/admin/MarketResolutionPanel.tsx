import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, AlertCircle, Loader2 } from "lucide-react";
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

interface MarketToResolve {
  id: string;
  question: string;
  status: string;
  volume: number;
  expiryTime: string;
  liquidityPool: number;
}

const MarketResolutionPanel = () => {
  const [markets, setMarkets] = useState<MarketToResolve[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, "yes" | "no" | "void">>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchMarketsToResolve();
  }, []);

  const fetchMarketsToResolve = async () => {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .in('status', ['approved', 'open', 'closed'])
      .lt('expiry_time', new Date().toISOString())
      .order('expiry_time', { ascending: true });

    if (error) {
      console.error('Error fetching markets:', error);
      toast({
        title: "Error",
        description: "Failed to fetch markets for resolution",
        variant: "destructive",
      });
    } else {
      setMarkets((data || []).map(m => ({
        id: m.id,
        question: m.question,
        status: m.status,
        volume: Number(m.volume),
        expiryTime: m.expiry_time,
        liquidityPool: Number(m.liquidity_pool),
      })));
    }
    setLoading(false);
  };

  const handleResolve = async (market: MarketToResolve) => {
    const outcome = resolutions[market.id];
    if (!outcome) {
      toast({
        title: "Select outcome",
        description: "Please select an outcome before settling",
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
        title: "Market resolved successfully!",
        description: `Outcome: ${outcome.toUpperCase()}. Processed ${data.positionsProcessed} positions. Total payouts: $${data.totalPayouts.toFixed(2)}`,
      });

      // Remove from list
      setMarkets(prev => prev.filter(m => m.id !== market.id));
    } catch (error: any) {
      console.error('Resolution error:', error);
      toast({
        title: "Resolution failed",
        description: error.message || "Failed to resolve market",
        variant: "destructive",
      });
    } finally {
      setResolving(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading markets...</p>
        </div>
      </Card>
    );
  }

  if (markets.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No markets to resolve</h3>
          <p className="text-sm text-muted-foreground">
            All expired markets have been resolved
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3 md:p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <span className="font-medium">Important:</span> Resolving a market will immediately process payouts from the liquidity pool. 
            Winners receive $1.00 per share, losers receive $0, and Void refunds original positions.
          </p>
        </div>
      </div>

      {markets.map(market => (
        <Card key={market.id} className="p-4 md:p-5">
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
                <div>
                  <span className="text-muted-foreground">Liquidity Pool: </span>
                  <span className="text-accent font-medium">${market.liquidityPool.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Expired: </span>
                  <span className="text-foreground">{format(new Date(market.expiryTime), "MMM dd, yyyy 'at' HH:mm")}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select Outcome
                </label>
                <Select 
                  value={resolutions[market.id] || ""} 
                  onValueChange={(value: "yes" | "no" | "void") => 
                    setResolutions(prev => ({ ...prev, [market.id]: value }))
                  }
                  disabled={resolving === market.id}
                >
                  <SelectTrigger className="bg-card h-12">
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
                  <Button 
                    className="w-full md:w-auto h-12 bg-accent text-accent-foreground hover:bg-accent/90 active:scale-95 transition-transform"
                    disabled={resolving === market.id}
                  >
                    {resolving === market.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Flag className="h-4 w-4 mr-2" />
                        Settle Market
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Settle Market</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to settle this market with outcome: <strong>{resolutions[market.id]?.toUpperCase() || "NONE"}</strong>?
                      This action cannot be undone and will immediately process payouts from the liquidity pool.
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
