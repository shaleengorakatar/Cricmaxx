import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { BarChart3, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export const RecentPollsSection = () => {
  const { data: polls, isLoading } = useQuery({
    queryKey: ["recent-polls-24h"],
    queryFn: async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("prediction_polls")
        .select("id, question, closes_at, total_pool, created_at, status")
        .in("status", ["open"])
        .gte("created_at", oneDayAgo)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || !polls?.length) return null;

  return (
    <section className="py-8 bg-gradient-to-b from-secondary/20 to-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-bold text-foreground">New Polls</h2>
            <Badge variant="secondary" className="text-xs">Last 24h</Badge>
          </div>
          <Link to="/polls">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {polls.map((p) => (
            <Link key={p.id} to={`/polls?highlight=${p.id}`}>
              <Card className="hover:border-accent/50 transition-colors h-full">
                <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
                  <p className="font-medium text-sm text-foreground line-clamp-2">{p.question}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-accent">
                      Pool: {Number(p.total_pool).toFixed(0)} tokens
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Closes {format(new Date(p.closes_at), "MMM d")}
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
