import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketHeader from "@/components/market-detail/MarketHeader";
import PriceChart from "@/components/market-detail/PriceChart";
import OrderBook from "@/components/market-detail/OrderBook";
import OrderBookTrading from "@/components/market-detail/OrderBookTrading";
import MarketCalculator from "@/components/market-detail/MarketCalculator";
import PriceAlerts from "@/components/market-detail/PriceAlerts";
import UserRatingBadge from "@/components/market-detail/UserRatingBadge";
import { Market } from "@/types/market";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
  const { profile } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  
  // Mobile collapsible sections
  const [chartExpanded, setChartExpanded] = useState(true);
  const [orderBookExpanded, setOrderBookExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

  useEffect(() => {
    fetchMarket();
  }, [id]);

  // Real-time subscription for market updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`market-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('Real-time market update:', payload);
          const data = payload.new as any;
          
          setMarket(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              yesPrice: Number(data.yes_price),
              noPrice: Number(data.no_price),
              volume: Number(data.volume),
            };
          });

          // Add new price point to chart
          setPriceHistory(prev => [
            ...prev.slice(-23),
            {
              time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              yesPrice: Number(data.yes_price),
              noPrice: Number(data.no_price),
            }
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/markets')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Markets
            </Button>
            
            {/* User Rating Badge */}
            <UserRatingBadge />
          </div>

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
              
              {/* Order Book - Collapsible on mobile */}
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
                    <OrderBook marketId={market.id} />
                  </div>
                </Card>
              </div>
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
                  <OrderBookTrading
                    marketId={market.id}
                    yesPrice={market.yesPrice}
                    noPrice={market.noPrice}
                    userBalance={profile?.balance || 0}
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
                      <span className="font-semibold text-foreground">Order Book</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform Fee:</span>
                      <span className="font-semibold text-foreground">3%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Settlement:</span>
                      <span className="font-semibold text-foreground">$1.00 per winning share</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* CFTC Disclaimer */}
              <Card className="p-4 bg-muted/30">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Shariz offers fixed-payout event contracts regulated by CFTC. 
                    If your prediction is correct, you receive $1.00 per share. 
                    If incorrect, your shares expire worthless. This is not gambling.
                  </p>
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