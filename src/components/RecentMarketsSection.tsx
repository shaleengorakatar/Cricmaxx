import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { TrendingUp, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export const RecentMarketsSection = () => {
  const { data: markets, isLoading } = useQuery({
    queryKey: ["recent-markets-24h"],
    queryFn: async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("markets")
        .select("id, question, category, yes_price, no_price, expiry_time, created_at")
        .in("status", ["approved", "open"])
        .gte("created_at", oneDayAgo)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || !markets?.length) return null;

  return (
    <section className="py-8 bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((m) => (
            <Link key={m.id} to={`/market/${m.id}`}>
              <Card className="hover:border-accent/50 transition-colors h-full">
                <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
                  <div>
                    <Badge variant="outline" className="text-xs mb-2">{m.category}</Badge>
                    <p className="font-medium text-sm text-foreground line-clamp-2">{m.question}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex gap-3">
                      <span className="text-green-500 font-semibold">Yes {Math.round(Number(m.yes_price) * 100)}¢</span>
                      <span className="text-red-500 font-semibold">No {Math.round(Number(m.no_price) * 100)}¢</span>
                    </div>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(m.expiry_time), "MMM d")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
