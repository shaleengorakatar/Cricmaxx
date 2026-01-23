import { useState, useEffect } from "react";
import { MobileLayout } from "@/layouts/MobileLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Market } from "@/types/market";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const MobileMarkets = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .in("status", ["approved", "open"])
      .lte("expiry_time", thirtyDaysFromNow.toISOString())
      .gte("expiry_time", now.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching markets:", error);
      toast({
        title: "Error loading markets",
        description: "Could not fetch markets",
        variant: "destructive",
      });
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

  const filteredMarkets = allMarkets.filter(
    (market) =>
      market.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      market.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Sports: "bg-blue-500",
      Politics: "bg-purple-500",
      Entertainment: "bg-pink-500",
      Crypto: "bg-orange-500",
      Business: "bg-green-500",
    };
    return colors[category] || "bg-gray-500";
  };

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-4">Markets</h1>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </div>

        {/* Markets List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading markets...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMarkets.map((market) => (
              <Card
                key={market.id}
                className="p-4 active:scale-[0.98] transition-transform cursor-pointer"
                onClick={() => navigate(`/market/${market.id}`)}
              >
                {/* Category Badge */}
                <Badge
                  className={`${getCategoryColor(market.category)} text-white mb-2`}
                >
                  {market.category}
                </Badge>

                {/* Question */}
                <h3 className="text-base font-semibold text-foreground mb-3 line-clamp-2">
                  {market.question}
                </h3>

                {/* Prices */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Yes</p>
                    <p className="text-xl font-bold text-green-600">
                      ${market.yesPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">No</p>
                    <p className="text-xl font-bold text-red-600">
                      ${market.noPrice.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>{market.volume.toLocaleString()} volume</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!loading && filteredMarkets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {allMarkets.length === 0 ? "No markets available" : "No markets found"}
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default MobileMarkets;
