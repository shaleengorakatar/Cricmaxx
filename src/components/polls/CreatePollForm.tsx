import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreatePollFormProps {
  onCreated: () => void;
}

export const CreatePollForm = ({ onCreated }: CreatePollFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", "", ""]);
  const [closesAt, setClosesAt] = useState("");
  const [creating, setCreating] = useState(false);

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ""]);
  };

  const removeOption = (i: number) => {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
  };

  const updateOption = (i: number, val: string) => {
    const updated = [...options];
    updated[i] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      toast({ title: "Need at least 2 options", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      // Create poll
      const { data: poll, error: pollError } = await supabase
        .from("prediction_polls")
        .insert({
          question: question.trim(),
          description: description.trim() || null,
          created_by: user.id,
          closes_at: new Date(closesAt).toISOString(),
        })
        .select("id")
        .single();

      if (pollError) throw pollError;

      // Create options
      const { error: optError } = await supabase.from("poll_options").insert(
        validOptions.map((text) => ({
          poll_id: poll.id,
          option_text: text.trim(),
        }))
      );

      if (optError) throw optError;

      toast({ title: "Poll created!" });
      setQuestion("");
      setDescription("");
      setOptions(["", "", ""]);
      setClosesAt("");
      onCreated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Create a Poll</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs sm:text-sm">Question</Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Who will be the top scorer?"
              required
              className="mt-1 text-sm"
           />
          </div>

          <div>
            <Label className="text-xs sm:text-sm">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context shown when expanded"
              className="mt-1 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs sm:text-sm">Options</Label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="text-sm min-w-0"
                />
                {options.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeOption(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                <Plus className="h-4 w-4 mr-1" /> Add Option
              </Button>
            )}
          </div>

          <div>
            <Label className="text-xs sm:text-sm">Closes at</Label>
            <Input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              required
              className="mt-1 text-sm"
            />
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">Should close 30 minutes before the match</p>
          </div>

          <Button type="submit" disabled={creating} className="w-full">
            {creating ? "Creating..." : "Create Poll"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
