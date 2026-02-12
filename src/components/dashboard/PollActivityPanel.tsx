import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Vote, Trophy, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface PollVoteData {
  id: string;
  amount: number;
  created_at: string;
  poll_id: string;
  option_id: string;
}

interface PollData {
  id: string;
  question: string;
  status: string;
  total_pool: number;
  winning_option_id: string | null;
  closes_at: string;
}

const PollActivityPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<PollVoteData[]>([]);
  const [polls, setPolls] = useState<PollData[]>([]);
  const [stats, setStats] = useState({
    totalVotes: 0,
    totalStaked: 0,
    activePolls: 0,
    wonPolls: 0,
  });

  useEffect(() => {
    if (!user?.id) return;

    const fetchPollData = async () => {
      setLoading(true);
      try {
        // Fetch user's votes
        const { data: votesData } = await supabase
          .from('poll_votes')
          .select('id, amount, created_at, poll_id, option_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        const userVotes = votesData || [];
        setVotes(userVotes);

        // Get unique poll IDs from votes
        const pollIds = [...new Set(userVotes.map(v => v.poll_id))];

        if (pollIds.length > 0) {
          const { data: pollsData } = await supabase
            .from('prediction_polls')
            .select('id, question, status, total_pool, winning_option_id, closes_at')
            .in('id', pollIds);

          const userPolls = pollsData || [];
          setPolls(userPolls);

          // Calculate stats
          const totalStaked = userVotes.reduce((sum, v) => sum + Number(v.amount), 0);
          const activePolls = userPolls.filter(p => p.status === 'open').length;
          const wonPolls = userPolls.filter(p => {
            if (p.status !== 'resolved' || !p.winning_option_id) return false;
            return userVotes.some(v => v.poll_id === p.id && v.option_id === p.winning_option_id);
          }).length;

          setStats({
            totalVotes: userVotes.length,
            totalStaked,
            activePolls,
            wonPolls,
          });
        } else {
          setStats({ totalVotes: 0, totalStaked: 0, activePolls: 0, wonPolls: 0 });
        }
      } catch (err) {
        console.error('Failed to fetch poll data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPollData();
  }, [user?.id]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Vote className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">Prediction Polls</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">Prediction Polls</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/polls')}
          className="text-xs"
        >
          View All <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.totalVotes}</p>
          <p className="text-xs text-muted-foreground">Votes Cast</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.totalStaked}</p>
          <p className="text-xs text-muted-foreground">Tokens Staked</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-2xl font-bold text-accent">{stats.activePolls}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-2xl font-bold text-green-500">{stats.wonPolls}</p>
          <p className="text-xs text-muted-foreground">Won</p>
        </div>
      </div>

      {/* Recent Poll Votes */}
      {votes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Votes</p>
          {votes.slice(0, 3).map((vote) => {
            const poll = polls.find(p => p.id === vote.poll_id);
            const isWinner = poll?.status === 'resolved' && poll?.winning_option_id === vote.option_id;
            const isActive = poll?.status === 'open';

            return (
              <div
                key={vote.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/polls?highlight=${vote.poll_id}`)}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium text-foreground truncate">
                    {poll?.question || 'Poll'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {vote.amount} tokens staked
                  </p>
                </div>
                <Badge
                  variant={isWinner ? "default" : isActive ? "secondary" : "outline"}
                  className={isWinner ? "bg-green-500/20 text-green-500 border-green-500/30" : ""}
                >
                  {isWinner ? (
                    <><Trophy className="h-3 w-3 mr-1" /> Won</>
                  ) : isActive ? (
                    "Active"
                  ) : poll?.status === 'resolved' ? (
                    "Lost"
                  ) : (
                    poll?.status || "—"
                  )}
                </Badge>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No poll votes yet</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigate('/polls')}
          >
            Browse Polls
          </Button>
        </div>
      )}
    </Card>
  );
};

export default PollActivityPanel;
