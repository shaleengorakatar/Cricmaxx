import { useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PartialFillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "yes" | "no";
  requestedAmount: number;
  filledQuantity: number;
  avgFillPrice: number;
  unfilledAmount: number;
  onPlaceLimitOrder: (price: number, quantity: number) => Promise<void>;
}

export function PartialFillDialog({
  open,
  onOpenChange,
  side,
  requestedAmount,
  filledQuantity,
  avgFillPrice,
  unfilledAmount,
  onPlaceLimitOrder,
}: PartialFillDialogProps) {
  const [limitPrice, setLimitPrice] = useState(avgFillPrice.toFixed(2));
  const [isPlacing, setIsPlacing] = useState(false);
  
  // Calculate how many contracts the unfilled amount could buy at the limit price
  const limitPriceNum = parseFloat(limitPrice) || avgFillPrice;
  const additionalContracts = Math.floor(unfilledAmount / limitPriceNum);

  const handlePlaceLimitOrder = async () => {
    if (additionalContracts <= 0) return;
    
    setIsPlacing(true);
    try {
      await onPlaceLimitOrder(limitPriceNum, additionalContracts);
      onOpenChange(false);
    } finally {
      setIsPlacing(false);
    }
  };

  const fillPercent = ((filledQuantity * avgFillPrice / requestedAmount) * 100).toFixed(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Partial Fill
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <p>
              Your market order was only <strong>{fillPercent}%</strong> filled due to limited liquidity.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Fill Summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Requested:</span>
              <span className="font-medium">${requestedAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Filled:</span>
              <span className="font-medium text-green-600">
                {filledQuantity.toFixed(1)} {side.toUpperCase()} @ {(avgFillPrice * 100).toFixed(0)}¢
              </span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Unfilled:</span>
              <span className="font-medium text-amber-600">${unfilledAmount.toFixed(2)} (back in wallet)</span>
            </div>
          </div>

          {/* Success message for what was filled */}
          <div className="flex items-start gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-green-600 dark:text-green-400">
                You now own {filledQuantity.toFixed(1)} {side.toUpperCase()} contracts.
              </span>
              <br />
              <span className="text-muted-foreground">
                Payout if correct: ${filledQuantity.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Limit Order Option */}
          {unfilledAmount > 0.01 && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-4 w-4" />
                Fill remaining with limit order?
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Price (¢)</Label>
                  <Input
                    type="number"
                    value={(parseFloat(limitPrice) * 100).toFixed(0)}
                    onChange={(e) => setLimitPrice((parseFloat(e.target.value) / 100).toFixed(2))}
                    className="h-9"
                    min="1"
                    max="99"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Contracts</Label>
                  <Input
                    type="text"
                    value={additionalContracts}
                    disabled
                    className="h-9 bg-muted"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                This will reserve ${(additionalContracts * limitPriceNum).toFixed(2)} from your wallet until filled or cancelled.
              </p>

              <Button 
                onClick={handlePlaceLimitOrder}
                disabled={isPlacing || additionalContracts <= 0}
                className="w-full"
              >
                {isPlacing ? "Placing..." : `Place ${additionalContracts} ${side.toUpperCase()} Limit Order`}
              </Button>
            </div>
          )}

          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
