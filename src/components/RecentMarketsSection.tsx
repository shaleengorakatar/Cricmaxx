import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { TrendingUp, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MarketCard from "@/components/markets/MarketCard";
import { Market } from "@/types/market";

export const RecentMarketsSection = () => {
  const { data: markets, isLoading } = useQuery({
    queryKey: ["recent-markets-24h"],
    queryFn: async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("markets")
        .select("id, question, category, yes_price, no_price, volume, expiry_time, type, description, image_url, created_at")
        .in("status", ["approved", "open"])
        .gte("created_at", oneDayAgo)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || !markets?.length) return null;

  const formattedMarkets: Market[] = markets.map((m) => ({
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

  return (
    <section className="py-6 bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-bold text-foreground">New Markets</h2>
            <Badge variant="secondary" className="text-xs">Last 24h</Badge>
          </div>
          <Link to="/markets">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formattedMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      </div>
    </section>
  );
};
