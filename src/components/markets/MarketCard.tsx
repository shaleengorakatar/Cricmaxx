import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Market } from "@/types/market";
import { TrendingUp, Clock, BarChart3, BookOpen, Zap, User, Flame, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  const isExpiringSoon = expiryDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const isHot = market.volume > 10000;

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

  // Calculate potential multipliers
  const yesMultiplier = (1 / market.yesPrice).toFixed(1);
  const noMultiplier = (1 / market.noPrice).toFixed(1);

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden cursor-pointer transition-all duration-300",
        "bg-card hover:bg-card/95 border-border/50",
        "hover:border-primary/30 hover:-translate-y-1",
        "active:scale-[0.98]",
        position && "ring-2 ring-accent/30"
      )}
      style={{
        boxShadow: 'var(--shadow-md)',
      }}
      onClick={handleClick}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative p-4 sm:p-5 space-y-4">
        {/* Header with badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {position && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="bg-accent/10 text-accent border-accent/30 text-xs cursor-help animate-in">
                        <User className="h-3 w-3 mr-1" />
                        Your Position
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="space-y-1">
                      <p className="font-medium">
                        {position.size} shares on <span className={position.side === 'yes' ? 'text-success' : 'text-destructive'}>{position.side.toUpperCase()}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Entry: ${position.entryPrice.toFixed(2)}
                      </p>
                      {pnl !== null && (
                        <p className={cn("text-xs font-medium", pnl >= 0 ? "text-success" : "text-destructive")}>
                          P&L: {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {isHot && (
                <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-xs animate-pulse">
                  <Flame className="h-3 w-3 mr-1" />
                  Hot
                </Badge>
              )}
              
              {isExpiringSoon && (
                <Badge variant="destructive" className="text-xs">
                  <Timer className="h-3 w-3 mr-1" />
                  Ending Soon
                </Badge>
              )}
            </div>
            
            {/* Question */}
            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
              {market.question}
            </h3>
          </div>
          
          {/* Category badge */}
          <Badge 
            variant="secondary" 
            className="shrink-0 text-xs bg-secondary/80 backdrop-blur-sm"
          >
            {market.category}
          </Badge>
        </div>

        {/* Market Type Indicator */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {market.type === "orderbook" ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Order Book</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
              <Zap className="h-3.5 w-3.5 text-accent" />
              <span>Instant</span>
            </div>
          )}
          
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="font-medium">${market.volume.toLocaleString()}</span>
          </div>
        </div>

        {/* Price Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* YES Card */}
          <div className="price-yes group/price">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Yes</span>
              <span className="text-xs font-bold text-success">{yesMultiplier}x</span>
            </div>
            <p className="text-2xl font-bold text-success">
              ${market.yesPrice.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(market.yesPrice * 100).toFixed(0)}% chance
            </p>
          </div>
          
          {/* NO Card */}
          <div className="price-no group/price">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">No</span>
              <span className="text-xs font-bold text-destructive">{noMultiplier}x</span>
            </div>
            <p className="text-2xl font-bold text-destructive">
              ${market.noPrice.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(market.noPrice * 100).toFixed(0)}% chance
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          {/* Expiry */}
          <div className={cn(
            "flex items-center gap-1.5 text-xs",
            isExpiringSoon ? "text-destructive font-medium" : "text-muted-foreground"
          )}>
            <Clock className="h-3.5 w-3.5" />
            <span>{timeToExpiry}</span>
          </div>
          
          {/* CTA */}
          <div className="flex items-center gap-2 text-primary font-medium text-sm group-hover:gap-3 transition-all">
            <span>Trade</span>
            <TrendingUp className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MarketCard;