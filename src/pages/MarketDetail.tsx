import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketHeader from "@/components/market-detail/MarketHeader";
import PriceChart from "@/components/market-detail/PriceChart";
import OrderBook from "@/components/market-detail/OrderBook";
import OrderBookTrading from "@/components/market-detail/OrderBookTrading";
import { ResolutionRules } from "@/components/market-detail/ResolutionRules";
import FeatureHelpTooltip from "@/components/FeatureHelpTooltip";
import { Market } from "@/types/market";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, TrendingUp, TrendingDown, History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeMarketPrices, useRealtimeTrades } from "@/hooks/useRealtimeMarket";
import { RealtimeStatus } from "@/components/ui/realtime-indicators";
import { supabase } from "@/integrations/supabase/client";
import { useBatchIndicativePrices } from "@/hooks/useBatchIndicativePrices";

// Generate price history from current price
const generatePriceHistory = (yesPrice: number) => {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const variation = (Math.random() - 0.5) * 0.1;
    const yes = Math.max(0.1, Math.min(0.9, yesPrice + variation));
    data.push({
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      yesPrice: yes,
      noPrice: 1 - yes,
    });
  }
  return data;
};

interface MarketOrder {
  id: string;
  side: string;
  quantity: number;
  filled_quantity: number;
  price: number;
  order_type: string;
  status: string;
  created_at: string;
}

