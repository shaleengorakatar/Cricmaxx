import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PollCard } from "@/components/polls/PollCard";
import { CreatePollForm } from "@/components/polls/CreatePollForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, Plus } from "lucide-react";
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
  closes_at: string;
  status: string;
  total_pool: number;
  winning_option_id: string | null;
  options: PollOption[];
  user_vote: { option_id: string; amount: number } | null;
}

const PredictionPolls = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

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
          <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-accent" />
                Prediction Polls
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Vote on match outcomes with tokens – winners split the pool!
              </p>
            </div>
            {user && (
              <Button variant="outline" size="sm" onClick={() => setShowCreate(!showCreate)}>
                <Plus className="h-4 w-4 mr-1" /> Create
              </Button>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-3 mb-6 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">How it works</p>
            <p>• Pick an option and stake 5, 10, 15, or 20 tokens</p>
            <p>• Polls close 30 minutes before the match</p>
            <p>• If your option wins, you get your stake back + a proportional share of the losing pool</p>
            <p>• Higher stakes = bigger share of winnings</p>
          </div>

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
                  <PollCard poll={poll} onVoted={fetchPolls} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PredictionPolls;
