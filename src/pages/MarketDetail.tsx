import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketHeader from "@/components/market-detail/MarketHeader";
import PriceChart from "@/components/market-detail/PriceChart";
import OrderBook from "@/components/market-detail/OrderBook";
import OrderBookTrading from "@/components/market-detail/OrderBookTrading";
import AMMTrading from "@/components/market-detail/AMMTrading";
import { mockMarkets } from "@/data/mockMarkets";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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

  const handleOrderPlaced = () => {
    // Refresh order book
    setOrderBook(generateOrderBook());
  };

  const handleAMMTrade = (side: "yes" | "no", shares: number) => {
    // Update prices based on LMSR logic
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
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/markets')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Markets
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Market Info */}
            <div className="lg:col-span-2 space-y-6">
              <MarketHeader market={market} />
              <PriceChart data={priceHistory} />
              
              {market.type === "orderbook" && (
                <OrderBook orders={orderBook} />
              )}
            </div>

            {/* Right Column - Trading Interface */}
            <div className="space-y-6">
              {market.type === "orderbook" ? (
                <OrderBookTrading 
                  marketId={market.id}
                  userBalance={userBalance}
                  onOrderPlaced={handleOrderPlaced}
                />
              ) : (
                <AMMTrading 
                  marketId={market.id}
                  yesPrice={market.yesPrice}
                  noPrice={market.noPrice}
                  userBalance={userBalance}
                  onTrade={handleAMMTrade}
                />
              )}

              {/* Market Stats */}
              <div className="bg-card border border-border rounded-lg p-6 space-y-3">
                <h3 className="text-sm font-semibold text-foreground mb-3">Market Statistics</h3>
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
            </div>
          </div>

          {/* Legal Disclaimer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground italic">
              Event contracts pay $1.00 if the outcome is correct, $0.00 if incorrect. 
              All trading is subject to CFTC regulations and Shariz Terms of Use. 
              Trade responsibly.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MarketDetail;