interface MarketPosition {
  id: string;
  side: string;
  size: number;
  entry_price: number;
  pnl: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

const MarketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, isAuthenticated, user } = useAuth();

  const [market, setMarket] = useState<Market | null>(null);
  const [marketStatus, setMarketStatus] = useState<string>('open');
  const [marketOutcome, setMarketOutcome] = useState<string | null>(null);
  const [marketFees, setMarketFees] = useState<{ platform: number; creator: number }>({ platform: 0, creator: 0 });
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);

  // Orders & positions for the bottom section
  const [pendingOrders, setPendingOrders] = useState<MarketOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<MarketPosition[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Real-time hooks
  const { prices: realtimePrices, isConnected: pricesConnected } = useRealtimeMarketPrices(id);
  const { isConnected: tradesConnected } = useRealtimeTrades(id);

  // Indicative prices from order book
  const { prices: indicativePrices } = useBatchIndicativePrices(id ? [id] : []);

  // Update market with realtime prices
  useEffect(() => {
    if (realtimePrices && market) {
      setMarket(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          yesPrice: Number(realtimePrices.yes_price),
          noPrice: Number(realtimePrices.no_price),
          volume: Number(realtimePrices.volume),
        };
      });
      setPriceHistory(prev => [
        ...prev.slice(-23),
        {
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          yesPrice: Number(realtimePrices.yes_price),
          noPrice: Number(realtimePrices.no_price),
        }
      ]);
    }
  }, [realtimePrices]);

  const fetchMarket = useCallback(async (currentIndicativePrices: Map<string, any>) => {
    if (!id) return;
    const { data, error } = await supabase.from("markets").select("*").eq("id", id).single();
    if (error || !data) { setLoading(false); return; }

    const indicative = currentIndicativePrices.get(data.id);
    const yesPrice = indicative && indicative.source !== "default" ? indicative.yesPrice : Number(data.yes_price);
    const noPrice = indicative && indicative.source !== "default" ? indicative.noPrice : Number(data.no_price);

    const formattedMarket: Market = {
      id: data.id,
      question: data.question,
      category: data.category as Market["category"],
      type: data.type as Market["type"],
      yesPrice,
      noPrice,
      volume: Number(data.volume),
      expiryTime: data.expiry_time,
      description: data.description || "",
      imageUrl: data.image_url || "",
    };

    setMarket(formattedMarket);
    setMarketStatus(data.status);
    setMarketOutcome(data.outcome);
    setMarketFees({
      platform: Number(data.platform_fee_percent) || 3,
      creator: Number(data.creator_fee_percent) || 0,
    });
    setPriceHistory(generatePriceHistory(formattedMarket.yesPrice));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchMarket(indicativePrices);
  }, [id, indicativePrices, fetchMarket]);

  // Fetch user orders & positions for this market
  const fetchUserActivity = useCallback(async () => {
    if (!user || !id) return;
    setOrdersLoading(true);
    const [ordersRes, positionsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, side, quantity, filled_quantity, price, order_type, status, created_at')
        .eq('market_id', id)
        .eq('user_id', user.id)
        .in('status', ['pending', 'partial'])
        .order('created_at', { ascending: false }),
      supabase
        .from('positions')
        .select('id, side, size, entry_price, pnl, status, opened_at, closed_at')
        .eq('market_id', id)
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false })
        .limit(20),
    ]);
    setPendingOrders(ordersRes.data || []);
    setCompletedOrders(positionsRes.data || []);
    setOrdersLoading(false);
  }, [user, id]);

  useEffect(() => {
    if (isAuthenticated && user && id) {
      fetchUserActivity();
      const channel = supabase
        .channel(`market-activity-${id}-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `market_id=eq.${id}` }, fetchUserActivity)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'positions', filter: `market_id=eq.${id}` }, fetchUserActivity)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isAuthenticated, user, id, fetchUserActivity]);

  const cancelOrder = async (orderId: string) => {
    await supabase.functions.invoke('order-book', { body: { action: 'cancel', orderId } });
    fetchUserActivity();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading market...</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Market not found</h1>
          <Button onClick={() => navigate('/markets')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Markets
          </Button>
        </div>
      </div>
    );
  }

  const yesCents = Math.round(market.yesPrice * 100);
  const noCents = 100 - yesCents;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 pt-28 lg:pt-20 pb-8">
        <div className="container mx-auto px-4 max-w-7xl">

          {/* Back + realtime row */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/markets')} className="-ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <RealtimeStatus isConnected={pricesConnected && tradesConnected} />
          </div>

          {/* Kalshi-style 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

              {/* Market Header — clean card, no gradient */}
              <Card className="p-5 sm:p-6 border border-border">
                {/* Category + expiry + status */}
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{market.category}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires {new Date(market.expiryTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    new Date(market.expiryTime) < new Date()
                      ? "border-destructive/40 text-destructive bg-destructive/10"
                      : "border-primary/40 text-primary bg-primary/10"
                  }`}>
                    {new Date(market.expiryTime) < new Date() ? "Closed" : "● Live"}
                  </span>
                </div>

                {/* Question */}
                <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug mb-4">
                  {market.question}
                </h1>

                {/* YES / NO / Volume row */}
                <div className="border-t border-border pt-4">
                  <div className="grid grid-cols-3 gap-0 divide-x divide-border text-center">
                    <div className="px-4">
                      <p className="text-xs text-muted-foreground mb-0.5">Market</p>
                    </div>
                    <div className="px-4">
                      <p className="text-xs text-muted-foreground mb-0.5">Pays out</p>
                    </div>
                    <div className="px-4">
                      <p className="text-xs text-muted-foreground mb-0.5">Odds</p>
                    </div>
                  </div>

                  {/* YES row */}
                  <div className="grid grid-cols-3 gap-0 divide-x divide-border text-center mt-2">
                    <div className="px-4 py-2 text-left">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="font-semibold text-foreground">Yes</span>
                      </div>
                    </div>
                    <div className="px-4 py-2 text-center">
                      <span className="font-semibold text-foreground">
                        {yesCents > 0 ? (100 / yesCents).toFixed(2) : '—'}x
                      </span>
                    </div>
                    <div className="px-4 py-2 flex justify-center">
                      <span className="inline-block px-3 py-0.5 rounded-full border border-green-400 text-green-600 dark:text-green-400 font-bold text-sm">
                        {yesCents}%
                      </span>
                    </div>
                  </div>

                  {/* NO row */}
                  <div className="grid grid-cols-3 gap-0 divide-x divide-border text-center">
                    <div className="px-4 py-2 text-left">
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        <span className="font-semibold text-foreground">No</span>
                      </div>
                    </div>
                    <div className="px-4 py-2 text-center">
                      <span className="font-semibold text-foreground">
                        {noCents > 0 ? (100 / noCents).toFixed(2) : '—'}x
                      </span>
                    </div>
                    <div className="px-4 py-2 flex justify-center">
                      <span className="inline-block px-3 py-0.5 rounded-full border border-border text-muted-foreground font-bold text-sm">
                        {noCents}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Volume + category footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                  <span>{market.volume.toLocaleString()} vol</span>
                  <span>{market.category}</span>
                </div>

                {/* Description */}
                {market.description && (
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {market.description}
                  </p>
                )}
              </Card>

              {/* Order Book / Chart / Rules tabs */}
              <Card className="border border-border overflow-hidden">
                <Tabs defaultValue="orderbook" className="w-full">
                  <TabsList className="w-full grid grid-cols-3 rounded-none border-b border-border bg-muted/40 h-10">
                    <TabsTrigger value="orderbook" className="flex items-center gap-1 text-xs">
                      Order Book
                      <FeatureHelpTooltip title="Order Book" description="View all pending buy orders at different price levels." faqId="order-book" />
                    </TabsTrigger>
                    <TabsTrigger value="chart" className="flex items-center gap-1 text-xs">
                      Price Chart
                      <FeatureHelpTooltip title="Price Chart" description="Track how the market's probability has changed over time." faqId="price-meaning" />
                    </TabsTrigger>
                    <TabsTrigger value="rules" className="flex items-center gap-1 text-xs">
                      Rules
                      <FeatureHelpTooltip title="Resolution Rules" description="Understand exactly how this market will be resolved." faqId="market-resolves" />
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="orderbook" className="m-0">
                    <OrderBook marketId={market.id} />
                  </TabsContent>
                  <TabsContent value="chart" className="m-0">
                    <PriceChart data={priceHistory} />
                  </TabsContent>
                  <TabsContent value="rules" className="m-0 p-4">
                    <ResolutionRules
                      marketId={market.id}
                      expiryTime={market.expiryTime}
                      status={marketStatus}
                      outcome={marketOutcome}
                    />
                  </TabsContent>
                </Tabs>
              </Card>

              {/* My Orders — only for authenticated users */}
              {isAuthenticated && (
                <Card className="border border-border overflow-hidden">
                  <Tabs defaultValue="pending" className="w-full">
                    <div className="flex items-center justify-between px-4 pt-4 pb-0">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">My Orders</h3>
                      </div>
                      <TabsList className="h-7 bg-muted/50">
                        <TabsTrigger value="pending" className="text-xs h-6 px-3">Pending</TabsTrigger>
                        <TabsTrigger value="completed" className="text-xs h-6 px-3">Completed</TabsTrigger>
                      </TabsList>
                    </div>

                    {/* Pending Orders */}
                    <TabsContent value="pending" className="m-0 p-4 pt-3">
                      {ordersLoading ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
                      ) : pendingOrders.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No pending orders</p>
                      ) : (
                        <div className="space-y-2">
                          {pendingOrders.map((order) => {
                            const remaining = order.quantity - order.filled_quantity;
                            return (
                              <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={order.side === 'yes'
                                    ? 'text-green-600 border-green-400 text-xs'
                                    : 'text-red-500 border-red-400 text-xs'
                                  }>
                                    {order.side.toUpperCase()}
                                  </Badge>
                                  <div>
                                    <p className="text-xs font-medium">{remaining} contracts @ {(order.price * 100).toFixed(0)}¢</p>
                                    <p className="text-[10px] text-muted-foreground">{order.status === 'partial' ? `${order.filled_quantity}/${order.quantity} filled` : 'Limit order'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">${(remaining * order.price).toFixed(2)}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-destructive hover:text-destructive px-2"
                                    onClick={() => cancelOrder(order.id)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* Completed / Positions */}
                    <TabsContent value="completed" className="m-0 p-4 pt-3">
                      {ordersLoading ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
                      ) : completedOrders.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No completed orders</p>
                      ) : (
                        <div className="space-y-2">
                          {completedOrders.map((pos) => (
                            <div key={pos.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={pos.side === 'yes'
                                  ? 'text-green-600 border-green-400 text-xs'
                                  : 'text-red-500 border-red-400 text-xs'
                                }>
                                  {pos.side.toUpperCase()}
                                </Badge>
                                <div>
                                  <p className="text-xs font-medium">{pos.size} contracts @ {(pos.entry_price * 100).toFixed(0)}¢</p>
                                  <p className="text-[10px] text-muted-foreground capitalize">{pos.status} · {new Date(pos.opened_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                              {pos.pnl !== null ? (
                                <span className={`text-xs font-semibold ${pos.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">${(pos.size * pos.entry_price).toFixed(2)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </Card>
              )}
            </div>

            {/* ── RIGHT COLUMN — Trading Panel ── */}
            <div className="space-y-4">
              <OrderBookTrading
                marketId={market.id}
                yesPrice={market.yesPrice}
                noPrice={market.noPrice}
                userBalance={profile?.balance || 0}
                platformFeePercent={marketFees.platform}
                creatorFeePercent={marketFees.creator}
              />
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MarketDetail;
