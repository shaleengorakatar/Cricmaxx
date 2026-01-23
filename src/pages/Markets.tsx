import { useState, useMemo, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketCard, { UserPosition } from "@/components/markets/MarketCard";
import MarketFilters from "@/components/markets/MarketFilters";
import UserRatingBadge from "@/components/market-detail/UserRatingBadge";
import LeaderboardModal from "@/components/leaderboard/LeaderboardModal";
import { MarketCategory, Market } from "@/types/market";
import { TrendingUp, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const Markets = () => {
  const { isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const [userPositions, setUserPositions] = useState<Map<string, UserPosition>>(new Map());
  const [loading, setLoading] = useState(true);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  useEffect(() => {
    fetchMarkets();

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
            // Only add if it's approved/open and within 30 days
            const expiry = new Date(data.expiry_time);
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            
            if (['approved', 'open'].includes(data.status) && expiry >= now && expiry <= thirtyDaysFromNow) {
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

  const fetchMarkets = async () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Fetch active markets (within 30 days)
    const { data: activeMarkets, error: activeError } = await supabase
      .from("markets")
      .select("*")
      .in("status", ["approved", "open"])
      .lte("expiry_time", thirtyDaysFromNow.toISOString())
      .gte("expiry_time", now.toISOString())
      .order("created_at", { ascending: false });

    if (activeError) {
      console.error("Error fetching markets:", activeError);
      setLoading(false);
      return;
    }

    let allMarketData = activeMarkets || [];

    // If authenticated, also fetch markets where user has positions (even if expired)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
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
        
        const positionMarketIds = positions.map(p => p.market_id);
        const activeMarketIds = new Set(allMarketData.map(m => m.id));
        
        // Filter out markets we already have
        const missingMarketIds = positionMarketIds.filter(id => !activeMarketIds.has(id));
        
        if (missingMarketIds.length > 0) {
          const { data: positionMarkets } = await supabase
            .from("markets")
            .select("*")
            .in("id", missingMarketIds)
            .in("status", ["approved", "open", "closed"]);

          if (positionMarkets) {
            allMarketData = [...allMarketData, ...positionMarkets];
          }
        }
      } else {
        setUserPositions(new Map());
      }
    } else {
      setUserPositions(new Map());
    }

    const formattedMarkets: Market[] = allMarketData.map((m) => ({
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

    setAllMarkets(formattedMarkets);
    setLoading(false);
  };

  const filteredMarkets = useMemo(() => {
    return allMarkets
      .filter((market) => {
        // Category filter
        const categoryMatch = selectedCategory === "All" || market.category === selectedCategory;
        
        // Search filter
        const searchMatch = searchQuery === "" || 
          market.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          market.category.toLowerCase().includes(searchQuery.toLowerCase());
        
        return categoryMatch && searchMatch;
      })
      // Sort by expiry time - soonest first
      .sort((a, b) => new Date(a.expiryTime).getTime() - new Date(b.expiryTime).getTime());
  }, [allMarkets, selectedCategory, searchQuery]);

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