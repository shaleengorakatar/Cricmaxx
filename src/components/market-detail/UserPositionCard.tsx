import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, TrendingDown, ExternalLink, Clock, X } from "lucide-react";
import { Link } from "react-router-dom";
import SellPositionDialog from "./SellPositionDialog";
import { toast } from "sonner";
import FeatureHelpTooltip from "@/components/FeatureHelpTooltip";

interface UserPositionCardProps {
  marketId: string;
  currentYesPrice: number;
  currentNoPrice: number;
  platformFeePercent?: number;
  creatorFeePercent?: number;
}

interface Position {
  id: string;
  side: string;
  size: number;
  entry_price: number;
  status: string;
  opened_at: string;
}

interface PendingOrder {
  id: string;
  side: string;
  quantity: number;
  filled_quantity: number;
  price: number;
  order_type: string;
  created_at: string;
}

const UserPositionCard = ({ 
  marketId, 
  currentYesPrice, 
  currentNoPrice,
  platformFeePercent = 0,
  creatorFeePercent = 0
}: UserPositionCardProps) => {
  const { isAuthenticated, profile } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes");
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && profile) {
      fetchPositions();
      fetchPendingOrders();
      
      // Subscribe to position changes
      const positionsChannel = supabase
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
      
      // Subscribe to order changes
      const ordersChannel = supabase
        .channel(`user-orders-position-${marketId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `market_id=eq.${marketId}`
          },
          () => {
            fetchPendingOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(positionsChannel);
        supabase.removeChannel(ordersChannel);
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

  const fetchPendingOrders = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from('orders')
      .select('id, side, quantity, filled_quantity, price, order_type, created_at')
      .eq('market_id', marketId)
      .eq('user_id', profile.id)
      .in('status', ['pending', 'partial'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending orders:', error);
    } else {
      setPendingOrders(data || []);
    }
  };

  const cancelOrder = async (orderId: string) => {
    setCancellingOrder(orderId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in");
        return;
      }

      const response = await supabase.functions.invoke('order-book', {
        body: { action: 'cancel', orderId },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Order cancelled");
      fetchPendingOrders();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel order");
    } finally {
      setCancellingOrder(null);
    }
  };

  const openSellDialog = (side: "yes" | "no") => {
    setSelectedSide(side);
    setSellDialogOpen(true);
  };

  // Don't show if not authenticated or loading
  if (!isAuthenticated || loading) {
    return null;
  }

  // Show if has positions OR pending orders
  if (positions.length === 0 && pendingOrders.length === 0) {
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

  // Calculate pending sell orders by side
  const yesPendingSell = pendingOrders
    .filter(o => o.side === 'yes')
    .reduce((sum, o) => sum + (o.quantity - o.filled_quantity), 0);
  const noPendingSell = pendingOrders
    .filter(o => o.side === 'no')
    .reduce((sum, o) => sum + (o.quantity - o.filled_quantity), 0);
  
  // Available to sell = total position - pending sell orders
  const yesAvailableToSell = Math.max(0, totalYesShares - yesPendingSell);
  const noAvailableToSell = Math.max(0, totalNoShares - noPendingSell);

  // Calculate current value and P&L
  const yesCurrentValue = totalYesShares * currentYesPrice;
  const noCurrentValue = totalNoShares * currentNoPrice;
  
  const yesCost = totalYesShares * avgYesEntry;
  const noCost = totalNoShares * avgNoEntry;
  
  const yesUnrealizedPnL = yesCurrentValue - yesCost;
  const noUnrealizedPnL = noCurrentValue - noCost;
  
  const totalUnrealizedPnL = yesUnrealizedPnL + noUnrealizedPnL;
  const totalCost = yesCost + noCost;

  // Calculate fees and net profit
  const totalFeePercent = platformFeePercent + creatorFeePercent;
  const feeMultiplier = 1 - (totalFeePercent / 100);
  
  // Max payout is $1 per share if correct
  const yesPotentialPayout = totalYesShares * 1;
  const noPotentialPayout = totalNoShares * 1;
  const yesGrossProfit = yesPotentialPayout - yesCost;
  const noGrossProfit = noPotentialPayout - noCost;
  // Fee only applies to profit portion
  const yesPotentialProfit = yesGrossProfit * feeMultiplier;
  const noPotentialProfit = noGrossProfit * feeMultiplier;

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              📊 Your Position
              <FeatureHelpTooltip
                title="Your Position"
                description="This shows your current holdings in this market. You can sell your position anytime before the market resolves to lock in profit or cut losses. If you wait, you'll receive $1 per contract if your prediction is correct, or $0 if incorrect."
                faqId="view-positions"
              />
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
                <div className="text-right">
                  <span className="text-sm font-semibold">{totalYesShares} contracts</span>
                  {yesPendingSell > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ({yesAvailableToSell} available, {yesPendingSell} in orders)
                    </p>
                  )}
                </div>
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
                  <span className="font-semibold text-primary">
                    +${yesPotentialProfit.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => openSellDialog("yes")}
                  disabled={yesAvailableToSell <= 0}
                >
                  {yesAvailableToSell > 0 ? `Sell YES (${yesAvailableToSell} available)` : 'All in pending orders'}
                </Button>
                <FeatureHelpTooltip
                  title="Sell Your Position"
                  description="Sell your shares before the market ends to lock in profit or cut losses. Your shares will be sold to buyers in the order book. This is different from canceling—selling trades your owned shares."
                  faqId="sell-position"
                />
              </div>
            </div>
          )}

          {/* NO Position */}
          {totalNoShares > 0 && (
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700">
                  NO
                </Badge>
                <div className="text-right">
                  <span className="text-sm font-semibold">{totalNoShares} contracts</span>
                  {noPendingSell > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ({noAvailableToSell} available, {noPendingSell} in orders)
                    </p>
                  )}
                </div>
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
                  <span className="font-semibold text-primary">
                    +${noPotentialProfit.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => openSellDialog("no")}
                  disabled={noAvailableToSell <= 0}
                >
                  {noAvailableToSell > 0 ? `Sell NO (${noAvailableToSell} available)` : 'All in pending orders'}
                </Button>
                <FeatureHelpTooltip
                  title="Sell Your Position"
                  description="Sell your shares before the market ends to lock in profit or cut losses. Your shares will be sold to buyers in the order book."
                  faqId="sell-position"
                />
              </div>
            </div>
          )}

          {/* Total Summary */}
          {(totalYesShares > 0 || totalNoShares > 0) && (
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
          )}

          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Pending Orders ({pendingOrders.length})</span>
                <FeatureHelpTooltip
                  title="Pending Orders"
                  description="These are your limit orders waiting in the order book. They'll fill when someone agrees to trade at your price. You can cancel unfilled orders anytime to get your tokens back."
                  faqId="cancel-prediction"
                />
              </div>
              <div className="space-y-2">
                {pendingOrders.map((order) => {
                  const remainingQty = order.quantity - order.filled_quantity;
                  const totalCostOrder = remainingQty * order.price;
                  const grossProfit = remainingQty - totalCostOrder;
                  const netProfit = grossProfit * feeMultiplier;
                  const isBuyOrder = order.order_type === 'limit' || order.order_type === 'market';
                  
                  return (
                    <div 
                      key={order.id} 
                      className="bg-muted/50 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={order.side === 'yes' 
                              ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-400' 
                              : 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-400'
                            }
                          >
                            {order.side.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Limit Order</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Cost</p>
                          <p className="font-semibold">${totalCostOrder.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Price per $1</p>
                          <p className="font-semibold">{(order.price * 100).toFixed(0)}¢</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">If correct</p>
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            +${netProfit.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      
                      {order.filled_quantity > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Partially filled: {order.filled_quantity}/{order.quantity}
                        </p>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => cancelOrder(order.id)}
                        disabled={cancellingOrder === order.id}
                      >
                        <X className="h-3 w-3 mr-1" />
                        {cancellingOrder === order.id ? 'Cancelling...' : 'Cancel Order'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sell Dialog - pass available amount, not total */}
      <SellPositionDialog
        open={sellDialogOpen}
        onOpenChange={setSellDialogOpen}
        marketId={marketId}
        side={selectedSide}
        positionSize={selectedSide === "yes" ? yesAvailableToSell : noAvailableToSell}
        entryPrice={selectedSide === "yes" ? avgYesEntry : avgNoEntry}
        currentPrice={selectedSide === "yes" ? currentYesPrice : currentNoPrice}
        onSellComplete={() => {
          fetchPositions();
          fetchPendingOrders();
        }}
      />
    </>
  );
};

export default UserPositionCard;
