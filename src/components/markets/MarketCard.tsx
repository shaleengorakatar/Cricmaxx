import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Market } from "@/types/market";
import { TrendingUp, Clock, BookOpen, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CountdownTimer } from "@/components/ui/countdown-timer";

export interface UserPosition {
  side: string;
  size: number;
  entryPrice: number;
}

interface MarketCardProps {
  market: Market & { prediction_count?: number; price_history?: any[] };
  position?: UserPosition | null;
}

const MarketCard = ({ market, position }: MarketCardProps) => {
  const navigate = useNavigate();

  const yesPrice = Number(market.yesPrice) || 0.5;
  const noPrice = Number(market.noPrice) || 0.5;
  const yesPercent = Math.round(yesPrice * 100);
  const noPercent = 100 - yesPercent;
  const yesMultiplier = (1 / yesPrice).toFixed(2);
  const noMultiplier = (1 / noPrice).toFixed(2);

  const handleClick = () => {
    navigate(`/market/${market.id}`);
  };

  // Calculate P&L if position exists
  const pnl = position
    ? ((position.side === "yes" ? yesPrice : noPrice) - position.entryPrice) * position.size
    : null;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer transition-all duration-200",
        "bg-card border-border/40 hover:border-primary/40 hover:shadow-lg",
        "active:scale-[0.98]",
        position && "ring-1 ring-accent/40"
      )}
      onClick={handleClick}
    >
      <div className="p-4 space-y-3">
        {/* Top: Question + Category */}
        <div className="flex items-start gap-3">
          <h3 className="flex-1 text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {market.question}
          </h3>
          <Badge
            variant="secondary"
            className="shrink-0 text-[10px] font-medium px-2 py-0.5 bg-muted/60"
          >
            {market.category}
          </Badge>
        </div>

        {/* Odds Rows */}
        <div className="space-y-2">
          {/* YES Row */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground w-7">Yes</span>
            <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-success/70 transition-all duration-500"
                style={{ width: `${yesPercent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-mono w-10 text-right">
              {yesMultiplier}x
            </span>
            <span
              className={cn(
                "text-xs font-bold px-3 py-1 rounded-full border min-w-[52px] text-center",
                "border-success/40 text-success bg-success/5"
              )}
            >
              {yesPercent}%
            </span>
          </div>

          {/* NO Row */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground w-7">No</span>
            <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-destructive/70 transition-all duration-500"
                style={{ width: `${noPercent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-mono w-10 text-right">
              {noMultiplier}x
            </span>
            <span
              className={cn(
                "text-xs font-bold px-3 py-1 rounded-full border min-w-[52px] text-center",
                "border-destructive/40 text-destructive bg-destructive/5"
              )}
            >
              {noPercent}%
            </span>
          </div>
        </div>

        {/* Position indicator */}
        {position && pnl !== null && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-accent/5 border border-accent/20 text-xs">
            <span className="text-muted-foreground">
              {position.size} on <span className={position.side === "yes" ? "text-success font-medium" : "text-destructive font-medium"}>{position.side.toUpperCase()}</span>
            </span>
            <span className="ml-auto font-semibold font-mono" style={{ color: pnl >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))" }}>
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
            </span>
          </div>
        )}

        {/* Footer: meta */}
        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <CountdownTimer expiryTime={market.expiryTime} compact />
            {market.type === "orderbook" ? (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> Book
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-accent" /> Instant
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <span>Predict</span>
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MarketCard;
