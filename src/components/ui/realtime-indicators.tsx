import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface RealtimeStatusProps {
  isConnected: boolean;
  className?: string;
  showLabel?: boolean;
}

export function RealtimeStatus({ isConnected, className, showLabel = true }: RealtimeStatusProps) {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1 text-xs",
        isConnected 
          ? "border-green-500/50 text-green-600 dark:text-green-400" 
          : "border-muted text-muted-foreground",
        className
      )}
    >
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          {showLabel && <span>Live</span>}
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          {showLabel && <span>Connecting...</span>}
        </>
      )}
    </Badge>
  );
}

interface LivePriceProps {
  price: number;
  previousPrice?: number;
  className?: string;
  showAnimation?: boolean;
  /** Override displayed cents value (for paired rounding) */
  displayCents?: number;
}

export function LivePrice({ price, previousPrice, className, showAnimation = true, displayCents }: LivePriceProps) {
  const hasChanged = previousPrice !== undefined && previousPrice !== price;
  const isUp = previousPrice !== undefined && price > previousPrice;
  const isDown = previousPrice !== undefined && price < previousPrice;

  const cents = displayCents !== undefined ? displayCents : Math.round(price * 100);

  return (
    <span 
      className={cn(
        "font-mono transition-colors duration-300",
        showAnimation && hasChanged && isUp && "text-success",
        showAnimation && hasChanged && isDown && "text-destructive",
        className
      )}
    >
      {cents}¢
    </span>
  );
}

interface LiveOddsProps {
  yesPrice: number;
  previousYesPrice?: number;
  className?: string;
}

export function LiveOdds({ yesPrice, previousYesPrice, className }: LiveOddsProps) {
  const odds = Math.round(yesPrice * 100);
  const prevOdds = previousYesPrice !== undefined ? Math.round(previousYesPrice * 100) : undefined;
  const hasChanged = prevOdds !== undefined && prevOdds !== odds;
  const isUp = prevOdds !== undefined && odds > prevOdds;
  const isDown = prevOdds !== undefined && odds < prevOdds;

  return (
    <span 
      className={cn(
        "font-bold transition-colors duration-300",
        hasChanged && isUp && "text-green-600 dark:text-green-400",
        hasChanged && isDown && "text-red-600 dark:text-red-400",
        className
      )}
    >
      {odds}%
    </span>
  );
}
