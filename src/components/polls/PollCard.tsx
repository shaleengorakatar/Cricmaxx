import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Trophy, Check, Coins, TrendingUp, Share2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PollEditForm } from "./PollEditForm";

interface PollOption {
  id: string;
  option_text: string;
  vote_count?: number;
  total_amount?: number;
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
  user_vote?: { option_id: string; amount: number } | null;
}

interface PollCardProps {
  poll: Poll;
  onVoted: () => void;
  defaultExpanded?: boolean;
}

const STAKE_OPTIONS = [5, 10, 15, 20];

export const PollCard = ({ poll, onVoted, defaultExpanded = false }: PollCardProps) => {
  const { user, refetchProfile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editing, setEditing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [selectedStake, setSelectedStake] = useState<number>(5);
  const [voting, setVoting] = useState(false);

  const isClosed = new Date(poll.closes_at) < new Date() || poll.status !== "open";
  const isResolved = poll.status === "resolved";
  const hasVoted = !!poll.user_vote;

  const totalVotes = poll.options.reduce((sum, o) => sum + (o.vote_count || 0), 0);

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
    if (hasVoted) {
      toast({ title: "Already voted", description: "You can only vote once per poll.", variant: "destructive" });
      return;
    }
    if (isClosed) {
      toast({ title: "Poll closed", description: "This poll is no longer accepting votes.", variant: "destructive" });
      return;
    }
    setVoting(true);
    try {
      // Re-check poll status server-side
      const { data: pollCheck } = await supabase
        .from("prediction_polls")
        .select("status, closes_at")
        .eq("id", poll.id)
        .single();
      
      if (!pollCheck || pollCheck.status !== "open" || new Date(pollCheck.closes_at) < new Date()) {
        toast({ title: "Poll closed", description: "This poll closed before your vote could be placed.", variant: "destructive" });
        return;
      }

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
        if (error.code === "23505") {
          toast({ title: "Already voted", description: "You've already voted on this poll.", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: "Vote placed!", description: `You staked ${selectedStake} tokens.` });
      refetchProfile();
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

  // Compact collapsed view
  if (!expanded) {
    return (
      <Card
        className="overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground line-clamp-2 mb-2">{poll.question}</p>
              <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{totalVotes} votes</span>
                <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{poll.total_pool} tokens</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeLeft()}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge variant={isResolved ? "default" : isClosed ? "secondary" : "outline"} className="shrink-0">
                {isResolved ? "Resolved" : isClosed ? "Closed" : "Open"}
              </Badge>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Expanded full view
  return (
    <Card className={`overflow-hidden ${isResolved ? "border-accent/30" : "border-primary/30"}`}>
      {editing ? (
        <CardContent className="pt-5">
          <PollEditForm
            poll={poll}
            onSaved={() => { setEditing(false); onVoted(); }}
            onCancel={() => setEditing(false)}
          />
        </CardContent>
      ) : (
      <>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{poll.question}</CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && !isResolved && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={async (e) => {
                e.stopPropagation();
                const url = `https://cricmaxx.com/polls?highlight=${poll.id}`;
                const copyFallback = async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {
                    const input = document.createElement('input');
                    input.value = url;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                  }
                  toast({ title: "Link copied!", description: "Share this poll with friends." });
                };
                try {
                  const optionsList = poll.options.map(o => `• ${o.option_text}`).join('\n');
                  const shareData = { title: poll.question, text: `POLL QUESTION\n\n${poll.question}\n\nOptions:\n${optionsList}\n\nHead on over to CricMaxx to predict!\n\nFor new users, use invite code WC26 to enter the website.`, url };
                  if (typeof navigator.share === 'function' && navigator.canShare?.(shareData)) {
                    await navigator.share(shareData);
                    return;
                  }
                } catch (e: any) {
                  if (e?.name === 'AbortError') return;
                }
                await copyFallback();
              }}
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            <Badge variant={isResolved ? "default" : isClosed ? "secondary" : "outline"} className="shrink-0">
              {isResolved ? "Resolved" : isClosed ? "Closed" : "Open"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeLeft()}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{totalVotes} votes</span>
          <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{poll.total_pool} tokens pool</span>
        </div>
        {poll.description && (
          <p className="text-xs text-muted-foreground mt-2">{poll.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasVoted && !isClosed ? (
          <>
            <div className="space-y-2">
              {poll.options.map((opt) => {
                const optVotes = opt.vote_count || 0;
                const optAmount = opt.total_amount || 0;
                const isSelected = selectedOption === opt.id;
                return (
                   <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOption(opt.id)}
                    className={`w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>{opt.option_text}</span>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{optVotes}</span>
                        <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{optAmount} tokens</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Your vote costs tokens (weighted voting):</p>
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {STAKE_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    variant={selectedStake === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedStake(s)}
                    className="w-full text-xs sm:text-sm"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            {selectedOption && potentialPayout !== null && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 sm:p-3 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <TrendingUp className="h-4 w-4 text-accent shrink-0" />
                  <span className="text-muted-foreground">Potential payout:</span>
                </div>
                <span className="text-sm font-bold text-accent ml-5 sm:ml-0">
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
          <div className="space-y-2">
            {poll.options.map((opt) => {
              const pct = poll.total_pool > 0 ? ((opt.total_amount || 0) / poll.total_pool) * 100 : 0;
              const isWinner = isResolved && poll.winning_option_id === opt.id;
              const isUserVote = poll.user_vote?.option_id === opt.id;
              const optVotes = opt.vote_count || 0;

              return (
                <div key={opt.id} className={`relative overflow-hidden rounded-lg border p-2.5 sm:p-3 ${isWinner ? "border-accent bg-accent/5" : "border-border"}`}>
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      {isWinner && <Trophy className="h-3.5 w-3.5 text-accent shrink-0" />}
                      {isUserVote && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      {opt.option_text}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted-foreground">
                      {optVotes} {optVotes === 1 ? "vote" : "votes"} · {(opt.total_amount || 0)} tokens · {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
            {hasVoted && poll.user_vote && !isResolved && (() => {
              const userStake = poll.user_vote!.amount;
              const userOptAmount = poll.options.find(o => o.id === poll.user_vote!.option_id)?.total_amount || 0;
              const losingPool = poll.total_pool - userOptAmount;
              const allOnOneOption = poll.options.filter(o => (o.total_amount || 0) > 0).length <= 1;
              const estimatedPayout = userOptAmount > 0
                ? userStake + (userStake / userOptAmount) * losingPool
                : userStake;
              const winnings = Math.round((estimatedPayout - userStake) * 100) / 100;
              return (
                <>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-accent/10 border border-accent/20 mt-2">
                    <span className="text-xs text-muted-foreground">
                      If correct: <span className="font-semibold text-foreground">{userStake}</span> back + <span className="font-semibold text-accent">{winnings}</span> winnings
                    </span>
                    <span className="text-sm font-bold text-accent">
                      = {Math.round(estimatedPayout * 100) / 100} tokens
                    </span>
                  </div>
                  {allOnOneOption && (
                    <p className="text-[11px] text-muted-foreground text-center mt-1">
                      ⚠️ All votes are on one option — if it wins, everyone gets their stake back with no bonus.
                    </p>
                  )}
                </>
              );
            })()}
            {hasVoted && isResolved && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                You voted with {poll.user_vote?.amount} tokens
              </p>
            )}
          </div>
        )}
      </CardContent>
      </>
      )}
    </Card>
  );
};
