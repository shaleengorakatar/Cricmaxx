import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Trash2, Star, CheckCircle } from "lucide-react";

interface ContestQuestionManagerProps {
  contestId: string;
  contestStatus: string;
  tiebreakerQuestionId: string | null;
}

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

const ContestQuestionManager = ({ contestId, contestStatus, tiebreakerQuestionId }: ContestQuestionManagerProps) => {
  const queryClient = useQueryClient();
  const [newQuestion, setNewQuestion] = useState({
    question_text: "", question_type: "yes_no", points: "1", options: "",
  });

  const { data: questions } = useQuery({
    queryKey: ["contest-questions", contestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contest_questions")
        .select("*")
        .eq("contest_id", contestId)
        .order("sort_order");
      if (error) throw error;
      return data as Question[];
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: async () => {
      const opts = newQuestion.question_type === "multiple_choice" && newQuestion.options
        ? newQuestion.options.split(",").map(o => o.trim()).filter(Boolean)
        : null;
      const { error } = await supabase.from("contest_questions").insert({
        contest_id: contestId,
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
      queryClient.invalidateQueries({ queryKey: ["contest-questions", contestId] });
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
      queryClient.invalidateQueries({ queryKey: ["contest-questions", contestId] });
    },
  });

  const setCorrectAnswerMutation = useMutation({
    mutationFn: async ({ qId, answer }: { qId: string; answer: string }) => {
      const { error } = await supabase.from("contest_questions").update({ correct_answer: answer }).eq("id", qId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Correct answer set");
      queryClient.invalidateQueries({ queryKey: ["contest-questions", contestId] });
    },
  });

  const setTiebreakerMutation = useMutation({
    mutationFn: async (qId: string) => {
      const { error } = await supabase.from("prediction_contests").update({ tiebreaker_question_id: qId }).eq("id", contestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tiebreaker set!");
      queryClient.invalidateQueries({ queryKey: ["contests"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("prediction_contests").update({ status }).eq("id", contestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contest status updated!");
      queryClient.invalidateQueries({ queryKey: ["contests"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc("resolve_contest", {
        _contest_id: contestId,
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
      queryClient.invalidateQueries({ queryKey: ["contests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isEditable = contestStatus !== "resolved";

  return (
    <Card className="mb-6">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Manage Questions</h2>
          <div className="flex items-center gap-2">
            {contestStatus === "draft" && (
              <Button size="sm" variant="secondary" onClick={() => updateStatusMutation.mutate("open")}>
                Open Contest
              </Button>
            )}
            {contestStatus === "open" && (
              <Button size="sm" variant="secondary" onClick={() => updateStatusMutation.mutate("closed")}>
                Close Contest
              </Button>
            )}
          </div>
        </div>

        {/* Existing questions */}
        {questions?.map((q, idx) => (
          <div key={q.id} className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">Q{idx + 1}: {q.question_text}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px]">{q.question_type}</Badge>
                  <Badge variant="outline" className="text-[10px]">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
                  {tiebreakerQuestionId === q.id && (
                    <Badge className="text-[10px] bg-accent text-accent-foreground">Tiebreaker</Badge>
                  )}
                </div>
                {q.options && <p className="text-xs text-muted-foreground mt-1">Options: {(q.options as string[]).join(", ")}</p>}
              </div>
              {isEditable && (
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setTiebreakerMutation.mutate(q.id)} title="Set as tiebreaker">
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteQuestionMutation.mutate(q.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {/* Correct answer */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Set correct answer"
                defaultValue={q.correct_answer || ""}
                className="text-sm h-8"
                onBlur={(e) => {
                  if (e.target.value !== (q.correct_answer || "")) {
                    setCorrectAnswerMutation.mutate({ qId: q.id, answer: e.target.value });
                  }
                }}
              />
              {q.correct_answer && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
            </div>
          </div>
        ))}

        {/* Add question form */}
        {isEditable && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Question
              </p>
              <Input
                placeholder="Question text"
                value={newQuestion.question_text}
                onChange={e => setNewQuestion(p => ({ ...p, question_text: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={newQuestion.question_type} onValueChange={v => setNewQuestion(p => ({ ...p, question_type: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes_no">Yes/No</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="subjective">Subjective</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Points"
                  value={newQuestion.points}
                  onChange={e => setNewQuestion(p => ({ ...p, points: e.target.value }))}
                />
              </div>
              {newQuestion.question_type === "multiple_choice" && (
                <Input
                  placeholder="Options (comma separated)"
                  value={newQuestion.options}
                  onChange={e => setNewQuestion(p => ({ ...p, options: e.target.value }))}
                />
              )}
              <Button
                size="sm"
                onClick={() => addQuestionMutation.mutate()}
                disabled={!newQuestion.question_text || addQuestionMutation.isPending}
              >
                {addQuestionMutation.isPending ? "Adding..." : "Add Question"}
              </Button>
            </div>
          </>
        )}

        {/* Resolve button */}
        {(contestStatus === "open" || contestStatus === "closed") && (
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
  );
};

export default ContestQuestionManager;
