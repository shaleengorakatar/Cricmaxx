import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Loader2, Info, X, AlertTriangle, BookOpen, Sparkles, LogIn, UserPlus, Coins, PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import MarketHowItWorks from "@/components/markets/MarketHowItWorks";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useHaptics } from "@/hooks/useHaptics";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LiquidityWarning, LiquidityIndicator } from "./LiquidityWarning";
import { EstimatedFillPreview } from "./EstimatedFillPreview";
import { PartialFillDialog } from "./PartialFillDialog";
import { TradeStatusOverlay, TradeStatus } from "@/components/trading/TradeStatusOverlay";
import { playSound, flashScreen, triggerConfetti, triggerHaptic } from "@/lib/tradingEffects";
import { useTradingPreferences } from "@/hooks/useTradingPreferences";
import { useIndicativePrice } from "@/hooks/useIndicativePrice";
import { useRealtimeOrderBook } from "@/hooks/useRealtimeOrderBook";
import { useEstimatedFillPrice } from "@/hooks/useEstimatedFillPrice";
import FeatureHelpTooltip from "@/components/FeatureHelpTooltip";
import PaymentMethodsDialog from "@/components/wallet/PaymentMethodsDialog";

interface OrderBookTradingProps {
  marketId: string;
  yesPrice: number; // Fallback from parent
  noPrice: number;  // Fallback from parent
  userBalance: number;
  platformFeePercent?: number;
  creatorFeePercent?: number;
  defaultSide?: "yes" | "no";
  onSideChange?: (side: "yes" | "no") => void;
}

interface OrderBookLevel {
  price: number;
  quantity: number;
}

interface UserOrder {
  id: string;
  side: string;
  price: number;
  quantity: number;
  filled_quantity: number;
  status: string;
  created_at: string;
}

interface UserPosition {
  id: string;
  side: string;
  size: number;
  entry_price: number;
  status: string;
}

