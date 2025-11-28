import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import PayoutInfoTooltip from "./PayoutInfoTooltip";
import InfoTooltip from "@/components/InfoTooltip";

interface SimpleTradingInterfaceProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  userBalance: number;
  marketType: "orderbook" | "amm";
  onTrade: (side: "yes" | "no", shares: number) => void;
}

type TradingMode = "simple" | "pro";

const SimpleTradingInterface = ({ 
  marketId, 
  yesPrice, 
  noPrice, 
  userBalance, 
  marketType,
  onTrade 
}: SimpleTradingInterfaceProps) => {
  const [mode, setMode] = useState<TradingMode>(() => {
    const saved = localStorage.getItem('tradingMode');
    return (saved as TradingMode) || 'simple';
  });
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");
  
  // Simple mode state
  const [amount, setAmount] = useState("");
  
  // Pro mode state
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  
  const { toast } = useToast();

  const currentPrice = outcome === "yes" ? yesPrice : noPrice;
  const currentOdds = Math.round(currentPrice * 100);

  // Save mode preference
  useEffect(() => {
    localStorage.setItem('tradingMode', mode);
  }, [mode]);

  // Simple mode calculations
  const multiplier = currentPrice > 0 ? 1 / currentPrice : 1;
  const potentialPayout = amount ? parseFloat(amount) * multiplier : 0;
  const maxLoss = amount ? parseFloat(amount) : 0;

  // Pro mode calculations
  const estimatedCost = quantity && pricePerShare 
    ? parseFloat(quantity) * parseFloat(pricePerShare)
    : quantity && orderType === "market"
    ? parseFloat(quantity) * currentPrice
    : 0;

  const handleSimpleTrade = () => {
    const amt = parseFloat(amount);
    
    if (!amount || amt <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amt > userBalance) {
      toast({
        title: "Insufficient balance",
        description: `You need at least ${amt.toFixed(2)} credits`,
        variant: "destructive",
      });
      return;
    }

    // Calculate shares from amount
    const shares = Math.floor(amt / currentPrice);
    
    toast({
      title: "Prediction placed",
      description: `Predicting ${outcome.toUpperCase()} with ${shares} shares. Potential payout: $${potentialPayout.toFixed(2)}`,
    });

    onTrade(outcome, shares);
    setAmount("");
  };

  const handleProTrade = () => {
    const qty = parseInt(quantity);
    
    if (!quantity || qty <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid number of shares",
        variant: "destructive",
      });
      return;
    }

    if (orderType === "limit") {
      const price = parseFloat(pricePerShare);
      if (!pricePerShare || price <= 0 || price >= 1) {
        toast({
          title: "Invalid price",
          description: "Price must be between $0.01 and $0.99",
          variant: "destructive",
        });
        return;
      }
    }

    if (estimatedCost > userBalance) {
      toast({
        title: "Insufficient balance",
        description: `You need at least ${estimatedCost.toFixed(2)} credits`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: orderType === "market" ? "Trade executed" : "Order placed",
      description: `${orderType === "market" ? "Bought" : "Limit order for"} ${qty} ${outcome.toUpperCase()} shares`,
    });

    onTrade(outcome, qty);
    setQuantity("");
    setPricePerShare("");
  };

  return (
    <Card className="p-4 sm:p-6">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Label htmlFor="trading-mode" className="text-sm font-medium">Trading Mode:</Label>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${mode === 'simple' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
              Simple
            </span>
            <Switch
              id="trading-mode"
              checked={mode === 'pro'}
              onCheckedChange={(checked) => setMode(checked ? 'pro' : 'simple')}
            />
            <span className={`text-sm ${mode === 'pro' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
              Pro
            </span>
          </div>
          <InfoTooltip content="Simple Mode is for quick predictions. Pro Mode gives you control over price and order types." />
        </div>
      </div>

      {mode === 'simple' ? (
        /* SIMPLE MODE */
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Quick Prediction</h3>
          
          <div>
            <Label htmlFor="outcome" className="text-sm">Choose outcome</Label>
            <Select value={outcome} onValueChange={(value: "yes" | "no") => setOutcome(value)}>
              <SelectTrigger id="outcome" className="bg-card h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="yes" className="text-base py-3">Yes</SelectItem>
                <SelectItem value="no" className="text-base py-3">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount" className="text-sm">Enter amount to predict ($)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="25.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0.01"
              step="0.01"
              className="h-12 text-base"
            />
          </div>

          {/* Prediction Summary */}
          <div className="bg-muted rounded-lg p-4 space-y-3 border border-border">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">You are predicting:</span>
              <span className={`text-base font-bold ${outcome === "yes" ? "text-green-600" : "text-red-600"}`}>
                {outcome.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current odds:</span>
              <span className="text-base font-semibold text-foreground">{currentOdds}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Potential payout if correct:</span>
              <span className="text-base font-semibold text-accent">
                {amount ? `$${potentialPayout.toFixed(2)}` : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">You could lose:</span>
              <span className="text-base font-semibold text-foreground">
                {amount ? `$${maxLoss.toFixed(2)}` : "—"} (your investment)
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Available balance:</span>
              <span className="text-base font-semibold text-foreground">{userBalance.toLocaleString()} credits</span>
            </div>
          </div>

          <Button 
            onClick={handleSimpleTrade}
            className={`w-full h-12 text-base font-semibold ${outcome === "yes" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white`}
          >
            Place Prediction
          </Button>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">
              Prediction contracts settle at $1 if correct. Market prices reflect probability.
            </p>
            <div className="flex justify-center">
              <PayoutInfoTooltip />
            </div>
          </div>
        </div>
      ) : (
        /* PRO MODE */
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Advanced Trading</h3>

          <div>
            <Label htmlFor="order-type" className="text-sm">Order Type</Label>
            <Select value={orderType} onValueChange={(value: "market" | "limit") => setOrderType(value)}>
              <SelectTrigger id="order-type" className="bg-card h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="market" className="text-base py-3">Market Order</SelectItem>
                <SelectItem value="limit" className="text-base py-3">Limit Order</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pro-outcome" className="text-sm">Outcome</Label>
            <Select value={outcome} onValueChange={(value: "yes" | "no") => setOutcome(value)}>
              <SelectTrigger id="pro-outcome" className="bg-card h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="yes" className="text-base py-3">Yes</SelectItem>
                <SelectItem value="no" className="text-base py-3">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity" className="text-sm">Quantity (shares)</Label>
            <Input
              id="quantity"
              type="number"
              placeholder="100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              className="h-12 text-base"
            />
          </div>

          {orderType === "limit" && (
            <div>
              <Label htmlFor="price-per-share" className="text-sm">Price per share ($)</Label>
              <Input
                id="price-per-share"
                type="number"
                placeholder={currentPrice.toFixed(2)}
                value={pricePerShare}
                onChange={(e) => setPricePerShare(e.target.value)}
                min="0.01"
                max="0.99"
                step="0.01"
                className="h-12 text-base"
              />
            </div>
          )}

          {/* Pro Mode Summary */}
          <div className="bg-muted rounded-lg p-4 space-y-2 border border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current {outcome} price:</span>
              <span className="font-semibold text-foreground">${currentPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimated cost:</span>
              <span className="font-semibold text-foreground">
                {quantity ? `${estimatedCost.toFixed(2)} credits` : "—"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max payout:</span>
              <span className="font-semibold text-accent">
                {quantity ? `$${parseInt(quantity) * 1.00}` : "—"}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">Available balance:</span>
              <span className="font-semibold text-foreground">{userBalance.toLocaleString()} credits</span>
            </div>
          </div>

          <Button 
            onClick={handleProTrade}
            className={`w-full h-12 text-base font-semibold ${outcome === "yes" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white`}
          >
            {orderType === "market" ? "Execute Trade" : "Place Limit Order"}
          </Button>

          <div className="flex justify-center pt-2">
            <PayoutInfoTooltip />
          </div>
        </div>
      )}
    </Card>
  );
};

export default SimpleTradingInterface;
