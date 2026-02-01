import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEstimatedFillPrice } from "@/hooks/useEstimatedFillPrice";

interface LiquidityWarningProps {
  marketId: string;
  side: "yes" | "no";
  stakeAmount: number;
  indicativePrice: number;
}

export function LiquidityWarning({ 
  marketId, 
  side, 
  stakeAmount, 
  indicativePrice 
}: LiquidityWarningProps) {
  const { calculateEstimatedFill, hasLiquidity, loading } = useEstimatedFillPrice(marketId);

  if (loading) return null;

  const liquidity = side === "yes" ? hasLiquidity.yes : hasLiquidity.no;
  
  // Calculate estimated fill to check for thin liquidity
  const estimate = stakeAmount > 0 
    ? calculateEstimatedFill(side, stakeAmount, indicativePrice) 
    : null;

  // Show warning if no liquidity at all
  if (!liquidity) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="text-xs">
          <span className="font-medium">No liquidity available.</span> Your order will be placed in the book at your price.
        </p>
      </div>
    );
  }

  // Show warning if partial fill expected
  if (estimate && estimate.isPartialFill && stakeAmount > 0) {
    const fillPercent = ((estimate.totalCost / stakeAmount) * 100).toFixed(0);
    return (
      <Alert className="py-2 border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-xs">
          <span className="font-medium text-amber-600 dark:text-amber-400">
            Low liquidity warning:
          </span>{" "}
          Only ~{fillPercent}% of your order can be filled at current prices.
        </AlertDescription>
      </Alert>
    );
  }

  // Show warning if significant price impact
  if (estimate && Math.abs(estimate.priceImpact) > 5) {
    return (
      <Alert className="py-2 border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-xs">
          <span className="font-medium text-amber-600 dark:text-amber-400">
            Price impact: {estimate.priceImpact.toFixed(1)}%
          </span>{" "}
          — Large orders may execute at higher prices.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

interface LiquidityIndicatorProps {
  marketId: string;
}

export function LiquidityIndicator({ marketId }: LiquidityIndicatorProps) {
  const { hasLiquidity, loading } = useEstimatedFillPrice(marketId);

  if (loading) return null;

  const yesHasLiquidity = hasLiquidity.yes;
  const noHasLiquidity = hasLiquidity.no;

  if (yesHasLiquidity && noHasLiquidity) {
    return null; // Both sides have liquidity, no warning needed
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-xs text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            <span>Low liquidity</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">
            {!yesHasLiquidity && !noHasLiquidity 
              ? "No orders in the book. Market orders may not fill."
              : !yesHasLiquidity 
                ? "No YES liquidity available. YES market orders may not fill."
                : "No NO liquidity available. NO market orders may not fill."
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
