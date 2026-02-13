import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Trophy, Users, Clock, Coins, ChevronRight, ArrowLeft, Medal, Star, CheckCircle, XCircle, HelpCircle, Plus, Pencil, ChevronDown, Info, Share2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import ContestFormDialog from "@/components/contests/ContestFormDialog";
import ContestQuestionManager from "@/components/contests/ContestQuestionManager";
import ContestHowItWorks from "@/components/contests/ContestHowItWorks";

type Contest = {
  id: string;
  title: string;
  description: string | null;
  buy_in_amount: number;
  total_points: number;
  status: string;
  match_name: string | null;
  closes_at: string;
  resolved_at: string | null;
  tiebreaker_question_id: string | null;
  tiebreaker_question_id_2?: string | null;
  min_participants: number;
  created_at: string;
};

type ContestQuestion = {
  id: string;
  contest_id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  points: number;
  correct_answer: string | null;
  sort_order: number;
};

type ContestEntry = {
  id: string;
  contest_id: string;
  user_id: string;
  score: number;
  total_points: number;
  rank: number | null;
  payout: number | null;
  created_at: string;
};

const PredictionContests = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, isAdmin, profile, refetchProfile } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [selectedContestId, setSelectedContestId] = useState<string | null>(highlightId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editContest, setEditContest] = useState<any>(null);
  const [isEditingPredictions, setIsEditingPredictions] = useState(false);

  // Fetch all visible contests
  const { data: contests, isLoading } = useQuery({
    queryKey: ["contests", isAdmin],
    queryFn: async () => {
      const statuses = isAdmin
        ? ["draft", "open", "closed", "resolved"]
        : ["open", "closed", "resolved"];
      const { data, error } = await supabase
        .from("prediction_contests")
        .select("*")
        .in("status", statuses)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Contest[];
    },
  });

  // Fetch questions for selected contest
  const { data: questions } = useQuery({
    queryKey: ["contest-questions", selectedContestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contest_questions")
        .select("*")
        .eq("contest_id", selectedContestId!)
        .order("sort_order");
      if (error) throw error;
      return data as ContestQuestion[];
    },
    enabled: !!selectedContestId,
  });

  // Fetch entries/leaderboard for selected contest
  const { data: entries } = useQuery({
    queryKey: ["contest-entries", selectedContestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contest_entries")
        .select("*")
        .eq("contest_id", selectedContestId!)
        .order("rank", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as ContestEntry[];
    },
    enabled: !!selectedContestId,
  });

  // Fetch user's answers for selected contest
  const { data: userAnswers } = useQuery({
    queryKey: ["contest-answers", selectedContestId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contest_answers")
        .select("*")
        .eq("contest_id", selectedContestId!)
        .eq("user_id", user!.id);
      if (error) throw error;
      return data as { question_id: string; answer: string; is_correct: boolean | null; points_earned: number }[];
    },
    enabled: !!selectedContestId && !!user?.id,
  });

  const _selectedContest = contests?.find(c => c.id === selectedContestId);
  const _tiebreakerQid = _selectedContest?.tiebreaker_question_id;
  const _tiebreakerQid2 = _selectedContest?.tiebreaker_question_id_2;

  // Fetch tiebreaker answers for all participants (for live ranking)
  const { data: tiebreakerAnswers } = useQuery({
    queryKey: ["contest-tiebreaker-answers", selectedContestId, _tiebreakerQid, _tiebreakerQid2],
    queryFn: async () => {
      const qids = [_tiebreakerQid, _tiebreakerQid2].filter(Boolean) as string[];
      if (!qids.length) return { tb1: {} as Record<string, boolean>, tb2: {} as Record<string, boolean> };
      const { data, error } = await supabase
        .from("contest_answers")
        .select("user_id, question_id, is_correct")
        .eq("contest_id", selectedContestId!)
        .in("question_id", qids);
      if (error) throw error;
      const tb1: Record<string, boolean> = {};
      const tb2: Record<string, boolean> = {};
      data?.forEach(a => {
        if (a.question_id === _tiebreakerQid) tb1[a.user_id] = a.is_correct ?? false;
        if (a.question_id === _tiebreakerQid2) tb2[a.user_id] = a.is_correct ?? false;
      });
      return { tb1, tb2 };
    },
    enabled: !!selectedContestId && (!!_tiebreakerQid || !!_tiebreakerQid2),
  });

  // Fetch profiles for leaderboard names
  const { data: entryProfiles } = useQuery({
    queryKey: ["contest-entry-profiles", entries?.map(e => e.user_id)],
    queryFn: async () => {
      if (!entries || entries.length === 0) return {};
      const userIds = entries.map(e => e.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, name, username, avatar_url")
        .in("id", userIds);
      if (error) throw error;
      const map: Record<string, { name: string; avatar_url: string | null }> = {};
      data?.forEach(p => {
        map[p.id] = { name: p.display_name || p.name || p.username || "Anonymous", avatar_url: p.avatar_url };
      });
      return map;
    },
    enabled: !!entries && entries.length > 0,
  });

  const selectedContest = contests?.find(c => c.id === selectedContestId);
  const userEntry = entries?.find(e => e.user_id === user?.id);
  const hasJoined = !!userEntry;
  const isOpen = selectedContest?.status === "open" && !isPast(new Date(selectedContest.closes_at));
  const isResolved = selectedContest?.status === "resolved";
  const participantCount = entries?.length || 0;
  const totalPot = participantCount * (selectedContest?.buy_in_amount || 0);

  // Join contest mutation
  const joinMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("join_contest", {
        _contest_id: selectedContestId!,
        _user_id: user!.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      toast.success(`Joined contest! ${result?.buy_in ?? selectedContest?.buy_in_amount} tokens deducted.`);
      refetchProfile();
      queryClient.invalidateQueries({ queryKey: ["contest-entries"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Submit answers mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!questions) return;
      const rows = questions.map(q => ({
        contest_id: selectedContestId!,
        question_id: q.id,
        user_id: user!.id,
        answer: answers[q.id] || "",
      })).filter(r => r.answer.trim());

      const { error } = await supabase.from("contest_answers").upsert(rows, {
        onConflict: "contest_id,question_id,user_id",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Predictions saved!");
      setIsEditingPredictions(false);
      queryClient.invalidateQueries({ queryKey: ["contest-answers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Initialize answers from existing user answers
  const initAnswers = () => {
    if (userAnswers) {
      const existing: Record<string, string> = {};
      userAnswers.forEach(a => { existing[a.question_id] = a.answer; });
      setAnswers(existing);
    }
  };

  // Contest list view
  if (!selectedContestId) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 pt-20 pb-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="mb-6">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-7 w-7 text-accent" />
                  <h1 className="text-2xl md:text-3xl font-bold">Prediction Contests</h1>
                </div>
                {isAdmin && (
                  <Button size="sm" className="gap-1" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" /> New Contest
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                Compete against others! Answer prediction questions, climb the leaderboard, and win from the prize pot.
              </p>
            </div>

            {!isAuthenticated && (
              <Card className="mb-4 border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground text-center sm:text-left">Sign in to join contests and compete for prizes!</p>
                  <Button size="sm" onClick={() => navigate(`/auth?mode=login&redirect=${encodeURIComponent('/contests')}`)}>Sign In</Button>
                </CardContent>
              </Card>
            )}

            <ContestHowItWorks />

            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />)}
              </div>
            ) : !contests?.length ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground">No contests available yet. Check back soon!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {contests.map(contest => {
                  const closed = isPast(new Date(contest.closes_at));
                  return (
                    <Card
                      key={contest.id}
                      className="cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => { setSelectedContestId(contest.id); initAnswers(); }}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-semibold text-sm sm:text-base leading-tight line-clamp-2">{contest.title}</h3>
                              <Badge variant={
                                contest.status === "resolved" ? "default" :
                                contest.status === "open" && !closed ? "secondary" : "outline"
                              } className="text-[10px] shrink-0">
                                {contest.status === "resolved" ? "Resolved" :
                                 closed ? "Closed" : "Open"}
                              </Badge>
                            </div>
                            {contest.match_name && (
                              <p className="text-xs text-muted-foreground">{contest.match_name}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const url = `https://cricmaxx.com/contests?highlight=${contest.id}`;
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
                                toast.success("Link copied! Share this contest with friends.");
                              };
                              try {
                                const shareData = {
                                  title: contest.title,
                                  text: `PREDICTION CONTEST\n\n${contest.title}${contest.match_name ? `\n${contest.match_name}` : ''}\n\nBuy-in: ${contest.buy_in_amount} tokens\nTotal Points: ${contest.total_points}\nCloses: ${format(new Date(contest.closes_at), "MMM d, h:mm a")}\n\nHead on over to CricMaxx to predict!\n\nFor new users, use invite code WC26 to enter the website.`,
                                  url,
                                };
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
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{contest.buy_in_amount} tokens</span>
                          <span className="flex items-center gap-1"><Star className="h-3 w-3" />{contest.total_points} pts</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(contest.closes_at), "MMM d, h:mm a")}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Admin dialogs */}
            <ContestFormDialog open={createOpen} onOpenChange={setCreateOpen} />
            <ContestFormDialog open={!!editContest} onOpenChange={(o) => { if (!o) setEditContest(null); }} editContest={editContest} />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Contest detail view
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back button */}
          <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => { setSelectedContestId(null); setAnswers({}); }}>
            <ArrowLeft className="h-4 w-4" /> All Contests
          </Button>

          {selectedContest && (
            <>
              {/* Contest Header */}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h1 className="text-xl md:text-2xl font-bold">{selectedContest.title}</h1>
                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && selectedContest.status !== "resolved" && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditContest(selectedContest)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    <Badge variant={isResolved ? "default" : isOpen ? "secondary" : "outline"}>
                      {isResolved ? "Resolved" : isOpen ? "Open" : "Closed"}
                    </Badge>
                  </div>
                </div>
                {selectedContest.description && (
                  <p className="text-sm text-muted-foreground mb-3">{selectedContest.description}</p>
                )}
                {selectedContest.match_name && (
                  <p className="text-xs text-muted-foreground mb-2">🏏 {selectedContest.match_name}</p>
                )}
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg">
                    <Coins className="h-3.5 w-3.5 text-accent" /> Buy-in: {selectedContest.buy_in_amount} tokens
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg">
                    <Users className="h-3.5 w-3.5" /> {participantCount} joined
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg">
                    <Trophy className="h-3.5 w-3.5 text-yellow-500" /> Pot: {totalPot} tokens
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg">
                    <Clock className="h-3.5 w-3.5" /> {format(new Date(selectedContest.closes_at), "MMM d, h:mm a")}
                  </span>
                </div>

                {/* Prize breakdown */}
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="gap-1"><Medal className="h-3 w-3 text-yellow-500" /> 1st: {(totalPot * 0.5).toFixed(0)} tokens</Badge>
                  <Badge variant="outline" className="gap-1"><Medal className="h-3 w-3 text-gray-400" /> 2nd: {(totalPot * 0.3).toFixed(0)} tokens</Badge>
                  <Badge variant="outline" className="gap-1"><Medal className="h-3 w-3 text-amber-700" /> 3rd: {(totalPot * 0.2).toFixed(0)} tokens</Badge>
                </div>

                <ContestHowItWorks compact />
              </div>

              {/* Join button */}
              {isAuthenticated && !hasJoined && isOpen && (
                <Card className="mb-6 border-accent/30 bg-accent/5">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">Join this contest</p>
                      <p className="text-sm text-muted-foreground">Entry fee: {selectedContest.buy_in_amount} tokens</p>
                    </div>
                    <Button
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={() => joinMutation.mutate()}
                      disabled={joinMutation.isPending}
                    >
                      {joinMutation.isPending ? "Joining..." : `Join for ${selectedContest.buy_in_amount} tokens`}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!isAuthenticated && isOpen && (
                <Card className="mb-6 border-primary/30">
                  <CardContent className="p-4 text-center space-y-2">
                    <p className="text-muted-foreground">Sign in to join this contest</p>
                    <Button variant="outline" onClick={() => window.location.href = `/auth?redirect=/contests`}>
                      Sign In
                    </Button>
                  </CardContent>
                </Card>
              )}

              {isAuthenticated && !hasJoined && isOpen && (profile?.balance ?? 0) < (selectedContest?.buy_in_amount ?? 0) && (
                <Card className="mb-6 border-destructive/30 bg-destructive/5">
                  <CardContent className="p-4 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      You need at least {selectedContest.buy_in_amount} tokens to join. Your balance: {profile?.balance ?? 0} tokens.
                    </p>
                    <Button variant="outline" onClick={() => window.location.href = `/wallet`}>
                      Add Balance
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Admin question management */}
              {isAdmin && selectedContest.status !== "resolved" && (
                <ContestQuestionManager
                  contestId={selectedContest.id}
                  contestStatus={selectedContest.status}
                  tiebreakerQuestionId={selectedContest.tiebreaker_question_id}
                  tiebreakerQuestionId2={selectedContest.tiebreaker_question_id_2 ?? null}
                />
              )}

              {/* Winner/Result banner for resolved contests */}
              {isResolved && hasJoined && (
                <Card className={cn(
                  "mb-6 border-2",
                  userEntry && userEntry.payout && userEntry.payout > 0 
                    ? "border-green-500/40 bg-green-500/10" 
                    : "border-border bg-muted/30"
                )}>
                  <CardContent className="p-4 text-center">
                    {userEntry && userEntry.payout && userEntry.payout > 0 ? (
                      <>
                        <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                        <p className="font-bold text-lg">🎉 You won {userEntry.payout} tokens!</p>
                        <p className="text-sm text-muted-foreground">You placed #{userEntry.rank} out of {participantCount} participants</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Contest Resolved</p>
                        <p className="text-sm text-muted-foreground">You scored {userEntry?.score ?? 0}/{userEntry?.total_points ?? 0} points. Better luck next time!</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Leaderboard */}
              {entries && entries.length > 0 && (
                <div className="mb-6">
                  <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" /> Leaderboard
                  </h2>
                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border">
                        {entries
                          .sort((a, b) => {
                            if (a.rank != null && b.rank != null) return a.rank - b.rank;
                            if (b.score !== a.score) return b.score - a.score;
                            const aTb1 = tiebreakerAnswers?.tb1?.[a.user_id] ? 1 : 0;
                            const bTb1 = tiebreakerAnswers?.tb1?.[b.user_id] ? 1 : 0;
                            if (bTb1 !== aTb1) return bTb1 - aTb1;
                            const aTb2 = tiebreakerAnswers?.tb2?.[a.user_id] ? 1 : 0;
                            const bTb2 = tiebreakerAnswers?.tb2?.[b.user_id] ? 1 : 0;
                            if (bTb2 !== aTb2) return bTb2 - aTb2;
                            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                          })
                          .map((entry, idx) => {
                            const profile = entryProfiles?.[entry.user_id];
                            const isMe = entry.user_id === user?.id;
                            const rankNum = entry.rank ?? idx + 1;
                            const rankIcon = rankNum === 1 ? "🥇" : rankNum === 2 ? "🥈" : rankNum === 3 ? "🥉" : null;
                            // Calculate what each position wins
                            const prizeLabel = rankNum === 1 ? `${(totalPot * 0.5).toFixed(0)} tokens` 
                              : rankNum === 2 ? `${(totalPot * 0.3).toFixed(0)} tokens`
                              : rankNum === 3 ? `${(totalPot * 0.2).toFixed(0)} tokens` : null;
                            return (
                              <div key={entry.id} className={cn(
                                "flex items-center gap-3 px-4 py-3",
                                isMe && "bg-primary/5"
                              )}>
                                <span className="w-8 text-center font-mono text-sm">
                                  {rankIcon || rankNum}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm truncate", isMe && "font-semibold")}>
                                    {profile?.name || (isMe ? "You" : "Participant")} {isMe && profile?.name && "(You)"}
                                  </p>
                                  {!isResolved && prizeLabel && (
                                    <p className="text-[10px] text-muted-foreground">Wins: {prizeLabel}</p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-semibold">
                                    {isResolved ? `${entry.score}/${entry.total_points} pts` : "—"}
                                  </p>
                                  {entry.payout != null && entry.payout > 0 && (
                                    <p className="text-xs text-green-600 font-medium">+{entry.payout} tokens</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Questions */}
              {hasJoined && questions && questions.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-lg">Predictions</h2>
                    {isOpen && userAnswers && userAnswers.length > 0 && !isEditingPredictions && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          const existing: Record<string, string> = {};
                          userAnswers.forEach(a => { existing[a.question_id] = a.answer; });
                          setAnswers(existing);
                          setIsEditingPredictions(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit Predictions
                      </Button>
                    )}
                  </div>

                  {/* Saved answers view (not editing) */}
                  {userAnswers && userAnswers.length > 0 && !isEditingPredictions && !isResolved && (
                    <Card className="mb-4 border-primary/20 bg-primary/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium">Your predictions are saved!</p>
                          {isOpen && <Badge variant="secondary" className="text-[10px] ml-auto">Editable until close</Badge>}
                        </div>
                        <div className="space-y-2">
                          {questions.map((q, idx) => {
                            const ans = userAnswers.find(a => a.question_id === q.id);
                            return (
                              <div key={q.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                                <span className="text-muted-foreground">Q{idx + 1}: {q.question_text}</span>
                                <Badge variant={ans ? "default" : "outline"} className="text-xs shrink-0 ml-2">
                                  {ans ? ans.answer : "Not answered"}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Input mode: show when editing, or when no answers saved yet */}
                  {(isEditingPredictions || (isOpen && (!userAnswers || userAnswers.length === 0))) && (
                    <>
                      <div className="space-y-3">
                        {questions.map((q, idx) => {
                          const existingAnswer = userAnswers?.find(a => a.question_id === q.id);
                          const isTiebreaker = selectedContest.tiebreaker_question_id === q.id;
                          return (
                            <Card key={q.id} className={cn(isTiebreaker && "border-yellow-500/40 bg-yellow-500/5")}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-muted-foreground">Q{idx + 1}</span>
                                    <p className="font-medium text-sm">{q.question_text}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isTiebreaker && <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">Tiebreaker</Badge>}
                                    <Badge variant="secondary" className="text-[10px]">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
                                  </div>
                                </div>

                                {q.question_type === "yes_no" ? (
                                  <RadioGroup
                                    value={answers[q.id] || existingAnswer?.answer || ""}
                                    onValueChange={v => setAnswers(p => ({ ...p, [q.id]: v }))}
                                    className="flex gap-4"
                                  >
                                    <div className="flex items-center gap-2">
                                      <RadioGroupItem value="Yes" id={`${q.id}-yes`} />
                                      <Label htmlFor={`${q.id}-yes`}>Yes</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <RadioGroupItem value="No" id={`${q.id}-no`} />
                                      <Label htmlFor={`${q.id}-no`}>No</Label>
                                    </div>
                                  </RadioGroup>
                                ) : q.question_type === "multiple_choice" && q.options ? (
                                  <RadioGroup
                                    value={answers[q.id] || existingAnswer?.answer || ""}
                                    onValueChange={v => setAnswers(p => ({ ...p, [q.id]: v }))}
                                    className="space-y-2"
                                  >
                                    {(q.options as string[]).map(opt => (
                                      <div key={opt} className="flex items-center gap-2">
                                        <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                                        <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
                                      </div>
                                    ))}
                                  </RadioGroup>
                                ) : (
                                  <Input
                                    placeholder="Your answer..."
                                    value={answers[q.id] || existingAnswer?.answer || ""}
                                    onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                                  />
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button
                          className="flex-1"
                          onClick={() => submitMutation.mutate()}
                          disabled={submitMutation.isPending}
                        >
                          {submitMutation.isPending ? "Saving..." : "Save Predictions"}
                        </Button>
                        {isEditingPredictions && (
                          <Button variant="outline" onClick={() => setIsEditingPredictions(false)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </>
                  )}

                  {/* Resolved results */}
                  {isResolved && (
                    <div className="space-y-3">
                      {questions.map((q, idx) => {
                        const existingAnswer = userAnswers?.find(a => a.question_id === q.id);
                        const isTiebreaker = selectedContest.tiebreaker_question_id === q.id;
                        return (
                          <Card key={q.id} className={cn(isTiebreaker && "border-yellow-500/40 bg-yellow-500/5")}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">Q{idx + 1}</span>
                                  <p className="font-medium text-sm">{q.question_text}</p>
                                </div>
                                <Badge variant="secondary" className="text-[10px]">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
                              </div>
                              {existingAnswer && (
                                <div className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
                                  existingAnswer.is_correct ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"
                                )}>
                                  {existingAnswer.is_correct ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                  <span>Your answer: <strong>{existingAnswer.answer}</strong></span>
                                  {q.correct_answer && <span className="ml-auto">Correct: <strong>{q.correct_answer}</strong></span>}
                                  <span className="ml-2 font-semibold">{existingAnswer.points_earned}/{q.points} pts</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Show locked answer if closed but not resolved */}
                  {!isOpen && !isResolved && userAnswers && userAnswers.length > 0 && !isEditingPredictions && (
                    <Card className="border-muted">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-muted-foreground">Contest closed — predictions locked</p>
                        </div>
                        <div className="space-y-2">
                          {questions.map((q, idx) => {
                            const ans = userAnswers.find(a => a.question_id === q.id);
                            return (
                              <div key={q.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                                <span className="text-muted-foreground">Q{idx + 1}: {q.question_text}</span>
                                <span className="text-xs font-medium">{ans?.answer || "—"}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* No questions yet for non-participants */}
              {!hasJoined && questions && questions.length > 0 && !isOpen && (
                <Card className="mb-6">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">This contest has {questions.length} prediction questions worth {selectedContest.total_points} total points.</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Admin edit dialog in detail view */}
          <ContestFormDialog open={!!editContest} onOpenChange={(o) => { if (!o) setEditContest(null); }} editContest={editContest} />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PredictionContests;
