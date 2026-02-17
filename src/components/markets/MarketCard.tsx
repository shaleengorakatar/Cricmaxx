import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Market } from "@/types/market";
import { TrendingUp, Clock, BookOpen, Zap, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { supabase } from "@/integrations/supabase/client";

export interface UserPosition {
  side: string;
  size: number;
  entryPrice: number;
}

interface MarketCardProps {
  market: Market & { prediction_count?: number; price_history?: any[] };
  position?: UserPosition | null;
}

interface MiniOrderLevel {
  price: number;
  quantity: number;
}

const MiniOrderBook = ({ marketId }: { marketId: string }) => {
  const [yesOrders, setYesOrders] = useState<MiniOrderLevel[]>([]);
  const [noOrders, setNoOrders] = useState<MiniOrderLevel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.rpc('get_order_book_aggregated', { market_ids: [marketId] });
    
    const yesLevels: MiniOrderLevel[] = [];
    const noLevels: MiniOrderLevel[] = [];

    for (const row of data || []) {
      const price = Number(row.price);
      const quantity = Number(row.total_quantity);
      if (quantity <= 0) continue;
      if (row.side === 'yes') {
        noLevels.push({ price: 1 - price, quantity });
      } else {
        yesLevels.push({ price: 1 - price, quantity });
      }
    }

    // Aggregate by price
    const agg = (levels: MiniOrderLevel[]) => {
      const map = new Map<number, number>();
      for (const l of levels) {
        const p = Math.round(l.price * 100) / 100;
        map.set(p, (map.get(p) || 0) + l.quantity);
      }
      return Array.from(map.entries())
        .map(([price, quantity]) => ({ price, quantity }))
        .sort((a, b) => b.price - a.price)
        .slice(0, 3);
    };

    setYesOrders(agg(yesLevels));
    setNoOrders(agg(noLevels));
    setLoading(false);
  }, [marketId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  if (loading) {
    return <div className="py-3 text-center text-[10px] text-muted-foreground animate-pulse">Loading order book...</div>;
  }

  const totalYes = yesOrders.reduce((s, o) => s + o.quantity, 0);
  const totalNo = noOrders.reduce((s, o) => s + o.quantity, 0);
  const total = totalYes + totalNo;
  const bestYes = yesOrders[0];
  const bestNo = noOrders[0];

  if (total === 0) {
    return <div className="py-3 text-center text-[10px] text-muted-foreground">No orders yet</div>;
  }

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {/* Liquidity bar */}
      <div className="flex items-center justify-center gap-3 py-1.5 px-2 bg-muted/40 rounded-md text-[10px]">
        <span className="text-muted-foreground">Liquidity: <span className="font-semibold text-foreground">{total}</span></span>
        <span className="h-2.5 w-px bg-border" />
        <span className="text-success font-medium">YES: {totalYes}</span>
        <span className="text-destructive font-medium">NO: {totalNo}</span>
      </div>

      {/* Best prices */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-success/5 border border-success/20 rounded-md p-2">
          <p className="text-[9px] text-muted-foreground mb-0.5">Best YES Price</p>
          {bestYes ? (
            <>
              <p className="text-sm font-bold text-success">{(bestYes.price * 100).toFixed(0)}¢</p>
              <p className="text-[9px] text-muted-foreground">{bestYes.quantity} shares</p>
            </>
          ) : <p className="text-[10px] text-muted-foreground">—</p>}
        </div>
        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-2">
          <p className="text-[9px] text-muted-foreground mb-0.5">Best NO Price</p>
          {bestNo ? (
            <>
              <p className="text-sm font-bold text-destructive">{(bestNo.price * 100).toFixed(0)}¢</p>
              <p className="text-[9px] text-muted-foreground">{bestNo.quantity} shares</p>
            </>
          ) : <p className="text-[10px] text-muted-foreground">—</p>}
        </div>
      </div>

      {/* Order levels */}
      <div className="grid grid-cols-2 gap-2">
        {/* YES */}
        <div>
          <p className="text-[10px] font-semibold text-foreground mb-1">YES Orders</p>
          {yesOrders.length > 0 ? yesOrders.map((o, i) => (
            <div key={i} className="flex justify-between text-[10px] py-0.5">
              <span className="text-success font-medium">{(o.price * 100).toFixed(0)}¢</span>
              <span className="text-muted-foreground">{o.quantity} shares</span>
            </div>
          )) : <p className="text-[10px] text-muted-foreground">—</p>}
        </div>
        {/* NO */}
        <div>
          <p className="text-[10px] font-semibold text-foreground mb-1">NO Orders</p>
          {noOrders.length > 0 ? noOrders.map((o, i) => (
            <div key={i} className="flex justify-between text-[10px] py-0.5">
              <span className="text-destructive font-medium">{(o.price * 100).toFixed(0)}¢</span>
              <span className="text-muted-foreground">{o.quantity} shares</span>
            </div>
          )) : <p className="text-[10px] text-muted-foreground">—</p>}
        </div>
      </div>
    </div>
  );
};

const MarketCard = ({ market, position }: MarketCardProps) => {
  const navigate = useNavigate();
  const [showBook, setShowBook] = useState(false);

  const yesPrice = Number(market.yesPrice) || 0.5;
  const noPrice = Number(market.noPrice) || 0.5;
  const yesPercent = Math.round(yesPrice * 100);
  const noPercent = 100 - yesPercent;
  const yesMultiplier = (1 / yesPrice).toFixed(2);
  const noMultiplier = (1 / noPrice).toFixed(2);

  const handleClick = () => {
    navigate(`/market/${market.id}`);
  };

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

        {/* Collapsible Order Book */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowBook(!showBook); }}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <BookOpen className="h-3 w-3" />
          <span className="font-medium">Order Book</span>
          <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", showBook && "rotate-180")} />
        </button>

        {showBook && <MiniOrderBook marketId={market.id} />}

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
