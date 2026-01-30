import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketHeader from "@/components/market-detail/MarketHeader";
import PriceChart from "@/components/market-detail/PriceChart";
import OrderBook from "@/components/market-detail/OrderBook";
import OrderBookTrading from "@/components/market-detail/OrderBookTrading";
import { ResolutionRules } from "@/components/market-detail/ResolutionRules";
import MarketCreatorInfo from "@/components/market-detail/MarketCreatorInfo";
import MarketCalculator from "@/components/market-detail/MarketCalculator";
import PriceAlerts from "@/components/market-detail/PriceAlerts";
import UserRatingBadge from "@/components/market-detail/UserRatingBadge";
import LiveTradeFeed from "@/components/market-detail/LiveTradeFeed";
import UserPositionCard from "@/components/market-detail/UserPositionCard";
import { Market } from "@/types/market";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertCircle, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeMarketPrices, useRealtimeTrades } from "@/hooks/useRealtimeMarket";
import { RealtimeStatus, LivePrice } from "@/components/ui/realtime-indicators";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

const MarketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, isAuthenticated } = useAuth();
  
  const [market, setMarket] = useState<Market | null>(null);
  const [marketStatus, setMarketStatus] = useState<string>('open');
  const [marketOutcome, setMarketOutcome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [stakeAmount] = useState(10);
  const previousPricesRef = useRef<{ yes: number; no: number } | null>(null);
  
  // Real-time hooks
  const { prices: realtimePrices, isConnected: pricesConnected } = useRealtimeMarketPrices(id);
  const { trades: realtimeTrades, isConnected: tradesConnected } = useRealtimeTrades(id);
  
  // Mobile collapsible sections
  const [chartExpanded, setChartExpanded] = useState(true);
  const [orderBookExpanded, setOrderBookExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  
  // Update market with realtime prices
  useEffect(() => {
    if (realtimePrices && market) {
      previousPricesRef.current = { yes: market.yesPrice, no: market.noPrice };
      
      setMarket(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          yesPrice: Number(realtimePrices.yes_price),
          noPrice: Number(realtimePrices.no_price),
          volume: Number(realtimePrices.volume),
        };
      });

      // Add new price point to chart
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

  useEffect(() => {
    fetchMarket();
  }, [id]);

  const fetchMarket = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("Error fetching market:", error);
      setLoading(false);
      return;
    }

    const formattedMarket: Market = {
      id: data.id,
      question: data.question,
      category: data.category as Market["category"],
      type: data.type as Market["type"],
      yesPrice: Number(data.yes_price),
      noPrice: Number(data.no_price),
      volume: Number(data.volume),
      expiryTime: data.expiry_time,
      description: data.description || "",
      imageUrl: data.image_url || "",
    };

    setMarket(formattedMarket);
    setMarketStatus(data.status);
    setMarketOutcome(data.outcome);
    setPriceHistory(generatePriceHistory(formattedMarket.yesPrice));
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading market...</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Market not found</h1>
          <Button onClick={() => navigate('/markets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Markets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-8">
        <div className="container mx-auto px-4">
          {/* Compact header row */}
          <div className="flex items-center justify-between mb-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/markets')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            
            <div className="flex items-center gap-2">
              <RealtimeStatus isConnected={pricesConnected && tradesConnected} />
              <UserRatingBadge />
            </div>
          </div>

          {/* Market Header - Compact */}
          <MarketHeader market={market} />
          
          {/* Compact Stats Bar */}
          <Card className="my-4 p-3">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Yes:</span>
                <LivePrice 
                  price={market.yesPrice} 
                  previousPrice={previousPricesRef.current?.yes}
                  className="font-semibold text-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">No:</span>
                <LivePrice 
                  price={market.noPrice} 
                  previousPrice={previousPricesRef.current?.no}
                  className="font-semibold text-destructive"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Volume:</span>
                <span className="font-semibold">{market.volume.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Fee:</span>
                <span className="font-semibold">3%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Payout:</span>
                <span className="font-semibold">$1.00/share</span>
              </div>
            </div>
          </Card>

          {/* Main Grid - Trading + Position side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Trading Panel */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="trade" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-9">
                  <TabsTrigger value="trade" className="text-xs sm:text-sm">Trade</TabsTrigger>
                  <TabsTrigger value="feed" className="text-xs sm:text-sm">Feed</TabsTrigger>
                  <TabsTrigger value="calculator" className="text-xs sm:text-sm">Calc</TabsTrigger>
                  <TabsTrigger value="alerts" className="text-xs sm:text-sm">Alerts</TabsTrigger>
                </TabsList>
                <TabsContent value="trade" className="mt-3">
                  <OrderBookTrading
                    marketId={market.id}
                    yesPrice={market.yesPrice}
                    noPrice={market.noPrice}
                    userBalance={profile?.balance || 0}
                  />
                </TabsContent>
                <TabsContent value="feed" className="mt-3">
                  <LiveTradeFeed marketId={market.id} maxHeight="280px" />
                </TabsContent>
                <TabsContent value="calculator" className="mt-3">
                  <MarketCalculator
                    yesPrice={market.yesPrice}
                    noPrice={market.noPrice}
                  />
                </TabsContent>
                <TabsContent value="alerts" className="mt-3">
                  <PriceAlerts
                    marketId={market.id}
                    currentYesPrice={market.yesPrice}
                    currentNoPrice={market.noPrice}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar - Position & Info */}
            <div className="space-y-4">
              <UserPositionCard 
                marketId={market.id}
                currentYesPrice={market.yesPrice}
                currentNoPrice={market.noPrice}
              />
              <MarketCreatorInfo marketId={market.id} />
            </div>
          </div>

          {/* Order Book + Price Chart - Side by Side on Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* Order Book */}
            <Card className="overflow-hidden">
              <button
                onClick={() => setOrderBookExpanded(!orderBookExpanded)}
                className="md:hidden w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              >
                <h3 className="text-sm font-semibold text-foreground">Order Book</h3>
                {orderBookExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <div className={`${orderBookExpanded ? 'block' : 'hidden'} md:block`}>
                <OrderBook marketId={market.id} />
              </div>
            </Card>

            {/* Price Chart */}
            <Card className="overflow-hidden">
              <button
                onClick={() => setChartExpanded(!chartExpanded)}
                className="md:hidden w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              >
                <h3 className="text-sm font-semibold text-foreground">Price History</h3>
                {chartExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <div className={`${chartExpanded ? 'block' : 'hidden'} md:block`}>
                <PriceChart data={priceHistory} />
              </div>
            </Card>
          </div>

          {/* Resolution Rules - Collapsible at bottom */}
          <div className="mt-4">
            <ResolutionRules 
              marketId={market.id}
              expiryTime={market.expiryTime}
              status={marketStatus}
              outcome={marketOutcome}
            />
          </div>

          {/* CFTC Disclaimer - Compact */}
          <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <p>
              CFTC-regulated event contracts. Pays $1.00 if correct, $0.00 if incorrect.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MarketDetail;