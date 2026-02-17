import { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Market } from "@/types/market";
import { useNavigate } from "react-router-dom";
import { Sparkline } from "@/components/ui/sparkline";
import { getMarketDateRange, ACTIVE_MARKET_STATUSES } from "@/lib/marketFilters";
import { cn } from "@/lib/utils";

interface FeaturedData extends Market {
  prediction_count?: number;
  price_history?: any[];
  volume: number;
}

export function FeaturedMarketHero() {
  const [markets, setMarkets] = useState<FeaturedData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const hasFetchedRef = useRef(false);

  const fetchMarkets = useCallback(async (isRetry = false) => {
    if (isRetry) { setLoading(true); setError(false); }
    const { now, maxExpiry } = getMarketDateRange();
    try {
      const { data, error: fetchError } = await supabase
        .from("markets")
        .select("*")
        .in("status", [...ACTIVE_MARKET_STATUSES])
        .lte("expiry_time", maxExpiry.toISOString())
        .gte("expiry_time", now.toISOString())
        .order("volume", { ascending: false })
        .limit(7);

      if (fetchError) {
        setLoading(false);
        if (!isRetry) setTimeout(() => fetchMarkets(true), 3000);
        else setError(true);
        return;
      }

      const formatted = (data || []).map((m) => ({
        id: m.id,
        question: m.question,
        category: m.category as Market["category"],
        type: m.type as Market["type"],
        yesPrice: Number(m.yes_price),
        noPrice: Number(m.no_price),
        volume: Number(m.volume),
        expiryTime: m.expiry_time,
        description: m.description || "",
        imageUrl: m.image_url || "",
        prediction_count: m.prediction_count || 0,
        price_history: Array.isArray(m.price_history) ? m.price_history : [],
      }));

      setMarkets(formatted);
      setLoading(false);
      hasFetchedRef.current = true;
    } catch {
      setLoading(false);
      if (!isRetry) setTimeout(() => fetchMarkets(true), 3000);
      else setError(true);
    }
  }, []);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  const goNext = () => setCurrentIndex((i) => (i + 1) % markets.length);
  const goPrev = () => setCurrentIndex((i) => (i - 1 + markets.length) % markets.length);

  if (loading) {
    return <Card className="p-4 animate-pulse"><div className="h-32 bg-muted rounded" /></Card>;
  }

  if (error) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Unable to load featured market</p>
        <Button variant="outline" size="sm" onClick={() => fetchMarkets(true)} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
      </Card>
    );
  }

  if (!markets.length) return null;

  const market = markets[currentIndex];
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = 100 - yesPercent;
  const priceData = market.price_history?.map((p: any) => p.y) || [];

  return (
    <Card
      className="border-border/40 overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => navigate(`/market/${market.id}`)}
    >
      <div className="p-4 sm:p-5">
        {/* Header: Question + Navigation */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug flex-1">
            {market.question}
          </h2>
          {markets.length > 1 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="p-1 rounded-full border border-border hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <span className="text-xs text-muted-foreground font-medium">
                {currentIndex + 1} of {markets.length}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="p-1 rounded-full border border-border hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Content: Table + Chart side by side */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Left: Outcomes table */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground font-medium pb-1.5 border-b border-border/40">
              <span>Market</span>
              <span className="text-center">Pays out</span>
              <span className="text-center">Odds</span>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center py-2 border-b border-border/20">
              <span className="text-sm font-medium text-foreground">Yes</span>
              <span className="text-sm text-muted-foreground text-center">{(1 / market.yesPrice).toFixed(2)}x</span>
              <div className="flex justify-center">
                <span className="text-xs font-bold px-3 py-0.5 rounded-full border border-accent/40 text-accent">
                  {yesPercent}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center py-2 border-b border-border/20">
              <span className="text-sm font-medium text-foreground">No</span>
              <span className="text-sm text-muted-foreground text-center">{(1 / market.noPrice).toFixed(2)}x</span>
              <div className="flex justify-center">
                <span className="text-xs font-bold px-3 py-0.5 rounded-full border border-muted-foreground/30 text-muted-foreground">
                  {noPercent}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span className="font-medium">${market.volume.toLocaleString()} vol</span>
              <span>{market.category}</span>
            </div>

            {market.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-2 pt-2 border-t border-border/20">
                {market.description}
              </p>
            )}
          </div>

          {/* Right: Chart — only if meaningful data */}
          {priceData.length > 2 && (
            <div className="sm:w-[40%] shrink-0 flex items-center">
              <Sparkline
                data={priceData}
                width={240}
                height={100}
                strokeColor="hsl(var(--accent))"
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
