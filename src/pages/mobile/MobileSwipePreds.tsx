import { useState, useEffect } from "react";
import { MobileLayout } from "@/layouts/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, SkipForward, Settings, TrendingUp, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Market } from "@/types/market";

export default function MobileSwipePreds() {
  const { profile } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stakeAmount, setStakeAmount] = useState(5);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  const currentMarket = markets[currentIndex];

  useEffect(() => {
    fetchMarkets();
    const savedStake = localStorage.getItem("swipepreds_stake");
    if (savedStake) setStakeAmount(Number(savedStake));
  }, []);

  const fetchMarkets = async () => {
    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .in("status", ["approved", "open"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load markets",
        variant: "destructive",
      });
      return;
    }

    const formattedMarkets: Market[] = (data || []).map((m) => ({
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
  };

  const handleTrade = async (side: "yes" | "no") => {
    if (!profile || !currentMarket) return;
    
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
      const price = side === "yes" ? currentMarket.yesPrice : currentMarket.noPrice;
      const totalCost = stakeAmount * price;

      // Insert position
      const { error: positionError } = await supabase.from("positions").insert({
        user_id: profile.id,
        market_id: currentMarket.id,
        side,
        size: stakeAmount,
        entry_price: price,
        status: "open",
      });

      if (positionError) throw positionError;

      // Update balance
      const { error: balanceError } = await supabase
        .from("profiles")
        .update({ balance: profile.balance - totalCost })
        .eq("id", profile.id);

      if (balanceError) throw balanceError;

      // Insert transaction
      await supabase.from("transactions").insert({
        user_id: profile.id,
        type: "trade",
        amount: -totalCost,
        balance_before: profile.balance,
        balance_after: profile.balance - totalCost,
        status: "completed",
        metadata: { market_id: currentMarket.id, side, size: stakeAmount },
      });

      toast({
        title: "🎉 Prediction placed!",
        description: `${side.toUpperCase()} for $${stakeAmount}`,
      });

      setSwipeDirection(side === "yes" ? "right" : "left");
      setTimeout(() => {
        loadNextMarket();
        setSwipeDirection(null);
      }, 300);
    } catch (error: any) {
      toast({
        title: "Trade Failed",
        description: error.message,
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
    setSwipeDirection("left");
    setTimeout(() => {
      loadNextMarket();
      setSwipeDirection(null);
    }, 300);
  };

  const saveStakePreference = (value: number) => {
    setStakeAmount(value);
    localStorage.setItem("swipepreds_stake", value.toString());
    toast({
      title: "Saved",
      description: `Quick predict amount set to $${value}`,
    });
  };

  const getMarketTag = () => {
    if (!currentMarket) return null;
    const hoursUntilExpiry = (new Date(currentMarket.expiryTime).getTime() - Date.now()) / (1000 * 60 * 60);
    
    if (hoursUntilExpiry < 6) return { label: "🔥 Expiring Soon", variant: "destructive" as const };
    if (currentMarket.volume > 10000) return { label: "📈 Trending", variant: "default" as const };
    return { label: "⚡ Hot", variant: "secondary" as const };
  };

  if (!currentMarket) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-screen p-4">
          <p className="text-muted-foreground">Loading markets...</p>
        </div>
      </MobileLayout>
    );
  }

  const tag = getMarketTag();

  return (
    <MobileLayout>
      <div className="flex flex-col items-center justify-between min-h-screen p-4 pb-20">
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">⚡ SwipePreds</h1>
            <p className="text-sm text-muted-foreground">Quick predictions</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quick Predict Amount</DialogTitle>
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
                <div className="flex gap-2">
                  {[5, 10, 25, 50].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
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

        {/* Market Card */}
        <div
          className={`w-full max-w-md transition-transform duration-300 ${
            swipeDirection === "left" ? "-translate-x-full opacity-0" : ""
          } ${swipeDirection === "right" ? "translate-x-full opacity-0" : ""}`}
        >
          <Card className="border-2">
            <CardHeader>
              {tag && (
                <Badge variant={tag.variant} className="w-fit mb-2">
                  {tag.label}
                </Badge>
              )}
              <CardTitle className="text-xl leading-tight">{currentMarket.question}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-2">
                <Clock className="h-4 w-4" />
                Expires {new Date(currentMarket.expiryTime).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentMarket.imageUrl && (
                <img
                  src={currentMarket.imageUrl}
                  alt={currentMarket.question}
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                <div className="text-center flex-1">
                  <p className="text-sm text-muted-foreground">YES</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(currentMarket.yesPrice * 100).toFixed(0)}¢
                  </p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-sm text-muted-foreground">NO</p>
                  <p className="text-2xl font-bold text-red-600">
                    {(currentMarket.noPrice * 100).toFixed(0)}¢
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Volume: ${currentMarket.volume.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-md space-y-3">
          <div className="flex gap-3">
            <Button
              onClick={() => handleTrade("yes")}
              disabled={isPlacingTrade}
              size="lg"
              className="flex-1 h-16 text-lg font-bold bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-6 w-6" />
              YES
            </Button>
            <Button
              onClick={() => handleTrade("no")}
              disabled={isPlacingTrade}
              size="lg"
              className="flex-1 h-16 text-lg font-bold bg-red-600 hover:bg-red-700"
            >
              <XCircle className="mr-2 h-6 w-6" />
              NO
            </Button>
          </div>
          <Button
            onClick={handleSkip}
            disabled={isPlacingTrade}
            variant="outline"
            size="lg"
            className="w-full h-14 text-lg"
          >
            <SkipForward className="mr-2 h-5 w-5" />
            Skip
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Quick predict: ${stakeAmount} • Balance: ${profile?.balance.toFixed(2) || "0.00"}
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}
