import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import SellPositionDialog from "./SellPositionDialog";

interface UserPositionCardProps {
  marketId: string;
  currentYesPrice: number;
  currentNoPrice: number;
}

interface Position {
  id: string;
  side: string;
  size: number;
  entry_price: number;
  status: string;
  opened_at: string;
}

const UserPositionCard = ({ marketId, currentYesPrice, currentNoPrice }: UserPositionCardProps) => {
  const { isAuthenticated, profile } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes");

  useEffect(() => {
    if (isAuthenticated && profile) {
      fetchPositions();
      
      // Subscribe to position changes
      const channel = supabase
        .channel(`user-positions-${marketId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'positions',
            filter: `market_id=eq.${marketId}`
          },
          () => {
            fetchPositions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, profile, marketId]);

  const fetchPositions = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('market_id', marketId)
      .eq('user_id', profile.id)
      .eq('status', 'open')
      .gt('size', 0);

    if (error) {
      console.error('Error fetching positions:', error);
    } else {
      setPositions(data || []);
    }
    setLoading(false);
  };

  const openSellDialog = (side: "yes" | "no") => {
    setSelectedSide(side);
    setSellDialogOpen(true);
  };

  // Don't show if not authenticated or no positions
  if (!isAuthenticated || loading) {
    return null;
  }

  if (positions.length === 0) {
    return null;
  }

  // Aggregate positions by side
  const yesPositions = positions.filter(p => p.side === 'yes');
  const noPositions = positions.filter(p => p.side === 'no');
  
  const totalYesShares = yesPositions.reduce((sum, p) => sum + p.size, 0);
  const totalNoShares = noPositions.reduce((sum, p) => sum + p.size, 0);
  
  const avgYesEntry = yesPositions.length > 0 
    ? yesPositions.reduce((sum, p) => sum + p.entry_price * p.size, 0) / totalYesShares
    : 0;
  const avgNoEntry = noPositions.length > 0 
    ? noPositions.reduce((sum, p) => sum + p.entry_price * p.size, 0) / totalNoShares
    : 0;

  // Calculate current value and P&L
  const yesCurrentValue = totalYesShares * currentYesPrice;
  const noCurrentValue = totalNoShares * currentNoPrice;
  
  const yesCost = totalYesShares * avgYesEntry;
  const noCost = totalNoShares * avgNoEntry;
  
  const yesUnrealizedPnL = yesCurrentValue - yesCost;
  const noUnrealizedPnL = noCurrentValue - noCost;
  
  const totalUnrealizedPnL = yesUnrealizedPnL + noUnrealizedPnL;
  const totalCost = yesCost + noCost;

  // Max payout is $1 per share if correct
  const yesPotentialPayout = totalYesShares * 1;
  const noPotentialPayout = totalNoShares * 1;
  const yesPotentialProfit = yesPotentialPayout - yesCost;
  const noPotentialProfit = noPotentialPayout - noCost;

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              📊 Your Position
            </CardTitle>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                Dashboard
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* YES Position */}
          {totalYesShares > 0 && (
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700">
                  YES
                </Badge>
                <span className="text-sm font-semibold">{totalYesShares} contracts</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Avg Entry:</span>
                  <span className="ml-1 font-medium">{(avgYesEntry * 100).toFixed(0)}¢</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cost:</span>
                  <span className="ml-1 font-medium">${yesCost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Current:</span>
                  <span className="ml-1 font-medium">${yesCurrentValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">If Correct:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    +${yesPotentialProfit.toFixed(2)}
                  </span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950"
                onClick={() => openSellDialog("yes")}
              >
                Sell YES Position
              </Button>
            </div>
          )}

          {/* NO Position */}
          {totalNoShares > 0 && (
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700">
                  NO
                </Badge>
                <span className="text-sm font-semibold">{totalNoShares} contracts</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Avg Entry:</span>
                  <span className="ml-1 font-medium">{(avgNoEntry * 100).toFixed(0)}¢</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cost:</span>
                  <span className="ml-1 font-medium">${noCost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Current:</span>
                  <span className="ml-1 font-medium">${noCurrentValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">If Correct:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    +${noPotentialProfit.toFixed(2)}
                  </span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950"
                onClick={() => openSellDialog("no")}
              >
                Sell NO Position
              </Button>
            </div>
          )}

          {/* Total Summary */}
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Invested:</span>
              <span className="font-semibold">${totalCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Unrealized P&L:</span>
              <span className={`font-semibold flex items-center gap-1 ${totalUnrealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {totalUnrealizedPnL >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sell Dialog */}
      <SellPositionDialog
        open={sellDialogOpen}
        onOpenChange={setSellDialogOpen}
        marketId={marketId}
        side={selectedSide}
        positionSize={selectedSide === "yes" ? totalYesShares : totalNoShares}
        entryPrice={selectedSide === "yes" ? avgYesEntry : avgNoEntry}
        currentPrice={selectedSide === "yes" ? currentYesPrice : currentNoPrice}
        onSellComplete={fetchPositions}
      />
    </>
  );
};

export default UserPositionCard;
