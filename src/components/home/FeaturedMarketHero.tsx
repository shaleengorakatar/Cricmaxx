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
    return <Card className="p-8 animate-pulse"><div className="h-48 bg-muted rounded" /></Card>;
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

  // Build sub-outcomes from top markets (simulate multi-outcome display like Kalshi)
  const subOutcomes = markets.slice(0, 3).map((m) => ({
    label: m.category,
    odds: Math.round(m.yesPrice * 100),
    multiplier: (1 / m.yesPrice).toFixed(1),
  }));

  return (
    <Card
      className="border-border/40 overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => navigate(`/market/${market.id}`)}
    >
      <div className="p-6 sm:p-8">
        {/* Header: Question + Navigation */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight flex-1">
            {market.question}
          </h2>
          {markets.length > 1 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="p-1.5 rounded-full border border-border hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className="text-sm text-muted-foreground font-medium">
                {currentIndex + 1} of {markets.length}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="p-1.5 rounded-full border border-border hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Content: Table + Chart side by side on desktop */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Outcomes table */}
          <div className="flex-1 min-w-0">
            {/* Table header */}
            <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground font-medium pb-2 border-b border-border/40">
              <span>Market</span>
              <span className="text-center">Pays out</span>
              <span className="text-center">Odds</span>
            </div>

            {/* YES row */}
            <div className="grid grid-cols-3 gap-4 items-center py-3 border-b border-border/20">
              <span className="text-sm font-medium text-foreground">Yes</span>
              <span className="text-sm text-muted-foreground text-center">{(1 / market.yesPrice).toFixed(2)}x</span>
              <div className="flex justify-center">
                <span className={cn(
                  "text-sm font-bold px-4 py-1 rounded-full border",
                  "border-accent/40 text-accent"
                )}>
                  {yesPercent}%
                </span>
              </div>
            </div>

            {/* NO row */}
            <div className="grid grid-cols-3 gap-4 items-center py-3 border-b border-border/20">
              <span className="text-sm font-medium text-foreground">No</span>
              <span className="text-sm text-muted-foreground text-center">{(1 / market.noPrice).toFixed(2)}x</span>
              <div className="flex justify-center">
                <span className={cn(
                  "text-sm font-bold px-4 py-1 rounded-full border",
                  "border-muted-foreground/30 text-muted-foreground"
                )}>
                  {noPercent}%
                </span>
              </div>
            </div>

            {/* Volume + category */}
            <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
              <span className="font-medium">${market.volume.toLocaleString()} vol</span>
              <span>{market.category}</span>
            </div>

            {/* Description snippet */}
            {market.description && (
              <div className="mt-4 pt-3 border-t border-border/20">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {market.description}
                </p>
              </div>
            )}
          </div>

          {/* Right: Chart */}
          {priceData.length > 1 && (
            <div className="lg:w-[45%] shrink-0 flex flex-col justify-center">
              <Sparkline
                data={priceData}
                width={320}
                height={140}
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
