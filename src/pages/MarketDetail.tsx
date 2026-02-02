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
import PayoutInfoTooltip from "@/components/market-detail/PayoutInfoTooltip";
import PriceAlerts from "@/components/market-detail/PriceAlerts";
import UserRatingBadge from "@/components/market-detail/UserRatingBadge";
import LiveTradeFeed from "@/components/market-detail/LiveTradeFeed";
import UserPositionCard from "@/components/market-detail/UserPositionCard";
import FeatureHelpTooltip from "@/components/FeatureHelpTooltip";
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

const MarketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, isAuthenticated } = useAuth();
  
  const [market, setMarket] = useState<Market | null>(null);
  const [marketStatus, setMarketStatus] = useState<string>('open');
  const [marketOutcome, setMarketOutcome] = useState<string | null>(null);
  const [marketFees, setMarketFees] = useState<{ platform: number; creator: number }>({ platform: 3, creator: 0 });
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [stakeAmount] = useState(10);
  const previousPricesRef = useRef<{ yes: number; no: number } | null>(null);
  
  // Real-time hooks
  const { prices: realtimePrices, isConnected: pricesConnected } = useRealtimeMarketPrices(id);
  const { trades: realtimeTrades, isConnected: tradesConnected } = useRealtimeTrades(id);
  
  // Indicative prices from order book
  const { prices: indicativePrices } = useBatchIndicativePrices(id ? [id] : []);
  
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
  }, [id, indicativePrices]);

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

    // Get indicative price from order book if available
    const indicative = indicativePrices.get(data.id);
    const yesPrice = indicative && indicative.source !== "default" 
      ? indicative.yesPrice 
      : Number(data.yes_price);
    const noPrice = indicative && indicative.source !== "default"
      ? indicative.noPrice
      : Number(data.no_price);

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
          {/* Back button row */}
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/markets')}
              className="-ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <RealtimeStatus isConnected={pricesConnected && tradesConnected} />
          </div>

          {/* Market Header - Compact */}
          <MarketHeader market={market} />

          {/* User Position Card - Show at top when user has a position */}
          {isAuthenticated && (
            <UserPositionCard 
              marketId={market.id}
              currentYesPrice={market.yesPrice}
              currentNoPrice={market.noPrice}
            />
          )}

          {/* Main 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Left column - Trading */}
            <div className="lg:col-span-2 space-y-4">
              {/* Trading Card */}
              <OrderBookTrading
                marketId={market.id}
                yesPrice={market.yesPrice}
                noPrice={market.noPrice}
                userBalance={profile?.balance || 0}
                platformFeePercent={marketFees.platform}
                creatorFeePercent={marketFees.creator}
              />
              
              {/* Order Book & Chart in tabs for space efficiency */}
              <Card>
                <Tabs defaultValue="orderbook" className="w-full">
                  <TabsList className="w-full grid grid-cols-3 rounded-b-none">
                    <TabsTrigger value="orderbook" className="flex items-center gap-1">
                      Order Book
                      <FeatureHelpTooltip
                        title="Order Book"
                        description="View all pending buy orders at different price levels. Click on any price to quickly place an order at that level."
                        faqId="order-book"
                      />
                    </TabsTrigger>
                    <TabsTrigger value="chart" className="flex items-center gap-1">
                      Price Chart
                      <FeatureHelpTooltip
                        title="Price Chart"
                        description="Track how the market's probability has changed over time. Price movements reflect changing opinions about the event's likelihood."
                        faqId="price-meaning"
                      />
                    </TabsTrigger>
                    <TabsTrigger value="rules" className="flex items-center gap-1">
                      Rules
                      <FeatureHelpTooltip
                        title="Resolution Rules"
                        description="Understand exactly how this market will be resolved—what data sources are used and what conditions determine YES vs NO outcomes."
                        faqId="market-resolves"
                      />
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
            </div>

            {/* Right column - Stats */}
            <div className="space-y-4">
              {/* Quick Stats Card */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold">Market Stats</h3>
                  <FeatureHelpTooltip
                    title="Market Stats"
                    description="Current market prices reflect the crowd's estimated probability. YES price of 65¢ means ~65% chance. Volume shows total trading activity."
                    faqId="price-meaning"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Yes Price</span>
                    <LivePrice 
                      price={market.yesPrice} 
                      previousPrice={previousPricesRef.current?.yes}
                      className="font-semibold text-lg text-primary"
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">No Price</span>
                    <LivePrice 
                      price={market.noPrice} 
                      previousPrice={previousPricesRef.current?.no}
                      className="font-semibold text-lg text-destructive"
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Volume</span>
                    <span className="font-semibold">{market.volume.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Fee</span>
                    <span className="font-semibold">3%</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border">
                  <PayoutInfoTooltip />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MarketDetail;