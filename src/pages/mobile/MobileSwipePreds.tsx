import { useState, useEffect, useRef } from "react";
import { MobileLayout } from "@/layouts/MobileLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, SkipForward, Settings, TrendingUp, Clock, Flame, Zap, BarChart3, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Market } from "@/types/market";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function MobileSwipePreds() {
  const { profile } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stakeAmount, setStakeAmount] = useState(5);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  const currentMarket = markets[currentIndex];
  const nextMarket = markets[currentIndex + 1];
  const thirdMarket = markets[currentIndex + 2];

  useEffect(() => {
    fetchMarkets();
    const savedStake = localStorage.getItem("swipepreds_stake");
    if (savedStake) setStakeAmount(Number(savedStake));
  }, []);

  const fetchMarkets = async () => {
    const now = new Date();
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .in("status", ["approved", "open"])
      .lte("expiry_time", fourteenDaysFromNow.toISOString())
      .gte("expiry_time", now.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching markets:", error);
      toast({
        title: "Error loading markets",
        description: "Could not fetch prediction markets",
        variant: "destructive",
      });
      return;
    }

    if (!data || data.length === 0) {
      toast({
        title: "No markets available",
        description: "No active markets found. Check back soon!",
      });
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
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;
    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(dragOffset) > 100) {
      if (dragOffset > 0) {
        handleTrade("yes");
      } else {
        handleTrade("no");
      }
    }
    setDragOffset(0);
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
    setSwipeDirection(side === "yes" ? "right" : "left");

    // Check if market ID is a valid UUID (real market) or mock
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentMarket.id);
    
    if (!isValidUUID) {
      // Mock market - show demo success without DB insert
      toast({
        title: "🎉 Demo Prediction!",
        description: `${side.toUpperCase()} for $${stakeAmount} (demo mode)`,
      });
      setTimeout(() => {
        loadNextMarket();
        setSwipeDirection(null);
        setIsPlacingTrade(false);
      }, 300);
      return;
    }

    try {
      const price = side === "yes" ? currentMarket.yesPrice : currentMarket.noPrice;

      // Use order-book edge function for proper trading (positions count toward rating)
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
          description: `${side.toUpperCase()} - ${filledQty} shares`,
        });
      } else {
        toast({
          title: "Order placed",
          description: `${side.toUpperCase()} order added to book`,
        });
      }

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
      setSwipeDirection(null);
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

  if (!currentMarket) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <Zap className="h-16 w-16 mx-auto text-accent" />
            </div>
            <p className="text-muted-foreground text-lg">Loading markets...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const tag = getMarketTag(currentMarket);
  const rotation = dragOffset * 0.05;
  const yesOpacity = Math.min(dragOffset / 100, 1);
  const noOpacity = Math.min(-dragOffset / 100, 1);

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-background/80">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pt-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-accent" />
              RapidPreds
            </h1>
            <p className="text-xs text-muted-foreground">Swipe to predict</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-accent/10 text-accent px-3 py-1.5 rounded-full">
              <span className="text-sm font-semibold">${profile?.balance.toFixed(2) || "0.00"}</span>
            </div>
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <Settings className="h-5 w-5 text-muted-foreground" />
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

        {/* Card Stack Area */}
        <div className="flex-1 relative flex items-center justify-center px-4 pb-4 overflow-hidden">
          {/* Main card */}
          <div
            ref={cardRef}
            className={`relative w-full max-w-sm z-10 transition-all ${
              swipeDirection ? "duration-300" : isDragging ? "duration-0" : "duration-150"
            } ${swipeDirection === "left" ? "-translate-x-[120%] -rotate-12 opacity-0" : ""} 
            ${swipeDirection === "right" ? "translate-x-[120%] rotate-12 opacity-0" : ""}`}
            style={{
              transform: !swipeDirection ? `translateX(${dragOffset}px) rotate(${rotation}deg)` : undefined,
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* YES Overlay */}
            <div
              className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-green-500/20 border-4 border-green-500 pointer-events-none transition-opacity"
              style={{ opacity: Math.max(0, yesOpacity) }}
            >
              <span className="text-5xl font-black text-green-500 -rotate-12 border-4 border-green-500 px-4 py-2 rounded-lg">
                YES
              </span>
            </div>

            {/* NO Overlay */}
            <div
              className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-red-500/20 border-4 border-red-500 pointer-events-none transition-opacity"
              style={{ opacity: Math.max(0, noOpacity) }}
            >
              <span className="text-5xl font-black text-red-500 rotate-12 border-4 border-red-500 px-4 py-2 rounded-lg">
                NO
              </span>
            </div>

            <Card className="overflow-hidden rounded-2xl shadow-xl border border-border bg-card">
              {/* Image or gradient header */}
              <div className="relative h-36 bg-gradient-to-br from-accent/10 via-primary/5 to-secondary/10">
                {currentMarket.imageUrl ? (
                  <img
                    src={currentMarket.imageUrl}
                    alt={currentMarket.question}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-6xl">{getCategoryIcon(currentMarket.category)}</span>
                  </div>
                )}
                
                {/* Tags */}
                <div className="absolute top-3 left-3">
                  <Badge className={`${tag?.color} text-white text-xs font-medium`}>
                    {tag?.icon && <tag.icon className="h-3 w-3 mr-1" />}
                    {tag?.label}
                  </Badge>
                </div>
                <Badge variant="secondary" className="absolute top-3 right-3 text-xs bg-background/80">
                  {currentMarket.category}
                </Badge>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                <h2 className="text-lg font-bold leading-snug line-clamp-2">
                  {currentMarket.question}
                </h2>

                {/* Odds Display */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Yes</p>
                    <p className="text-2xl font-black text-green-500">
                      {(currentMarket.yesPrice * 100).toFixed(0)}¢
                    </p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">No</p>
                    <p className="text-2xl font-black text-red-500">
                      {(currentMarket.noPrice * 100).toFixed(0)}¢
                    </p>
                  </div>
                </div>

                {/* Meta info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>${currentMarket.volume.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(currentMarket.expiryTime).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Card counter and payout info */}
        <div className="text-center pb-2 flex items-center justify-center gap-3">
          <span className="text-xs text-muted-foreground">{currentIndex + 1} / {markets.length}</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <HelpCircle className="h-3.5 w-3.5" />
                <span>How it works</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-sm" align="center">
              <div className="space-y-3">
                <p className="font-semibold">How RapidPred Works</p>
                <p className="text-muted-foreground text-xs">
                  Swipe right for YES, left for NO. If your prediction is correct, you get <span className="font-semibold text-foreground">$1 per share</span>. If not, your share expires worthless.
                </p>
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-2">
                  <p className="text-muted-foreground text-xs">
                    <strong className="text-foreground">Important:</strong> The prediction must happen <em>exactly</em> as stated—if not, it resolves to NO.
                  </p>
                </div>
                <Link to="/faq#rapidpred" className="text-accent hover:underline text-xs block">
                  Learn more in FAQ →
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Action Buttons */}
        <div className="px-6 pb-24 space-y-2">
          <div className="flex items-center justify-center gap-6">
            {/* NO Button */}
            <Button
              onClick={() => handleTrade("no")}
              disabled={isPlacingTrade}
              size="lg"
              className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25 transition-transform active:scale-95"
            >
              <XCircle className="h-7 w-7" />
            </Button>

            {/* Skip Button */}
            <Button
              onClick={handleSkip}
              disabled={isPlacingTrade}
              variant="outline"
              size="lg"
              className="h-11 w-11 rounded-full border-2 border-muted-foreground/30"
            >
              <SkipForward className="h-5 w-5" />
            </Button>

            {/* YES Button */}
            <Button
              onClick={() => handleTrade("yes")}
              disabled={isPlacingTrade}
              size="lg"
              className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/25 transition-transform active:scale-95"
            >
              <CheckCircle className="h-7 w-7" />
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground pt-1">
            Stake: <span className="font-semibold text-foreground">${stakeAmount}</span>
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}
