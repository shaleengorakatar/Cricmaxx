import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface AMMTradingProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  userBalance: number;
  onTrade: (side: "yes" | "no", shares: number) => void;
}

const AMMTrading = ({ marketId, yesPrice, noPrice, userBalance, onTrade }: AMMTradingProps) => {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [shares, setShares] = useState("");
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [newPrice, setNewPrice] = useState(0);
  const { toast } = useToast();

  const currentPrice = side === "yes" ? yesPrice : noPrice;

  useEffect(() => {
    if (shares && parseInt(shares) > 0) {
      const qty = parseInt(shares);
      // Simplified LMSR calculation with slippage
      const basePrice = currentPrice;
      const slippage = (qty * 0.0001); // Small slippage factor
      const avgPrice = basePrice + slippage;
      const cost = qty * avgPrice;
      
      setEstimatedCost(cost);
      setNewPrice(Math.min(0.99, basePrice + (qty * 0.001))); // Price impact
    } else {
      setEstimatedCost(0);
      setNewPrice(currentPrice);
    }
  }, [shares, side, currentPrice]);

  const handleTrade = () => {
    const qty = parseInt(shares);
    
    if (!shares || qty <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid number of shares",
        variant: "destructive",
      });
      return;
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
      title: "Trade executed",
      description: `Bought ${qty} ${side.toUpperCase()} shares at ~$${currentPrice.toFixed(2)}. New price: $${newPrice.toFixed(2)}`,
    });

    onTrade(side, qty);
    setShares("");
  };

  return (
    <Card className="p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 hidden md:block">Trade</h3>
      
      <div className="space-y-4">
        {/* Current Prices Display - Enhanced for mobile */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 min-h-[80px] flex flex-col justify-center">
            <p className="text-xs text-muted-foreground mb-1">Yes Price</p>
            <p className="text-2xl sm:text-xl font-bold text-green-600 dark:text-green-500">
              ${yesPrice.toFixed(2)}
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 min-h-[80px] flex flex-col justify-center">
            <p className="text-xs text-muted-foreground mb-1">No Price</p>
            <p className="text-2xl sm:text-xl font-bold text-red-600 dark:text-red-500">
              ${noPrice.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Side Selection - Touch-friendly */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={side === "yes" ? "default" : "outline"}
            className={`h-12 text-base font-semibold ${side === "yes" ? "bg-green-600 hover:bg-green-700" : ""} active:scale-[0.98] transition-transform`}
            onClick={() => setSide("yes")}
          >
            Buy Yes
          </Button>
          <Button
            variant={side === "no" ? "default" : "outline"}
            className={`h-12 text-base font-semibold ${side === "no" ? "bg-red-600 hover:bg-red-700" : ""} active:scale-[0.98] transition-transform`}
            onClick={() => setSide("no")}
          >
            Buy No
          </Button>
        </div>

        <div>
          <Label htmlFor="shares" className="text-sm sm:text-base">Number of Shares</Label>
          <Input
            id="shares"
            type="number"
            placeholder="100"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            min="1"
            className="h-12 text-base"
          />
        </div>

        {/* Estimation Panel */}
        <div className="bg-muted rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current price:</span>
            <span className="font-semibold text-foreground">
              ${currentPrice.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated cost:</span>
            <span className="font-semibold text-foreground">
              {shares ? `${estimatedCost.toFixed(2)} credits` : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">New {side} price:</span>
            <span className="font-semibold text-accent">
              {shares ? `~$${newPrice.toFixed(2)}` : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">Available balance:</span>
            <span className="font-semibold text-foreground">{userBalance.toLocaleString()} credits</span>
          </div>
        </div>

        <Button 
          onClick={handleTrade}
          className={`w-full h-12 text-base font-semibold ${side === "yes" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white active:scale-[0.98] transition-transform`}
        >
          Buy {side.toUpperCase()} Shares
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Prices adjust automatically based on market demand
        </p>
      </div>
    </Card>
  );
};

export default AMMTrading;
