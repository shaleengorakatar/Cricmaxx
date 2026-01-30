import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingDown, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SellPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketId: string;
  side: "yes" | "no";
  positionSize: number;
  entryPrice: number;
  currentPrice: number;
  onSellComplete: () => void;
}

const SellPositionDialog = ({
  open,
  onOpenChange,
  marketId,
  side,
  positionSize,
  entryPrice,
  currentPrice,
  onSellComplete
}: SellPositionDialogProps) => {
  const [sellQuantity, setSellQuantity] = useState(positionSize);
  const [isSelling, setIsSelling] = useState(false);

  const estimatedProceeds = sellQuantity * currentPrice;
  const cost = sellQuantity * entryPrice;
  const estimatedPnL = estimatedProceeds - cost;
  const fees = estimatedProceeds * 0.03; // 3% platform fee estimate
  const netProceeds = estimatedProceeds - fees;

  const handleSell = async () => {
    if (sellQuantity <= 0 || sellQuantity > positionSize) {
      toast({
        title: "Invalid quantity",
        description: `Enter a quantity between 1 and ${positionSize}`,
        variant: "destructive",
      });
      return;
    }

    setIsSelling(true);

    try {
      const response = await supabase.functions.invoke("order-book", {
        body: {
          action: "sell",
          marketId,
          side,
          quantity: sellQuantity,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to sell position");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const { sold, totalProceeds, avgPrice, remaining } = response.data;

      if (sold > 0) {
        toast({
          title: "🎉 Position sold!",
          description: `Sold ${sold} ${side.toUpperCase()} contracts @ ${(avgPrice * 100).toFixed(0)}¢ for $${totalProceeds.toFixed(2)}`,
        });
        onSellComplete();
        onOpenChange(false);
      } else {
        toast({
          title: "No buyers found",
          description: "There are no matching orders at this price. Try again later or place a limit order.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Sell error:", error);
      toast({
        title: "Sell failed",
        description: error.message || "Could not sell position",
        variant: "destructive",
      });
    } finally {
      setIsSelling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Sell {side.toUpperCase()} Position
            <Badge variant={side === "yes" ? "default" : "destructive"} className="ml-1">
              {side.toUpperCase()}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Sell your contracts to available buyers in the order book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sell-quantity">Contracts to Sell</Label>
            <Input
              id="sell-quantity"
              type="number"
              min={1}
              max={positionSize}
              value={sellQuantity}
              onChange={(e) => setSellQuantity(Math.min(positionSize, Math.max(1, parseInt(e.target.value) || 1)))}
            />
            <p className="text-xs text-muted-foreground">
              You have {positionSize} {side.toUpperCase()} contracts
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setSellQuantity(Math.floor(positionSize / 2))}
            >
              50%
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setSellQuantity(positionSize)}
            >
              Max
            </Button>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your entry price:</span>
              <span className="font-medium">{(entryPrice * 100).toFixed(0)}¢</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current market price:</span>
              <span className="font-medium">{(currentPrice * 100).toFixed(0)}¢</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Est. gross proceeds:</span>
              <span className="font-medium">${estimatedProceeds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. fees (~3%):</span>
              <span className="font-medium text-muted-foreground">-${fees.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Est. net proceeds:</span>
              <span className="font-bold">${netProceeds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. P&L:</span>
              <span className={`font-bold flex items-center gap-1 ${estimatedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {estimatedPnL >= 0 ? '+' : ''}{(estimatedPnL - fees).toFixed(2)}
                {estimatedPnL < 0 && <TrendingDown className="h-3 w-3" />}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              This is a market sell. Your order will fill at the best available prices in the order book.
              The actual proceeds may vary slightly from the estimate.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSell}
            disabled={isSelling || sellQuantity <= 0}
            variant="destructive"
          >
            {isSelling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Selling...
              </>
            ) : (
              `Sell ${sellQuantity} for ~$${netProceeds.toFixed(2)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SellPositionDialog;
