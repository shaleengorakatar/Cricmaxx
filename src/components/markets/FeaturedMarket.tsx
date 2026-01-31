import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, Users, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Market } from "@/types/market";
import { useNavigate } from "react-router-dom";
import { Sparkline } from "@/components/ui/sparkline";
import { useTradingPreferences } from "@/hooks/useTradingPreferences";
import { getMarketDateRange, ACTIVE_MARKET_STATUSES } from "@/lib/marketFilters";

export function FeaturedMarket() {
  const [market, setMarket] = useState<Market & { prediction_count?: number; price_history?: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { formatOdds } = useTradingPreferences();

  useEffect(() => {
    fetchFeaturedMarket();
  }, []);

  const fetchFeaturedMarket = async () => {
    const { now, maxExpiry } = getMarketDateRange();

    // First try to get a featured market
    let { data, error } = await supabase
      .from("markets")
      .select("*")
      .eq("is_featured", true)
      .in("status", [...ACTIVE_MARKET_STATUSES])
      .gte("expiry_time", now.toISOString())
      .limit(1)
      .single();

    // If no featured market, get highest volume market
    if (!data) {
      const result = await supabase
        .from("markets")
        .select("*")
        .in("status", [...ACTIVE_MARKET_STATUSES])
        .lte("expiry_time", maxExpiry.toISOString())
        .gte("expiry_time", now.toISOString())
        .order("volume", { ascending: false })
        .limit(1)
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (data) {
      setMarket({
        id: data.id,
        question: data.question,
        category: data.category as Market["category"],
        type: data.type as Market["type"],
        yesPrice: Number(data.yes_price),
        noPrice: Number(data.no_price),
        volume: Number(data.volume),
        expiryTime: data.expiry_time,
        description: data.description || "",
        imageUrl: data.image_url || "",
        prediction_count: data.prediction_count || 0,
        price_history: Array.isArray(data.price_history) ? data.price_history : [],
      });
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-32 bg-muted rounded" />
      </Card>
    );
  }

  if (!market) return null;

  // Extract price history for sparkline
  const priceData = Array.isArray(market.price_history) 
    ? market.price_history.map((p: any) => p.y) 
    : [];

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-card to-accent/5 border-primary/20">
      {/* Featured badge */}
      <div className="absolute top-4 right-4">
        <Badge className="bg-gradient-to-r from-accent to-primary text-accent-foreground border-0 gap-1">
          <Star className="h-3 w-3 fill-current" />
          Prediction of the Day
        </Badge>
      </div>

      <div className="p-6 space-y-4">
        {/* Category */}
        <Badge variant="secondary" className="text-xs">
          {market.category}
        </Badge>

        {/* Question */}
        <h2 className="text-xl sm:text-2xl font-bold text-foreground pr-32 leading-tight">
          {market.question}
        </h2>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{market.prediction_count || 0} predicted</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>${market.volume.toLocaleString()} volume</span>
          </div>
          {priceData.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">24h:</span>
              <Sparkline data={priceData} width={50} height={16} />
            </div>
          )}
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-success/10 border border-success/20">
            <p className="text-xs font-medium text-muted-foreground mb-1">Yes</p>
            <p className="text-3xl font-bold text-success">
              {formatOdds(market.yesPrice)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-xs font-medium text-muted-foreground mb-1">No</p>
            <p className="text-3xl font-bold text-destructive">
              {formatOdds(market.noPrice)}
            </p>
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={() => navigate(`/market/${market.id}`)}
          className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
        >
          Make Your Prediction
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
