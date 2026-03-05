import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/lib/posthog";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Clock, Users, Trophy, Check, Coins, TrendingUp, Share2, Pencil } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PollEditForm } from "./PollEditForm";
import { formatDistanceToNow } from "date-fns";

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
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(defaultExpanded);
  const [editing, setEditing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [selectedStake, setSelectedStake] = useState<number>(5);
  const [voting, setVoting] = useState(false);

  const isClosed = new Date(poll.closes_at) < new Date() || poll.status !== "open";
  const isResolved = poll.status === "resolved";
  const hasVoted = !!poll.user_vote;
  const totalVotes = poll.options.reduce((sum, o) => sum + (o.vote_count || 0), 0);

  // Top 2 options for preview
  const topOptions = poll.options.slice(0, 2);

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
        _user_id: user.id, _operation: "withdrawal", _amount: selectedStake,
        _metadata: { source: "poll_vote", poll_id: poll.id },
      });
      if (balanceError) throw balanceError;
      const { error } = await supabase.from("poll_votes").insert({
        poll_id: poll.id, option_id: selectedOption, user_id: user.id, amount: selectedStake,
      });
      if (error) {
        await supabase.rpc("process_wallet_operation_pooled", {
          _user_id: user.id, _operation: "deposit", _amount: selectedStake,
          _metadata: { source: "poll_vote_refund", poll_id: poll.id },
        });
        if (error.code === "23505") {
          toast({ title: "Already voted", description: "You've already voted on this poll.", variant: "destructive" });
        } else { throw error; }
        return;
      }
      trackEvent('poll_vote_placed', { poll_id: poll.id, option_id: selectedOption, stake: selectedStake });
      toast({ title: "Vote placed!", description: `You staked ${selectedStake} tokens.` });
      refetchProfile();
      onVoted();
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setVoting(false);
    }
  };

  const closesIn = () => {
    const diff = new Date(poll.closes_at).getTime() - Date.now();
    if (diff <= 0) return "Closed";
    return formatDistanceToNow(new Date(poll.closes_at));
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `https://cricmaxx.com/polls?highlight=${poll.id}`;
    const copyFallback = async () => {
      try { await navigator.clipboard.writeText(url); } catch {
        const input = document.createElement('input'); input.value = url;
        document.body.appendChild(input); input.select(); document.execCommand('copy'); document.body.removeChild(input);
      }
      toast({ title: "Link copied!", description: "Share this poll with friends." });
    };
    try {
      const optionsList = poll.options.map(o => `• ${o.option_text}`).join('\n');
      const shareData = { title: poll.question, text: `TOKEN BASED POLL\n\n${poll.question}\n\nOptions:\n${optionsList}\n\nHead on over to CricMaxx to predict!\n\nFor new users, use invite code WC26 to enter the website.`, url };
      if (typeof navigator.share === 'function' && navigator.canShare?.(shareData)) { await navigator.share(shareData); return; }
    } catch (e: any) { if (e?.name === 'AbortError') return; }
    await copyFallback();
  };

  // ─── Compact Grid Card ───
  const compactCard = (
    <Card
      className="overflow-hidden border-border/50 hover:border-primary/40 transition-all cursor-pointer hover:shadow-md h-full"
      onClick={() => navigate(`/poll/${poll.id}`)}
    >
      <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
        {/* Top: badge + status */}
        <div className="flex items-center justify-between">
          <Badge className="bg-accent text-accent-foreground text-[10px] font-semibold px-2 py-0">
            Poll
          </Badge>
          <Badge variant={isResolved ? "default" : isClosed ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
            {isResolved ? "Resolved" : isClosed ? "Closed" : "Open"}
          </Badge>
        </div>

        {/* Question */}
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
          {poll.question}
        </p>

        {/* Mini progress bars for top options */}
        <div className="space-y-1.5">
          {topOptions.map((opt) => {
            const pct = poll.total_pool > 0 ? ((opt.total_amount || 0) / poll.total_pool) * 100 : 0;
            const isWinner = isResolved && poll.winning_option_id === opt.id;
            return (
              <div key={opt.id} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground truncate mr-2 flex items-center gap-1">
                    {isWinner && <Trophy className="h-3 w-3 text-accent shrink-0" />}
                    {opt.option_text}
                  </span>
                  <span className="text-muted-foreground font-medium shrink-0">{pct.toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isWinner ? "bg-accent" : "bg-accent/60"}`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {poll.options.length > 2 && (
            <p className="text-[10px] text-muted-foreground/60">+{poll.options.length - 2} more</p>
          )}
        </div>

        {/* Bottom stats */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{totalVotes}</span>
            <span className="flex items-center gap-0.5"><Coins className="h-3 w-3" />{poll.total_pool}</span>
          </div>
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />{closesIn()}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Detail Dialog ───
  const detailDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg leading-snug pr-6">{poll.question}</DialogTitle>
          {poll.description ? (
            <DialogDescription className="text-xs">{poll.description}</DialogDescription>
          ) : (
            <VisuallyHidden><DialogDescription>Poll details</DialogDescription></VisuallyHidden>
          )}
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-accent text-accent-foreground text-xs px-2 py-0.5">Poll</Badge>
          <Badge variant={isResolved ? "default" : isClosed ? "secondary" : "outline"} className="text-xs">
            {isResolved ? "Resolved" : isClosed ? "Closed" : "Open"}
          </Badge>
          <div className="ml-auto flex items-center gap-1">
            {isAdmin && !isResolved && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleShare}>
              <Share2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {editing ? (
          <PollEditForm poll={poll} onSaved={() => { setEditing(false); onVoted(); }} onCancel={() => setEditing(false)} />
        ) : !hasVoted && !isClosed ? (
          <div className="space-y-4">
            <div className="space-y-2">
              {poll.options.map((opt) => {
                const isSelected = selectedOption === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOption(opt.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>{opt.option_text}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Stake tokens (weighted voting):</p>
              <div className="grid grid-cols-4 gap-1.5">
                {STAKE_OPTIONS.map((s) => (
                  <Button key={s} variant={selectedStake === s ? "default" : "outline"} size="sm" onClick={() => setSelectedStake(s)} className="w-full text-xs">
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            {selectedOption && potentialPayout !== null && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex items-center gap-1.5 text-xs">
                  <TrendingUp className="h-4 w-4 text-accent shrink-0" />
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

            <Button onClick={handleVote} disabled={!selectedOption || voting || !user} className="w-full">
              {voting ? "Placing vote..." : `Vote with ${selectedStake} tokens`}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {poll.options.map((opt) => {
              const pct = poll.total_pool > 0 ? ((opt.total_amount || 0) / poll.total_pool) * 100 : 0;
              const isWinner = isResolved && poll.winning_option_id === opt.id;
              const isUserVote = poll.user_vote?.option_id === opt.id;
              return (
                <div key={opt.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      {isWinner && <Trophy className="h-3.5 w-3.5 text-accent" />}
                      {isUserVote && <Check className="h-3.5 w-3.5 text-primary" />}
                      {opt.option_text}
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${isWinner ? "bg-accent" : "bg-accent/60"}`} style={{ width: `${Math.max(pct, 1)}%` }} />
                  </div>
                </div>
              );
            })}
            {hasVoted && poll.user_vote && !isResolved && (() => {
              const userStake = poll.user_vote!.amount;
              const userOptAmount = poll.options.find(o => o.id === poll.user_vote!.option_id)?.total_amount || 0;
              const losingPool = poll.total_pool - userOptAmount;
              const allOnOneOption = poll.options.filter(o => (o.total_amount || 0) > 0).length <= 1;
              const estimatedPayout = userOptAmount > 0 ? userStake + (userStake / userOptAmount) * losingPool : userStake;
              const winnings = Math.round((estimatedPayout - userStake) * 100) / 100;
              return (
                <>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-accent/10 border border-accent/20 mt-1">
                    <span className="text-xs text-muted-foreground">
                      If correct: <span className="font-semibold text-foreground">{userStake}</span> back + <span className="font-semibold text-accent">{winnings}</span> winnings
                    </span>
                    <span className="text-sm font-bold text-accent">= {Math.round(estimatedPayout * 100) / 100} tokens</span>
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
              <p className="text-xs text-muted-foreground text-center mt-2">You voted with {poll.user_vote?.amount} tokens</p>
            )}
          </div>
        )}

        {/* Bottom stats */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{totalVotes} votes</span>
            <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" />{poll.total_pool} pool</span>
          </div>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{closesIn()}</span>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {compactCard}
      {detailDialog}
    </>
  );
};
