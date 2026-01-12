import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { CheckCircle, XCircle, Loader2, HelpCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SimpleTradingCardProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  userBalance: number;
}

const STAKE_OPTIONS = [5, 10, 25, 50, 100];

const SimpleTradingCard = ({ marketId, yesPrice, noPrice, userBalance }: SimpleTradingCardProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stakeAmount, setStakeAmount] = useState(10);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [lastTradeSide, setLastTradeSide] = useState<"yes" | "no" | null>(null);

  const yesMultiplier = Math.round((1 / yesPrice) * 10) / 10;
  const noMultiplier = Math.round((1 / noPrice) * 10) / 10;
  const yesShares = stakeAmount / yesPrice;
  const noShares = stakeAmount / noPrice;
  const yesWin = yesShares - stakeAmount;
  const noWin = noShares - stakeAmount;

  const handleTrade = async (side: "yes" | "no") => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to make predictions",
        variant: "destructive",
      });
      navigate("/auth?mode=login");
      return;
    }

    if (userBalance < stakeAmount) {
      toast({
        title: "Insufficient Balance",
        description: "Please add funds to your wallet",
        variant: "destructive",
      });
      return;
    }

    setIsPlacingTrade(true);
    setLastTradeSide(side);

    try {
      const price = side === "yes" ? yesPrice : noPrice;
      const response = await supabase.functions.invoke("order-book", {
        body: {
          action: "place",
          marketId,
          side,
          orderType: "market",
          quantity: stakeAmount,
          price,
        },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.error?.message || response.data?.error);
      }

      const orderData = response.data?.order;
      const fillPrice = orderData?.avgFillPrice || price;
      const shares = stakeAmount / fillPrice;
      const maxWin = shares - stakeAmount;

      toast({
        title: "🎉 Prediction placed!",
        description: `${side.toUpperCase()} — You could win $${maxWin.toFixed(2)}!`,
      });
    } catch (error: any) {
      toast({
        title: "Trade Failed",
        description: error.message || "Could not place prediction",
        variant: "destructive",
      });
    } finally {
      setIsPlacingTrade(false);
      setTimeout(() => setLastTradeSide(null), 600);
    }
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/20 bg-card">
      {/* Header gradient */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />
      
      <CardContent className="p-6 space-y-6">
        {/* Title */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-bold">Quick Predict</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Pick a side and predict the outcome
          </p>
        </div>

        {/* Stake Amount with Visual Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Your stake</span>
            <div className="flex items-center gap-1">
              <span className="text-3xl font-bold text-foreground">${stakeAmount}</span>
            </div>
          </div>
          
          {/* Slider */}
          <div className="py-2">
            <Slider
              value={[stakeAmount]}
              onValueChange={(v) => setStakeAmount(v[0])}
              min={1}
              max={Math.min(100, userBalance || 100)}
              step={1}
              className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_[role=slider]]:shadow-lg"
            />
          </div>
          
          {/* Quick amount pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {STAKE_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => setStakeAmount(Math.min(amount, userBalance || 100))}
                disabled={amount > userBalance}
                className={cn(
                  "transition-all duration-200",
                  stakeAmount === amount ? "stake-pill-active" : "stake-pill-inactive",
                  amount > userBalance && "opacity-40 cursor-not-allowed"
                )}
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Prediction Buttons */}
        <div className="grid grid-cols-2 gap-4">
          {/* YES Button */}
          <button
            onClick={() => handleTrade("yes")}
            disabled={isPlacingTrade}
            className={cn(
              "btn-yes relative p-5 rounded-2xl overflow-hidden",
              lastTradeSide === "yes" && "animate-celebrate"
            )}
          >
            {/* Shimmer effect on hover */}
            <div className="absolute inset-0 bg-shimmer animate-shimmer opacity-0 hover:opacity-100 transition-opacity" />
            
            <div className="relative text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="h-6 w-6" />
                <span className="text-lg font-bold">YES</span>
              </div>
              <p className="text-4xl font-black">{yesMultiplier}x</p>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold opacity-90">
                  Win ${yesWin.toFixed(2)}
                </p>
                <p className="text-xs opacity-75">
                  Get ${yesShares.toFixed(2)} back
                </p>
              </div>
            </div>
            
            {isPlacingTrade && lastTradeSide === "yes" && (
              <div className="absolute inset-0 flex items-center justify-center bg-success/90 rounded-2xl">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
          </button>

          {/* NO Button */}
          <button
            onClick={() => handleTrade("no")}
            disabled={isPlacingTrade}
            className={cn(
              "btn-no relative p-5 rounded-2xl overflow-hidden",
              lastTradeSide === "no" && "animate-celebrate"
            )}
          >
            {/* Shimmer effect on hover */}
            <div className="absolute inset-0 bg-shimmer animate-shimmer opacity-0 hover:opacity-100 transition-opacity" />
            
            <div className="relative text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <XCircle className="h-6 w-6" />
                <span className="text-lg font-bold">NO</span>
              </div>
              <p className="text-4xl font-black">{noMultiplier}x</p>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold opacity-90">
                  Win ${noWin.toFixed(2)}
                </p>
                <p className="text-xs opacity-75">
                  Get ${noShares.toFixed(2)} back
                </p>
              </div>
            </div>
            
            {isPlacingTrade && lastTradeSide === "no" && (
              <div className="absolute inset-0 flex items-center justify-center bg-destructive/90 rounded-2xl">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
          </button>
        </div>

        {/* Help text */}
        <div className="flex items-center justify-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-full bg-muted/50 hover:bg-muted">
                  <HelpCircle className="h-3.5 w-3.5" />
                  How does this work?
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-4 space-y-2">
                <p className="font-semibold">Simple prediction trading:</p>
                <ul className="text-sm space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-success">✓</span>
                    <span><strong>If you're right:</strong> Get your stake × multiplier</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">✗</span>
                    <span><strong>If you're wrong:</strong> Lose your stake</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">💡</span>
                    <span>Higher multiplier = lower probability (but bigger payout!)</span>
                  </li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Balance Display */}
        {isAuthenticated && (
          <div className="text-center pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Available balance: <span className="font-bold text-foreground">${userBalance.toFixed(2)}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleTradingCard;