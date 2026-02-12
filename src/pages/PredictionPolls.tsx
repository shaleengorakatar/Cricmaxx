import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PollCard } from "@/components/polls/PollCard";
import { CreatePollForm } from "@/components/polls/CreatePollForm";
import PollLeaderboardModal from "@/components/leaderboard/PollLeaderboardModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, BarChart3, Plus, LogIn, Coins, Trophy, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
      // Fetch polls
      const { data: pollsData, error: pollsError } = await supabase
        .from("prediction_polls")
        .select("*")
        .in("status", ["open", "closed", "resolved"])
        .order("created_at", { ascending: false });

      if (pollsError) throw pollsError;
      if (!pollsData?.length) { setPolls([]); return; }

      const pollIds = pollsData.map((p: any) => p.id);

      // Fetch options
      const { data: optionsData } = await supabase
        .from("poll_options")
        .select("*")
        .in("poll_id", pollIds);

      // Fetch vote aggregates
      const { data: votesAgg } = await supabase
        .from("poll_votes")
        .select("poll_id, option_id, amount");

      // Fetch user's votes
      let userVotes: any[] = [];
      if (user) {
        const { data } = await supabase
          .from("poll_votes")
          .select("poll_id, option_id, amount")
          .eq("user_id", user.id);
        userVotes = data || [];
      }

      // Aggregate votes per option
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
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="mb-6">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-accent shrink-0" />
                Prediction Polls
              </h1>
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
            <p className="text-sm text-muted-foreground mt-1">
              Vote on match outcomes with tokens – winners split the pool!
            </p>
          </div>

          <Alert className="border-amber-500/30 bg-amber-500/10 mb-6">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground block mb-0.5">Closed Beta — Gentleman's Agreement</span>
              1 CricMaxx Token = $1 USD. All balances are settled directly between participants after the tournament. This is a trust-based system.
            </AlertDescription>
          </Alert>

          <div className="bg-muted/50 rounded-lg p-3 mb-6 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground text-sm">How it works</p>
            <p>• Pick an option and stake 5, 10, 15, or 20 tokens</p>
            <p>• Polls close 30 minutes before the match</p>
            <p>• If your option wins, you get your stake back + your proportional share of the losing pool</p>
            <p>• Higher stakes = bigger share of winnings</p>
            <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
              <p className="font-medium text-foreground text-xs">Example</p>
              <p>Poll: "Who will be Player of the Match?" — Options: Kohli, Smith, Williamson</p>
              <p>You stake 20 tokens on Kohli. Total pool: 100 tokens (Kohli: 40, Smith: 35, Williamson: 25)</p>
              <p>Kohli wins! Losing pool = 60 tokens. Your share: 20/40 = 50%</p>
              <p className="text-green-600 dark:text-green-400">✅ You get: 20 (stake) + 50% of 60 = 50 tokens! That's a 30 token profit.</p>
              <p className="text-red-500">❌ If Kohli doesn't win: you lose your 20 token stake.</p>
            </div>
          </div>

          {/* Auth / balance prompts */}
          {!user ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                <LogIn className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">You're not signed in</p>
                  <p className="text-xs text-muted-foreground">Sign in or create an account to participate in polls and win tokens!</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 ml-8 sm:ml-0">
                <Button size="sm" variant="outline" onClick={() => navigate("/auth?redirect=/polls")}>Sign In</Button>
                <Button size="sm" onClick={() => navigate("/auth?redirect=/polls")}>Sign Up</Button>
              </div>
            </div>
          ) : profile && (profile.balance ?? 0) < 10 ? (
            <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 sm:p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Coins className="h-5 w-5 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    You have {profile.balance ?? 0} token{(profile.balance ?? 0) !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Load up tokens to participate in polls and win big!</p>
                </div>
              </div>
              <Button size="sm" className="ml-8 sm:ml-0 self-start sm:self-auto" onClick={() => navigate("/dashboard#wallet")}>Load Tokens</Button>
            </div>
          ) : null}

          {showCreate && (
            <div className="mb-6">
              <CreatePollForm onCreated={() => { setShowCreate(false); fetchPolls(); }} />
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading polls...</p>
            </div>
          ) : polls.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No polls yet. Be the first to create one!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {polls.map((poll) => (
                <div key={poll.id} id={`poll-${poll.id}`} className={highlightId === poll.id ? "ring-2 ring-primary rounded-lg" : ""}>
                  <PollCard poll={poll} onVoted={fetchPolls} defaultExpanded={highlightId === poll.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <PollLeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
    </div>
  );
};

export default PredictionPolls;
