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
import { toast } from "sonner";
import { Plus, Trash2, Trophy, CheckCircle, Star } from "lucide-react";
import { format } from "date-fns";

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
              <span className="text-sm font-normal text-muted-foreground">{entryCount} participants</span>
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
    </div>
  );
};

export default ContestManagementPanel;
