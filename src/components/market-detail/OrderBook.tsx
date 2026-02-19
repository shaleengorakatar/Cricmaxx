import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, Info, HelpCircle, Wifi, WifiOff } from "lucide-react";
import FeatureHelpTooltip from "@/components/FeatureHelpTooltip";

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
  const [isConnected, setIsConnected] = useState(false);
  
  // Debouncing refs for rapid updates
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);
  const DEBOUNCE_MS = 50; // Fast updates

  const fetchOrders = useCallback(async (force = false) => {
    // Debounce rapid fetches
    const now = Date.now();
    if (!force && now - lastFetchRef.current < DEBOUNCE_MS) {
      if (!debounceRef.current) {
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          fetchOrders(true);
        }, DEBOUNCE_MS);
      }
      return;
    }
    lastFetchRef.current = now;

    // Fetch aggregated order book data using RPC function (bypasses RLS)
    const { data: aggregatedOrderBook } = await supabase
      .rpc('get_order_book_aggregated', { market_ids: [marketId] });
    
    // Fetch user's own orders separately to mark them with "(you)"
    let userOrderPrices: Set<string> = new Set();
    if (isAuthenticated && profile?.id) {
      const { data: userOrders } = await supabase
        .from('orders')
        .select('side, price')
        .eq('market_id', marketId)
        .eq('user_id', profile.id)
        .in('status', ['pending', 'partial']);
      
      // Create a set of "side:price" keys for user's orders
      (userOrders || []).forEach(o => {
        if (o.price !== null) {
          userOrderPrices.add(`${o.side}:${o.price}`);
        }
      });
    }
    
    // Transform aggregated data, marking user's own price levels
    const aggregatedData = (aggregatedOrderBook || [])
      .filter(o => o.total_quantity > 0 && o.price !== null)
      .map(o => ({
        side: o.side,
        price: o.price,
        total_quantity: o.total_quantity,
        isOwn: userOrderPrices.has(`${o.side}:${o.price}`)
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
    // Show ALL orders for visibility, but mark user's own orders (they can't trade against themselves)
    const yesLevelsBuy: OrderLevel[] = [];
    const noLevelsBuy: OrderLevel[] = [];

    // SELL MODE: Raw orders as placed (no conversion)
    // - YES column shows YES buy orders (people buying YES = you can sell YES to them)
    // - NO column shows NO buy orders (people buying NO = you can sell NO to them)
    // Show ALL orders for visibility, but mark user's own orders (they can't sell to themselves)
    const yesLevelsSell: OrderLevel[] = [];
    const noLevelsSell: OrderLevel[] = [];

    for (const row of aggregatedData || []) {
      const price = Number(row.price);
      const quantity = Number(row.total_quantity);
      const isOwn = row.isOwn;
      
      if (row.side === 'yes') {
        // YES order at price X means someone is BUYING YES at X
        // BUY MODE: They are implicitly SELLING NO at (1-X), so you can BUY NO at (1-X)
        // Include all orders for visibility, mark own orders as non-actionable
        noLevelsBuy.push({ price: 1 - price, quantity, isOwn });
        // SELL MODE: Show as YES buyers at X (you can sell YES to them at X)
        yesLevelsSell.push({ price, quantity, isOwn });
      } else {
        // NO order at price Y means someone is BUYING NO at Y
        // BUY MODE: They are implicitly SELLING YES at (1-Y), so you can BUY YES at (1-Y)
        // Include all orders for visibility, mark own orders as non-actionable
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
  }, [marketId, isAuthenticated, profile?.id]);

  // Setup realtime subscription
  useEffect(() => {
    fetchOrders(true);

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
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [marketId, profile?.id, fetchOrders]);

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
  const payout = buyQuantity; // $1 per contract if correct
  const profit = payout - cost;
  const multiplier = selectedPrice > 0 ? (1 / selectedPrice) : 0;
  const maxAffordable = profile?.balance ? Math.floor(profile.balance / selectedPrice) : 0;

  if (loading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-muted/60 rounded-xl"></div>
            <div className="h-20 bg-muted/60 rounded-xl"></div>
          </div>
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-8 bg-muted/40 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  const hasOrders = displayYesOrders.length > 0 || displayNoOrders.length > 0;
  const totalYesLiq = displayYesOrders.reduce((s, o) => s + o.quantity, 0);
  const totalNoLiq = displayNoOrders.reduce((s, o) => s + o.quantity, 0);
  const totalLiq = totalYesLiq + totalNoLiq;
  const yesPct = totalLiq > 0 ? (totalYesLiq / totalLiq) * 100 : 50;

  return (
    <TooltipProvider>
      <div className="p-4 md:p-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground tracking-tight">Order Book</h3>
            <FeatureHelpTooltip
              title="Order Book"
              description="The order book shows all pending buy orders at different price levels. In Buy mode, you see prices where you can purchase shares. In Sell mode, you see buyers you can sell your positions to."
              faqId="order-book"
            />
          </div>
          {/* Buy/Sell Toggle */}
          <div className="inline-flex items-center gap-0.5 bg-muted/60 border border-border rounded-lg p-0.5">
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
        {/* ── Liquidity depth bar ── */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="text-green-600 dark:text-green-400 font-medium">YES {totalYesLiq.toFixed(0)}</span>
            <span className="text-xs">{totalLiq.toFixed(0)} shares total</span>
            <span className="text-destructive font-medium">NO {totalNoLiq.toFixed(0)}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-destructive/30 flex">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${yesPct}%` }}
            />
          </div>
        </div>

        {/* ── Best prices ── */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            disabled={!bestYesBid || bestYesBid.isOwn}
            onClick={() => bestYesBid && openBuyDialog("yes", bestYesBid.price, bestYesBid.quantity, bestYesBid.isOwn)}
            className="relative overflow-hidden rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-left transition-all duration-150 hover:border-green-500/50 hover:bg-green-500/10 hover:shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 to-transparent pointer-events-none" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {viewMode === "buy" ? "Best YES Price" : "YES Buyers"}
            </p>
            {bestYesBid ? (
              <>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 leading-none">
                  {(bestYesBid.price * 100).toFixed(0)}<span className="text-sm font-normal ml-0.5">¢</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{bestYesBid.quantity} shares</p>
                {viewMode === "buy" && <p className="text-[9px] text-green-600/60 font-medium mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to buy →</p>}
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">—</p>
            )}
          </button>
          <button
            disabled={!bestNoAsk || bestNoAsk.isOwn}
            onClick={() => bestNoAsk && openBuyDialog("no", bestNoAsk.price, bestNoAsk.quantity, bestNoAsk.isOwn)}
            className="relative overflow-hidden rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-left transition-all duration-150 hover:border-destructive/50 hover:bg-destructive/10 hover:shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-destructive/8 to-transparent pointer-events-none" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {viewMode === "buy" ? "Best NO Price" : "NO Buyers"}
            </p>
            {bestNoAsk ? (
              <>
                <p className="text-2xl font-bold text-destructive leading-none">
                  {(bestNoAsk.price * 100).toFixed(0)}<span className="text-sm font-normal ml-0.5">¢</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{bestNoAsk.quantity} shares</p>
                {viewMode === "buy" && <p className="text-[9px] text-destructive/60 font-medium mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to buy →</p>}
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">—</p>
            )}
          </button>
        </div>

        {!hasOrders && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No orders yet — be the first to add liquidity!</p>
          </div>
        )}

        {/* ── Detailed order levels — desktop only ── */}
        {hasOrders && (
          <div className="hidden md:grid md:grid-cols-2 gap-3">
            {/* YES column */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  {viewMode === "buy" ? "YES Buy Orders" : "YES Buyers"}
                </span>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1">
                  <span>Price</span><span className="text-center">Qty</span><span className="text-right">Action</span>
                </div>
                {displayYesOrders.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No orders</p>
                ) : displayYesOrders.map((order, i) => {
                  const maxQty = displayYesOrders[0]?.quantity || 1;
                  const barWidth = Math.max(8, (order.quantity / maxQty) * 100);
                  return (
                    <div
                      key={i}
                      className={`relative grid grid-cols-3 items-center px-2 py-1.5 rounded-lg text-xs transition-colors ${
                        order.isOwn ? "opacity-60" : "hover:bg-muted/50 cursor-pointer"
                      }`}
                      onClick={viewMode === "buy" ? () => openBuyDialog("yes", order.price, order.quantity, order.isOwn) : undefined}
                    >
                      <div
                        className="absolute inset-0 bg-green-500/8 rounded-lg"
                        style={{ width: `${barWidth}%` }}
                      />
                      <span className="relative font-semibold text-green-600 dark:text-green-400">
                        {(order.price * 100).toFixed(0)}¢
                        {order.isOwn && <span className="ml-1 text-[9px] text-muted-foreground">(you)</span>}
                      </span>
                      <span className="relative text-center text-muted-foreground">{order.quantity}</span>
                      <div className="relative flex justify-end">
                        {viewMode === "buy" && (
                          <button
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                              order.isOwn
                                ? "border-border text-muted-foreground cursor-not-allowed"
                                : "border-green-400/50 text-green-600 dark:text-green-400 hover:bg-green-500/10"
                            }`}
                            disabled={order.isOwn}
                            onClick={e => { e.stopPropagation(); openBuyDialog("yes", order.price, order.quantity, order.isOwn); }}
                          >
                            {order.isOwn ? "Own" : "Buy"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NO column */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />
                <span className="text-xs font-semibold text-foreground">
                  {viewMode === "buy" ? "NO Buy Orders" : "NO Buyers"}
                </span>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1">
                  <span>Price</span><span className="text-center">Qty</span><span className="text-right">Action</span>
                </div>
                {displayNoOrders.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No orders</p>
                ) : displayNoOrders.map((order, i) => {
                  const maxQty = displayNoOrders[0]?.quantity || 1;
                  const barWidth = Math.max(8, (order.quantity / maxQty) * 100);
                  return (
                    <div
                      key={i}
                      className={`relative grid grid-cols-3 items-center px-2 py-1.5 rounded-lg text-xs transition-colors ${
                        order.isOwn ? "opacity-60" : "hover:bg-muted/50 cursor-pointer"
                      }`}
                      onClick={viewMode === "buy" ? () => openBuyDialog("no", order.price, order.quantity, order.isOwn) : undefined}
                    >
                      <div
                        className="absolute inset-0 bg-destructive/8 rounded-lg"
                        style={{ width: `${barWidth}%` }}
                      />
                      <span className="relative font-semibold text-destructive">
                        {(order.price * 100).toFixed(0)}¢
                        {order.isOwn && <span className="ml-1 text-[9px] text-muted-foreground">(you)</span>}
                      </span>
                      <span className="relative text-center text-muted-foreground">{order.quantity}</span>
                      <div className="relative flex justify-end">
                        {viewMode === "buy" && (
                          <button
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                              order.isOwn
                                ? "border-border text-muted-foreground cursor-not-allowed"
                                : "border-destructive/40 text-destructive hover:bg-destructive/10"
                            }`}
                            disabled={order.isOwn}
                            onClick={e => { e.stopPropagation(); openBuyDialog("no", order.price, order.quantity, order.isOwn); }}
                          >
                            {order.isOwn ? "Own" : "Buy"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Buy Dialog ── */}
        <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${
                  selectedSide === "yes"
                    ? "bg-green-500/15 text-green-600 dark:text-green-400"
                    : "bg-destructive/15 text-destructive"
                }`}>
                  {selectedSide.toUpperCase()}
                </span>
                <span className="text-base font-normal text-muted-foreground">
                  @ {(selectedPrice * 100).toFixed(0)}¢ per share
                </span>
              </DialogTitle>
              <DialogDescription className="sr-only">Place a buy order</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Quantity input */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Number of shares</Label>
                {/* Quick-pick buttons */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[5, 10, 25, 50].map(q => (
                    <button
                      key={q}
                      onClick={() => setBuyQuantity(q)}
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        buyQuantity === q
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={1}
                  max={maxAffordable || undefined}
                  value={buyQuantity}
                  onChange={e => setBuyQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
                {profile && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Max you can afford: <button className="font-semibold text-foreground underline-offset-2 hover:underline" onClick={() => setBuyQuantity(Math.min(maxAffordable, displayYesOrders.concat(displayNoOrders).find(o => o.price === selectedPrice)?.quantity ?? maxAffordable))}>{maxAffordable} shares</button>
                  </p>
                )}
              </div>

              {/* Trade breakdown */}
              <div className={`rounded-xl border p-4 space-y-2.5 text-sm ${
                selectedSide === "yes"
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-destructive/5 border-destructive/20"
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Price per share</span>
                  <span className="font-semibold">{(selectedPrice * 100).toFixed(0)}¢</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Shares</span>
                  <span className="font-semibold">{buyQuantity}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border/60 pt-2">
                  <span className="text-muted-foreground">You pay now</span>
                  <span className="font-bold text-foreground">${(buyQuantity * selectedPrice).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">If you win, you get</span>
                  <span className="font-bold text-foreground">${buyQuantity.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Potential profit</span>
                  <span className={`font-bold text-base ${profit >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                    +${profit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Return multiplier</span>
                  <span className="font-semibold text-foreground">{multiplier.toFixed(2)}x</span>
                </div>
              </div>

              {/* If you lose */}
              <p className="text-[11px] text-muted-foreground text-center">
                If {selectedSide === "yes" ? "NO" : "YES"} wins, you lose <span className="font-semibold text-foreground">${(buyQuantity * selectedPrice).toFixed(2)}</span>
              </p>

              {profile && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Wallet balance: <span className="font-semibold text-foreground">${profile.balance?.toFixed(2)}</span>
                  {cost > (profile.balance ?? 0) && <span className="text-destructive ml-1">· Insufficient funds</span>}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setBuyDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={handleBuyOrder}
                disabled={isPlacingOrder || cost > (profile?.balance ?? 0)}
                className={`flex-1 font-bold ${selectedSide === "yes" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-destructive hover:bg-destructive/90 text-white"}`}
              >
                {isPlacingOrder
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Placing…</>
                  : `Buy ${selectedSide.toUpperCase()} · $${cost.toFixed(2)}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default OrderBook;