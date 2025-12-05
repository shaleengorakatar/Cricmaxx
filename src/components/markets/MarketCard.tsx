import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Market } from "@/types/market";
import { TrendingUp, Clock, BarChart3, BookOpen, Zap, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface UserPosition {
  side: string;
  size: number;
  entryPrice: number;
}

interface MarketCardProps {
  market: Market;
  position?: UserPosition | null;
}

const MarketCard = ({ market, position }: MarketCardProps) => {
  const navigate = useNavigate();
  const expiryDate = new Date(market.expiryTime);
  const timeToExpiry = formatDistanceToNow(expiryDate, { addSuffix: true });
  const isExpiringSoon = expiryDate.getTime() - Date.now() < 24 * 60 * 60 * 1000; // Less than 24 hours

  const handleClick = () => {
    navigate(`/market/${market.id}`);
  };

  // Calculate P&L if position exists
  const calculatePnL = () => {
    if (!position) return null;
    const currentPrice = position.side === 'yes' ? market.yesPrice : market.noPrice;
    const pnl = (currentPrice - position.entryPrice) * position.size;
    return pnl;
  };

  const pnl = calculatePnL();

  return (
    <Card 
      className="p-4 sm:p-5 cursor-pointer hover:shadow-lg transition-all duration-300 hover:border-accent/50 group active:scale-[0.98]"
      onClick={handleClick}
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {position && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="mb-2 bg-accent/10 text-accent border-accent/30 text-xs cursor-help">
                      <User className="h-3 w-3 mr-1" />
                      Your Position
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="space-y-1">
                    <p className="font-medium">
                      {position.size} shares on <span className={position.side === 'yes' ? 'text-green-500' : 'text-red-500'}>{position.side.toUpperCase()}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Entry: ${position.entryPrice.toFixed(2)}
                    </p>
                    {pnl !== null && (
                      <p className={`text-xs font-medium ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        P&L: {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <h3 className="text-base sm:text-base font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-3 leading-snug">
              {market.question}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="text-xs whitespace-nowrap">
              {market.category}
            </Badge>
          </div>
        </div>

        {/* Market Type Indicator */}
        <div className="flex items-center gap-2">
          {market.type === "orderbook" ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Order Book</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              <span>Automated Market</span>
            </div>
          )}
        </div>

        {/* Prices - Enhanced touch targets on mobile */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 sm:p-3 min-h-[64px] flex flex-col justify-center">
            <p className="text-xs text-muted-foreground mb-1">Yes</p>
            <p className="text-xl sm:text-lg font-bold text-green-600 dark:text-green-500">
              ${market.yesPrice.toFixed(2)}
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 sm:p-3 min-h-[64px] flex flex-col justify-center">
            <p className="text-xs text-muted-foreground mb-1">No</p>
            <p className="text-xl sm:text-lg font-bold text-red-600 dark:text-red-500">
              ${market.noPrice.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Stats - Stack on very small screens */}
        <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs sm:text-xs">
              {market.volume.toLocaleString()} vol
            </span>
          </div>
          <div className={`flex items-center gap-1.5 ${isExpiringSoon ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'}`}>
            <Clock className="h-4 w-4" />
            <span className="text-xs sm:text-xs">
              {isExpiringSoon && "⚠️ "}
              Expires {timeToExpiry}
            </span>
          </div>
        </div>

        {/* Trade Button - Enhanced for mobile */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-accent group-hover:text-accent/80 transition-colors py-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">View Market</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MarketCard;
