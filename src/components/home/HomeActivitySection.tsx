import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Coins, Trophy, Clock, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const PollMiniCard = ({ poll }: { poll: any }) => {
  const navigate = useNavigate();
  const totalVotes = poll.options?.reduce((s: number, o: any) => s + (o.vote_count || 0), 0) || 0;
  const timeLeft = formatDistanceToNow(new Date(poll.closes_at), { addSuffix: true });

  return (
    <Card
      className="group cursor-pointer border-border/40 hover:border-primary/40 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
      onClick={() => navigate(`/polls?highlight=${poll.id}`)}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Badge variant="secondary" className="shrink-0 text-[10px] bg-accent/10 text-accent border-accent/20">
            Poll
          </Badge>
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {poll.question}
          </h3>
        </div>

        {/* Option bars */}
        {poll.options?.slice(0, 3).map((opt: any) => {
          const pct = totalVotes > 0 ? Math.round((opt.vote_count || 0) / totalVotes * 100) : 0;
          return (
            <div key={opt.id} className="space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-foreground font-medium truncate max-w-[70%]">{opt.option_text}</span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent/60 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{totalVotes} votes</span>
          <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{poll.total_pool} pool</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Closes {timeLeft}</span>
        </div>
      </div>
    </Card>
  );
};

const ContestMiniCard = ({ contest }: { contest: any }) => {
  const navigate = useNavigate();
  const timeLeft = formatDistanceToNow(new Date(contest.closes_at), { addSuffix: true });
  const prizePool = (contest.entry_count || 0) * contest.buy_in_amount;

  return (
    <Card
      className="group cursor-pointer border-border/40 hover:border-primary/40 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
      onClick={() => navigate(`/contests`)}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Badge variant="secondary" className="shrink-0 text-[10px] bg-primary/10 text-primary border-primary/20">
            Contest
          </Badge>
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {contest.title}
          </h3>
        </div>

        {contest.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{contest.description}</p>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/40 rounded-md p-2">
            <p className="text-xs font-bold text-foreground">{contest.buy_in_amount}</p>
            <p className="text-[10px] text-muted-foreground">Buy-in</p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-md p-2">
            <p className="text-xs font-bold text-primary">{prizePool > 0 ? prizePool : "—"}</p>
            <p className="text-[10px] text-muted-foreground">Prize pool</p>
          </div>
          <div className="bg-muted/40 rounded-md p-2">
            <p className="text-xs font-bold text-foreground">{contest.entry_count || 0}</p>
            <p className="text-[10px] text-muted-foreground">Entries</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{contest.match_name || "Prediction Contest"}</span>
          <span className="flex items-center gap-1 text-primary font-medium">
            Join <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Card>
  );
};

export function HomeActivitySection() {
  const { data: polls } = useQuery({
    queryKey: ["home-polls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prediction_polls")
        .select(`id, question, closes_at, status, total_pool, poll_options(id, option_text)`)
        .eq("status", "open")
        .gte("closes_at", new Date().toISOString())
        .order("total_pool", { ascending: false })
        .limit(4);
      if (error) throw error;

      // Fetch vote counts
      const withCounts = await Promise.all((data || []).map(async (poll) => {
        const { data: votes } = await supabase
          .from("poll_votes")
          .select("option_id, amount")
          .eq("poll_id", poll.id);

        const voteCounts = new Map<string, number>();
        for (const v of votes || []) voteCounts.set(v.option_id, (voteCounts.get(v.option_id) || 0) + 1);

        return {
          ...poll,
          options: poll.poll_options.map((o: any) => ({ ...o, vote_count: voteCounts.get(o.id) || 0 })),
        };
      }));

      return withCounts;
    },
  });

  const { data: contests } = useQuery({
    queryKey: ["home-contests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prediction_contests")
        .select("id, title, description, closes_at, buy_in_amount, match_name, status")
        .eq("status", "open")
        .gte("closes_at", new Date().toISOString())
        .order("closes_at", { ascending: true })
        .limit(2);
      if (error) throw error;

      // Get entry counts
      const withCounts = await Promise.all((data || []).map(async (c) => {
        const { count } = await supabase
          .from("contest_entries")
          .select("id", { count: "exact", head: true })
          .eq("contest_id", c.id);
        return { ...c, entry_count: count || 0 };
      }));

      return withCounts;
    },
  });

  const hasPolls = polls && polls.length > 0;
  const hasContests = contests && contests.length > 0;

  if (!hasPolls && !hasContests) return null;

  const items: { type: "poll" | "contest"; data: any }[] = [];
  if (hasPolls) polls.forEach((p) => items.push({ type: "poll", data: p }));
  if (hasContests) contests.forEach((c) => items.push({ type: "contest", data: c }));

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Polls & Contests</h2>
        <div className="flex items-center gap-2">
          {hasPolls && (
            <Link to="/polls">
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1 text-xs">
                All Polls <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
          {hasContests && (
            <Link to="/contests">
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1 text-xs">
                All Contests <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) =>
          item.type === "poll"
            ? <PollMiniCard key={`poll-${item.data.id}`} poll={item.data} />
            : <ContestMiniCard key={`contest-${item.data.id}`} contest={item.data} />
        )}
      </div>
    </div>
  );
}
