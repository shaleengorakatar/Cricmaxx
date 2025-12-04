import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketHeader from "@/components/market-detail/MarketHeader";
import PriceChart from "@/components/market-detail/PriceChart";
import OrderBook from "@/components/market-detail/OrderBook";
import SimpleTradingInterface from "@/components/market-detail/SimpleTradingInterface";
import MarketCalculator from "@/components/market-detail/MarketCalculator";
import PriceAlerts from "@/components/market-detail/PriceAlerts";
import { Market } from "@/types/market";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Mock price history data
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

// Mock order book data
const generateOrderBook = () => {
  const orders = [];
  // Yes orders
  for (let i = 0; i < 5; i++) {
    orders.push({
      id: `yes-${i}`,
      side: "yes" as const,
      price: 0.65 - (i * 0.01),
      quantity: Math.floor(Math.random() * 500) + 50,
    });
  }
  // No orders
  for (let i = 0; i < 5; i++) {
    orders.push({
      id: `no-${i}`,
      side: "no" as const,
      price: 0.35 + (i * 0.01),
      quantity: Math.floor(Math.random() * 500) + 50,
    });
  }
  return orders;
};

const MarketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [orderBook, setOrderBook] = useState(generateOrderBook());
  const [isTrading, setIsTrading] = useState(false);
  
  // Mobile collapsible sections
  const [chartExpanded, setChartExpanded] = useState(true);
  const [orderBookExpanded, setOrderBookExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

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

  const handleTrade = async (side: "yes" | "no", shares: number) => {
    if (!user || !profile) {
      toast({
        title: "Authentication required",
        description: "Please sign in to place predictions",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    if (isTrading) return;
    setIsTrading(true);

    try {
      const entryPrice = side === "yes" ? market.yesPrice : market.noPrice;
      const cost = shares * entryPrice;

      // Check balance
      if (cost > profile.balance) {
        toast({
          title: "Insufficient balance",
          description: `You need ${cost.toFixed(2)} credits but have ${profile.balance.toFixed(2)}`,
          variant: "destructive",
        });
        setIsTrading(false);
        return;
      }

      // Create position in database
      const { data: position, error: positionError } = await supabase
        .from('positions')
        .insert({
          user_id: user.id,
          market_id: market.id,
          side: side,
          size: shares,
          entry_price: entryPrice,
          status: 'open'
        })
        .select()
        .single();

      if (positionError) throw positionError;

      // Deduct cost from user balance
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ balance: profile.balance - cost })
        .eq('id', user.id);

      if (balanceError) throw balanceError;

      // Create transaction record
      await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'trade',
          amount: -cost,
          balance_before: profile.balance,
          balance_after: profile.balance - cost,
          status: 'completed',
          metadata: {
            market_id: market.id,
            position_id: position.id,
            side: side,
            shares: shares,
            price: entryPrice
          }
        });

      // Calculate new market stats
      const priceImpact = shares * 0.001; // Simple price impact formula
      const newYesPrice = side === "yes" 
        ? Math.min(0.99, market.yesPrice + priceImpact)
        : Math.max(0.01, market.yesPrice - priceImpact);
      const newVolume = market.volume + shares;

      // Update market in database with new volume and prices
      const { error: marketError } = await supabase
        .from('markets')
        .update({ 
          volume: newVolume,
          yes_price: newYesPrice,
          no_price: 1 - newYesPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', market.id);

      if (marketError) {
        console.error('Failed to update market stats:', marketError);
      }

      toast({
        title: "Prediction placed successfully!",
        description: `Bought ${shares} ${side.toUpperCase()} shares at $${entryPrice.toFixed(2)}. Cost: ${cost.toFixed(2)} credits`,
      });

      // Update local market state for immediate visual feedback
      setMarket(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          yesPrice: newYesPrice,
          noPrice: 1 - newYesPrice,
          volume: newVolume,
        };
      });

      if (market.type === "orderbook") {
        setOrderBook(generateOrderBook());
      }

      setPriceHistory(prev => [
        ...prev.slice(-23),
        {
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          yesPrice: newYesPrice,
          noPrice: 1 - newYesPrice,
        }
      ]);
    } catch (error: any) {
      console.error('Trade error:', error);
      toast({
        title: "Trade failed",
        description: error.message || "Failed to place prediction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTrading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/markets')}
            className="mb-4 sm:mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Markets
          </Button>

          {/* Mobile: Single column layout, Desktop: Grid layout */}
          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Market Info & Chart Section */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              <MarketHeader market={market} />
              
              {/* Collapsible Price Chart on Mobile */}
              <div className="md:block">
                <Card className="overflow-hidden">
                  <button
                    onClick={() => setChartExpanded(!chartExpanded)}
                    className="md:hidden w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <h3 className="text-base font-semibold text-foreground">Price History</h3>
                    {chartExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className={`${chartExpanded ? 'block' : 'hidden'} md:block`}>
                    <PriceChart data={priceHistory} />
                  </div>
                </Card>
              </div>
              
              {/* Order Book - Collapsible on mobile for orderbook markets */}
              {market.type === "orderbook" && (
                <div className="md:block">
                  <Card className="overflow-hidden">
                    <button
                      onClick={() => setOrderBookExpanded(!orderBookExpanded)}
                      className="md:hidden w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <h3 className="text-base font-semibold text-foreground">Order Book</h3>
                      {orderBookExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className={`${orderBookExpanded ? 'block' : 'hidden'} md:block`}>
                      <OrderBook orders={orderBook} />
                    </div>
                  </Card>
                </div>
              )}
            </div>

            {/* Trading Section - Always visible on mobile, sticky on desktop */}
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-24 lg:self-start">
              <Tabs defaultValue="trade" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="trade">Trade</TabsTrigger>
                  <TabsTrigger value="calculator">Calculator</TabsTrigger>
                  <TabsTrigger value="alerts">Alerts</TabsTrigger>
                </TabsList>
                <TabsContent value="trade" className="mt-4">
                  <SimpleTradingInterface
                    marketId={market.id}
                    yesPrice={market.yesPrice}
                    noPrice={market.noPrice}
                    userBalance={profile?.balance || 0}
                    marketType={market.type}
                    onTrade={handleTrade}
                  />
                </TabsContent>
                <TabsContent value="calculator" className="mt-4">
                  <MarketCalculator
                    yesPrice={market.yesPrice}
                    noPrice={market.noPrice}
                  />
                </TabsContent>
                <TabsContent value="alerts" className="mt-4">
                  <PriceAlerts
                    marketId={market.id}
                    currentYesPrice={market.yesPrice}
                    currentNoPrice={market.noPrice}
                  />
                </TabsContent>
              </Tabs>

              {/* Market Stats - Collapsible on mobile */}
              <Card className="overflow-hidden">
                <button
                  onClick={() => setStatsExpanded(!statsExpanded)}
                  className="md:hidden w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <h3 className="text-sm font-semibold text-foreground">Market Statistics</h3>
                  {statsExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <div className={`${statsExpanded ? 'block' : 'hidden'} md:block p-4 sm:p-6 space-y-3`}>
                  <h3 className="text-sm font-semibold text-foreground mb-3 hidden md:block">Market Statistics</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Volume:</span>
                      <span className="font-semibold text-foreground">
                        {market.volume.toLocaleString()} shares
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Market Type:</span>
                      <span className="font-semibold text-foreground">
                        {market.type === "orderbook" ? "Order Book" : "Automated Market"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform Fee:</span>
                      <span className="font-semibold text-foreground">2%</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Legal Disclaimer - Responsive */}
          <div className="mt-6 sm:mt-8 bg-muted/30 border border-border rounded-lg p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground mb-2 sm:mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Important Trading Disclosure
            </h3>
            <p className="text-xs sm:text-xs text-muted-foreground leading-relaxed italic">
              <strong className="text-foreground not-italic">Disclaimer:</strong> Shariz offers fixed-payout event contracts (binary options) 
              that pay $1.00 if the predicted event occurs and $0.00 if not. All markets are regulated by the U.S. Commodity Futures 
              Trading Commission (CFTC) as event contracts under federal commodity law, not gambling. Trading involves substantial risk 
              of loss. Only trade with funds you can afford to lose. Past performance does not guarantee future results. 
              See <a href="/terms" className="text-accent hover:underline">Terms of Use</a> for complete details and risk disclosures.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MarketDetail;
