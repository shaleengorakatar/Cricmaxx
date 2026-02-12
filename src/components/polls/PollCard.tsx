import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Clock, Users, Trophy, Check, Coins, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PollOption {
  id: string;
  option_text: string;
  vote_count?: number;
  total_amount?: number;
}

interface Poll {
  id: string;
  question: string;
  closes_at: string;
  status: string;
  total_pool: number;
  winning_option_id: string | null;
  options: PollOption[];
  user_vote?: { option_id: string; amount: number } | null;
}

interface PollCardProps {
  poll: Poll;
  onVoted: () => void;
}

const STAKE_OPTIONS = [5, 10, 15, 20];

export const PollCard = ({ poll, onVoted }: PollCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [selectedStake, setSelectedStake] = useState<number>(5);
  const [voting, setVoting] = useState(false);

  const isClosed = new Date(poll.closes_at) < new Date() || poll.status !== "open";
  const isResolved = poll.status === "resolved";
  const hasVoted = !!poll.user_vote;

  const totalVotes = poll.options.reduce((sum, o) => sum + (o.vote_count || 0), 0);

  // Calculate potential payout for the selected option and stake
  const potentialPayout = useMemo(() => {
    if (!selectedOption || !selectedStake) return null;
    const selectedOpt = poll.options.find((o) => o.id === selectedOption);
    if (!selectedOpt) return null;

    const currentWinningPool = (selectedOpt.total_amount || 0) + selectedStake;
    const currentLosingPool = poll.total_pool - (selectedOpt.total_amount || 0);

    if (currentWinningPool <= 0) return selectedStake;

    const payout = selectedStake + (selectedStake / currentWinningPool) * currentLosingPool;
    return Math.round(payout * 100) / 100;
  }, [selectedOption, selectedStake, poll.options, poll.total_pool]);

  const handleVote = async () => {
    if (!user || !selectedOption) return;

    setVoting(true);
    try {
      const { error: balanceError } = await supabase.rpc("process_wallet_operation_pooled", {
        _user_id: user.id,
        _operation: "withdrawal",
        _amount: selectedStake,
        _metadata: { source: "poll_vote", poll_id: poll.id },
      });

      if (balanceError) throw balanceError;

      const { error } = await supabase.from("poll_votes").insert({
        poll_id: poll.id,
        option_id: selectedOption,
        user_id: user.id,
        amount: selectedStake,
      });

      if (error) {
        await supabase.rpc("process_wallet_operation_pooled", {
          _user_id: user.id,
          _operation: "deposit",
          _amount: selectedStake,
          _metadata: { source: "poll_vote_refund", poll_id: poll.id },
        });
        throw error;
      }

      toast({ title: "Vote placed!", description: `You staked ${selectedStake} tokens.` });
      onVoted();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setVoting(false);
    }
  };

  const timeLeft = () => {
    const diff = new Date(poll.closes_at).getTime() - Date.now();
    if (diff <= 0) return "Closed";
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  return (
    <Card className={`overflow-hidden ${isResolved ? "border-accent/30" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{poll.question}</CardTitle>
          <Badge variant={isResolved ? "default" : isClosed ? "secondary" : "outline"} className="shrink-0">
            {isResolved ? "Resolved" : isClosed ? "Closed" : "Open"}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeLeft()}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{totalVotes} votes</span>
          <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{poll.total_pool} tokens pool</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasVoted && !isClosed ? (
          <>
            <RadioGroup value={selectedOption} onValueChange={setSelectedOption} className="space-y-2">
              {poll.options.map((opt) => {
                const optVotes = opt.vote_count || 0;
                const optAmount = opt.total_amount || 0;
                return (
                  <div key={opt.id} className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${selectedOption === opt.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                    <RadioGroupItem value={opt.id} id={opt.id} />
                    <Label htmlFor={opt.id} className="flex-1 cursor-pointer">
                      <span className="text-sm font-medium">{opt.option_text}</span>
                      <span className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span>{optVotes} {optVotes === 1 ? "vote" : "votes"}</span>
                        <span>{optAmount} tokens</span>
                      </span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            {/* Stake selection */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Your vote costs tokens (weighted voting):</p>
              <div className="flex gap-2">
                {STAKE_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    variant={selectedStake === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedStake(s)}
                    className="flex-1"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            {/* Live potential payout */}
            {selectedOption && potentialPayout !== null && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex items-center gap-1.5 text-sm">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  <span className="text-muted-foreground">Potential payout:</span>
                </div>
                <span className="text-sm font-bold text-accent">
                  {potentialPayout} tokens
                  <span className="text-[11px] font-normal text-muted-foreground ml-1">
                    ({((potentialPayout / selectedStake - 1) * 100).toFixed(0)}% return)
                  </span>
                </span>
              </div>
            )}

            <Button
              onClick={handleVote}
              disabled={!selectedOption || voting || !user}
              className="w-full"
            >
              {voting ? "Placing vote..." : `Vote with ${selectedStake} tokens`}
            </Button>
          </>
        ) : (
          /* Results view */
          <div className="space-y-2">
            {poll.options.map((opt) => {
              const pct = poll.total_pool > 0 ? ((opt.total_amount || 0) / poll.total_pool) * 100 : 0;
              const isWinner = isResolved && poll.winning_option_id === opt.id;
              const isUserVote = poll.user_vote?.option_id === opt.id;
              const optVotes = opt.vote_count || 0;

              return (
                <div key={opt.id} className={`relative overflow-hidden rounded-lg border p-3 ${isWinner ? "border-accent bg-accent/5" : "border-border"}`}>
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      {isWinner && <Trophy className="h-3.5 w-3.5 text-accent" />}
                      {isUserVote && <Check className="h-3.5 w-3.5 text-primary" />}
                      {opt.option_text}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {optVotes} {optVotes === 1 ? "vote" : "votes"} · {(opt.total_amount || 0)} tokens · {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
            {hasVoted && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                You voted with {poll.user_vote?.amount} tokens
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
