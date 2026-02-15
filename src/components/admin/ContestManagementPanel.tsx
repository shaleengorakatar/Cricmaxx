import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Plus, Trash2, Trophy, CheckCircle, Star, Eye, Users, Clock, Coins, Medal, Download } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import ContestHowItWorks from "@/components/contests/ContestHowItWorks";

type Contest = {
  id: string;
  title: string;
  description: string | null;
  buy_in_amount: number;
  total_points: number;
  status: string;
  match_id: string | null;
  match_name: string | null;
  closes_at: string;
  tiebreaker_question_id: string | null;
  min_participants: number;
  created_by: string;
  created_at: string;
};

type Question = {
  id: string;
  contest_id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  points: number;
  correct_answer: string | null;
  sort_order: number;
};

const ContestManagementPanel = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [newContest, setNewContest] = useState({
    title: "", description: "", buy_in_amount: "10", total_points: "10",
    match_name: "", closes_at: "", min_participants: "3",
  });
  const [newQuestion, setNewQuestion] = useState({
    question_text: "", question_type: "yes_no", points: "1", options: "",
  });

  const { data: contests } = useQuery({
    queryKey: ["admin-contests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prediction_contests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Contest[];
    },
  });

  const { data: questions } = useQuery({
    queryKey: ["admin-contest-questions", selectedContestId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contest_questions").select("*").eq("contest_id", selectedContestId!).order("sort_order");
      if (error) throw error;
      return data as Question[];
    },
    enabled: !!selectedContestId,
  });

  const { data: entryCount } = useQuery({
    queryKey: ["admin-contest-entries-count", selectedContestId],
    queryFn: async () => {
      const { count, error } = await supabase.from("contest_entries").select("*", { count: "exact", head: true }).eq("contest_id", selectedContestId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!selectedContestId,
  });

  const createContestMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("prediction_contests").insert({
        title: newContest.title,
        description: newContest.description || null,
        buy_in_amount: Number(newContest.buy_in_amount),
        total_points: Number(newContest.total_points),
        match_name: newContest.match_name || null,
        closes_at: new Date(newContest.closes_at).toISOString(),
        min_participants: Number(newContest.min_participants),
        created_by: user!.id,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contest created!");
      setCreateOpen(false);
      setNewContest({ title: "", description: "", buy_in_amount: "10", total_points: "10", match_name: "", closes_at: "", min_participants: "3" });
      queryClient.invalidateQueries({ queryKey: ["admin-contests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addQuestionMutation = useMutation({
    mutationFn: async () => {
      const opts = newQuestion.question_type === "multiple_choice" && newQuestion.options
        ? newQuestion.options.split(",").map(o => o.trim()).filter(Boolean)
        : null;
      const { error } = await supabase.from("contest_questions").insert({
        contest_id: selectedContestId!,
        question_text: newQuestion.question_text,
        question_type: newQuestion.question_type,
        points: Number(newQuestion.points),
        options: opts,
        sort_order: (questions?.length || 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question added!");
      setNewQuestion({ question_text: "", question_type: "yes_no", points: "1", options: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-contest-questions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (qId: string) => {
      const { error } = await supabase.from("contest_questions").delete().eq("id", qId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question removed");
      queryClient.invalidateQueries({ queryKey: ["admin-contest-questions"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("prediction_contests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contest status updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-contests"] });
      queryClient.invalidateQueries({ queryKey: ["contests"] });
    },
  });

  const setCorrectAnswerMutation = useMutation({
    mutationFn: async ({ qId, answer }: { qId: string; answer: string }) => {
      const { error } = await supabase.from("contest_questions").update({ correct_answer: answer }).eq("id", qId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Correct answer set");
      queryClient.invalidateQueries({ queryKey: ["admin-contest-questions"] });
    },
  });

  const setTiebreakerMutation = useMutation({
    mutationFn: async (qId: string) => {
      const { error } = await supabase.from("prediction_contests").update({ tiebreaker_question_id: qId }).eq("id", selectedContestId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tiebreaker set!");
      queryClient.invalidateQueries({ queryKey: ["admin-contests"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("resolve_contest", {
        _contest_id: selectedContestId!,
        _admin_id: user!.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.voided) {
        toast.info(`Contest voided: ${data.reason}. ${data.refunded} refunded.`);
      } else {
        toast.success(`Contest resolved! Pot: ${data.total_pot} tokens, ${data.winners_paid} winners paid.`);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-contests"] });
      queryClient.invalidateQueries({ queryKey: ["contests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedContest = contests?.find(c => c.id === selectedContestId);

  const downloadContestResults = async () => {
    if (!selectedContest || !questions?.length) return;
    try {
      // Fetch all answers for this contest
      const { data: allAnswers, error: ansError } = await supabase
        .from("contest_answers")
        .select("user_id, question_id, answer")
        .eq("contest_id", selectedContest.id);
      if (ansError) throw ansError;

      // Fetch all entries for ranks/scores
      const { data: allEntries, error: entError } = await supabase
        .from("contest_entries")
        .select("user_id, score, total_points, rank, payout")
        .eq("contest_id", selectedContest.id);
      if (entError) throw entError;

      const userIds = [...new Set((allAnswers || []).map(a => a.user_id))];
      if (!userIds.length) { toast.info("No answers to download"); return; }

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, name, username")
        .in("id", userIds);
      const profMap: Record<string, string> = {};
      profiles?.forEach(p => { profMap[p.id] = p.display_name || p.name || p.username || "Anonymous"; });

      const entryMap: Record<string, { score: number; total_points: number; rank: number | null; payout: number | null }> = {};
      allEntries?.forEach(e => { entryMap[e.user_id] = e; });

      // Build answer lookup: userId -> questionId -> answer
      const ansMap: Record<string, Record<string, string>> = {};
      allAnswers?.forEach(a => {
        if (!ansMap[a.user_id]) ansMap[a.user_id] = {};
        ansMap[a.user_id][a.question_id] = a.answer;
      });

      // CSV header
      const escapeCsv = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const qHeaders = questions.map((q, i) => `Q${i + 1}: ${q.question_text}`);
      const header = ["User", ...qHeaders, "Score", "Rank", "Payout"].map(escapeCsv).join(",");

      // Correct answers row
      const correctRow = ["CORRECT ANSWERS", ...questions.map(q => q.correct_answer || "—"), "", "", ""].map(escapeCsv).join(",");

      // Data rows
      const rows = userIds.map(uid => {
        const entry = entryMap[uid];
        const cols = [
          profMap[uid] || uid,
          ...questions.map(q => ansMap[uid]?.[q.id] || "—"),
          entry ? `${entry.score}/${entry.total_points}` : "—",
          entry?.rank != null ? String(entry.rank) : "—",
          entry?.payout != null ? String(entry.payout) : "0",
        ];
        return cols.map(escapeCsv).join(",");
      });

      const csv = [header, correctRow, ...rows].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedContest.title.replace(/[^a-zA-Z0-9]/g, "_")}_results.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Results downloaded!");
    } catch (err: any) {
      toast.error("Download failed: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prediction Contests</h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> New Contest</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Contest</DialogTitle>
              <DialogDescription>Set up a new prediction contest with a buy-in and questions.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={newContest.title} onChange={e => setNewContest(p => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>Description (optional)</Label><Textarea value={newContest.description} onChange={e => setNewContest(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Buy-in (tokens)</Label><Input type="number" value={newContest.buy_in_amount} onChange={e => setNewContest(p => ({ ...p, buy_in_amount: e.target.value }))} /></div>
                <div><Label>Total Points</Label><Input type="number" value={newContest.total_points} onChange={e => setNewContest(p => ({ ...p, total_points: e.target.value }))} /></div>
              </div>
              <div><Label>Match Name (optional)</Label><Input value={newContest.match_name} onChange={e => setNewContest(p => ({ ...p, match_name: e.target.value }))} placeholder="e.g. IND vs AUS, Semi Final" /></div>
              <div><Label>Closes At</Label><Input type="datetime-local" value={newContest.closes_at} onChange={e => setNewContest(p => ({ ...p, closes_at: e.target.value }))} /></div>
              <div><Label>Min Participants (for payout)</Label><Input type="number" value={newContest.min_participants} onChange={e => setNewContest(p => ({ ...p, min_participants: e.target.value }))} /></div>
              <Button onClick={() => createContestMutation.mutate()} disabled={!newContest.title || !newContest.closes_at || createContestMutation.isPending}>
                {createContestMutation.isPending ? "Creating..." : "Create Contest"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contest List */}
      <div className="space-y-2">
        {contests?.map(c => (
          <Card key={c.id} className={`cursor-pointer transition-colors ${selectedContestId === c.id ? "border-primary" : "hover:border-primary/30"}`}
            onClick={() => setSelectedContestId(c.id)}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{c.title}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(c.closes_at), "MMM d, h:mm a")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                {c.status === "draft" && (
                  <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: c.id, status: "open" }); }}>
                    Open
                  </Button>
                )}
                {(c.status === "open" || c.status === "closed") && (
                  <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: c.id, status: "closed" }); }}>
                    Close
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
            ))}

      </div>

      {/* Selected Contest Management */}
      {selectedContest && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{selectedContest.title} — Questions</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal text-muted-foreground">{entryCount} participants</span>
                {(selectedContest.status === "closed" || selectedContest.status === "resolved") && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={downloadContestResults}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setPreviewOpen(true)}>
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing questions */}
            {questions?.map((q, idx) => (
              <div key={q.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Q{idx + 1}: {q.question_text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">{q.question_type}</Badge>
                      <Badge variant="outline" className="text-[10px]">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
                      {selectedContest.tiebreaker_question_id === q.id && (
                        <Badge className="text-[10px] bg-yellow-500">Tiebreaker</Badge>
                      )}
                    </div>
                    {q.options && <p className="text-xs text-muted-foreground mt-1">Options: {(q.options as string[]).join(", ")}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setTiebreakerMutation.mutate(q.id)} title="Set as tiebreaker">
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteQuestionMutation.mutate(q.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Correct answer input */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Set correct answer"
                    defaultValue={q.correct_answer || ""}
                    className="text-sm h-8 max-w-xs"
                    onBlur={(e) => {
                      if (e.target.value !== (q.correct_answer || "")) {
                        setCorrectAnswerMutation.mutate({ qId: q.id, answer: e.target.value });
                      }
                    }}
                  />
                  {q.correct_answer && <CheckCircle className="h-4 w-4 text-green-500" />}
                </div>
              </div>
            ))}

            <Separator />

            {/* Add question form */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Add Question</p>
              <Input placeholder="Question text" value={newQuestion.question_text} onChange={e => setNewQuestion(p => ({ ...p, question_text: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={newQuestion.question_type} onValueChange={v => setNewQuestion(p => ({ ...p, question_type: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes_no">Yes/No</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="subjective">Subjective (1-4 words)</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Points" value={newQuestion.points} onChange={e => setNewQuestion(p => ({ ...p, points: e.target.value }))} />
              </div>
              {newQuestion.question_type === "multiple_choice" && (
                <Input placeholder="Options (comma separated)" value={newQuestion.options} onChange={e => setNewQuestion(p => ({ ...p, options: e.target.value }))} />
              )}
              <Button size="sm" onClick={() => addQuestionMutation.mutate()} disabled={!newQuestion.question_text || addQuestionMutation.isPending}>
                Add Question
              </Button>
            </div>

            {/* Resolve button */}
            {(selectedContest.status === "open" || selectedContest.status === "closed") && (
              <>
                <Separator />
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => resolveMutation.mutate()}
                  disabled={resolveMutation.isPending || !questions?.every(q => q.correct_answer)}
                >
                  {resolveMutation.isPending ? "Resolving..." : "Resolve Contest & Pay Winners"}
                </Button>
                {questions && !questions.every(q => q.correct_answer) && (
                  <p className="text-xs text-destructive">Set correct answers for all questions before resolving.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      {selectedContest && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" /> Contest Preview (User View)
              </DialogTitle>
              <DialogDescription>This is how the contest appears to participants.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Header */}
              <div>
                <h3 className="text-lg font-bold">{selectedContest.title}</h3>
                {selectedContest.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedContest.description}</p>
                )}
                {selectedContest.match_name && (
                  <p className="text-xs text-muted-foreground mt-1">🏏 {selectedContest.match_name}</p>
                )}
              </div>

              {/* Meta badges */}
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg">
                  <Coins className="h-3.5 w-3.5 text-accent" /> Buy-in: {selectedContest.buy_in_amount} tokens
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg">
                  <Users className="h-3.5 w-3.5" /> {entryCount} joined
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg">
                  <Trophy className="h-3.5 w-3.5 text-yellow-500" /> Pot: {(entryCount || 0) * selectedContest.buy_in_amount} tokens
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg">
                  <Clock className="h-3.5 w-3.5" /> {format(new Date(selectedContest.closes_at), "MMM d, h:mm a")}
                </span>
              </div>

              {/* Prize breakdown */}
              {(() => {
                const pot = (entryCount || 0) * selectedContest.buy_in_amount;
                return (
                  <div className="flex gap-2">
                    <Badge variant="outline" className="gap-1"><Medal className="h-3 w-3 text-yellow-500" /> 1st: {(pot * 0.5).toFixed(0)} tokens</Badge>
                    <Badge variant="outline" className="gap-1"><Medal className="h-3 w-3 text-gray-400" /> 2nd: {(pot * 0.3).toFixed(0)} tokens</Badge>
                    <Badge variant="outline" className="gap-1"><Medal className="h-3 w-3 text-amber-700" /> 3rd: {(pot * 0.2).toFixed(0)} tokens</Badge>
                  </div>
                );
              })()}

              <ContestHowItWorks compact />

              {/* Questions preview */}
              {questions && questions.length > 0 ? (
                <div>
                  <h4 className="font-semibold text-base mb-3">Predictions</h4>
                  <div className="space-y-3">
                    {questions.map((q, idx) => {
                      const isTiebreaker1 = selectedContest.tiebreaker_question_id === q.id;
                      return (
                        <Card key={q.id} className={cn(isTiebreaker1 && "border-yellow-500/40 bg-yellow-500/5")}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground">Q{idx + 1}</span>
                                <p className="font-medium text-sm">{q.question_text}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isTiebreaker1 && <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">Tiebreaker</Badge>}
                                <Badge variant="secondary" className="text-[10px]">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
                              </div>
                            </div>

                            {q.question_type === "yes_no" ? (
                              <RadioGroup disabled className="flex gap-4">
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value="Yes" id={`preview-${q.id}-yes`} disabled />
                                  <Label htmlFor={`preview-${q.id}-yes`} className="text-muted-foreground">Yes</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value="No" id={`preview-${q.id}-no`} disabled />
                                  <Label htmlFor={`preview-${q.id}-no`} className="text-muted-foreground">No</Label>
                                </div>
                              </RadioGroup>
                            ) : q.question_type === "multiple_choice" && q.options ? (
                              <RadioGroup disabled className="space-y-2">
                                {(q.options as string[]).map(opt => (
                                  <div key={opt} className="flex items-center gap-2">
                                    <RadioGroupItem value={opt} id={`preview-${q.id}-${opt}`} disabled />
                                    <Label htmlFor={`preview-${q.id}-${opt}`} className="text-muted-foreground">{opt}</Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            ) : (
                              <Input placeholder="Your answer..." disabled className="text-sm" />
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No questions added yet. Add questions above to see them here.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ContestManagementPanel;
