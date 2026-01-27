import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, Info, HelpCircle } from "lucide-react";

interface OrderBookProps {
  marketId: string;
}

interface OrderLevel {
  price: number;
  quantity: number;
}

const OrderBook = ({ marketId }: OrderBookProps) => {
  const { profile, isAuthenticated } = useAuth();
  const [yesOrders, setYesOrders] = useState<OrderLevel[]>([]);
  const [noOrders, setNoOrders] = useState<OrderLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes");
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [buyQuantity, setBuyQuantity] = useState(10);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel(`orderbook-display-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `market_id=eq.${marketId}`
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId]);

  const fetchOrders = async () => {
    // Use the aggregated order book view for privacy-preserving market transparency
    // This view shows order depth without exposing individual user trading patterns
    const { data: aggregatedData } = await supabase
      .from('order_book_aggregated')
      .select('side, price, total_quantity')
      .eq('market_id', marketId);

    const yesLevels: OrderLevel[] = [];
    const noLevels: OrderLevel[] = [];

    for (const row of aggregatedData || []) {
      const level = { price: Number(row.price), quantity: Number(row.total_quantity) };
      if (row.side === 'yes') {
        yesLevels.push(level);
      } else {
        noLevels.push(level);
      }
    }

    // Sort and limit to top 5 price levels
    yesLevels.sort((a, b) => b.price - a.price);
    noLevels.sort((a, b) => b.price - a.price);

    setYesOrders(yesLevels.slice(0, 5));
    setNoOrders(noLevels.slice(0, 5));
    setLoading(false);
  };

  const openBuyDialog = (side: "yes" | "no", price: number, maxQty: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to place orders",
        variant: "destructive",
      });
      return;
    }
    setSelectedSide(side);
    setSelectedPrice(price);
    setBuyQuantity(Math.min(10, maxQty));
    setBuyDialogOpen(true);
  };

  const handleBuyOrder = async () => {
    if (!isAuthenticated || !profile) {
      toast({
        title: "Sign in required",
        description: "Please sign in to place orders",
        variant: "destructive",
      });
      return;
    }

    const cost = buyQuantity * selectedPrice;
    if (profile.balance < cost) {
      toast({
        title: "Insufficient balance",
        description: `You need $${cost.toFixed(2)} but only have $${profile.balance.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    setIsPlacingOrder(true);

    try {
      const response = await supabase.functions.invoke("order-book", {
        body: {
          action: "place",
          marketId,
          side: selectedSide,
          orderType: "market",
          quantity: buyQuantity,
          price: selectedPrice,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to place order");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const payout = buyQuantity; // Each share pays $1 if correct
      const profit = payout - cost;

      toast({
        title: "🎉 Order filled!",
        description: `Bought ${buyQuantity} ${selectedSide.toUpperCase()} shares @ ${(selectedPrice * 100).toFixed(0)}¢. Potential profit: $${profit.toFixed(2)}`,
      });

      setBuyDialogOpen(false);
      fetchOrders();
    } catch (error: any) {
      console.error("Buy order error:", error);
      toast({
        title: "Order failed",
        description: error.message || "Could not place order",
        variant: "destructive",
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const bestYesBid = yesOrders[0];
  const bestNoAsk = noOrders[0];

  const cost = buyQuantity * selectedPrice;
  const payout = buyQuantity;
  const profit = payout - cost;

  if (loading) {
    return (
      <div className="p-6">
        <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4">Order Book</h3>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-muted rounded-lg"></div>
            <div className="h-20 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  const hasOrders = yesOrders.length > 0 || noOrders.length > 0;

  return (
    <TooltipProvider>
      <div className="p-0 md:p-6">
        <div className="flex items-center gap-2 mb-4 px-4 md:px-0 hidden md:flex">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">Order Book</h3>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                The order book shows open limit orders from other traders. 
                Click "Buy" to instantly purchase shares at the listed price.
                If you're right, each share pays $1.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        <div className="space-y-4 px-4 md:px-0 pb-4 md:pb-0">
          {/* Best Prices Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 sm:p-4 min-h-[72px]">
              <p className="text-xs text-muted-foreground mb-1">Best YES Price</p>
              {bestYesBid ? (
                <>
                  <p className="text-xl sm:text-lg font-bold text-green-600 dark:text-green-500">
                    {(bestYesBid.price * 100).toFixed(0)}¢
                  </p>
                  <p className="text-xs text-muted-foreground">{bestYesBid.quantity} shares</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No bids yet</p>
              )}
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 sm:p-4 min-h-[72px]">
              <p className="text-xs text-muted-foreground mb-1">Best NO Price</p>
              {bestNoAsk ? (
                <>
                  <p className="text-xl sm:text-lg font-bold text-red-600 dark:text-red-500">
                    {(bestNoAsk.price * 100).toFixed(0)}¢
                  </p>
                  <p className="text-xs text-muted-foreground">{bestNoAsk.quantity} shares</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No bids yet</p>
              )}
            </div>
          </div>

          {!hasOrders && (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No orders yet. Be the first to place a limit order!</p>
            </div>
          )}

          {/* Detailed Order Book Tables - Desktop only */}
          {hasOrders && (
            <div className="hidden md:grid md:grid-cols-2 gap-4">
              {/* Yes Orders */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">YES Orders</h4>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          Buy YES shares if you think the event will happen. 
                          Pay the listed price per share, get $1 back if correct.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {yesOrders.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                          onClick={() => openBuyDialog("yes", bestYesBid.price, bestYesBid.quantity)}
                        >
                          Buy
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Buy YES shares at best available price</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="space-y-1">
                  {yesOrders.length > 0 ? (
                    yesOrders.map((order, idx) => (
                      <div 
                        key={idx} 
                        className="flex justify-between items-center text-xs p-2 bg-green-50 dark:bg-green-950/10 rounded hover:bg-green-100 dark:hover:bg-green-950/20 cursor-pointer transition-colors"
                        onClick={() => openBuyDialog("yes", order.price, order.quantity)}
                      >
                        <span className="font-medium text-green-600 dark:text-green-500">
                          {(order.price * 100).toFixed(0)}¢
                        </span>
                        <span className="text-muted-foreground">{order.quantity} shares</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-center text-muted-foreground py-2">No orders</p>
                  )}
                </div>
              </div>

              {/* No Orders */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">NO Orders</h4>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          Buy NO shares if you think the event will NOT happen. 
                          Pay the listed price per share, get $1 back if correct.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {noOrders.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => openBuyDialog("no", bestNoAsk.price, bestNoAsk.quantity)}
                        >
                          Buy
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Buy NO shares at best available price</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="space-y-1">
                  {noOrders.length > 0 ? (
                    noOrders.map((order, idx) => (
                      <div 
                        key={idx} 
                        className="flex justify-between items-center text-xs p-2 bg-red-50 dark:bg-red-950/10 rounded hover:bg-red-100 dark:hover:bg-red-950/20 cursor-pointer transition-colors"
                        onClick={() => openBuyDialog("no", order.price, order.quantity)}
                      >
                        <span className="font-medium text-red-600 dark:text-red-500">
                          {(order.price * 100).toFixed(0)}¢
                        </span>
                        <span className="text-muted-foreground">{order.quantity} shares</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-center text-muted-foreground py-2">No orders</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mobile hint */}
          {hasOrders && (
            <p className="text-xs text-center text-muted-foreground md:hidden">
              Full order book available on larger screens
            </p>
          )}
        </div>

        {/* Buy Dialog */}
        <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Buy {selectedSide.toUpperCase()} Shares
                <span className={selectedSide === "yes" ? "text-green-600" : "text-red-600"}>
                  @ {(selectedPrice * 100).toFixed(0)}¢
                </span>
              </DialogTitle>
              <DialogDescription>
                {selectedSide === "yes" 
                  ? "You're betting this event WILL happen. If correct, each share pays $1."
                  : "You're betting this event will NOT happen. If correct, each share pays $1."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Number of Shares</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={buyQuantity}
                  onChange={(e) => setBuyQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price per share:</span>
                  <span className="font-medium">{(selectedPrice * 100).toFixed(0)}¢</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total cost:</span>
                  <span className="font-medium">${cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">If correct, you get:</span>
                  <span className="font-medium text-green-600">${payout.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Potential profit:</span>
                  <span className="font-bold text-green-600">+${profit.toFixed(2)}</span>
                </div>
              </div>

              {isAuthenticated && profile && (
                <p className="text-xs text-muted-foreground text-center">
                  Your balance: ${profile.balance.toFixed(2)}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBuyDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleBuyOrder}
                disabled={isPlacingOrder || !isAuthenticated}
                className={selectedSide === "yes" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              >
                {isPlacingOrder ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buying...
                  </>
                ) : (
                  `Buy ${buyQuantity} ${selectedSide.toUpperCase()} for $${cost.toFixed(2)}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default OrderBook;