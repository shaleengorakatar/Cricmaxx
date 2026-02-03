import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Market } from "@/types/market";
import { useNavigate } from "react-router-dom";
import { getMarketDateRange, ACTIVE_MARKET_STATUSES } from "@/lib/marketFilters";

export default function LiveMarketsWidget() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const fetchLiveMarkets = useCallback(async (retry = false) => {
    if (retry) {
      setLoading(true);
      setError(false);
    }
    
    const { now, maxExpiry } = getMarketDateRange();

    const { data, error: fetchError } = await supabase
      .from("markets")
      .select("*")
      .in("status", [...ACTIVE_MARKET_STATUSES])
      .lte("expiry_time", maxExpiry.toISOString())
      .gte("expiry_time", now.toISOString())
      .order("volume", { ascending: false })
      .limit(6);

    if (fetchError) {
      console.error("Error fetching live markets:", fetchError);
      
      // Check if it's an auth error - if so, wait and retry once
      const isAuthError = fetchError.message?.includes('JWT') || 
                          fetchError.code === 'PGRST301' ||
                          fetchError.message?.includes('invalid');
      
      if (isAuthError && !retry) {
        // Wait for potential token refresh, then retry
        setTimeout(() => fetchLiveMarkets(true), 2000);
        return;
      }
      
      setError(true);
      setLoading(false);
      return;
    }

    const formattedMarkets: Market[] = (data || []).map((m) => ({
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
    }));

    setMarkets(formattedMarkets);
    setError(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLiveMarkets();
  }, [fetchLiveMarkets]);

  const getTimeUntilExpiry = (expiryTime: string) => {
    const now = new Date();
    const expiry = new Date(expiryTime);
    const diff = expiry.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    return `${hours}h`;
  };

  if (loading) {
    return (
      <section className="py-12 bg-gradient-to-b from-background to-secondary/5">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-muted-foreground">Loading live markets...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-12 bg-gradient-to-b from-background to-secondary/5">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Unable to load markets</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchLiveMarkets(true)}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (markets.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-gradient-to-b from-background to-secondary/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
              Live Markets
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Top prediction markets from live cricket matches
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/markets")}
            className="hidden sm:flex items-center gap-2"
          >
            View All
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((market) => (
            <Card
              key={market.id}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/market/${market.id}`)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {market.category}
                  </Badge>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getTimeUntilExpiry(market.expiryTime)}
                  </Badge>
                </div>

                <h3 className="font-semibold text-sm line-clamp-2 leading-snug">
                  {market.question}
                </h3>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Yes</p>
                      <p className="text-base font-bold text-green-500">
                        {(market.yesPrice * 100).toFixed(0)}¢
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">No</p>
                      <p className="text-base font-bold text-red-500">
                        {(market.noPrice * 100).toFixed(0)}¢
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <Button
            variant="outline"
            onClick={() => navigate("/markets")}
            className="w-full max-w-xs"
          >
            View All Markets
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}
