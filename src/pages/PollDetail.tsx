import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trackEvent } from "@/lib/posthog";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Trophy, Check, Coins, TrendingUp, Share2, Pencil, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PollEditForm } from "@/components/polls/PollEditForm";
import { formatDistanceToNow } from "date-fns";

const STAKE_OPTIONS = [5, 10, 15, 20];

const PollDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refetchProfile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const [selectedStake, setSelectedStake] = useState(5);
  const [voting, setVoting] = useState(false);
  const [changingVote, setChangingVote] = useState(false);
  const [votersExpanded, setVotersExpanded] = useState(false);
  const [voters, setVoters] = useState<{ user_name: string; user_email: string; option_text: string; amount: number }[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);

  const { data: poll, refetch } = useQuery({
    queryKey: ["poll-detail", id],
    queryFn: async () => {
      const { data: p, error } = await supabase
        .from("prediction_polls")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;

      const { data: opts } = await supabase.from("poll_options").select("*").eq("poll_id", id!);
      const { data: votesAgg } = await supabase.from("poll_votes").select("poll_id, option_id, amount").eq("poll_id", id!);

      let userVote: any = null;
      if (user) {
        const { data } = await supabase.from("poll_votes").select("option_id, amount").eq("poll_id", id!).eq("user_id", user.id).maybeSingle();
        userVote = data;
      }

      const votesByOption: Record<string, { count: number; total: number }> = {};
      (votesAgg || []).forEach((v: any) => {
        if (!votesByOption[v.option_id]) votesByOption[v.option_id] = { count: 0, total: 0 };
        votesByOption[v.option_id].count++;
        votesByOption[v.option_id].total += Number(v.amount);
      });

      return {
        id: p.id,
        question: p.question,
        description: p.description,
        closes_at: p.closes_at,
        status: p.status,
        total_pool: Number(p.total_pool),
        winning_option_id: p.winning_option_id,
        options: (opts || []).map((o: any) => ({
          id: o.id,
          option_text: o.option_text,
          vote_count: votesByOption[o.id]?.count || 0,
          total_amount: votesByOption[o.id]?.total || 0,
        })),
        user_vote: userVote ? { option_id: userVote.option_id, amount: Number(userVote.amount) } : null,
      };
    },
    enabled: !!id,
  });

  const isClosed = poll ? new Date(poll.closes_at) < new Date() || poll.status !== "open" : false;
  const isResolved = poll?.status === "resolved";
  const hasVoted = !!poll?.user_vote;
  const totalVotes = poll?.options.reduce((sum, o) => sum + (o.vote_count || 0), 0) ?? 0;

  const fetchVoters = async () => {
    if (votersExpanded) { setVotersExpanded(false); return; }
    if (!poll || !id) return;
    setLoadingVoters(true);
    const { data } = await supabase
      .from("poll_votes")
      .select("user_id, amount, option_id")
      .eq("poll_id", id);
    if (!data?.length) { setVoters([]); setVotersExpanded(true); setLoadingVoters(false); return; }
    const userIds = [...new Set(data.map(v => v.user_id))];
    const optionIds = [...new Set(data.map(v => v.option_id))];
    const [{ data: profiles }, { data: options }] = await Promise.all([
      supabase.from("profiles").select("id, name, email, display_name, username").in("id", userIds),
      supabase.from("poll_options").select("id, option_text").in("id", optionIds),
    ]);
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    const optionMap = Object.fromEntries((options || []).map(o => [o.id, o.option_text]));
    setVoters(data.map(v => ({
      user_name: profileMap[v.user_id]?.display_name || profileMap[v.user_id]?.username || profileMap[v.user_id]?.name || "Unknown",
      user_email: profileMap[v.user_id]?.email || "",
      option_text: optionMap[v.option_id] || "Unknown",
      amount: Number(v.amount),
    })));
    setVotersExpanded(true);
    setLoadingVoters(false);
  };

  const potentialPayout = useMemo(() => {
    if (!poll || !selectedOption || !selectedStake) return null;
    const selectedOpt = poll.options.find((o) => o.id === selectedOption);
    if (!selectedOpt) return null;
    const currentWinningPool = (selectedOpt.total_amount || 0) + selectedStake;
    const currentLosingPool = poll.total_pool - (selectedOpt.total_amount || 0);
    if (currentWinningPool <= 0) return selectedStake;
    const payout = selectedStake + (selectedStake / currentWinningPool) * currentLosingPool;
    return Math.round(payout * 100) / 100;
  }, [poll, selectedOption, selectedStake]);

  const handleVote = async () => {
    if (!user || !selectedOption || !poll) return;
    if (hasVoted) { toast({ title: "Already voted", variant: "destructive" }); return; }
    if (isClosed) { toast({ title: "Poll closed", variant: "destructive" }); return; }
    setVoting(true);
    try {
      const { data: pollCheck } = await supabase.from("prediction_polls").select("status, closes_at").eq("id", poll.id).single();
      if (!pollCheck || pollCheck.status !== "open" || new Date(pollCheck.closes_at) < new Date()) {
        toast({ title: "Poll closed", description: "This poll closed before your vote could be placed.", variant: "destructive" }); return;
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
        if (error.code === "23505") { toast({ title: "Already voted", variant: "destructive" }); }
        else throw error;
        return;
      }
      trackEvent('poll_vote_placed', { poll_id: poll.id, option_id: selectedOption, stake: selectedStake });
      toast({ title: "Vote placed!", description: `You staked ${selectedStake} tokens.` });
      refetchProfile();
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setVoting(false); }
  };

  const handleChangeVote = async () => {
    if (!user || !selectedOption || !poll || !poll.user_vote) return;
    if (selectedOption === poll.user_vote.option_id) {
      toast({ title: "Same option", description: "Select a different option to change your vote.", variant: "destructive" });
      return;
    }
    setVoting(true);
    try {
      const { data: pollCheck } = await supabase.from("prediction_polls").select("status, closes_at").eq("id", poll.id).single();
      if (!pollCheck || pollCheck.status !== "open" || new Date(pollCheck.closes_at) < new Date()) {
        toast({ title: "Poll closed", description: "This poll closed before your vote could be changed.", variant: "destructive" });
        return;
      }
      const { error } = await supabase.from("poll_votes")
        .update({ option_id: selectedOption })
        .eq("poll_id", poll.id)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Vote changed!", description: "Your prediction has been updated." });
      setChangingVote(false);
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setVoting(false); }
  };

  const closesIn = () => {
    if (!poll) return "";
    const diff = new Date(poll.closes_at).getTime() - Date.now();
    if (diff <= 0) return "Closed";
    return formatDistanceToNow(new Date(poll.closes_at));
  };

  const handleShare = async () => {
    if (!poll) return;
    const url = `https://cricmaxx.com/poll/${poll.id}`;
    try {
      const optionsList = poll.options.map(o => `• ${o.option_text}`).join('\n');
      const shareData = { title: poll.question, text: `TOKEN BASED POLL\n\n${poll.question}\n\nOptions:\n${optionsList}\n\nHead on over to CricMaxx to predict!\n\nFor new users, use invite code WC26 to enter the website.`, url };
      if (typeof navigator.share === 'function' && navigator.canShare?.(shareData)) { await navigator.share(shareData); return; }
    } catch (e: any) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); } catch {
      const input = document.createElement('input'); input.value = url; document.body.appendChild(input); input.select(); document.execCommand('copy'); document.body.removeChild(input);
    }
    toast({ title: "Link copied!" });
  };

  if (!poll) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 pt-32 lg:pt-24 pb-12 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading poll...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 pt-32 lg:pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-lg">
          {/* Back button */}
          <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/polls")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Polls
          </Button>

          <Card className="overflow-hidden border-border/50 shadow-md">
            <CardContent className="p-5">
              {/* Badges + actions */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <Badge className="bg-accent text-accent-foreground text-xs px-2 py-0.5">Poll</Badge>
                <Badge variant={isResolved ? "default" : isClosed ? "secondary" : "outline"} className="text-xs">
                  {isResolved ? "Resolved" : isClosed ? "Closed" : "Open"}
                </Badge>
                <div className="ml-auto flex items-center gap-1">
                  {isAdmin && !isResolved && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleShare}>
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Question */}
              <h1 className="text-xl font-bold text-foreground leading-snug mb-1">{poll.question}</h1>
              {poll.description && <p className="text-xs text-muted-foreground mb-4">{poll.description}</p>}

              {editing ? (
                <PollEditForm poll={poll} onSaved={() => { setEditing(false); refetch(); }} onCancel={() => setEditing(false)} />
              ) : !hasVoted && !isClosed ? (
                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    {poll.options.map((opt) => {
                      const isSelected = selectedOption === opt.id;
                      return (
                        <button key={opt.id} type="button" onClick={() => setSelectedOption(opt.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-muted/50"}`}>
                          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
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
                        <Button key={s} variant={selectedStake === s ? "default" : "outline"} size="sm" onClick={() => setSelectedStake(s)} className="w-full text-xs">{s}</Button>
                      ))}
                    </div>
                  </div>
                  {selectedOption && potentialPayout !== null && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20">
                      <div className="flex items-center gap-1.5 text-xs"><TrendingUp className="h-4 w-4 text-accent" /><span className="text-muted-foreground">Potential payout:</span></div>
                      <span className="text-sm font-bold text-accent">{potentialPayout} tokens <span className="text-[11px] font-normal text-muted-foreground ml-1">({((potentialPayout / selectedStake - 1) * 100).toFixed(0)}% return)</span></span>
                    </div>
                  )}
                  <Button onClick={handleVote} disabled={!selectedOption || voting || !user} className="w-full">
                    {voting ? "Placing vote..." : `Vote with ${selectedStake} tokens`}
                  </Button>
                </div>
              ) : changingVote && !isClosed ? (
                <div className="mt-5 space-y-4">
                  <p className="text-sm font-medium text-foreground">Change your prediction:</p>
                  <div className="space-y-2">
                    {poll.options.map((opt) => {
                      const isSelected = selectedOption === opt.id;
                      const wasPreviousVote = poll.user_vote?.option_id === opt.id;
                      return (
                        <button key={opt.id} type="button" onClick={() => setSelectedOption(opt.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${isSelected ? "border-primary bg-primary/10" : wasPreviousVote ? "border-muted-foreground/30 bg-muted/30" : "border-border hover:border-primary/40 hover:bg-muted/50"}`}>
                          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <span className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {opt.option_text}
                            {wasPreviousVote && <span className="text-xs text-muted-foreground ml-2">(current)</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setChangingVote(false)} className="flex-1">Cancel</Button>
                    <Button onClick={handleChangeVote} disabled={!selectedOption || selectedOption === poll.user_vote?.option_id || voting} className="flex-1">
                      {voting ? "Changing..." : "Confirm Change"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">Your stake amount stays the same ({poll.user_vote?.amount} tokens).</p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
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
                  {hasVoted && !isClosed && !isResolved && (
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { setChangingVote(true); setSelectedOption(poll.user_vote?.option_id || ""); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Change Your Vote
                    </Button>
                  )}
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
                          <span className="text-xs text-muted-foreground">If correct: <span className="font-semibold text-foreground">{userStake}</span> back + <span className="font-semibold text-accent">{winnings}</span> winnings</span>
                          <span className="text-sm font-bold text-accent">= {Math.round(estimatedPayout * 100) / 100} tokens</span>
                        </div>
                        {allOnOneOption && <p className="text-[11px] text-muted-foreground text-center mt-1">⚠️ All votes are on one option — if it wins, everyone gets their stake back with no bonus.</p>}
                      </>
                    );
                  })()}
                  {hasVoted && isResolved && <p className="text-xs text-muted-foreground text-center mt-2">You voted with {poll.user_vote?.amount} tokens</p>}
                </div>
              )}

              {/* Bottom stats */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{totalVotes} votes</span>
                  <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" />{poll.total_pool} pool</span>
                </div>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{closesIn()}</span>
              </div>

              {/* Admin: Show Participants */}
              {isAdmin && (
                <div className="mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={fetchVoters}
                    disabled={loadingVoters}
                  >
                    <Users className="h-3.5 w-3.5 mr-1" />
                    {loadingVoters ? "Loading..." : votersExpanded ? "Hide Participants" : "Show Participants"}
                    {votersExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                  </Button>
                  {votersExpanded && (
                    <div className="mt-2">
                      {voters.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No participants yet</p>
                      ) : (
                        <div className="rounded-md border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs h-8 px-2">User</TableHead>
                                <TableHead className="text-xs h-8 px-2">Option</TableHead>
                                <TableHead className="text-xs h-8 px-2 text-right">Stake</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {voters.map((v, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs py-1.5 px-2">
                                    <div>{v.user_name}</div>
                                    <div className="text-[10px] text-muted-foreground">{v.user_email}</div>
                                  </TableCell>
                                  <TableCell className="text-xs py-1.5 px-2">
                                    <Badge variant="outline" className="text-[10px]">{v.option_text}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs py-1.5 px-2 text-right font-medium">{v.amount}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PollDetail;
