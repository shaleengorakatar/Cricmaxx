import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, XCircle, SkipForward, Loader2, ChevronLeft, History, Info, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Market } from "@/types/market";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SessionTrade {
  id: string;
  marketQuestion: string;
  side: "yes" | "no";
  amount: number;
  shares: number;
  entryPrice: number;
  maxWin: number;
  risk: number;
  timestamp: Date;
}

const STAKE_OPTIONS = [5, 10, 25, 50];

const RapidPred = () => {
  const { profile, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stakeAmount, setStakeAmount] = useState(10);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastTrade, setLastTrade] = useState<SessionTrade | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [animateTrade, setAnimateTrade] = useState<"yes" | "no" | null>(null);
  const [sessionTrades, setSessionTrades] = useState<SessionTrade[]>(() => {
    const saved = localStorage.getItem("rapidpred_session_trades");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const currentMarket = markets[currentIndex];

  useEffect(() => {
    fetchMarkets();
    const savedStake = localStorage.getItem("rapidpred_stake");
    if (savedStake) setStakeAmount(Number(savedStake));
  }, []);

  useEffect(() => {
    if (lastTrade) {
      const timer = setTimeout(() => setLastTrade(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastTrade]);

  useEffect(() => {
    if (animateTrade) {
      const timer = setTimeout(() => setAnimateTrade(null), 600);
      return () => clearTimeout(timer);
    }
  }, [animateTrade]);

  const fetchMarkets = async () => {
    setLoading(true);
    const now = new Date();
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .in("status", ["approved", "open"])
      .lte("expiry_time", fourteenDaysFromNow.toISOString())
      .gte("expiry_time", now.toISOString())
      .order("expiry_time", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching markets:", error);
      toast({
        title: "Error loading markets",
        description: "Could not fetch prediction markets",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setLoading(false);
      return;
    }

    const formattedMarkets: Market[] = data.map((m) => ({
      id: m.id,
      question: m.question,
      category: m.category as Market["category"],
      type: m.type as Market["type"],
      yesPrice: Number(m.yes_price),
      noPrice: Number(m.no_price),
      volume: Number(m.volume),
      expiryTime: m.expiry_time,
      description: m.description || "",
      imageUrl: m.image_url || "",
    }));

    setMarkets(formattedMarkets);
    setLoading(false);
  };

  const handleTrade = async (side: "yes" | "no") => {
    if (!isAuthenticated || !profile) {
      toast({
        title: "Sign in required",
        description: "Please sign in to make predictions",
        variant: "destructive",
      });
      navigate("/auth?mode=login");
      return;
    }

    if (!currentMarket) return;

    if (profile.balance < stakeAmount) {
      toast({
        title: "Insufficient Balance",
        description: "Please add funds to your wallet",
        variant: "destructive",
      });
      return;
    }

    setAnimateTrade(side);
    setIsPlacingTrade(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const price = side === "yes" ? currentMarket.yesPrice : currentMarket.noPrice;

      const response = await supabase.functions.invoke("order-book", {
        body: {
          action: "place",
          marketId: currentMarket.id,
          side,
          orderType: "market",
          quantity: stakeAmount,
          price: price,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to place order");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const orderData = response.data?.order;
      const filledQty = orderData?.filledQuantity || 0;
      const fillPrice = orderData?.avgFillPrice || price;
      const position = orderData?.position;

      const maxWin = position?.maxWin || filledQty * (1 - fillPrice);
      const risk = position?.risk || filledQty * fillPrice;

      const newTrade: SessionTrade = {
        id: orderData?.id || Date.now().toString(),
        marketQuestion: currentMarket.question,
        side,
        amount: stakeAmount,
        shares: filledQty || stakeAmount,
        entryPrice: fillPrice,
        maxWin: maxWin,
        risk: risk,
        timestamp: new Date(),
      };

      setLastTrade(newTrade);
      setSessionTrades((prev) => {
        const updated = [newTrade, ...prev];
        localStorage.setItem("rapidpred_session_trades", JSON.stringify(updated));
        return updated;
      });

      if (filledQty > 0) {
        toast({
          title: "🎉 Prediction placed!",
          description: `${side.toUpperCase()} — Potential win: $${maxWin.toFixed(2)}`,
        });
      }

      loadNextMarket();
    } catch (error: any) {
      console.error("Trade error:", error);
      toast({
        title: "Trade Failed",
        description: error.message || "Could not place prediction",
        variant: "destructive",
      });
    } finally {
      setIsPlacingTrade(false);
    }
  };

  const loadNextMarket = () => {
    if (currentIndex < markets.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const loadPrevMarket = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setCurrentIndex(markets.length - 1);
    }
  };

  const handleSkip = () => loadNextMarket();

  const selectStake = (value: number) => {
    setStakeAmount(value);
    localStorage.setItem("rapidpred_stake", value.toString());
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
            <p className="text-muted-foreground">Loading markets...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!currentMarket) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center px-4">
          <Card className="max-w-md w-full p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold">No Markets Available</h2>
            <p className="text-muted-foreground">Check back soon for new prediction markets!</p>
            <Button onClick={fetchMarkets} className="bg-accent text-accent-foreground">
              Refresh
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Correct payout calculation: shares = stake / price, payout = shares * $1
  const yesShares = stakeAmount / currentMarket.yesPrice;
  const noShares = stakeAmount / currentMarket.noPrice;
  const yesTotal = yesShares; // Each share pays $1 if correct
  const noTotal = noShares;
  const yesProfit = yesTotal - stakeAmount;
  const noProfit = noTotal - stakeAmount;
  const yesOdds = 1 / currentMarket.yesPrice;
  const noOdds = 1 / currentMarket.noPrice;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 pt-20 pb-8 px-4">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <span className="font-bold text-lg">Quick Predict</span>
            </div>
            <div className="flex items-center gap-2">
              {isAuthenticated && (
                <Badge variant="secondary" className="text-sm py-1.5 px-3">
                  ${profile?.balance.toFixed(2) || "0.00"}
                </Badge>
              )}
              <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <History className="h-5 w-5" />
                    {sessionTrades.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                        {sessionTrades.length}
                      </span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Session History</DialogTitle>
                  </DialogHeader>
                  {sessionTrades.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No predictions yet</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-80">
                      <div className="space-y-2 pr-4">
                        {sessionTrades.map((trade) => (
                          <div key={trade.id} className="p-3 rounded-xl bg-muted/50 border border-border">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full ${trade.side === "yes" ? "bg-green-500/20" : "bg-red-500/20"}`}>
                                {trade.side === "yes" ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium line-clamp-2">{trade.marketQuestion}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span>Risk: ${trade.risk?.toFixed(2)}</span>
                                  <span className="text-green-500">Win: ${trade.maxWin?.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Last Trade Confirmation */}
          {lastTrade && (
            <div
              className={`p-3 rounded-xl border-2 animate-in slide-in-from-top-2 duration-300 ${
                lastTrade.side === "yes" ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"
              }`}
            >
              <div className="flex items-center gap-3">
                {lastTrade.side === "yes" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">Prediction placed!</p>
                  <p className="text-xs text-muted-foreground">Potential win: ${lastTrade.maxWin.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Prediction Card */}
          <Card
            className={`overflow-hidden rounded-3xl shadow-custom-xl border-2 transition-all duration-300 ${
              animateTrade === "yes"
                ? "border-green-500 scale-[0.98]"
                : animateTrade === "no"
                ? "border-red-500 scale-[0.98]"
                : "border-border"
            }`}
          >
            {/* Question */}
            <div className="p-6 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-xs">
                  {currentMarket.category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1}/{markets.length}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold leading-tight text-center">{currentMarket.question}</h2>
            </div>

            {/* Stake Selector */}
            <div className="px-6 pb-4">
              <p className="text-xs text-muted-foreground text-center mb-3">Stake Amount</p>
              <div className="flex justify-center gap-2">
                {STAKE_OPTIONS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => selectStake(amount)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                      stakeAmount === amount
                        ? "bg-accent text-accent-foreground shadow-md scale-105"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>

            {/* YES / NO Buttons */}
            <div className="p-6 pt-2 grid grid-cols-2 gap-4">
              {/* YES Button */}
              <button
                onClick={() => handleTrade("yes")}
                disabled={isPlacingTrade}
                className="group relative p-5 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30 transition-all duration-200 hover:shadow-xl hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlacingTrade && animateTrade === "yes" ? (
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-lg font-bold">YES</span>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black">Get ${yesTotal.toFixed(2)}</p>
                      <p className="text-xs opacity-80 mt-0.5">{yesOdds.toFixed(1)}x odds</p>
                      <p className="text-sm opacity-90 mt-1">Risk ${stakeAmount}</p>
                    </div>
                  </>
                )}
              </button>

              {/* NO Button */}
              <button
                onClick={() => handleTrade("no")}
                disabled={isPlacingTrade}
                className="group relative p-5 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30 transition-all duration-200 hover:shadow-xl hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlacingTrade && animateTrade === "no" ? (
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <XCircle className="h-5 w-5" />
                      <span className="text-lg font-bold">NO</span>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black">Get ${noTotal.toFixed(2)}</p>
                      <p className="text-xs opacity-80 mt-0.5">{noOdds.toFixed(1)}x odds</p>
                      <p className="text-sm opacity-90 mt-1">Risk ${stakeAmount}</p>
                    </div>
                  </>
                )}
              </button>
            </div>

            {/* Info Toggle */}
            <div className="px-6 pb-4">
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger className="flex items-center justify-center gap-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-4 w-4" />
                  <span>Market details</span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${showDetails ? "rotate-90" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-2 text-sm animate-in slide-in-from-top-2">
                  <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                    <span className="text-muted-foreground">Volume</span>
                    <span className="font-medium">${currentMarket.volume.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                    <span className="text-muted-foreground">Expires</span>
                    <span className="font-medium">{new Date(currentMarket.expiryTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                    <span className="text-muted-foreground">Yes odds</span>
                    <span className="font-medium">{yesOdds.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-muted/50">
                    <span className="text-muted-foreground">No odds</span>
                    <span className="font-medium">{noOdds.toFixed(2)}x</span>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Navigation */}
            <div className="px-6 pb-6 flex items-center justify-center gap-4">
              <Button onClick={loadPrevMarket} disabled={isPlacingTrade} variant="ghost" size="icon" className="h-12 w-12 rounded-full">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                onClick={handleSkip}
                disabled={isPlacingTrade}
                variant="outline"
                className="px-6 rounded-full border-2"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip
              </Button>
              <Button onClick={loadNextMarket} disabled={isPlacingTrade} variant="ghost" size="icon" className="h-12 w-12 rounded-full">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </Card>

          {/* View full market link */}
          <div className="text-center">
            <Button
              variant="link"
              onClick={() => navigate(`/market/${currentMarket.id}`)}
              className="text-muted-foreground hover:text-foreground"
            >
              View full market details →
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default RapidPred;
