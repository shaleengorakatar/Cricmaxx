import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CheckCircle, XCircle, Loader2, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SimpleTradingCardProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  userBalance: number;
}

const SimpleTradingCard = ({ marketId, yesPrice, noPrice, userBalance }: SimpleTradingCardProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stakeAmount, setStakeAmount] = useState(10);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);

  const yesMultiplier = Math.round((1 / yesPrice) * 10) / 10;
  const noMultiplier = Math.round((1 / noPrice) * 10) / 10;
  const yesWin = stakeAmount * (1 - yesPrice);
  const noWin = stakeAmount * (1 - noPrice);

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
      const maxWin = stakeAmount * (1 - fillPrice);

      toast({
        title: "🎉 Prediction placed!",
        description: `${side.toUpperCase()} @ ${(fillPrice * 100).toFixed(0)}¢ — Win up to $${maxWin.toFixed(2)}`,
      });
    } catch (error: any) {
      toast({
        title: "Trade Failed",
        description: error.message || "Could not place prediction",
        variant: "destructive",
      });
    } finally {
      setIsPlacingTrade(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardContent className="p-6 space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-1">Quick Predict</h3>
          <p className="text-sm text-muted-foreground">
            Simple mode — just pick Yes or No
          </p>
        </div>

        {/* Stake Amount */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Your bet</span>
            <span className="text-xl font-bold">${stakeAmount}</span>
          </div>
          <Slider
            value={[stakeAmount]}
            onValueChange={(v) => setStakeAmount(v[0])}
            min={1}
            max={Math.min(100, userBalance || 100)}
            step={1}
          />
          <div className="flex gap-2">
            {[5, 10, 25, 50].map((amount) => (
              <Button
                key={amount}
                variant={stakeAmount === amount ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setStakeAmount(amount)}
                disabled={amount > userBalance}
              >
                ${amount}
              </Button>
            ))}
          </div>
        </div>

        {/* Prediction Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleTrade("yes")}
            disabled={isPlacingTrade}
            className="group relative p-6 rounded-2xl bg-green-500/10 border-2 border-green-500/30 hover:border-green-500 hover:bg-green-500/20 transition-all disabled:opacity-50"
          >
            <div className="text-center space-y-2">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500" />
              <p className="text-sm font-medium text-muted-foreground">YES</p>
              <p className="text-3xl font-black text-green-500">{yesMultiplier}x</p>
              <p className="text-sm text-green-500 font-semibold">
                Win ${yesWin.toFixed(2)}
              </p>
            </div>
            {isPlacingTrade && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-2xl">
                <Loader2 className="h-6 w-6 animate-spin text-green-500" />
              </div>
            )}
          </button>

          <button
            onClick={() => handleTrade("no")}
            disabled={isPlacingTrade}
            className="group relative p-6 rounded-2xl bg-red-500/10 border-2 border-red-500/30 hover:border-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
          >
            <div className="text-center space-y-2">
              <XCircle className="h-8 w-8 mx-auto text-red-500" />
              <p className="text-sm font-medium text-muted-foreground">NO</p>
              <p className="text-3xl font-black text-red-500">{noMultiplier}x</p>
              <p className="text-sm text-green-500 font-semibold">
                Win ${noWin.toFixed(2)}
              </p>
            </div>
            {isPlacingTrade && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-2xl">
                <Loader2 className="h-6 w-6 animate-spin text-red-500" />
              </div>
            )}
          </button>
        </div>

        {/* Help text */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <HelpCircle className="h-3.5 w-3.5" />
                  How does this work?
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  <strong>If you're right:</strong> You get your bet × the multiplier shown.
                  <br /><br />
                  <strong>If you're wrong:</strong> You lose your bet.
                  <br /><br />
                  Higher multiplier = less likely to happen (but bigger payout!)
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Balance */}
        {isAuthenticated && (
          <div className="text-center text-sm text-muted-foreground pt-2 border-t border-border">
            Available: <span className="font-semibold text-foreground">${userBalance.toFixed(2)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleTradingCard;
