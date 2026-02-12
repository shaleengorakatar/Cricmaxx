import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

type ContestFormData = {
  id?: string;
  title: string;
  description: string;
  buy_in_amount: string;
  total_points: string;
  match_name: string;
  closes_at: string;
  min_participants: string;
  status?: string;
};

interface ContestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editContest?: {
    id: string;
    title: string;
    description: string | null;
    buy_in_amount: number;
    total_points: number;
    match_name: string | null;
    closes_at: string;
    min_participants: number;
    status: string;
  } | null;
}

const defaultForm: ContestFormData = {
  title: "", description: "", buy_in_amount: "10", total_points: "10",
  match_name: "", closes_at: "", min_participants: "3",
};

const ContestFormDialog = ({ open, onOpenChange, editContest }: ContestFormDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = !!editContest;

  const [form, setForm] = useState<ContestFormData>(defaultForm);

  useEffect(() => {
    if (editContest) {
      const closesLocal = new Date(editContest.closes_at);
      const offset = closesLocal.getTimezoneOffset();
      const local = new Date(closesLocal.getTime() - offset * 60000);
      setForm({
        id: editContest.id,
        title: editContest.title,
        description: editContest.description || "",
        buy_in_amount: String(editContest.buy_in_amount),
        total_points: String(editContest.total_points),
        match_name: editContest.match_name || "",
        closes_at: local.toISOString().slice(0, 16),
        min_participants: String(editContest.min_participants),
        status: editContest.status,
      });
    } else {
      setForm(defaultForm);
    }
  }, [editContest, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const { error } = await supabase.from("prediction_contests").update({
          title: form.title,
          description: form.description || null,
          buy_in_amount: Number(form.buy_in_amount),
          total_points: Number(form.total_points),
          match_name: form.match_name || null,
          closes_at: new Date(form.closes_at).toISOString(),
          min_participants: Number(form.min_participants),
        }).eq("id", editContest!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prediction_contests").insert({
          title: form.title,
          description: form.description || null,
          buy_in_amount: Number(form.buy_in_amount),
          total_points: Number(form.total_points),
          match_name: form.match_name || null,
          closes_at: new Date(form.closes_at).toISOString(),
          min_participants: Number(form.min_participants),
          created_by: user!.id,
          status: "draft",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Contest updated!" : "Contest created!");
      onOpenChange(false);
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ["contests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-contests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (key: keyof ContestFormData, value: string) =>
    setForm(p => ({ ...p, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Contest" : "Create Contest"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the contest details." : "Set up a new prediction contest with a buy-in and questions."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e => set("title", e.target.value)} /></div>
          <div><Label>Description (optional)</Label><Textarea value={form.description} onChange={e => set("description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Buy-in (tokens)</Label><Input type="number" value={form.buy_in_amount} onChange={e => set("buy_in_amount", e.target.value)} /></div>
            <div><Label>Total Points</Label><Input type="number" value={form.total_points} onChange={e => set("total_points", e.target.value)} /></div>
          </div>
          <div><Label>Match Name (optional)</Label><Input value={form.match_name} onChange={e => set("match_name", e.target.value)} placeholder="e.g. IND vs AUS, Semi Final" /></div>
          <div><Label>Closes At</Label><Input type="datetime-local" value={form.closes_at} onChange={e => set("closes_at", e.target.value)} /></div>
          <div><Label>Min Participants (for payout)</Label><Input type="number" value={form.min_participants} onChange={e => set("min_participants", e.target.value)} /></div>
          <Button onClick={() => mutation.mutate()} disabled={!form.title || !form.closes_at || mutation.isPending}>
            {mutation.isPending ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create Contest")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContestFormDialog;
