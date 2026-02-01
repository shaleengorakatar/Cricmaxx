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
  isOwn?: boolean;
}

const OrderBook = ({ marketId }: OrderBookProps) => {
  const { profile, isAuthenticated } = useAuth();
  const [yesOrders, setYesOrders] = useState<OrderLevel[]>([]);
  const [noOrders, setNoOrders] = useState<OrderLevel[]>([]);
  const [rawYesOrders, setRawYesOrders] = useState<OrderLevel[]>([]);
  const [rawNoOrders, setRawNoOrders] = useState<OrderLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes");
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [buyQuantity, setBuyQuantity] = useState(10);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [viewMode, setViewMode] = useState<"buy" | "sell">("buy");

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
  }, [marketId, profile?.id]); // Re-fetch when user changes to update self-trade filtering

  const fetchOrders = async () => {
    // Fetch all orders (including user's own) so we can mark them with "(you)"
    const { data: orderData } = await supabase
      .from('orders')
      .select('side, price, quantity, filled_quantity, user_id')
      .eq('market_id', marketId)
      .in('status', ['pending', 'partial']);
    
    // Transform raw orders to match the expected format with available quantity
    // Mark orders that belong to the current user
    const aggregatedData = (orderData || [])
      .filter(o => o.quantity - o.filled_quantity > 0)
      .map(o => ({
        side: o.side,
        price: o.price,
        total_quantity: o.quantity - o.filled_quantity,
        isOwn: isAuthenticated && profile?.id === o.user_id
      }));

    // Aggregate same price levels helper - track if any order at this level is user's own
    const aggregateByPrice = (levels: OrderLevel[]): OrderLevel[] => {
      const priceMap = new Map<number, { quantity: number; isOwn: boolean }>();
      for (const level of levels) {
        const roundedPrice = Math.round(level.price * 100) / 100;
        const existing = priceMap.get(roundedPrice) || { quantity: 0, isOwn: false };
        priceMap.set(roundedPrice, { 
          quantity: existing.quantity + level.quantity,
          isOwn: existing.isOwn || !!level.isOwn
        });
      }
      return Array.from(priceMap.entries()).map(([price, data]) => ({ 
        price, 
        quantity: data.quantity,
        isOwn: data.isOwn
      }));
    };

    // BUY MODE: Kalshi-style order book display
    // - YES column shows prices where you can BUY YES (from NO bidders)
    // - NO column shows prices where you can BUY NO (from YES bidders)
    const yesLevelsBuy: OrderLevel[] = [];
    const noLevelsBuy: OrderLevel[] = [];

    // SELL MODE: Raw orders as placed (no conversion)
    // - YES column shows YES buy orders (people buying YES = you can sell YES to them)
    // - NO column shows NO buy orders (people buying NO = you can sell NO to them)
    const yesLevelsSell: OrderLevel[] = [];
    const noLevelsSell: OrderLevel[] = [];

    for (const row of aggregatedData || []) {
      const price = Number(row.price);
      const quantity = Number(row.total_quantity);
      const isOwn = row.isOwn;
      
      if (row.side === 'yes') {
        // YES order at price X means someone is BUYING YES at X
        // BUY MODE: They are implicitly SELLING NO at (1-X), so you can BUY NO at (1-X)
        noLevelsBuy.push({ price: 1 - price, quantity, isOwn });
        // SELL MODE: Show as YES buyers at X (you can sell YES to them at X)
        yesLevelsSell.push({ price, quantity, isOwn });
      } else {
        // NO order at price Y means someone is BUYING NO at Y
        // BUY MODE: They are implicitly SELLING YES at (1-Y), so you can BUY YES at (1-Y)
        yesLevelsBuy.push({ price: 1 - price, quantity, isOwn });
        // SELL MODE: Show as NO buyers at Y (you can sell NO to them at Y)
        noLevelsSell.push({ price, quantity, isOwn });
      }
    }

    // Aggregate and sort BUY mode orders
    const aggregatedYesBuy = aggregateByPrice(yesLevelsBuy);
    const aggregatedNoBuy = aggregateByPrice(noLevelsBuy);
    aggregatedYesBuy.sort((a, b) => b.price - a.price);
    aggregatedNoBuy.sort((a, b) => b.price - a.price);

    // Aggregate and sort SELL mode orders (highest price first = best sell price)
    const aggregatedYesSell = aggregateByPrice(yesLevelsSell);
    const aggregatedNoSell = aggregateByPrice(noLevelsSell);
    aggregatedYesSell.sort((a, b) => b.price - a.price);
    aggregatedNoSell.sort((a, b) => b.price - a.price);

    setYesOrders(aggregatedYesBuy.slice(0, 5));
    setNoOrders(aggregatedNoBuy.slice(0, 5));
    setRawYesOrders(aggregatedYesSell.slice(0, 5));
    setRawNoOrders(aggregatedNoSell.slice(0, 5));
    setLoading(false);
  };

  // Get the appropriate orders based on view mode
  const displayYesOrders = viewMode === "buy" ? yesOrders : rawYesOrders;
  const displayNoOrders = viewMode === "buy" ? noOrders : rawNoOrders;

  const openBuyDialog = (side: "yes" | "no", price: number, maxQty: number, isOwnOrder?: boolean) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to place orders",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent self-trade: can't buy your own orders
    if (isOwnOrder) {
      toast({
        title: "Can't buy your own order",
        description: "You cannot trade against your own limit orders. Cancel this order first if you want to change your position.",
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

      // Check for no liquidity or failed order
      if (response.data?.noLiquidity || response.data?.success === false) {
        toast({
          title: "No liquidity available",
          description: response.data?.message || "No matching orders in the book. Try placing a limit order instead.",
          variant: "destructive",
        });
        setBuyDialogOpen(false);
        return;
      }

      // Check if order was actually filled
      const filledQty = response.data?.order?.filledQuantity || response.data?.order?.filled_quantity || 0;
      
      if (filledQty === 0) {
        toast({
          title: "Order not filled",
          description: "No matching orders available. Try a limit order to provide liquidity.",
          variant: "destructive",
        });
        setBuyDialogOpen(false);
        return;
      }

      // The edge function returns avgFillPrice as YES price
      // For NO side, the actual cost per share is (1 - yesPrice)
      const yesPrice = response.data?.order?.avgFillPrice || response.data?.order?.avg_fill_price || selectedPrice;
      const actualPricePerShare = selectedSide === 'no' ? (1 - yesPrice) : yesPrice;
      const actualCost = filledQty * actualPricePerShare;
      const payout = filledQty; // Each share pays $1 if correct
      const profit = payout - actualCost;

      toast({
        title: "🎉 Order filled!",
        description: `Bought ${filledQty} ${selectedSide.toUpperCase()} shares @ ${(actualPricePerShare * 100).toFixed(0)}¢. Potential profit: $${profit.toFixed(2)}`,
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

  const bestYesBid = displayYesOrders[0];
  const bestNoAsk = displayNoOrders[0];

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

  const hasOrders = displayYesOrders.length > 0 || displayNoOrders.length > 0;

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6">
        {/* Header with title and toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-foreground">Order Book</h3>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  {viewMode === "buy" 
                    ? "Buy mode shows where you can purchase shares. Orders are converted to show buying opportunities."
                    : "Sell mode shows raw orders as placed. Use this to see buyers you can sell your positions to."}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Buy/Sell Toggle */}
          <div className="inline-flex items-center gap-0.5 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("buy")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === "buy" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setViewMode("sell")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === "sell" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sell
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Mode description */}
          <p className="text-xs text-muted-foreground text-center">
            {viewMode === "buy" 
              ? "Showing prices where you can buy shares (dual-sided matching)"
              : "Showing raw orders — sell your position to these buyers"}
          </p>
          
          {/* Best Prices Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 sm:p-4 min-h-[72px]">
              <p className="text-xs text-muted-foreground mb-1">
                {viewMode === "buy" ? "Best YES Buy Price" : "YES Buyers"}
              </p>
              {bestYesBid ? (
                <>
                  <p className="text-xl sm:text-lg font-bold text-green-600 dark:text-green-500">
                    {(bestYesBid.price * 100).toFixed(0)}¢
                  </p>
                  <p className="text-xs text-muted-foreground">{bestYesBid.quantity} shares</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No orders</p>
              )}
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 sm:p-4 min-h-[72px]">
              <p className="text-xs text-muted-foreground mb-1">
                {viewMode === "buy" ? "Best NO Buy Price" : "NO Buyers"}
              </p>
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
                    <h4 className="text-sm font-semibold text-foreground">
                      {viewMode === "buy" ? "YES Orders" : "YES Buyers"}
                    </h4>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          {viewMode === "buy"
                            ? "Buy YES shares if you think the event will happen. Pay the listed price per share, get $1 back if correct."
                            : "These are buyers wanting YES shares. You can sell your YES position to them at the listed price."}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {viewMode === "buy" && displayYesOrders.length > 0 && (
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
                  {displayYesOrders.length > 0 ? (
                    displayYesOrders.map((order, idx) => (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <div 
                            className={`flex justify-between items-center text-xs p-2 bg-green-50 dark:bg-green-950/10 rounded transition-colors ${
                              viewMode === "buy" && !order.isOwn 
                                ? "hover:bg-green-100 dark:hover:bg-green-950/20 cursor-pointer" 
                                : order.isOwn 
                                  ? "opacity-60 cursor-not-allowed" 
                                  : ""
                            }`}
                            onClick={viewMode === "buy" ? () => openBuyDialog("yes", order.price, order.quantity, order.isOwn) : undefined}
                          >
                            <span className="font-medium text-green-600 dark:text-green-500">
                              {(order.price * 100).toFixed(0)}¢
                              {order.isOwn && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                            </span>
                            <span className="text-muted-foreground">{order.quantity} shares</span>
                          </div>
                        </TooltipTrigger>
                        {order.isOwn && viewMode === "buy" && (
                          <TooltipContent>
                            <p className="text-sm">You can't buy your own order</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
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
                    <h4 className="text-sm font-semibold text-foreground">
                      {viewMode === "buy" ? "NO Orders" : "NO Buyers"}
                    </h4>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          {viewMode === "buy"
                            ? "Buy NO shares if you think the event will NOT happen. Pay the listed price per share, get $1 back if correct."
                            : "These are buyers wanting NO shares. You can sell your NO position to them at the listed price."}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {viewMode === "buy" && displayNoOrders.length > 0 && (
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
                  {displayNoOrders.length > 0 ? (
                    displayNoOrders.map((order, idx) => (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <div 
                            className={`flex justify-between items-center text-xs p-2 bg-red-50 dark:bg-red-950/10 rounded transition-colors ${
                              viewMode === "buy" && !order.isOwn 
                                ? "hover:bg-red-100 dark:hover:bg-red-950/20 cursor-pointer" 
                                : order.isOwn 
                                  ? "opacity-60 cursor-not-allowed" 
                                  : ""
                            }`}
                            onClick={viewMode === "buy" ? () => openBuyDialog("no", order.price, order.quantity, order.isOwn) : undefined}
                          >
                            <span className="font-medium text-red-600 dark:text-red-500">
                              {(order.price * 100).toFixed(0)}¢
                              {order.isOwn && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                            </span>
                            <span className="text-muted-foreground">{order.quantity} shares</span>
                          </div>
                        </TooltipTrigger>
                        {order.isOwn && viewMode === "buy" && (
                          <TooltipContent>
                            <p className="text-sm">You can't buy your own order</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
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