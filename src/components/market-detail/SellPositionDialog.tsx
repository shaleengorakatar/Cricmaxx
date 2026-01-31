import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingDown, AlertCircle, Zap, BookOpen, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [sellMode, setSellMode] = useState<"market" | "limit">("market");
  const [sellQuantity, setSellQuantity] = useState(positionSize);
  const [limitPrice, setLimitPrice] = useState((currentPrice * 100).toFixed(0));
  const [isSelling, setIsSelling] = useState(false);

  // Market sell calculations
  const marketProceeds = sellQuantity * currentPrice;
  const marketCost = sellQuantity * entryPrice;
  const marketPnL = marketProceeds - marketCost;
  const marketFees = marketProceeds * 0.03;
  const marketNetProceeds = marketProceeds - marketFees;

  // Limit sell calculations
  const limitPriceNum = (parseFloat(limitPrice) || 0) / 100;
  const limitProceeds = sellQuantity * limitPriceNum;
  const limitCost = sellQuantity * entryPrice;
  const limitPnL = limitProceeds - limitCost;
  const limitFees = limitProceeds * 0.03;
  const limitNetProceeds = limitProceeds - limitFees;

  const handleMarketSell = async () => {
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
        if (sold < sellQuantity) {
          // Partial fill
          toast({
            title: "⚠️ Partial sell",
            description: `Sold ${sold}/${sellQuantity} contracts @ ${(avgPrice * 100).toFixed(0)}¢ for $${totalProceeds.toFixed(2)}`,
          });
        } else {
          toast({
            title: "🎉 Position sold!",
            description: `Sold ${sold} ${side.toUpperCase()} contracts @ ${(avgPrice * 100).toFixed(0)}¢ for $${totalProceeds.toFixed(2)}`,
          });
        }
        onSellComplete();
        onOpenChange(false);
      } else {
        toast({
          title: "No buyers found",
          description: "There are no matching orders at this price. Try a limit order instead.",
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

  const handleLimitSell = async () => {
    if (sellQuantity <= 0 || sellQuantity > positionSize) {
      toast({
        title: "Invalid quantity",
        description: `Enter a quantity between 1 and ${positionSize}`,
        variant: "destructive",
      });
      return;
    }

    if (limitPriceNum <= 0 || limitPriceNum >= 1) {
      toast({
        title: "Invalid price",
        description: "Price must be between 1¢ and 99¢",
        variant: "destructive",
      });
      return;
    }

    setIsSelling(true);

    try {
      // For selling, we place an order on the opposite side
      // Selling YES at 60¢ = offering YES to buyers at 60¢
      // This is done by placing a limit order that will match with buyers
      const response = await supabase.functions.invoke("order-book", {
        body: {
          action: "place",
          marketId,
          side: side, // Same side - the order book handles the matching
          orderType: "limit",
          quantity: sellQuantity,
          price: limitPriceNum,
          isSellOrder: true, // Flag to indicate this is a sell order
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to place limit order");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const filledQty = response.data.order?.filledQuantity || 0;
      const remaining = sellQuantity - filledQty;

      if (filledQty > 0 && remaining === 0) {
        toast({
          title: "🎉 Limit sell filled!",
          description: `Sold ${filledQty} ${side.toUpperCase()} contracts @ ${(limitPriceNum * 100).toFixed(0)}¢`,
        });
      } else if (filledQty > 0) {
        toast({
          title: "Partially filled",
          description: `Sold ${filledQty}/${sellQuantity} contracts. ${remaining} in order book.`,
        });
      } else {
        toast({
          title: "Order placed",
          description: `${sellQuantity} ${side.toUpperCase()} sell order @ ${(limitPriceNum * 100).toFixed(0)}¢ added to book`,
        });
      }
      
      onSellComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Limit sell error:", error);
      toast({
        title: "Order failed",
        description: error.message || "Could not place limit order",
        variant: "destructive",
      });
    } finally {
      setIsSelling(false);
    }
  };

  const handleQuantityChange = (value: string) => {
    const num = parseInt(value) || 0;
    setSellQuantity(Math.min(positionSize, Math.max(0, num)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Sell {side.toUpperCase()} Position
            <Badge variant={side === "yes" ? "default" : "destructive"} className="ml-1">
              {side.toUpperCase()}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            You have {positionSize} {side.toUpperCase()} contracts to sell.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={sellMode} onValueChange={(v) => setSellMode(v as "market" | "limit")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="market" className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Market Sell
            </TabsTrigger>
            <TabsTrigger value="limit" className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              Limit Sell
            </TabsTrigger>
          </TabsList>

          {/* Quantity Selection - shared between both modes */}
          <div className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="sell-quantity">Contracts to Sell</Label>
              <Input
                id="sell-quantity"
                type="number"
                min={1}
                max={positionSize}
                value={sellQuantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setSellQuantity(Math.floor(positionSize / 4))}
              >
                25%
              </Button>
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
                onClick={() => setSellQuantity(Math.floor(positionSize * 0.75))}
              >
                75%
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
          </div>

          {/* Market Sell Tab */}
          <TabsContent value="market" className="space-y-4 mt-4">
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
                <span className="font-medium">${marketProceeds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Est. fees (~3%):</span>
                <span className="font-medium text-muted-foreground">-${marketFees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Est. net proceeds:</span>
                <span className="font-bold">${marketNetProceeds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Est. P&L:</span>
                <span className={`font-bold flex items-center gap-1 ${marketPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {marketPnL >= 0 ? '+' : ''}{(marketPnL - marketFees).toFixed(2)}
                  {marketPnL < 0 && <TrendingDown className="h-3 w-3" />}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-warning/10 p-3 rounded-lg border border-warning/20">
              <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <p>
                Market sell fills at the best available prices. Actual proceeds may vary from the estimate.
              </p>
            </div>

            <Button
              onClick={handleMarketSell}
              disabled={isSelling || sellQuantity <= 0}
              variant="destructive"
              className="w-full"
            >
              {isSelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Selling...
                </>
              ) : (
                `Sell ${sellQuantity} for ~$${marketNetProceeds.toFixed(2)}`
              )}
            </Button>
          </TabsContent>

          {/* Limit Sell Tab */}
          <TabsContent value="limit" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="limit-price">Your Sell Price (¢)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">
                        Set the minimum price you'll accept. Your order stays in the book until filled or cancelled.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="limit-price"
                type="number"
                min={1}
                max={99}
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Current market: {(currentPrice * 100).toFixed(0)}¢ • Entry: {(entryPrice * 100).toFixed(0)}¢
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Limit price:</span>
                <span className="font-medium">{limitPrice}¢</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Contracts:</span>
                <span className="font-medium">{sellQuantity}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">If filled, gross:</span>
                <span className="font-medium">${limitProceeds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Est. fees (~3%):</span>
                <span className="font-medium text-muted-foreground">-${limitFees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Est. net if filled:</span>
                <span className="font-bold">${limitNetProceeds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Est. P&L if filled:</span>
                <span className={`font-bold flex items-center gap-1 ${limitPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {limitPnL >= 0 ? '+' : ''}{(limitPnL - limitFees).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg border">
              <BookOpen className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <p>
                Your sell order will be added to the order book. It will fill when a buyer matches your price.
              </p>
            </div>

            <Button
              onClick={handleLimitSell}
              disabled={isSelling || sellQuantity <= 0 || limitPriceNum <= 0 || limitPriceNum >= 1}
              className="w-full"
            >
              {isSelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Placing order...
                </>
              ) : (
                `Place Limit Sell @ ${limitPrice}¢`
              )}
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SellPositionDialog;
