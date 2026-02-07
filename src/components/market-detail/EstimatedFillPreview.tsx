import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Info, BookOpen } from "lucide-react";
import { useEstimatedFillPrice } from "@/hooks/useEstimatedFillPrice";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EstimatedFillPreviewProps {
  marketId: string;
  side: "yes" | "no";
  stakeAmount: number;
  indicativePrice: number;
  className?: string;
  onSwitchToLimitOrder?: () => void;
}

export function EstimatedFillPreview({
  marketId,
  side,
  stakeAmount,
  indicativePrice,
  className,
  onSwitchToLimitOrder,
}: EstimatedFillPreviewProps) {
  const { calculateEstimatedFill, hasLiquidity, loading } = useEstimatedFillPrice(marketId);

  if (loading || stakeAmount <= 0) {
    return null;
  }

  const liquidity = side === "yes" ? hasLiquidity.yes : hasLiquidity.no;
  
  if (!liquidity) {
    return (
      <div className={cn("text-xs p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2", className)}>
        <div className="flex items-center gap-1.5 text-destructive font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>No liquidity on {side.toUpperCase()} side</span>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          No one has placed orders to match yours yet. You can <strong className="text-foreground">set your own price</strong> with a limit order and wait for someone to take it.
        </p>
        {onSwitchToLimitOrder && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1 gap-1.5 border-destructive/30 hover:bg-destructive/10"
            onClick={onSwitchToLimitOrder}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Set Your Price &amp; Wait for a Match
          </Button>
        )}
      </div>
    );
  }

  const estimate = calculateEstimatedFill(side, stakeAmount, indicativePrice);

  if (!estimate) {
    return null;
  }

  const { avgPrice, totalCost, filledQuantity, isPartialFill, priceImpact } = estimate;
  const expectedPayout = filledQuantity; // Each contract pays 1 token
  const expectedProfit = expectedPayout - totalCost;
  const unfilled = stakeAmount - totalCost;

  // Determine severity of price impact
  const impactSeverity = 
    Math.abs(priceImpact) > 10 ? "high" : 
    Math.abs(priceImpact) > 5 ? "medium" : "low";

  return (
    <div className={cn(
      "text-xs p-3 rounded-lg border space-y-2",
      isPartialFill || impactSeverity === "high" 
        ? "bg-warning/10 border-warning/30" 
        : "bg-muted/50 border-border/50",
      className
    )}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-1">
          Estimated Fill
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  Based on current order book depth. Actual fill price may vary.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
        {priceImpact !== 0 && (
          <span className={cn(
            "font-medium flex items-center gap-0.5",
            priceImpact > 0 ? "text-destructive" : "text-success"
          )}>
            {priceImpact > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {priceImpact > 0 ? "+" : ""}{priceImpact.toFixed(1)}% impact
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-muted-foreground">Avg Price</div>
          <div className="font-semibold">{(avgPrice * 100).toFixed(1)}¢</div>
        </div>
        <div>
          <div className="text-muted-foreground">Contracts</div>
          <div className="font-semibold">{filledQuantity.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">You Pay</div>
          <div className="font-semibold">{totalCost.toFixed(2)} tokens</div>
        </div>
        <div>
          <div className="text-muted-foreground">If Correct</div>
          <div className="font-semibold text-success">{expectedPayout.toFixed(2)} tokens</div>
        </div>
      </div>

      {isPartialFill && (
        <div className="pt-2 border-t border-warning/30 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
          <div className="text-warning">
            <span className="font-medium">Partial fill:</span> Only {totalCost.toFixed(2)} of {stakeAmount.toFixed(2)} tokens can be filled. 
            {unfilled.toFixed(2)} tokens will remain in your wallet.
          </div>
        </div>
      )}

      {impactSeverity === "high" && !isPartialFill && (
        <div className="pt-2 border-t border-warning/30 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
          <div className="text-warning">
            <span className="font-medium">High price impact.</span> Consider placing a smaller order or using a limit order.
          </div>
        </div>
      )}
    </div>
  );
}
