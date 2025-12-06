import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CheckCircle, XCircle, SkipForward, Settings, TrendingUp, Clock, Flame, Zap, BarChart3, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Market } from "@/types/market";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";

const RapidPred = () => {
  const { profile, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stakeAmount, setStakeAmount] = useState(5);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentMarket = markets[currentIndex];

  useEffect(() => {
    fetchMarkets();
    const savedStake = localStorage.getItem("rapidpred_stake");
    if (savedStake) setStakeAmount(Number(savedStake));
  }, []);

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

    setIsPlacingTrade(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const price = side === "yes" ? currentMarket.yesPrice : currentMarket.noPrice;

      // Use order-book edge function for proper trading
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

      const filledQty = response.data?.order?.filledQuantity || 0;
      
      if (filledQty > 0) {
        toast({
          title: "🎉 Prediction placed!",
          description: `${side.toUpperCase()} - ${filledQty} shares filled`,
        });
      } else {
        // Order pending in book
        toast({
          title: "Order placed",
          description: `${side.toUpperCase()} order added to book`,
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

  const handleSkip = () => {
    loadNextMarket();
  };

  const saveStakePreference = (value: number) => {
    setStakeAmount(value);
    localStorage.setItem("rapidpred_stake", value.toString());
    setSettingsOpen(false);
    toast({
      title: "Saved",
      description: `Quick predict amount set to $${value}`,
    });
  };

  const getMarketTag = (market: Market) => {
    if (!market) return null;
    const hoursUntilExpiry = (new Date(market.expiryTime).getTime() - Date.now()) / (1000 * 60 * 60);
    
    if (hoursUntilExpiry < 6) return { label: "Expiring Soon", icon: Flame, color: "bg-red-500" };
    if (market.volume > 10000) return { label: "Trending", icon: TrendingUp, color: "bg-accent" };
    return { label: "Hot", icon: Zap, color: "bg-orange-500" };
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      Cricket: "🏏",
      Politics: "🏛️",
      Finance: "💰",
      Technology: "💻",
      Sports: "⚽",
      Entertainment: "🎬",
    };
    return icons[category] || "📊";
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
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <Card className="max-w-md mx-4">
            <CardContent className="pt-6 text-center space-y-4">
              <Zap className="h-16 w-16 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-bold">No Markets Available</h2>
              <p className="text-muted-foreground">
                Check back soon for new prediction markets!
              </p>
              <Button onClick={fetchMarkets} className="bg-accent text-accent-foreground">
                Refresh
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const tag = getMarketTag(currentMarket);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Zap className="h-8 w-8 text-accent" />
                RapidPred
              </h1>
              <p className="text-muted-foreground mt-1">
                Quick predictions, fast wins
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isAuthenticated && (
                <Badge variant="outline" className="text-sm py-1 px-3">
                  Balance: ${profile?.balance.toFixed(2) || "0.00"}
                </Badge>
              )}
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Quick Predict Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Label>Stake Amount: ${stakeAmount}</Label>
                    <Slider
                      value={[stakeAmount]}
                      onValueChange={(v) => setStakeAmount(v[0])}
                      min={1}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex gap-2 flex-wrap">
                      {[5, 10, 25, 50, 100].map((amount) => (
                        <Button
                          key={amount}
                          variant={stakeAmount === amount ? "default" : "outline"}
                          size="sm"
                          onClick={() => setStakeAmount(amount)}
                        >
                          ${amount}
                        </Button>
                      ))}
                    </div>
                    <Button onClick={() => saveStakePreference(stakeAmount)} className="w-full">
                      Save Preference
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-2xl mx-auto">
            {/* Market Card */}
            <Card className="overflow-hidden rounded-2xl shadow-xl border border-border bg-card">
              {/* Image or gradient header */}
              <div className="relative h-48 bg-gradient-to-br from-accent/10 via-primary/5 to-secondary/10">
                {currentMarket.imageUrl ? (
                  <img
                    src={currentMarket.imageUrl}
                    alt={currentMarket.question}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-8xl">{getCategoryIcon(currentMarket.category)}</span>
                  </div>
                )}
                
                {/* Tags */}
                <div className="absolute top-4 left-4">
                  <Badge className={`${tag?.color} text-white text-sm font-medium`}>
                    {tag?.icon && <tag.icon className="h-4 w-4 mr-1" />}
                    {tag?.label}
                  </Badge>
                </div>
                <Badge variant="secondary" className="absolute top-4 right-4 bg-background/80">
                  {currentMarket.category}
                </Badge>
              </div>

              {/* Content */}
              <CardContent className="p-6 space-y-6">
                <h2 className="text-2xl font-bold leading-snug">
                  {currentMarket.question}
                </h2>

                {/* Odds Display */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">Yes</p>
                    <p className="text-4xl font-black text-green-500">
                      {(currentMarket.yesPrice * 100).toFixed(0)}¢
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Win ${(stakeAmount / currentMarket.yesPrice).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">No</p>
                    <p className="text-4xl font-black text-red-500">
                      {(currentMarket.noPrice * 100).toFixed(0)}¢
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Win ${(stakeAmount / currentMarket.noPrice).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Meta info */}
                <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Volume: ${currentMarket.volume.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Expires: {new Date(currentMarket.expiryTime).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Stake indicator */}
                <div className="text-center text-sm text-muted-foreground">
                  Stake: <span className="font-semibold text-foreground">${stakeAmount}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-6">
                  {/* NO Button */}
                  <Button
                    onClick={() => handleTrade("no")}
                    disabled={isPlacingTrade}
                    size="lg"
                    className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25 transition-transform active:scale-95"
                  >
                    {isPlacingTrade ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                      <XCircle className="h-8 w-8" />
                    )}
                  </Button>

                  {/* Skip Button */}
                  <Button
                    onClick={handleSkip}
                    disabled={isPlacingTrade}
                    variant="outline"
                    size="lg"
                    className="h-12 w-12 rounded-full border-2 border-muted-foreground/30"
                  >
                    <SkipForward className="h-6 w-6" />
                  </Button>

                  {/* YES Button */}
                  <Button
                    onClick={() => handleTrade("yes")}
                    disabled={isPlacingTrade}
                    size="lg"
                    className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/25 transition-transform active:scale-95"
                  >
                    {isPlacingTrade ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                      <CheckCircle className="h-8 w-8" />
                    )}
                  </Button>
                </div>

                {/* Card counter */}
                <div className="text-center">
                  <span className="text-sm text-muted-foreground">
                    {currentIndex + 1} / {markets.length} markets
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* View full market link */}
            <div className="text-center mt-4">
              <Button
                variant="link"
                onClick={() => navigate(`/market/${currentMarket.id}`)}
                className="text-muted-foreground hover:text-foreground"
              >
                View full market details →
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default RapidPred;
