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
import { mockMarkets } from "@/data/mockMarkets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

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
  const [userBalance] = useState(10950);
  const [market, setMarket] = useState(mockMarkets.find(m => m.id === id));
  const [priceHistory, setPriceHistory] = useState(market ? generatePriceHistory(market.yesPrice) : []);
  const [orderBook, setOrderBook] = useState(generateOrderBook());
  
  // Mobile collapsible sections
  const [chartExpanded, setChartExpanded] = useState(true);
  const [orderBookExpanded, setOrderBookExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

  useEffect(() => {
    const foundMarket = mockMarkets.find(m => m.id === id);
    if (foundMarket) {
      setMarket(foundMarket);
      setPriceHistory(generatePriceHistory(foundMarket.yesPrice));
    }
  }, [id]);

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

  const handleTrade = (side: "yes" | "no", shares: number) => {
    if (market.type === "orderbook") {
      // Refresh order book for orderbook markets
      setOrderBook(generateOrderBook());
    } else {
      // Update prices based on LMSR logic for AMM markets
      const priceImpact = shares * 0.001;
      setMarket(prev => {
        if (!prev) return prev;
        const newYesPrice = side === "yes" 
          ? Math.min(0.99, prev.yesPrice + priceImpact)
          : Math.max(0.01, prev.yesPrice - priceImpact);
        return {
          ...prev,
          yesPrice: newYesPrice,
          noPrice: 1 - newYesPrice,
        };
      });

      // Add to price history
      setPriceHistory(prev => [
        ...prev.slice(-23),
        {
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
        }
      ]);
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
                    userBalance={userBalance}
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
