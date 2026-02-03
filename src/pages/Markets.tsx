import { useState, useMemo, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketCard, { UserPosition } from "@/components/markets/MarketCard";
import MarketFilters from "@/components/markets/MarketFilters";
import UserRatingBadge from "@/components/market-detail/UserRatingBadge";
import LeaderboardModal from "@/components/leaderboard/LeaderboardModal";
import { MarketCategory, Market } from "@/types/market";
import { TrendingUp, Trophy, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getMarketDateRange, ACTIVE_MARKET_STATUSES, shouldShowMarket } from "@/lib/marketFilters";
import { useBatchIndicativePrices } from "@/hooks/useBatchIndicativePrices";

const Markets = () => {
  const { isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const [userPositions, setUserPositions] = useState<Map<string, UserPosition>>(new Map());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  // Fetch markets immediately on mount (no auth dependency for public data)
  useEffect(() => {
    fetchPublicMarkets();

    // Real-time subscription for market updates
    const channel = supabase
      .channel('markets-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'markets'
        },
        (payload) => {
          console.log('Real-time markets update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const data = payload.new as any;
            // Only add if it's approved/open and within visibility window
            if (shouldShowMarket(data.status, data.expiry_time)) {
              const newMarket: Market = {
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
              };
              setAllMarkets(prev => [newMarket, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const data = payload.new as any;
            setAllMarkets(prev => prev.map(m => 
              m.id === data.id 
                ? {
                    ...m,
                    yesPrice: Number(data.yes_price),
                    noPrice: Number(data.no_price),
                    volume: Number(data.volume),
                    question: data.question,
                    category: data.category as Market["category"],
                  }
                : m
            ));
          } else if (payload.eventType === 'DELETE') {
            setAllMarkets(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch user positions separately once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserPositions();
    } else {
      setUserPositions(new Map());
    }
  }, [isAuthenticated]);

  // Fetch public markets (no auth required)
  const fetchPublicMarkets = useCallback(async (retry = false) => {
    if (retry) {
      setLoading(true);
      setFetchError(false);
    }
    
    const { now, maxExpiry } = getMarketDateRange();

    const { data: activeMarkets, error: activeError } = await supabase
      .from("markets")
      .select("*")
      .in("status", [...ACTIVE_MARKET_STATUSES])
      .lte("expiry_time", maxExpiry.toISOString())
      .gte("expiry_time", now.toISOString())
      .order("created_at", { ascending: false });

    if (activeError) {
      console.error("Error fetching markets:", activeError);
      
      // Check if it's an auth error - if so, wait and retry once
      const isAuthError = activeError.message?.includes('JWT') || 
                          activeError.code === 'PGRST301' ||
                          activeError.message?.includes('invalid');
      
      if (isAuthError && !retry) {
        // Wait for potential token refresh, then retry
        setTimeout(() => fetchPublicMarkets(true), 2000);
        return;
      }
      
      setFetchError(true);
      setLoading(false);
      return;
    }

    const formattedMarkets: (Market & { prediction_count?: number; price_history?: any[] })[] = (activeMarkets || []).map((m: any) => ({
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

    setAllMarkets(formattedMarkets);
    setFetchError(false);
    setLoading(false);
  }, []);

  // Fetch user positions (requires auth)
  const fetchUserPositions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUserPositions(new Map());
      return;
    }

    const { data: positions } = await supabase
      .from("positions")
      .select("market_id, side, size, entry_price")
      .eq("user_id", user.id)
      .eq("status", "open");

    if (positions && positions.length > 0) {
      const positionsMap = new Map<string, UserPosition>();
      positions.forEach(p => {
        positionsMap.set(p.market_id, { 
          side: p.side, 
          size: Number(p.size),
          entryPrice: Number(p.entry_price)
        });
      });
      setUserPositions(positionsMap);
      
      // Fetch any markets with positions that might not be in the main list
      const positionMarketIds = positions.map(p => p.market_id);
      
      setAllMarkets(prev => {
        const existingMarketIds = new Set(prev.map(m => m.id));
        const missingMarketIds = positionMarketIds.filter(id => !existingMarketIds.has(id));
        
        if (missingMarketIds.length > 0) {
          // Fetch missing markets async and update state
          supabase
            .from("markets")
            .select("*")
            .in("id", missingMarketIds)
            .in("status", ["approved", "open", "closed"])
            .then(({ data: positionMarkets }) => {
              if (positionMarkets && positionMarkets.length > 0) {
                const additionalMarkets = positionMarkets.map((m: any) => ({
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
                // Deduplicate when adding
                setAllMarkets(current => {
                  const currentIds = new Set(current.map(m => m.id));
                  const uniqueAdditional = additionalMarkets.filter(m => !currentIds.has(m.id));
                  return [...current, ...uniqueAdditional];
                });
              }
            });
        }
        return prev;
      });
    } else {
      setUserPositions(new Map());
    }
  };

  // Batch fetch indicative prices from order book
  const marketIds = useMemo(() => allMarkets.map(m => m.id), [allMarkets]);
  const { prices: indicativePrices } = useBatchIndicativePrices(marketIds);

  // Apply indicative prices to markets
  const marketsWithIndicativePrices = useMemo(() => {
    return allMarkets.map(market => {
      const indicative = indicativePrices.get(market.id);
      if (indicative && indicative.source !== "default") {
        return {
          ...market,
          yesPrice: indicative.yesPrice,
          noPrice: indicative.noPrice,
        };
      }
      return market;
    });
  }, [allMarkets, indicativePrices]);

  const filteredMarkets = useMemo(() => {
    return marketsWithIndicativePrices
      .filter((market) => {
        // Category filter
        const categoryMatch = selectedCategory === "All" || market.category === selectedCategory;
        
        // Search filter
        const searchMatch = searchQuery === "" || 
          market.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          market.category.toLowerCase().includes(searchQuery.toLowerCase());
        
        return categoryMatch && searchMatch;
      })
      // Sort: T20 World Cup 2026 market first, then by expiry time
      .sort((a, b) => {
        const isAT20WC = a.question.toLowerCase().includes("india win t20 world cup 2026");
        const isBT20WC = b.question.toLowerCase().includes("india win t20 world cup 2026");
        
        if (isAT20WC && !isBT20WC) return -1;
        if (!isAT20WC && isBT20WC) return 1;
        
        return new Date(a.expiryTime).getTime() - new Date(b.expiryTime).getTime();
      });
  }, [marketsWithIndicativePrices, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          {/* Header - Mobile optimized */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Browse Markets</h1>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Discover and trade on prediction markets across various categories
                </p>
              </div>
              
              {/* Rating & Leaderboard Buttons */}
              {isAuthenticated && (
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <UserRatingBadge />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeaderboardOpen(true)}
                    className="gap-1.5"
                  >
                    <Trophy className="w-4 h-4" />
                    <span className="hidden sm:inline">Leaderboard</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 sm:mb-8">
            <MarketFilters
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
              onCategoryChange={setSelectedCategory}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* Results Count */}
          <div className="mb-4 sm:mb-6">
            <p className="text-sm text-muted-foreground">
              Showing {filteredMarkets.length} {filteredMarkets.length === 1 ? 'market' : 'markets'}
            </p>
          </div>

          {/* Market Grid - Single column on mobile, multiple on larger screens */}
          {loading ? (
            <div className="text-center py-12 sm:py-16">
              <p className="text-base sm:text-lg text-muted-foreground">Loading markets...</p>
            </div>
          ) : fetchError ? (
            <div className="text-center py-12 sm:py-16 space-y-4">
              <p className="text-base sm:text-lg text-muted-foreground">
                Unable to load markets
              </p>
              <Button 
                variant="outline" 
                onClick={() => fetchPublicMarkets(true)}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          ) : filteredMarkets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredMarkets.map((market) => (
                <MarketCard 
                  key={market.id} 
                  market={market} 
                  position={userPositions.get(market.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 sm:py-16">
              <p className="text-base sm:text-lg text-muted-foreground">
                {allMarkets.length === 0 ? "No active markets available" : "No markets found matching your filters"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {allMarkets.length === 0 ? "Check back soon for new markets!" : "Try adjusting your search or filters"}
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Leaderboard Modal */}
      <LeaderboardModal 
        isOpen={leaderboardOpen} 
        onClose={() => setLeaderboardOpen(false)} 
      />
    </div>
  );
};

export default Markets;