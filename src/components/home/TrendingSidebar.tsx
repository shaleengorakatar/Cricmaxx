import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Market } from "@/types/market";
import { useNavigate } from "react-router-dom";
import { TrendingUp, ArrowRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendingMarket extends Market {
  change?: number;
}

export function TrendingSidebar() {
  const navigate = useNavigate();

  const { data: trending } = useQuery({
    queryKey: ["trending-markets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("markets")
        .select("id, question, category, yes_price, no_price, volume, expiry_time, type, description, image_url")
        .in("status", ["approved", "open"])
        .gte("expiry_time", new Date().toISOString())
        .order("volume", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((m) => ({
        id: m.id,
        question: m.question,
        category: m.category as Market["category"],
        type: m.type as Market["type"],
        yesPrice: Number(m.yes_price),
        noPrice: Number(m.no_price),
        volume: Number(m.volume),
        expiryTime: m.expiry_time,
      }));
    },
  });

  const { data: topMovers } = useQuery({
    queryKey: ["top-movers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("markets")
        .select("id, question, category, yes_price, no_price, volume, expiry_time, type, price_history")
        .in("status", ["approved", "open"])
        .gte("expiry_time", new Date().toISOString())
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((m) => {
        const history = Array.isArray(m.price_history) ? m.price_history : [];
        const prevPrice = history.length > 1 ? Number((history[history.length - 2] as any)?.y ?? m.yes_price) : Number(m.yes_price);
        const currentPrice = Number(m.yes_price);
        const change = Math.round((currentPrice - prevPrice) * 100);
        return {
          id: m.id,
          question: m.question,
          category: m.category as Market["category"],
          type: m.type as Market["type"],
          yesPrice: currentPrice,
          noPrice: Number(m.no_price),
          volume: Number(m.volume),
          expiryTime: m.expiry_time,
          change,
        } as TrendingMarket;
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Trending */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-1.5">
            Trending
          </h3>
          <button
            onClick={() => navigate("/markets")}
            className="text-accent hover:text-accent-foreground text-sm font-medium flex items-center gap-0.5"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1">
          {trending?.map((m, i) => (
            <button
              key={m.id}
              onClick={() => navigate(`/market/${m.id}`)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {m.question}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.category}</p>
                </div>
                <span className="text-sm font-bold text-foreground shrink-0">
                  {Math.round(m.yesPrice * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Top Movers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Top movers</h3>
          <button
            onClick={() => navigate("/markets")}
            className="text-accent hover:text-accent-foreground text-sm font-medium flex items-center gap-0.5"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1">
          {topMovers?.map((m, i) => (
            <button
              key={m.id}
              onClick={() => navigate(`/market/${m.id}`)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {m.question}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.category}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-bold text-foreground">
                    {Math.round(m.yesPrice * 100)}%
                  </span>
                  {m.change !== undefined && m.change !== 0 && (
                    <div className={cn(
                      "flex items-center justify-end gap-0.5 text-xs font-medium",
                      m.change > 0 ? "text-accent" : "text-destructive"
                    )}>
                      {m.change > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(m.change)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
