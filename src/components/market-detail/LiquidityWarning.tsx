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
  // All warnings are now handled by EstimatedFillPreview to avoid duplicates
  // This component is kept for backward compatibility but renders nothing
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
