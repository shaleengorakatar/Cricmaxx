import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { CheckCircle, XCircle, Loader2, HelpCircle, Sparkles, DollarSign, BookOpen, TrendingUp, LogIn, UserPlus, Coins, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTradingPreferences } from "@/hooks/useTradingPreferences";
import { OddsToggle } from "@/components/trading/OddsToggle";
import { SoundToggle } from "@/components/trading/SoundToggle";
import { StreakDisplay } from "@/components/trading/StreakDisplay";
import { TradeStatusOverlay, TradeStatus } from "@/components/trading/TradeStatusOverlay";
import { triggerConfetti, triggerHaptic, playSound, celebrateStreak, flashScreen } from "@/lib/tradingEffects";
import { useEstimatedFillPrice } from "@/hooks/useEstimatedFillPrice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PaymentMethodsDialog from "@/components/wallet/PaymentMethodsDialog";

interface SimpleTradingCardProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  userBalance: number;
  onScrollToOrderBook?: () => void;
  platformFeePercent?: number;
  creatorFeePercent?: number;
}

const STAKE_OPTIONS = [5, 10, 25, 50, 100];
const QUICK_AMOUNTS = [1, 5, 10];

const SimpleTradingCard = ({ 
  marketId, 
  yesPrice, 
  noPrice, 
  userBalance, 
  onScrollToOrderBook,
  platformFeePercent = 3,
  creatorFeePercent = 0
}: SimpleTradingCardProps) => {
  const { isAuthenticated, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [stakeAmount, setStakeAmount] = useState(10);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [lastTradeSide, setLastTradeSide] = useState<"yes" | "no" | null>(null);
  const [showNoLiquidityDialog, setShowNoLiquidityDialog] = useState(false);
  const [noLiquiditySide, setNoLiquiditySide] = useState<"yes" | "no">("yes");
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showInsufficientBalanceDialog, setShowInsufficientBalanceDialog] = useState(false);
  const [showBuyTokensDialog, setShowBuyTokensDialog] = useState(false);
  
  // Trade status overlay state
  const [tradeStatus, setTradeStatus] = useState<TradeStatus>('idle');
  const [tradeResult, setTradeResult] = useState<{
    side?: 'yes' | 'no';
    filledQuantity?: number;
    totalQuantity?: number;
    avgPrice?: number;
    error?: string;
    totalCost?: number;
    netPayout?: number;
    netProfit?: number;
    effectiveOdds?: number;
  }>({});
  
  const { 
    formatOdds, 
    soundEnabled, 
    incrementStreak, 
    predictionStreak 
  } = useTradingPreferences();

  // Get estimated fill prices from order book
  const { calculateEstimatedFill, hasLiquidity } = useEstimatedFillPrice(marketId);

  // Calculate estimated fills for current stake amount
  const yesEstimate = useMemo(() => 
    calculateEstimatedFill("yes", stakeAmount, yesPrice),
    [calculateEstimatedFill, stakeAmount, yesPrice]
  );
  
  const noEstimate = useMemo(() => 
    calculateEstimatedFill("no", stakeAmount, noPrice),
    [calculateEstimatedFill, stakeAmount, noPrice]
  );

  // Use estimated price if available, otherwise indicative
  const effectiveYesPrice = yesEstimate?.avgPrice ?? yesPrice;
  const effectiveNoPrice = noEstimate?.avgPrice ?? noPrice;

  // Calculate fee-adjusted payouts
  const totalFeePercent = platformFeePercent + creatorFeePercent;
  const feeMultiplier = 1 - (totalFeePercent / 100);
  
  // Calculate shares based on effective prices
  const yesShares = stakeAmount / effectiveYesPrice;
  const noShares = stakeAmount / effectiveNoPrice;
  
  // Gross payout is $1 per share, fee is applied to profit
  const yesGrossPayout = yesShares;
  const noGrossPayout = noShares;
  
  // Net payout after fees (fee applied to profit portion)
  const yesProfit = yesGrossPayout - stakeAmount;
  const noProfit = noGrossPayout - stakeAmount;
  const yesPayout = stakeAmount + (yesProfit * feeMultiplier);
  const noPayout = stakeAmount + (noProfit * feeMultiplier);

  const handleTrade = async (side: "yes" | "no") => {
    if (!isAuthenticated) {
      setShowAuthDialog(true);
      return;
    }

    if (userBalance < stakeAmount) {
      setShowInsufficientBalanceDialog(true);
      if (soundEnabled) playSound('error');
      return;
    }

    setIsPlacingTrade(true);
    setLastTradeSide(side);
    setTradeResult({ side });
    
    // Start the overlay flow
    setTradeStatus('submitting');
    if (soundEnabled) playSound('submit');

    try {
      // Simulate progression for better UX
      await new Promise(resolve => setTimeout(resolve, 300));
      setTradeStatus('matching');
      if (soundEnabled) playSound('click');
      
      const price = side === "yes" ? yesPrice : noPrice;
      const response = await supabase.functions.invoke("order-book", {
        body: {
          action: "place",
          marketId,
          side,
          orderType: "market",
          quantity: stakeAmount,
          price,
          maxBudget: stakeAmount, // Budget mode: spend up to $stakeAmount
        },
      });

      if (response.error) {
        throw new Error(response.error?.message || 'Trade failed');
      }

      // Check for no liquidity response
      if (response.data?.noLiquidity) {
        setTradeStatus('no-liquidity');
        setTradeResult({ side, error: 'No matching orders available' });
        setNoLiquiditySide(side);
        if (soundEnabled) playSound('error');
        flashScreen('warning');
        return;
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const orderData = response.data?.order;
      const filledQty = orderData?.filledQuantity || orderData?.filled_quantity || 0;
      const fillPrice = orderData?.avgFillPrice || orderData?.avg_fill_price || price;
      const position = orderData?.position;
      
      // Show filling state briefly
      setTradeStatus('filling');
      if (soundEnabled) playSound('filling');
      await new Promise(resolve => setTimeout(resolve, 400));

      if (filledQty === 0) {
        // No fill - show as no liquidity
        setTradeStatus('no-liquidity');
        setTradeResult({ side, error: 'No matching orders available' });
        setNoLiquiditySide(side);
        if (soundEnabled) playSound('error');
        flashScreen('warning');
        return;
      }

      // Success!
      setTradeResult({
        side,
        filledQuantity: filledQty,
        totalQuantity: filledQty,
        avgPrice: fillPrice,
        totalCost: position?.totalCost,
        netPayout: position?.netPayout,
        netProfit: position?.netProfit,
        effectiveOdds: position?.effectiveOdds,
      });
      
      const isPartial = filledQty < Math.round(stakeAmount / fillPrice) * 0.9;
      setTradeStatus(isPartial ? 'partial' : 'success');
      
      // Success effects
      triggerConfetti();
      triggerHaptic('success');
      flashScreen('success');
      if (soundEnabled) playSound(isPartial ? 'partial' : 'complete');
      
      // Update streak
      incrementStreak();
      const newStreak = predictionStreak + 1;
      if (newStreak >= 2) {
        celebrateStreak(newStreak);
        if (soundEnabled && newStreak % 3 === 0) playSound('streak');
      }
      
      // Refresh balance immediately after successful trade
      refetchProfile();

    } catch (error: any) {
      setTradeStatus('failed');
      setTradeResult({ side, error: error.message || 'Trade failed' });
      if (soundEnabled) playSound('error');
      flashScreen('error');
    } finally {
      setIsPlacingTrade(false);
      setTimeout(() => setLastTradeSide(null), 600);
    }
  };
  
  const handleTradeStatusComplete = () => {
    setTradeStatus('idle');
    setTradeResult({});
    
    // Show no liquidity dialog after overlay closes
    if (tradeStatus === 'no-liquidity') {
      setShowNoLiquidityDialog(true);
    }
  };

  const handleQuickPredict = async (side: "yes" | "no", amount: number) => {
    const originalAmount = stakeAmount;
    setStakeAmount(amount);
    await handleTrade(side);
    setStakeAmount(originalAmount);
  };

  // Get current path for redirect
  const currentPath = window.location.pathname + window.location.search;

  // Show auth prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <Card className="overflow-hidden border-2 border-primary/20 bg-card">
        {/* Header gradient */}
        <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />
        
        <CardContent className="p-6 space-y-5">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-bold">Quick Predict</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Sign in to start making predictions
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate(`/auth?mode=login&redirect=${encodeURIComponent(currentPath)}`)}
              className="h-12 gap-2"
              variant="default"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
            <Button
              onClick={() => navigate(`/auth?mode=signup&redirect=${encodeURIComponent(currentPath)}`)}
              className="h-12 gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <UserPlus className="h-4 w-4" />
              Sign Up
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            New to CricMaxx? Create a free account to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Trade Status Overlay */}
      <TradeStatusOverlay
        status={tradeStatus}
        side={tradeResult.side}
        filledQuantity={tradeResult.filledQuantity}
        totalQuantity={tradeResult.totalQuantity}
        avgPrice={tradeResult.avgPrice}
        error={tradeResult.error}
        totalCost={tradeResult.totalCost}
        netPayout={tradeResult.netPayout}
        netProfit={tradeResult.netProfit}
        effectiveOdds={tradeResult.effectiveOdds}
        onComplete={handleTradeStatusComplete}
      />
      
      <Card className="overflow-hidden border-2 border-primary/20 bg-card">
        {/* Header gradient */}
        <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />
        
        <CardContent className="p-6 space-y-6">
        {/* Title with toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-bold">Quick Predict</h3>
            </div>
            <div className="flex items-center gap-1">
              <OddsToggle />
              <SoundToggle />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Pick a side and predict the outcome
          </p>
          
          {/* Streak display */}
          <StreakDisplay />
        </div>

        {/* Quick Predict Buttons - One-tap at preset amounts */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="font-medium">One-tap predict</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <div key={amount} className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => handleQuickPredict("yes", amount)}
                  disabled={isPlacingTrade || amount > userBalance}
                  className="px-2 py-2 rounded-lg text-xs font-bold bg-success/10 hover:bg-success/20 text-success border border-success/30 transition-all disabled:opacity-40"
                >
                  ${amount} Yes
                </button>
                <button
                  onClick={() => handleQuickPredict("no", amount)}
                  disabled={isPlacingTrade || amount > userBalance}
                  className="px-2 py-2 rounded-lg text-xs font-bold bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-all disabled:opacity-40"
                >
                  ${amount} No
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or custom amount</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Stake Amount with Visual Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Stake amount</span>
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
              
              {/* Price display - show estimated if different from indicative */}
              {yesEstimate && Math.abs(yesEstimate.avgPrice - yesPrice) > 0.005 ? (
                <div className="space-y-0.5">
                  <p className="text-xs line-through opacity-60">{formatOdds(yesPrice)}</p>
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <p className="text-2xl font-black">{formatOdds(yesEstimate.avgPrice)}</p>
                  </div>
                  <p className="text-[10px] opacity-70">Est. fill price</p>
                </div>
              ) : (
                <p className="text-2xl font-black">{formatOdds(yesPrice)}</p>
              )}
              
              {/* Prominent payout display with fee info */}
              <div className="bg-white/20 rounded-lg p-2 space-y-1">
                <p className="text-xs font-medium opacity-80">If Yes, you get</p>
                <p className="text-xl font-black">${yesPayout.toFixed(2)}</p>
                <p className="text-[10px] opacity-60">After {totalFeePercent}% fee</p>
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
              
              {/* Price display - show estimated if different from indicative */}
              {noEstimate && Math.abs(noEstimate.avgPrice - noPrice) > 0.005 ? (
                <div className="space-y-0.5">
                  <p className="text-xs line-through opacity-60">{formatOdds(noPrice)}</p>
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <p className="text-2xl font-black">{formatOdds(noEstimate.avgPrice)}</p>
                  </div>
                  <p className="text-[10px] opacity-70">Est. fill price</p>
                </div>
              ) : (
                <p className="text-2xl font-black">{formatOdds(noPrice)}</p>
              )}
              
              {/* Prominent payout display with fee info */}
              <div className="bg-white/20 rounded-lg p-2 space-y-1">
                <p className="text-xs font-medium opacity-80">If No, you get</p>
                <p className="text-xl font-black">${noPayout.toFixed(2)}</p>
                <p className="text-[10px] opacity-60">After {totalFeePercent}% fee</p>
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
                <p className="font-semibold">How positions work:</p>
                <ul className="text-sm space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-success">✓</span>
                    <span><strong>If outcome matches:</strong> Tokens returned at 1:1</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">✗</span>
                    <span><strong>If outcome differs:</strong> 0 tokens returned</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">💡</span>
                    <span>Tokens are locked until market resolves</span>
                  </li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Balance Display */}
        {isAuthenticated && (
          <div className="text-center pt-4 border-t border-border/50">
            {userBalance > 0 ? (
              <p className="text-sm text-muted-foreground">
                Available tokens: <span className="font-bold text-foreground">{userBalance.toFixed(0)}</span>
              </p>
            ) : (
              <Button
                onClick={() => setShowBuyTokensDialog(true)}
                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <PlusCircle className="h-4 w-4" />
                Buy Tokens to Start
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* No Liquidity Dialog */}
      <Dialog open={showNoLiquidityDialog} onOpenChange={setShowNoLiquidityDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent" />
              No Orders in the Book
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                There are currently no {noLiquiditySide === 'yes' ? 'sellers' : 'buyers'} in the order book to match your market order.
              </p>
              <p className="text-sm">
                You can <strong>place a limit order</strong> to set your own price and wait for someone to take the other side.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button 
              onClick={() => {
                setShowNoLiquidityDialog(false);
                onScrollToOrderBook?.();
              }}
              className="w-full"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Go to Order Book
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowNoLiquidityDialog(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign In Required Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-xl">
              <Sparkles className="h-6 w-6 text-accent" />
              Sign In Required
            </DialogTitle>
            <DialogDescription className="text-center space-y-3 pt-4">
              <p className="text-base">
                You need to sign in to make predictions and start trading!
              </p>
              <p className="text-sm text-muted-foreground">
                Create a free account to get started with CricMaxx predictions.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button 
              onClick={() => {
                setShowAuthDialog(false);
                navigate(`/auth?mode=login&redirect=${encodeURIComponent(currentPath)}`);
              }}
              className="w-full h-12 gap-2"
            >
              <LogIn className="h-5 w-5" />
              Sign In
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setShowAuthDialog(false);
                navigate(`/auth?mode=signup&redirect=${encodeURIComponent(currentPath)}`);
              }}
              className="w-full h-12 gap-2"
            >
              <UserPlus className="h-5 w-5" />
              Create Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Insufficient Balance Dialog */}
      <Dialog open={showInsufficientBalanceDialog} onOpenChange={setShowInsufficientBalanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-xl">
              <Coins className="h-6 w-6 text-accent" />
              Insufficient Balance
            </DialogTitle>
            <DialogDescription className="text-center space-y-3 pt-4">
              <p className="text-base">
                You need more tokens to place this prediction.
              </p>
              <p className="text-sm text-muted-foreground">
                Your balance: <span className="font-bold">{userBalance.toFixed(0)} tokens</span>
                <br />
                Required: <span className="font-bold">{stakeAmount} tokens</span>
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button 
              onClick={() => {
                setShowInsufficientBalanceDialog(false);
                setShowBuyTokensDialog(true);
              }}
              className="w-full h-12 gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <PlusCircle className="h-5 w-5" />
              Buy Tokens
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowInsufficientBalanceDialog(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buy Tokens Dialog */}
      <PaymentMethodsDialog
        isOpen={showBuyTokensDialog}
        onClose={() => setShowBuyTokensDialog(false)}
        onSuccess={() => {
          setShowBuyTokensDialog(false);
          // Balance will refresh via parent component
        }}
      />
      </Card>
    </>
  );
};

export default SimpleTradingCard;
