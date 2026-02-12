import { useState } from "react";
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
import { Trophy, Users, Clock, Coins, ChevronRight, ArrowLeft, Medal, Star, CheckCircle, XCircle, HelpCircle, Plus, Pencil } from "lucide-react";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import ContestFormDialog from "@/components/contests/ContestFormDialog";
import ContestQuestionManager from "@/components/contests/ContestQuestionManager";

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
  const { isAuthenticated, user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editContest, setEditContest] = useState<any>(null);

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
    onSuccess: () => {
      toast.success("Joined contest!");
      queryClient.invalidateQueries({ queryKey: ["contest-entries"] });
      queryClient.invalidateQueries({ queryKey: ["auth-profile"] });
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
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{contest.title}</h3>
                            <Badge variant={
                              contest.status === "resolved" ? "default" :
                              contest.status === "open" && !closed ? "secondary" : "outline"
                            } className="text-[10px] shrink-0">
                              {contest.status === "resolved" ? "Resolved" :
                               closed ? "Closed" : "Open"}
                            </Badge>
                          </div>
                          {contest.match_name && (
                            <p className="text-xs text-muted-foreground mb-1">{contest.match_name}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{contest.buy_in_amount} tokens</span>
                            <span className="flex items-center gap-1"><Star className="h-3 w-3" />{contest.total_points} pts</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(contest.closes_at), "MMM d, h:mm a")}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
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
                  <CardContent className="p-4 text-center">
                    <p className="text-muted-foreground">Sign in to join this contest</p>
                  </CardContent>
                </Card>
              )}

              {/* Admin question management */}
              {isAdmin && selectedContest.status !== "resolved" && (
                <ContestQuestionManager
                  contestId={selectedContest.id}
                  contestStatus={selectedContest.status}
                  tiebreakerQuestionId={selectedContest.tiebreaker_question_id}
                />
              )}

              {/* Leaderboard - at top */}
              {entries && entries.length > 0 && (
                <div className="mb-6">
                  <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" /> Leaderboard
                  </h2>
                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border">
                        {entries
                          .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
                          .map((entry, idx) => {
                            const profile = entryProfiles?.[entry.user_id];
                            const isMe = entry.user_id === user?.id;
                            const rankIcon = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
                            return (
                              <div key={entry.id} className={cn(
                                "flex items-center gap-3 px-4 py-3",
                                isMe && "bg-primary/5"
                              )}>
                                <span className="w-8 text-center font-mono text-sm">
                                  {rankIcon || (entry.rank ?? idx + 1)}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm truncate", isMe && "font-semibold")}>
                                    {profile?.name || (isMe ? "You" : "Loading...")} {isMe && profile?.name && "(You)"}
                                  </p>
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
                  <h2 className="font-semibold text-lg mb-3">Predictions</h2>
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

                            {/* Show result if resolved */}
                            {isResolved && existingAnswer && (
                              <div className={cn(
                                "flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md text-xs",
                                existingAnswer.is_correct ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"
                              )}>
                                {existingAnswer.is_correct ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                <span>Your answer: <strong>{existingAnswer.answer}</strong></span>
                                {q.correct_answer && <span className="ml-auto">Correct: <strong>{q.correct_answer}</strong></span>}
                                <span className="ml-2 font-semibold">{existingAnswer.points_earned}/{q.points} pts</span>
                              </div>
                            )}

                            {/* Answer input */}
                            {isOpen && hasJoined && !isResolved && (
                              <>
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
                              </>
                            )}

                            {/* Show locked answer if closed but not resolved */}
                            {!isOpen && !isResolved && existingAnswer && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <HelpCircle className="h-3.5 w-3.5" />
                                <span>Your answer: <strong>{existingAnswer.answer}</strong></span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Submit button */}
                  {isOpen && hasJoined && (
                    <Button
                      className="w-full mt-4"
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending}
                    >
                      {submitMutation.isPending ? "Saving..." : "Save Predictions"}
                    </Button>
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
