import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Market } from "@/types/market";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ArrowDownRight, Coins, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
        .select("id, question, category, yes_price, no_price, volume, expiry_time, type")
        .in("status", ["approved", "open"])
        .gte("expiry_time", new Date().toISOString())
        .order("volume", { ascending: false })
        .limit(3);
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
        .limit(3);
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

  const { data: polls } = useQuery({
    queryKey: ["sidebar-polls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prediction_polls")
        .select("id, question, total_pool, closes_at, status")
        .in("status", ["open"])
        .gte("closes_at", new Date().toISOString())
        .order("total_pool", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contests } = useQuery({
    queryKey: ["sidebar-contests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prediction_contests")
        .select("id, title, buy_in_amount, closes_at, status")
        .in("status", ["open"])
        .gte("closes_at", new Date().toISOString())
        .order("closes_at", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      {/* Trending */}
      {trending && trending.length > 0 && (
        <SidebarSection title="Trending" onViewAll={() => navigate("/markets")}>
          {trending.map((m, i) => (
            <SidebarItem
              key={m.id}
              index={i + 1}
              label={m.question}
              sublabel={m.category}
              value={`${Math.round(m.yesPrice * 100)}%`}
              onClick={() => navigate(`/market/${m.id}`)}
            />
          ))}
        </SidebarSection>
      )}

      {/* Top Movers */}
      {topMovers && topMovers.length > 0 && (
        <SidebarSection title="Top movers" onViewAll={() => navigate("/markets")}>
          {topMovers.map((m, i) => (
            <SidebarItem
              key={m.id}
              index={i + 1}
              label={m.question}
              sublabel={m.category}
              value={`${Math.round(m.yesPrice * 100)}%`}
              change={m.change}
              onClick={() => navigate(`/market/${m.id}`)}
            />
          ))}
        </SidebarSection>
      )}

      {/* Polls */}
      {polls && polls.length > 0 && (
        <SidebarSection
          title="Active Polls"
          icon={<Coins className="h-4 w-4 text-accent" />}
          onViewAll={() => navigate("/polls")}
        >
          {polls.map((p, i) => (
            <SidebarItem
              key={p.id}
              index={i + 1}
              label={p.question}
              sublabel={`Closes ${format(new Date(p.closes_at), "MMM d")}`}
              value={`${Number(p.total_pool).toFixed(0)}`}
              valueSuffix=" tokens"
              onClick={() => navigate(`/polls?highlight=${p.id}`)}
            />
          ))}
        </SidebarSection>
      )}

      {/* Contests */}
      {contests && contests.length > 0 && (
        <SidebarSection
          title="Contests"
          icon={<Trophy className="h-4 w-4 text-yellow-500" />}
          onViewAll={() => navigate("/contests")}
        >
          {contests.map((c, i) => (
            <SidebarItem
              key={c.id}
              index={i + 1}
              label={c.title}
              sublabel={`Closes ${format(new Date(c.closes_at), "MMM d")}`}
              value={`${Number(c.buy_in_amount)}`}
              valueSuffix=" buy-in"
              onClick={() => navigate("/contests")}
            />
          ))}
        </SidebarSection>
      )}
    </div>
  );
}

/* ── Reusable sub-components ── */

function SidebarSection({
  title,
  icon,
  onViewAll,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  onViewAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
          {icon}
          {title}
        </h3>
        <button
          onClick={onViewAll}
          className="text-accent hover:text-accent/80 text-sm font-medium flex items-center gap-0.5"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarItem({
  index,
  label,
  sublabel,
  value,
  valueSuffix,
  change,
  onClick,
}: {
  index: number;
  label: string;
  sublabel: string;
  value: string;
  valueSuffix?: string;
  change?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-muted-foreground mt-0.5 w-3 shrink-0">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {label}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xs font-bold text-foreground">
            {value}
            {valueSuffix && (
              <span className="text-xs font-normal text-muted-foreground">{valueSuffix}</span>
            )}
          </span>
          {change !== undefined && change !== 0 && (
            <div
              className={cn(
                "flex items-center justify-end gap-0.5 text-xs font-medium",
                change > 0 ? "text-accent" : "text-destructive"
              )}
            >
              {change > 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(change)}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