const OrderBookTrading = ({ 
  marketId, 
  yesPrice: fallbackYesPrice, 
  noPrice: fallbackNoPrice, 
  userBalance,
  platformFeePercent = 0,
  creatorFeePercent = 0,
  defaultSide,
}: OrderBookTradingProps) => {
  const { user, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { trigger: haptic } = useHaptics();
  const { soundEnabled } = useTradingPreferences();
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Use indicative price hook for accurate pricing based on last trade / order book
  const { 
    yesPrice: indicativeYesPrice, 
    noPrice: indicativeNoPrice, 
    source: priceSource, 
    hasLiquidity,
    loading: priceLoading 
  } = useIndicativePrice(marketId);
  
  // Use estimated fill price hook for dangerous price detection
  const { calculateEstimatedFill } = useEstimatedFillPrice(marketId);
  
  // Use indicative prices, fallback to props if still loading
  const yesPrice = priceLoading ? fallbackYesPrice : indicativeYesPrice;
  const noPrice = priceLoading ? fallbackNoPrice : indicativeNoPrice;
  const [tradingMode, setTradingMode] = useState<"simple" | "advanced">("simple");
  const [side, setSide] = useState<"yes" | "no">(defaultSide ?? "yes");
  
  // Sync side when defaultSide prop changes (e.g. clicking YES/NO cards)
  useEffect(() => {
    if (defaultSide) setSide(defaultSide);
  }, [defaultSide]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNoLiquidityDialog, setShowNoLiquidityDialog] = useState(false);
  const [noLiquiditySide, setNoLiquiditySide] = useState<"yes" | "no">("yes");
  const [noLiquidityAmount, setNoLiquidityAmount] = useState<number>(0);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showInsufficientBalanceDialog, setShowInsufficientBalanceDialog] = useState(false);
  const [showBuyTokensDialog, setShowBuyTokensDialog] = useState(false);
  const [insufficientBalanceAmount, setInsufficientBalanceAmount] = useState(0);
  
  // Dangerous price warning dialog state
  const [showDangerousPriceDialog, setShowDangerousPriceDialog] = useState(false);
  const [dangerousPriceData, setDangerousPriceData] = useState<{
    side: "yes" | "no";
    marketPrice: number;
    fillPrice: number;
    contracts: number;
    totalCost: number;
  } | null>(null);
  
  // Trade status overlay state
  const [tradeStatus, setTradeStatus] = useState<TradeStatus>('idle');
  const [tradeResult, setTradeResult] = useState<{
    side?: 'yes' | 'no';
    filledQuantity?: number;
    totalQuantity?: number;
    avgPrice?: number;
    error?: string;
  }>({});
  
  // Get current path for redirect after login
  const currentPath = window.location.pathname + window.location.search;
  
  // Partial fill dialog state
  const [showPartialFillDialog, setShowPartialFillDialog] = useState(false);
  const [partialFillData, setPartialFillData] = useState<{
    requestedAmount: number;
    filledQuantity: number;
    avgFillPrice: number;
    unfilledAmount: number;
    side: "yes" | "no";
  } | null>(null);
  
  // Simple mode state - toggle between contracts and dollars input (dollars first for UX)
  const [inputMode, setInputMode] = useState<"contracts" | "dollars">("dollars");
  const [contractCount, setContractCount] = useState("");
  const [dollarAmount, setDollarAmount] = useState("");
  
  // Advanced mode state
  const [advancedInputMode, setAdvancedInputMode] = useState<"contracts" | "dollars">("dollars");
  const [limitPrice, setLimitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [advancedDollarAmount, setAdvancedDollarAmount] = useState("");
  
  // Order book state - use optimized realtime hook
  const { 
    orderBook, 
    isConnected: orderBookConnected, 
    addOptimisticOrder,
    refetch: refetchOrderBook 
  } = useRealtimeOrderBook({ 
    marketId, 
    userId: user?.id,
    debounceMs: 50 // Fast updates for responsiveness
  });
  const [userOrders, setUserOrders] = useState<UserOrder[]>([]);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [pendingOrdersExpanded, setPendingOrdersExpanded] = useState(false);
  
  const handleTradeStatusComplete = () => {
    setTradeStatus('idle');
    setTradeResult({});
    if (tradeStatus === 'no-liquidity') {
      setShowNoLiquidityDialog(true);
    }
  };
  

  // Subscribe to user orders and positions updates
  useEffect(() => {
    if (user) {
      fetchUserOrders();
      fetchUserPosition();
    }

    // Subscribe to user-specific updates only (order book handled by hook)
    const channel = supabase
      .channel(`user-data-${marketId}-${user?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `market_id=eq.${marketId}`
        },
        () => {
          if (user) fetchUserOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'positions',
          filter: `market_id=eq.${marketId}`
        },
        () => {
          if (user) fetchUserPosition();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, user]);

  const fetchUserOrders = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('market_id', marketId)
      .eq('user_id', user.id)
      .in('status', ['pending', 'partial'])
      .order('created_at', { ascending: false });

    setUserOrders(data || []);
  };

  const fetchUserPosition = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('positions')
      .select('*')
      .eq('market_id', marketId)
      .eq('user_id', user.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    // Combine positions if multiple exist
    if (data && data.length > 0) {
      setUserPosition(data[0]);
    } else {
      setUserPosition(null);
    }
  };

  // Ref guard to prevent rapid double-submissions
  const tradeInProgressRef = useRef(false);

  const handleSimpleTrade = async (skipDangerousCheck = false) => {
    // Client-side guard prevents rapid double-clicks
    if (tradeInProgressRef.current || isSubmitting) return;
    
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    // Calculate contracts based on input mode
    const currentPrice = side === "yes" ? yesPrice : noPrice;
    const dollarBudget = inputMode === "dollars" ? parseFloat(dollarAmount) : null;
    const contractsToTrade = inputMode === "contracts"
      ? parseInt(contractCount)
      : Math.floor(parseFloat(dollarAmount) / Math.max(currentPrice, 0.01));

    if (!contractsToTrade || contractsToTrade <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }

    const cost = dollarBudget || (contractsToTrade * currentPrice);
    if (cost > userBalance) {
      setInsufficientBalanceAmount(cost);
      setShowInsufficientBalanceDialog(true);
      haptic('warning');
      return;
    }

    // Check for dangerous price fills (unless user already confirmed)
    if (!skipDangerousCheck) {
      const estimate = calculateEstimatedFill(side, cost, currentPrice);
      if (estimate) {
        const priceDifferencePercent = Math.abs(estimate.priceImpact);
        // Warn if estimated fill price differs by more than 15% from market price
        if (priceDifferencePercent > 15) {
          setDangerousPriceData({
            side,
            marketPrice: currentPrice,
            fillPrice: estimate.avgPrice,
            contracts: contractsToTrade,
            totalCost: cost,
          });
          setShowDangerousPriceDialog(true);
          haptic('warning');
          return;
        }
      }
    }

    // Set both guards
    tradeInProgressRef.current = true;
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('order-book', {
        body: {
          action: 'place',
          marketId,
          side,
          orderType: 'market',
          quantity: contractsToTrade,
          // Use budget mode when input is in dollars to spend the full amount
          ...(dollarBudget ? { maxBudget: dollarBudget } : {})
        }
      });

      if (error) throw error;

      // Check for no liquidity response or failed order
      if (data?.noLiquidity || data?.success === false) {
        setNoLiquiditySide(side);
        setNoLiquidityAmount(cost);
        setShowNoLiquidityDialog(true);
        haptic('warning');
        // Reset guards before early return
        tradeInProgressRef.current = false;
        setIsSubmitting(false);
        return;
      }

      const filledQty = data.order?.filledQuantity || data.order?.filled_quantity || 0;
      const avgPrice = data.order?.avgFillPrice || data.order?.avg_fill_price || currentPrice;
      const position = data.order?.position;
      const actualCost = position?.totalCost || (filledQty * avgPrice);
      const unfilledAmount = cost - actualCost;

      // Check for partial fill
      if (filledQty > 0 && filledQty < contractsToTrade && unfilledAmount > 0.01) {
        setPartialFillData({
          requestedAmount: cost,
          filledQuantity: filledQty,
          avgFillPrice: avgPrice,
          unfilledAmount: unfilledAmount,
          side: side,
        });
        setShowPartialFillDialog(true);
      } else if (filledQty > 0) {
        // Show success with detailed position info
        haptic('success');
        const winText = position?.netPayout 
          ? ` — if correct, you win ${position.netPayout.toFixed(2)} tokens`
          : '';
        toast({
          title: "Prediction placed!",
          description: `${filledQty} ${side.toUpperCase()} contracts @ ${(avgPrice * 100).toFixed(0)}¢${winText}`,
        });
      } else {
        // Order was cancelled or no fill happened - show dialog only (no toast)
        haptic('warning');
        setNoLiquiditySide(side);
        setNoLiquidityAmount(cost);
        setShowNoLiquidityDialog(true);
        // Reset guards before early return
        tradeInProgressRef.current = false;
        setIsSubmitting(false);
        return;
      }

      setContractCount("");
      setDollarAmount("");
      refetchOrderBook();
      fetchUserOrders();
      fetchUserPosition();
      
      // Refresh balance immediately after trade
      refetchProfile();
    } catch (error: any) {
      haptic('error');
      toast({
        title: "Order failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    } finally {
      tradeInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleAdvancedTrade = async () => {
    // Client-side guard prevents rapid double-clicks
    if (tradeInProgressRef.current || isSubmitting) return;
    
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    const price = parseFloat(limitPrice);
    const qty = parseFloat(quantity);

    // Enforce 1-99 cents range for limit orders
    if (!price || price < 0.01 || price > 0.99) {
      toast({ title: "Price must be between 1¢ and 99¢", variant: "destructive" });
      return;
    }

    if (!qty || qty <= 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }

    const cost = qty * price;
    if (cost > userBalance) {
      setInsufficientBalanceAmount(cost);
      setShowInsufficientBalanceDialog(true);
      haptic('warning');
      return;
    }

    // Set both guards
    tradeInProgressRef.current = true;
    setIsSubmitting(true);
    
    // Optimistically add order to order book for instant UI feedback
    addOptimisticOrder(side, price, qty);

    try {
      const { data, error } = await supabase.functions.invoke('order-book', {
        body: {
          action: 'place',
          marketId,
          side,
          orderType: 'limit',
          quantity: qty,
          price
        }
      });

      if (error) throw error;

      const filledQty = data.order?.filledQuantity || 0;
      const isFilled = filledQty >= qty;
      const isPartial = filledQty > 0 && filledQty < qty;
      const isPending = filledQty === 0;
      
      const status = isFilled ? 'Order Filled!' : 
        isPartial ? 'Partially Filled' : 'Pending in Order Book';
      
      // Better description for pending orders
      const description = isPending 
        ? `Waiting for a match: ${qty} contracts @ ${(price * 100).toFixed(0)}¢`
        : `${filledQty}/${qty} contracts @ ${(price * 100).toFixed(0)}¢`;

      haptic('success');
      toast({
        title: status,
        description,
      });

      setLimitPrice("");
      setQuantity("");
      refetchOrderBook();
      fetchUserOrders();
      fetchUserPosition();
      
      // Refresh balance after trade (tokens are reserved for pending orders)
      refetchProfile();
    } catch (error: any) {
      haptic('error');
      toast({
        title: "Order failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    } finally {
      tradeInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const response = await supabase.functions.invoke('order-book', {
        body: { action: 'cancel', orderId }
      });

      if (response.error) throw response.error;

      // Handle already processed orders gracefully
      if (response.data?.alreadyProcessed) {
        toast({ 
          title: response.data.status === 'filled' ? "Order already filled" : "Order already cancelled",
          description: response.data.message
        });
      } else {
        toast({ title: "Order cancelled" });
      }
      
      fetchUserOrders();
      refetchOrderBook();
    } catch (error: any) {
      toast({
        title: "Cancel failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Unified calculations based on input mode
  const currentPrice = side === "yes" ? yesPrice : noPrice;
  
  // Calculate contracts and cost based on input mode
  const contracts = inputMode === "contracts" 
    ? (contractCount ? parseInt(contractCount) : 0)
    : (dollarAmount ? Math.floor(parseFloat(dollarAmount) / Math.max(currentPrice, 0.01)) : 0);
  
  const totalCost = inputMode === "contracts"
    ? contracts * currentPrice
    : (dollarAmount ? parseFloat(dollarAmount) : 0);
  
  // Fee calculations
  const totalFeePercent = platformFeePercent + creatorFeePercent;
  const feeMultiplier = 1 - (totalFeePercent / 100);
  
  // Gross payout is $1 per contract, fee applies to profit
  const grossPayout = contracts; // Each contract = $1 payout
  const grossProfit = grossPayout - totalCost;
  const potentialProfit = grossProfit * feeMultiplier;
  const totalPayout = totalCost + potentialProfit; // Net payout after fees
  
  const advancedCost = quantity && limitPrice ? parseFloat(quantity) * parseFloat(limitPrice) : 0;
  
  // For display consistency
  const hasValidInput = inputMode === "contracts" ? contracts > 0 : (dollarAmount && parseFloat(dollarAmount) > 0);

  // Handle switching to limit order with pre-filled values
  const handleSwitchToLimitOrder = () => {
    const priceToUse = noLiquiditySide === "yes" ? yesPrice : noPrice;
    const amountToUse = noLiquidityAmount;
    
    // Pre-fill the form
    setAdvancedInputMode("dollars");
    setAdvancedDollarAmount(amountToUse.toFixed(2));
    setLimitPrice(priceToUse.toFixed(2));
    
    // Calculate contracts
    if (priceToUse > 0) {
      const contracts = Math.floor(amountToUse / priceToUse);
      setQuantity(contracts > 0 ? contracts.toString() : '');
    }
    
    // Close dialog and switch to advanced mode
    setShowNoLiquidityDialog(false);
    setTradingMode("advanced");
    
    // Scroll to card after a short delay to let state update
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

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
        onComplete={handleTradeStatusComplete}
      />
      
      <Card ref={cardRef} className="p-4 sm:p-6">
      {/* How It Works */}
      <div className="px-4 pt-3">
        <MarketHowItWorks compact />
      </div>

      {/* Side Selection */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Choose outcome</span>
          </div>
          <LiquidityIndicator marketId={marketId} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={side === "yes" ? "default" : "outline"}
            className={`h-16 ${side === "yes" ? "bg-primary hover:bg-primary/90" : ""}`}
            onClick={() => { setSide("yes"); haptic('light'); }}
          >
            <TrendingUp className="h-5 w-5 mr-2" />
            <div className="text-left">
              <div className="font-bold text-lg">YES</div>
              <div className="text-xs opacity-80">{(yesPrice * 100).toFixed(0)}¢</div>
            </div>
          </Button>
          <Button
            variant={side === "no" ? "default" : "outline"}
            className={`h-16 ${side === "no" ? "bg-destructive hover:bg-destructive/90" : ""}`}
            onClick={() => { setSide("no"); haptic('light'); }}
          >
            <TrendingDown className="h-5 w-5 mr-2" />
            <div className="text-left">
              <div className="font-bold text-lg">NO</div>
              <div className="text-xs opacity-80">{(noPrice * 100).toFixed(0)}¢</div>
            </div>
          </Button>
        </div>
      </div>

      {/* Trading Mode Tabs */}
      <Tabs value={tradingMode} onValueChange={(v) => setTradingMode(v as "simple" | "advanced")}>
        <TabsList className="grid w-full grid-cols-2 mb-4 h-10">
          <TabsTrigger value="simple" className="relative flex items-center justify-center gap-1 text-sm">
            Quick Predict
            <FeatureHelpTooltip
              title="Quick Predict"
              description="The fastest way to trade! Choose your amount, tap YES or NO, and your order executes instantly at the current market price. Perfect for live markets where prices move quickly."
              faqId="quick-predict"
            />
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center justify-center gap-1 text-sm">
            Set Your Price
            <FeatureHelpTooltip
              title="Set Your Price (Limit Order)"
              description="Choose the exact price you're willing to pay. Your order waits in the order book until someone agrees to trade at your price. Great for getting better prices or when there's low liquidity."
              faqId="set-your-price"
            />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-4">
          {/* Input Mode Toggle + Amount Entry */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-muted-foreground">
                {inputMode === "contracts" ? "How much do you want to win?" : "How much do you want to spend?"}
              </Label>
              {/* Dropdown toggle like Kalshi */}
              <button
                onClick={() => setInputMode(inputMode === "contracts" ? "dollars" : "contracts")}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {inputMode === "contracts" ? "Contracts" : "Tokens"}
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Each contract pays 1 token if you're right
            </p>
            
            {inputMode === "contracts" ? (
              <>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="10"
                    value={contractCount}
                    onChange={(e) => setContractCount(e.target.value)}
                    className="h-12 text-lg pr-24"
                    min="1"
                    step="1"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    contracts
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  {[5, 10, 25, 50].map((amt) => (
                    <Button
                      key={amt}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setContractCount(amt.toString()); haptic('light'); }}
                    >
                      {amt}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="10"
                    value={dollarAmount}
                    onChange={(e) => setDollarAmount(e.target.value)}
                    className="h-12 text-lg"
                    min="0.01"
                    step="0.01"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[5, 10, 25, 50].map((amt) => (
                    <Button
                      key={amt}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setDollarAmount(amt.toString()); haptic('light'); }}
                    >
                      {amt}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Liquidity Warning */}
          {hasValidInput && (
            <LiquidityWarning
              marketId={marketId}
              side={side}
              stakeAmount={totalCost}
              indicativePrice={currentPrice}
            />
          )}

          {/* Estimated Fill Preview */}
          {hasValidInput && (
            <EstimatedFillPreview
              marketId={marketId}
              side={side}
              stakeAmount={totalCost}
              indicativePrice={currentPrice}
              onSwitchToLimitOrder={() => {
                const priceToUse = side === "yes" ? yesPrice : noPrice;
                setAdvancedInputMode("dollars");
                setAdvancedDollarAmount(totalCost.toFixed(2));
                setLimitPrice(priceToUse.toFixed(2));
                if (priceToUse > 0) {
                  const contracts = Math.floor(totalCost / priceToUse);
                  setQuantity(contracts > 0 ? contracts.toString() : '');
                }
                setSide(side);
                setTradingMode("advanced");
                setTimeout(() => {
                  cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }}
            />
          )}

          {hasValidInput && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              {/* Primary: What you pay → What you get */}
              <div className="flex items-center justify-between bg-background rounded-lg p-3 border">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground uppercase">You Pay</div>
                   <div className="text-xl font-bold">{totalCost.toFixed(2)} tokens</div>
                 </div>
                 <div className="text-2xl text-muted-foreground">→</div>
                 <div className="text-center">
                   <div className="text-xs text-muted-foreground uppercase">If {side.toUpperCase()} wins</div>
                   <div className="text-xl font-bold text-primary">{totalPayout.toFixed(2)} tokens</div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Contracts:</span>
                   <span className="font-medium">{contracts} × {(currentPrice * 100).toFixed(0)}¢ each</span>
                 </div>
                 <div className="flex justify-between text-sm">
                   <span className="text-muted-foreground">Profit if correct:</span>
                   <span className="font-bold text-primary">+{potentialProfit.toFixed(2)} tokens</span>
                 </div>
                 <div className="flex justify-between text-sm">
                   <span className="text-muted-foreground">If {side === 'yes' ? 'NO' : 'YES'} wins:</span>
                   <span className="font-medium text-destructive">-{totalCost.toFixed(2)} tokens</span>
                </div>
              </div>
            </div>
          )}

          <Button
            className="w-full h-12 text-lg"
            onClick={() => handleSimpleTrade()}
            disabled={isSubmitting || !hasValidInput}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Buy {contracts || 0} {side.toUpperCase()} contracts
          </Button>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          {/* Input Mode Toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm text-muted-foreground">
                {advancedInputMode === "contracts" ? "How many contracts?" : "How much do you want to spend?"}
              </Label>
              <button
                onClick={() => setAdvancedInputMode(advancedInputMode === "contracts" ? "dollars" : "contracts")}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {advancedInputMode === "contracts" ? "Contracts" : "Tokens"}
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Set your own price. Each contract pays 1 token if correct.
            </p>

            {advancedInputMode === "contracts" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Contracts</Label>
                    <Input
                      type="number"
                      placeholder="10"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="h-12"
                      min="1"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-muted-foreground">Price (¢ each)</Label>
                      <button
                        type="button"
                        onClick={() => {
                          const marketPrice = side === "yes" ? yesPrice : noPrice;
                          setLimitPrice(marketPrice.toFixed(2));
                          haptic('light');
                        }}
                        className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                      >
                        Use {Math.round((side === "yes" ? yesPrice : noPrice) * 100)}¢
                      </button>
                    </div>
                    <Input
                      type="number"
                      placeholder="50"
                      value={limitPrice ? (parseFloat(limitPrice) * 100).toString() : ''}
                      onChange={(e) => {
                        const cents = parseFloat(e.target.value) || 0;
                        setLimitPrice((cents / 100).toFixed(2));
                      }}
                      className="h-12"
                      min="1"
                      max="99"
                      step="1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[5, 10, 25, 50].map((amt) => (
                    <Button
                      key={amt}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setQuantity(amt.toString()); haptic('light'); }}
                    >
                      {amt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                     <Label className="text-xs text-muted-foreground mb-1 block">Amount (tokens)</Label>
                     <div className="relative">
                       <Input
                         type="number"
                         placeholder="10"
                         value={advancedDollarAmount}
                         onChange={(e) => {
                           setAdvancedDollarAmount(e.target.value);
                           // Auto-calculate contracts based on price
                           if (limitPrice && parseFloat(limitPrice) > 0) {
                             const contracts = Math.floor(parseFloat(e.target.value) / parseFloat(limitPrice));
                             setQuantity(contracts > 0 ? contracts.toString() : '');
                           }
                         }}
                         className="h-12"
                        min="0.01"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-muted-foreground">Price (¢ each)</Label>
                      <button
                        type="button"
                        onClick={() => {
                          const marketPrice = side === "yes" ? yesPrice : noPrice;
                          setLimitPrice(marketPrice.toFixed(2));
                          haptic('light');
                          // Recalculate contracts if dollar amount is set
                          if (advancedDollarAmount && marketPrice > 0) {
                            const contracts = Math.floor(parseFloat(advancedDollarAmount) / marketPrice);
                            setQuantity(contracts > 0 ? contracts.toString() : '');
                          }
                        }}
                        className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                      >
                        Use {Math.round((side === "yes" ? yesPrice : noPrice) * 100)}¢
                      </button>
                    </div>
                    <Input
                      type="number"
                      placeholder="50"
                      value={limitPrice ? (parseFloat(limitPrice) * 100).toString() : ''}
                      onChange={(e) => {
                        const cents = parseFloat(e.target.value) || 0;
                        const price = cents / 100;
                        setLimitPrice(price.toFixed(2));
                        // Recalculate contracts when price changes
                        if (advancedDollarAmount && price > 0) {
                          const contracts = Math.floor(parseFloat(advancedDollarAmount) / price);
                          setQuantity(contracts > 0 ? contracts.toString() : '');
                        }
                      }}
                      className="h-12"
                      min="1"
                      max="99"
                      step="1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[5, 10, 25, 50].map((amt) => (
                    <Button
                      key={amt}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setAdvancedDollarAmount(amt.toString());
                        haptic('light');
                        if (limitPrice && parseFloat(limitPrice) > 0) {
                          const contracts = Math.floor(amt / parseFloat(limitPrice));
                          setQuantity(contracts > 0 ? contracts.toString() : '');
                        }
                      }}
                    >
                      {amt}
                    </Button>
                  ))}
                </div>
                {quantity && parseFloat(quantity) > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    = {quantity} contracts @ {limitPrice ? (parseFloat(limitPrice) * 100).toFixed(0) : '??'}¢ each
                  </p>
                )}
              </div>
            )}
          </div>

          {advancedCost > 0 && (() => {
            const advancedQty = parseFloat(quantity) || 0;
            const advancedGrossPayout = advancedQty; // $1 per contract
            const advancedGrossProfit = advancedGrossPayout - advancedCost;
            const advancedNetProfit = advancedGrossProfit * feeMultiplier;
            const advancedNetPayout = advancedCost + advancedNetProfit;
            
            return (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {/* Primary: What you pay → What you get */}
                <div className="flex items-center justify-between bg-background rounded-lg p-3 border">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground uppercase">You Pay</div>
                     <div className="text-xl font-bold">{advancedCost.toFixed(2)} tokens</div>
                   </div>
                   <div className="text-2xl text-muted-foreground">→</div>
                   <div className="text-center">
                     <div className="text-xs text-muted-foreground uppercase">If {side.toUpperCase()} wins</div>
                     <div className="text-xl font-bold text-primary">{advancedNetPayout.toFixed(2)} tokens</div>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profit if correct:</span>
                    <span className="font-medium text-primary">
                       +{advancedNetProfit.toFixed(2)} tokens
                     </span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">If {side === 'yes' ? 'NO' : 'YES'} wins:</span>
                     <span className="font-medium text-destructive">-{advancedCost.toFixed(2)} tokens</span>
                  </div>
                </div>
              </div>
            );
          })()}

          <Button
            className="w-full h-12"
            onClick={handleAdvancedTrade}
            disabled={isSubmitting || !quantity || !limitPrice}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Place Limit Order
          </Button>

          {/* Market Depth - Simplified */}
          {(orderBook.yes.length > 0 || orderBook.no.length > 0) && (
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Current Orders</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-primary font-medium mb-1">YES Orders ({orderBook.yes.length})</div>
                  {orderBook.yes.length > 0 ? (
                    orderBook.yes.slice(0, 3).map((level, i) => (
                      <div key={i} className="flex justify-between py-0.5 text-muted-foreground">
                        <span>{(level.price * 100).toFixed(0)}¢</span>
                        <span>{level.quantity} contracts</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No orders yet</div>
                  )}
                </div>
                <div>
                  <div className="text-destructive font-medium mb-1">NO Orders ({orderBook.no.length})</div>
                  {orderBook.no.length > 0 ? (
                    orderBook.no.slice(0, 3).map((level, i) => (
                      <div key={i} className="flex justify-between py-0.5 text-muted-foreground">
                        <span>{(level.price * 100).toFixed(0)}¢</span>
                        <span>{level.quantity} contracts</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No orders yet</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* User's Open Orders */}
      {userOrders.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <button
            onClick={() => setPendingOrdersExpanded(p => !p)}
            className="flex items-center justify-between w-full text-sm font-medium mb-2 hover:text-foreground/80 transition-colors"
          >
            <span>Your Pending Orders ({userOrders.length})</span>
            {pendingOrdersExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {pendingOrdersExpanded && <div className="space-y-2">
      {userOrders.map((order) => {
              const price = Number(order.price);
              const quantity = order.quantity;
              const totalCost = quantity * price;
              const grossPayout = quantity; // Each contract pays $1 if correct
              const grossProfit = grossPayout - totalCost;
              const netProfit = grossProfit * feeMultiplier;
              
              return (
                <div key={order.id} className="bg-muted/30 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={order.side === 'yes' ? 'default' : 'secondary'} className={
                      order.side === 'yes' ? 'bg-green-600' : 'bg-red-600'
                    }>
                      {order.side.toUpperCase()}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleCancelOrder(order.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Cost</p>
                       <p className="font-semibold">{totalCost.toFixed(2)} tokens</p>
                     </div>
                     <div>
                       <p className="text-muted-foreground">Price</p>
                       <p className="font-semibold">{(price * 100).toFixed(0)}¢</p>
                     </div>
                     <div>
                       <p className="text-muted-foreground">If correct</p>
                       <p className="font-semibold text-success">+{netProfit.toFixed(2)} tokens</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>}
        </div>
      )}

      {/* Balance display */}
      <div className="border-t pt-3 mt-4 text-sm text-muted-foreground text-center">
        Available balance: <span className="font-semibold text-foreground">{userBalance.toFixed(0)} tokens</span>
      </div>

      {/* No Liquidity Dialog */}
      <Dialog open={showNoLiquidityDialog} onOpenChange={setShowNoLiquidityDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              No Liquidity Available
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p>
                  There are currently no {noLiquiditySide === 'yes' ? 'sellers' : 'buyers'} in the order book to match your {noLiquiditySide.toUpperCase()} market order.
                </p>
                <p className="text-sm">
                  Want to <strong>place a limit order</strong> instead? Your order will wait in the book until someone matches it.
                </p>
                {noLiquidityAmount > 0 && (
                  <div className="bg-muted/60 rounded-lg p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-semibold">{noLiquidityAmount.toFixed(2)} tokens</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-semibold">{((noLiquiditySide === "yes" ? yesPrice : noPrice) * 100).toFixed(0)}¢ per contract</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contracts:</span>
                      <span className="font-semibold">
                        {Math.floor(noLiquidityAmount / Math.max(noLiquiditySide === "yes" ? yesPrice : noPrice, 0.01))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button 
              onClick={handleSwitchToLimitOrder}
              className="w-full"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Place Limit Order — Wait for a Match
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

      {/* Partial Fill Dialog */}
      {partialFillData && (
        <PartialFillDialog
          open={showPartialFillDialog}
          onOpenChange={setShowPartialFillDialog}
          side={partialFillData.side}
          requestedAmount={partialFillData.requestedAmount}
          filledQuantity={partialFillData.filledQuantity}
          avgFillPrice={partialFillData.avgFillPrice}
          unfilledAmount={partialFillData.unfilledAmount}
          onPlaceLimitOrder={async (price, quantity) => {
            try {
              const { data, error } = await supabase.functions.invoke('order-book', {
                body: {
                  action: 'place',
                  marketId,
                  side: partialFillData.side,
                  orderType: 'limit',
                  quantity,
                  price
                }
              });

              if (error) throw error;

              toast({
                title: "Limit order placed",
                description: `${quantity} ${partialFillData.side.toUpperCase()} contracts @ ${(price * 100).toFixed(0)}¢`,
              });

              refetchOrderBook();
              fetchUserOrders();
            } catch (error: any) {
              toast({
                title: "Order failed",
                description: error.message || "Failed to place limit order",
                variant: "destructive",
              });
            }
          }}
        />
      )}

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
                Required: <span className="font-bold">{insufficientBalanceAmount.toFixed(0)} tokens</span>
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
               Add Tokens
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

      {/* Dangerous Price Warning Dialog */}
      <Dialog open={showDangerousPriceDialog} onOpenChange={setShowDangerousPriceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-xl text-destructive">
              <AlertTriangle className="h-6 w-6" />
              Price Warning
            </DialogTitle>
            <DialogDescription className="text-center space-y-4 pt-4">
              {dangerousPriceData && (
                <>
                  <p className="text-base font-medium text-foreground">
                    This order will fill at a significantly different price!
                  </p>
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Market price:</span>
                      <span className="font-bold">{(dangerousPriceData.marketPrice * 100).toFixed(0)}¢</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Your fill price:</span>
                      <span className="font-bold text-destructive">{(dangerousPriceData.fillPrice * 100).toFixed(0)}¢</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Difference:</span>
                      <span className="font-bold text-destructive">
                        {Math.abs(((dangerousPriceData.fillPrice - dangerousPriceData.marketPrice) / dangerousPriceData.marketPrice) * 100).toFixed(0)}% {dangerousPriceData.fillPrice > dangerousPriceData.marketPrice ? 'more expensive' : 'cheaper'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    There may be orders in this market at prices that are far from the current market value. 
                    Consider using <strong>Set Your Price</strong> mode for better control.
                  </p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button 
              variant="outline"
              onClick={() => {
                setShowDangerousPriceDialog(false);
                setTradingMode("advanced");
                // Pre-fill limit order with market price
                if (dangerousPriceData) {
                  setLimitPrice(dangerousPriceData.marketPrice.toFixed(2));
                  setQuantity(dangerousPriceData.contracts.toString());
                }
              }}
              className="w-full h-12 gap-2"
            >
              <BookOpen className="h-5 w-5" />
              Use Set Your Price Instead
            </Button>
            <Button 
              onClick={() => {
                setShowDangerousPriceDialog(false);
                // Proceed with trade, skipping the dangerous check
                handleSimpleTrade(true);
              }}
              variant="destructive"
              className="w-full h-12 gap-2"
            >
              <AlertTriangle className="h-5 w-5" />
              Trade Anyway (I understand the risk)
            </Button>
            <Button 
              variant="ghost"
              onClick={() => setShowDangerousPriceDialog(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </Card>
    </>
  );
};

export default OrderBookTrading;
