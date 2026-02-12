import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PollOption {
  id: string;
  option_text: string;
}

interface PollEditFormProps {
  poll: {
    id: string;
    question: string;
    description?: string | null;
    closes_at: string;
    options: PollOption[];
  };
  onSaved: () => void;
  onCancel: () => void;
}

export const PollEditForm = ({ poll, onSaved, onCancel }: PollEditFormProps) => {
  const { toast } = useToast();
  const [question, setQuestion] = useState(poll.question);
  const [description, setDescription] = useState(poll.description || "");
  const [closesAt, setClosesAt] = useState(() => {
    const dt = new Date(poll.closes_at);
    return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [options, setOptions] = useState<{ id: string; text: string; isNew?: boolean; markedForDelete?: boolean }[]>(
    poll.options.map(o => ({ id: o.id, text: o.option_text }))
  );
  const [saving, setSaving] = useState(false);

  const remaining = options.filter(o => !o.markedForDelete);

  const handleSave = async () => {
    if (!question.trim() || !closesAt) return;
    if (remaining.length < 2) {
      toast({ title: "Error", description: "A poll must have at least 2 options.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error: pollError } = await supabase
        .from("prediction_polls")
        .update({
          question: question.trim(),
          description: description.trim() || null,
          closes_at: new Date(closesAt).toISOString(),
        })
        .eq("id", poll.id);
      if (pollError) throw pollError;

      // Delete removed options
      const toDelete = options.filter(o => o.markedForDelete && !o.isNew);
      for (const opt of toDelete) {
        const { count } = await supabase
          .from("poll_votes")
          .select("*", { count: "exact", head: true })
          .eq("option_id", opt.id);
        if (count && count > 0) {
          toast({ title: "Cannot remove", description: `"${opt.text}" has ${count} vote(s).`, variant: "destructive" });
          setSaving(false);
          return;
        }
        const { error } = await supabase.from("poll_options").delete().eq("id", opt.id);
        if (error) throw error;
      }

      // Update existing
      for (const opt of remaining.filter(o => !o.isNew)) {
        const { error } = await supabase.from("poll_options").update({ option_text: opt.text.trim() }).eq("id", opt.id);
        if (error) throw error;
      }

      // Insert new
      const newOpts = remaining.filter(o => o.isNew && o.text.trim());
      if (newOpts.length > 0) {
        const { error } = await supabase.from("poll_options").insert(
          newOpts.map(o => ({ poll_id: poll.id, option_text: o.text.trim() }))
        );
        if (error) throw error;
      }

      toast({ title: "Poll updated!" });
      onSaved();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">Edit Poll</span>
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div>
        <Label className="text-xs">Question</Label>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-1 text-sm" />
      </div>

      <div>
        <Label className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional context" className="mt-1 text-sm" />
      </div>

      <div>
        <Label className="text-xs">Closes At</Label>
        <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="mt-1 text-sm" />
      </div>

      <div>
        <Label className="text-xs">Options</Label>
        <div className="space-y-2 mt-1.5">
          {options.filter(o => !o.markedForDelete).map((opt, idx) => {
            const originalIdx = options.indexOf(opt);
            return (
              <div key={opt.id} className="flex items-center gap-1.5">
                <Input
                  value={opt.text}
                  onChange={(e) => {
                    const updated = [...options];
                    updated[originalIdx] = { ...updated[originalIdx], text: e.target.value };
                    setOptions(updated);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  className="text-sm min-w-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => {
                    if (opt.isNew) {
                      setOptions(options.filter((_, i) => i !== originalIdx));
                    } else {
                      const updated = [...options];
                      updated[originalIdx] = { ...updated[originalIdx], markedForDelete: true };
                      setOptions(updated);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOptions([...options, { id: `new-${Date.now()}`, text: "", isNew: true }])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
          </Button>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving || !question.trim()} className="w-full">
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
};
