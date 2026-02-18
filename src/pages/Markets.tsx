import { useState, useMemo } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketCard from "@/components/markets/MarketCard";
import MarketFilters from "@/components/markets/MarketFilters";
import UserRatingBadge from "@/components/market-detail/UserRatingBadge";
import LeaderboardModal from "@/components/leaderboard/LeaderboardModal";
import { MarketCategory } from "@/types/market";
import { TrendingUp, Trophy, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useBatchIndicativePrices } from "@/hooks/useBatchIndicativePrices";
import { useMarkets } from "@/hooks/useMarkets";

const Markets = () => {
  const { user, isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  // Use the new hook for markets data
  const { markets: allMarkets, userPositions, loading, error, refetch } = useMarkets(
    user?.id ?? null
  );

  // Batch fetch indicative prices from order book
  const marketIds = useMemo(() => allMarkets.map((m) => m.id), [allMarkets]);
  const { prices: indicativePrices } = useBatchIndicativePrices(marketIds);

  // Apply indicative prices to markets
  const marketsWithIndicativePrices = useMemo(() => {
    return allMarkets.map((market) => {
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
        const categoryMatch =
          selectedCategory === "All" || market.category === selectedCategory;
        const searchMatch =
          searchQuery === "" ||
          market.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          market.category.toLowerCase().includes(searchQuery.toLowerCase());
        return categoryMatch && searchMatch;
      })
      .sort((a, b) => {
        const isAT20WC = a.question.toLowerCase().includes("india win t20 world cup 2026");
        const isBT20WC = b.question.toLowerCase().includes("india win t20 world cup 2026");
        if (isAT20WC && !isBT20WC) return -1;
        if (!isAT20WC && isBT20WC) return 1;
        return new Date(a.expiryTime).getTime() - new Date(b.expiryTime).getTime();
      });
  }, [marketsWithIndicativePrices, selectedCategory, searchQuery]);

  // Determine what to render
  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-12 sm:py-16">
          <p className="text-base sm:text-lg text-muted-foreground">Loading markets...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12 sm:py-16 space-y-4">
          <p className="text-base sm:text-lg text-muted-foreground">Unable to load markets</p>
          <Button variant="outline" onClick={refetch} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      );
    }

    if (filteredMarkets.length > 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredMarkets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              position={userPositions.get(market.id)}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="text-center py-12 sm:py-16">
        <p className="text-base sm:text-lg text-muted-foreground">
          {allMarkets.length === 0
            ? "No active markets available"
            : "No markets found matching your filters"}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {allMarkets.length === 0
            ? "Check back soon for new markets!"
            : "Try adjusting your search or filters"}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 pt-28 lg:pt-20 pb-12">
        <div className="container mx-auto px-4">
          {/* Header — compact single row */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent shrink-0" />
              <h1 className="text-lg font-bold text-foreground">Browse Markets</h1>
            </div>
            {isAuthenticated && (
              <div className="flex items-center gap-2 shrink-0">
                <UserRatingBadge />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLeaderboardOpen(true)}
                  className="gap-1.5 h-8 px-2"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">Leaderboard</span>
                </Button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="mb-3">
            <MarketFilters
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
              onCategoryChange={setSelectedCategory}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* Results Count */}
          {!loading && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground">
                Showing {filteredMarkets.length}{" "}
                {filteredMarkets.length === 1 ? "market" : "markets"}
              </p>
            </div>
          )}

          {/* Market Content */}
          {renderContent()}
        </div>
      </main>

      <Footer />

      <LeaderboardModal
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />
    </div>
  );
};

export default Markets;
