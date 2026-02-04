import { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, Users, ArrowRight, RefreshCw } from "lucide-react";
import { Market } from "@/types/market";
import { useNavigate } from "react-router-dom";
import { Sparkline } from "@/components/ui/sparkline";
import { useTradingPreferences } from "@/hooks/useTradingPreferences";
import { getMarketDateRange, ACTIVE_MARKET_STATUSES } from "@/lib/marketFilters";

export function FeaturedMarket() {
  const [market, setMarket] = useState<Market & { prediction_count?: number; price_history?: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const { formatOdds } = useTradingPreferences();
  const hasFetchedRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchFeaturedMarket = useCallback(async (isRetry = false) => {
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (isRetry) {
      setLoading(true);
      setError(false);
    }
    
    const { now, maxExpiry } = getMarketDateRange();

    try {
      // Use direct REST API to bypass any auth issues
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const params = new URLSearchParams({
        select: '*',
        status: `in.(${ACTIVE_MARKET_STATUSES.join(',')})`,
        expiry_time: `gte.${now.toISOString()}`,
        order: 'volume.desc'
      });
      
      const url = `${supabaseUrl}/rest/v1/markets?${params.toString()}&expiry_time=lte.${maxExpiry.toISOString()}`;
      
      const response = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      const allMarkets = await response.json();
    
      if (!allMarkets || allMarkets.length === 0) {
        setLoading(false);
        hasFetchedRef.current = true;
        return;
      }

      // Use the current date as a seed for daily rotation
      const today = new Date();
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const marketIndex = dayOfYear % allMarkets.length;
      
      const data = allMarkets[marketIndex];

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

      setError(false);
      setLoading(false);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error("Error fetching featured market:", err);
      
      if (!isRetry) {
        // Retry once after 2 seconds
        retryTimeoutRef.current = setTimeout(() => fetchFeaturedMarket(true), 2000);
        return;
      }
      
      setError(true);
      setLoading(false);
    }
  }, []);

  // Initial fetch + failsafe timeout
  useEffect(() => {
    fetchFeaturedMarket();
    
    // Failsafe: if still loading after 15 seconds, force retry
    const failsafeTimeout = setTimeout(() => {
      if (loading && !error) {
        console.log('FeaturedMarket: Failsafe triggered - forcing retry');
        fetchFeaturedMarket(true);
      }
    }, 15000);
    
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      clearTimeout(failsafeTimeout);
    };
  }, [fetchFeaturedMarket]);

  // Refresh markets periodically
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchFeaturedMarket();
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(refreshInterval);
  }, [fetchFeaturedMarket]);

  if (loading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-32 bg-muted rounded" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center space-y-4">
        <p className="text-muted-foreground">Unable to load featured market</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchFeaturedMarket(true)}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
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

        {/* Stats row - hidden for now */}
        {priceData.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">24h:</span>
            <Sparkline data={priceData} width={50} height={16} />
          </div>
        )}

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
