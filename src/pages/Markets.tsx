import { useState, useMemo, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketCard from "@/components/markets/MarketCard";
import MarketFilters from "@/components/markets/MarketFilters";
import { MarketType, MarketCategory, Market } from "@/types/market";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Markets = () => {
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | "All">("All");
  const [selectedType, setSelectedType] = useState<MarketType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

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
            // Only add if it's approved/open and within 14 days
            const expiry = new Date(data.expiry_time);
            const now = new Date();
            const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
            
            if (['approved', 'open'].includes(data.status) && expiry >= now && expiry <= fourteenDaysFromNow) {
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
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .in("status", ["approved", "open"])
      .lte("expiry_time", fourteenDaysFromNow.toISOString())
      .gte("expiry_time", now.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching markets:", error);
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

    setAllMarkets(formattedMarkets);
    setLoading(false);
  };

  const filteredMarkets = useMemo(() => {
    return allMarkets.filter((market) => {
      // Category filter
      const categoryMatch = selectedCategory === "All" || market.category === selectedCategory;
      
      // Type filter
      const typeMatch = selectedType === "all" || market.type === selectedType;
      
      // Search filter
      const searchMatch = searchQuery === "" || 
        market.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        market.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      return categoryMatch && typeMatch && searchMatch;
    });
  }, [allMarkets, selectedCategory, selectedType, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          {/* Header - Mobile optimized */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Browse Markets</h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              Discover and trade on prediction markets across various categories
            </p>
          </div>

          {/* Filters */}
          <div className="mb-6 sm:mb-8">
            <MarketFilters
              selectedCategory={selectedCategory}
              selectedType={selectedType}
              searchQuery={searchQuery}
              onCategoryChange={setSelectedCategory}
              onTypeChange={setSelectedType}
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
                <MarketCard key={market.id} market={market} />
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
    </div>
  );
};

export default Markets;
