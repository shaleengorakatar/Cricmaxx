import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

import { CreatePollForm } from "@/components/polls/CreatePollForm";
import { PollCarousel } from "@/components/polls/PollCarousel";
import PollLeaderboardModal from "@/components/leaderboard/PollLeaderboardModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart3, Plus, LogIn, Coins, Trophy, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PollOption {
  id: string;
  option_text: string;
  vote_count: number;
  total_amount: number;
}

interface Poll {
  id: string;
  question: string;
  description?: string | null;
  closes_at: string;
  status: string;
  total_pool: number;
  winning_option_id: string | null;
  options: PollOption[];
  user_vote: { option_id: string; amount: number } | null;
}

const PollHowItWorks = () => {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between text-muted-foreground gap-2">
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            How it works
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2">
          <CardContent className="p-3 text-xs text-muted-foreground space-y-1.5">
            <p>• Pick an option and stake 5, 10, 15, or 20 tokens</p>
            <p>• Polls close 30 minutes before the match</p>
            <p>• If your option wins, you get your proportional share of the pool</p>
            <p>• Higher stakes = bigger share of winnings</p>
            <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
              <p className="font-medium text-foreground text-xs">Example</p>
              <p>Poll: "Who will be Player of the Match?" — Options: Kohli, Smith, Williamson</p>
              <p>Total pool: 100 tokens. You stake 20 on Kohli (total on Kohli: 40).</p>
              <p>Kohli wins! Your share: 20 / 40 = 50% of the pool.</p>
              <p className="text-green-600 dark:text-green-400">✅ You get: 50% × 100 = 50 tokens. That's a 30 token profit!</p>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};

const PredictionPolls = () => {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Scroll to highlighted poll after loading
  useEffect(() => {
    if (!loading && highlightId) {
      const el = document.getElementById(`poll-${highlightId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, highlightId]);

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    try {
      const { data: pollsData, error: pollsError } = await supabase
        .from("prediction_polls")
        .select("*")
        .in("status", ["open", "closed", "resolved"])
        .order("created_at", { ascending: false });

      if (pollsError) throw pollsError;
      if (!pollsData?.length) { setPolls([]); return; }

      const pollIds = pollsData.map((p: any) => p.id);

      const { data: optionsData } = await supabase
        .from("poll_options")
        .select("*")
        .in("poll_id", pollIds);

      const { data: votesAgg } = await supabase
        .from("poll_votes")
        .select("poll_id, option_id, amount");

      let userVotes: any[] = [];
      if (user) {
        const { data } = await supabase
          .from("poll_votes")
          .select("poll_id, option_id, amount")
          .eq("user_id", user.id);
        userVotes = data || [];
      }

      const votesByOption: Record<string, { count: number; total: number }> = {};
      (votesAgg || []).forEach((v: any) => {
        const key = v.option_id;
        if (!votesByOption[key]) votesByOption[key] = { count: 0, total: 0 };
        votesByOption[key].count++;
        votesByOption[key].total += Number(v.amount);
      });

      const enrichedPolls: Poll[] = pollsData.map((p: any) => {
        const opts = (optionsData || [])
          .filter((o: any) => o.poll_id === p.id)
          .map((o: any) => ({
            id: o.id,
            option_text: o.option_text,
            vote_count: votesByOption[o.id]?.count || 0,
            total_amount: votesByOption[o.id]?.total || 0,
          }));

        const uv = userVotes.find((v) => v.poll_id === p.id);

        return {
          id: p.id,
          question: p.question,
          description: p.description || null,
          closes_at: p.closes_at,
          status: p.status,
          total_pool: Number(p.total_pool),
          winning_option_id: p.winning_option_id,
          options: opts,
          user_vote: uv ? { option_id: uv.option_id, amount: Number(uv.amount) } : null,
        };
      });

      setPolls(enrichedPolls);
    } catch (err) {
      console.error("Error fetching polls:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 pt-32 lg:pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header — matches Contests style */}
          <div className="mb-6">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-7 w-7 text-accent" />
                <h1 className="text-2xl md:text-3xl font-bold">Prediction Polls</h1>
              </div>
              {user && (
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setShowLeaderboard(true)}>
                    <Trophy className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Leaderboard</span><span className="sm:hidden">Board</span>
                  </Button>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setShowCreate(!showCreate)}>
                      <Plus className="h-4 w-4 mr-1" /> Create
                    </Button>
                  )}
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Vote on match outcomes with tokens – winners split the pool!
            </p>
          </div>

          {/* Auth prompt — matches Contests style */}
          {!user && (
            <Card className="mb-4 border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground text-center sm:text-left">Sign in to participate in polls and win tokens!</p>
                <Button size="sm" onClick={() => navigate("/auth?redirect=/polls")}>Sign In</Button>
              </CardContent>
            </Card>
          )}

          {/* Balance prompt */}
          {user && profile && (profile.balance ?? 0) < 10 && (
            <Card className="mb-4 border-accent/20 bg-accent/5">
              <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <Coins className="h-5 w-5 text-accent shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      You have {profile.balance ?? 0} token{(profile.balance ?? 0) !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">Load up tokens to participate in polls and win big!</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => navigate("/dashboard#wallet")}>Load Tokens</Button>
              </CardContent>
            </Card>
          )}

          {/* Closed Beta Alert */}
          <Alert className="border-amber-500/30 bg-amber-500/10 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground block mb-0.5">Closed Beta — Gentleman's Agreement</span>
              1 CricMaxx Token = $1 USD. All balances are settled directly between participants after the tournament. This is a trust-based system.
            </AlertDescription>
          </Alert>

          {/* How It Works — collapsible like Contests */}
          <PollHowItWorks />

          {showCreate && (
            <div className="mb-6">
              <CreatePollForm onCreated={() => { setShowCreate(false); fetchPolls(); }} />
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted/50 rounded-xl animate-pulse" />)}
            </div>
          ) : polls.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No polls yet. Be the first to create one!</p>
              </CardContent>
            </Card>
          ) : (
            <PollCarousel polls={polls} highlightId={highlightId} onVoted={fetchPolls} />
          )}
        </div>
      </main>
      <Footer />
      <PollLeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
    </div>
  );
};

export default PredictionPolls;
