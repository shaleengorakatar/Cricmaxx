import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketCard from "@/components/markets/MarketCard";
import { Market } from "@/types/market";

export function TopMarketsSection() {
  const { data: markets, isLoading } = useQuery({
    queryKey: ["top-markets-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("markets")
        .select("id, question, category, yes_price, no_price, volume, expiry_time, type, description, image_url")
        .in("status", ["approved", "open"])
        .gte("expiry_time", new Date().toISOString())
        .order("volume", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || !markets?.length) return null;

  const formatted: Market[] = markets.map((m) => ({
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
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Top Markets</h2>
          <Link to="/markets">
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formatted.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      </div>
    </section>
  );
}
