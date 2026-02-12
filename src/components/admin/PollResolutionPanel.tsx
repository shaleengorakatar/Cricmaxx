import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Pencil, X, Check, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface PollOption {
  id: string;
  option_text: string;
}

interface Poll {
  id: string;
  question: string;
  status: string;
  total_pool: number;
  closes_at: string;
  options: PollOption[];
}

const PollResolutionPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWinners, setSelectedWinners] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<string | null>(null);
  const [editingPoll, setEditingPoll] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editClosesAt, setEditClosesAt] = useState("");
  const [editOptions, setEditOptions] = useState<{ id: string; text: string; isNew?: boolean; markedForDelete?: boolean }[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchPolls = async () => {
    setLoading(true);
    const { data: pollsData } = await supabase
      .from("prediction_polls")
      .select("*")
      .in("status", ["open", "closed"])
      .order("closes_at", { ascending: true });

    if (!pollsData?.length) { setPolls([]); setLoading(false); return; }

    const { data: optionsData } = await supabase
      .from("poll_options")
      .select("*")
      .in("poll_id", pollsData.map((p: any) => p.id));

    const enriched = pollsData.map((p: any) => ({
      id: p.id,
      question: p.question,
      status: p.status,
      total_pool: Number(p.total_pool),
      closes_at: p.closes_at,
      options: (optionsData || []).filter((o: any) => o.poll_id === p.id),
    }));

    setPolls(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchPolls(); }, []);

  const startEdit = (poll: Poll) => {
    setEditingPoll(poll.id);
    setEditQuestion(poll.question);
    // Format for datetime-local input
    const dt = new Date(poll.closes_at);
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditClosesAt(local);
    setEditOptions(poll.options.map(o => ({ id: o.id, text: o.option_text })));
  };

  const cancelEdit = () => {
    setEditingPoll(null);
    setEditQuestion("");
    setEditClosesAt("");
    setEditOptions([]);
  };

  const handleSaveEdit = async (pollId: string) => {
    if (!editQuestion.trim() || !editClosesAt) return;
    const remaining = editOptions.filter(o => !o.markedForDelete);
    if (remaining.length < 2) {
      toast({ title: "Error", description: "A poll must have at least 2 options.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Update poll question and closing time
      const { error: pollError } = await supabase
        .from("prediction_polls")
        .update({
          question: editQuestion.trim(),
          closes_at: new Date(editClosesAt).toISOString(),
        })
        .eq("id", pollId);

      if (pollError) throw pollError;

      // Delete removed options (only existing ones, not new)
      const toDelete = editOptions.filter(o => o.markedForDelete && !o.isNew);
      for (const opt of toDelete) {
        // Check if option has votes before deleting
        const { count } = await supabase
          .from("poll_votes")
          .select("*", { count: "exact", head: true })
          .eq("option_id", opt.id);
        
        if (count && count > 0) {
          toast({ title: "Cannot remove", description: `"${opt.text}" has ${count} vote(s). Remove votes first.`, variant: "destructive" });
          setSaving(false);
          return;
        }

        const { error } = await supabase
          .from("poll_options")
          .delete()
          .eq("id", opt.id);
        if (error) throw error;
      }

      // Update existing options
      for (const opt of remaining.filter(o => !o.isNew)) {
        const { error } = await supabase
          .from("poll_options")
          .update({ option_text: opt.text.trim() })
          .eq("id", opt.id);
        if (error) throw error;
      }

      // Insert new options
      const newOpts = remaining.filter(o => o.isNew && o.text.trim());
      if (newOpts.length > 0) {
        const { error } = await supabase.from("poll_options").insert(
          newOpts.map(o => ({ poll_id: pollId, option_text: o.text.trim() }))
        );
        if (error) throw error;
      }

      toast({ title: "Poll updated", description: "Changes saved successfully." });
      cancelEdit();
      fetchPolls();
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (pollId: string) => {
    const winningId = selectedWinners[pollId];
    if (!winningId || !user) return;

    setResolving(pollId);
    try {
      const { data, error } = await supabase.rpc("resolve_poll", {
        _poll_id: pollId,
        _winning_option_id: winningId,
        _admin_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Poll resolved!",
        description: `Pool: ${(data as any).total_pool} tokens. Winners paid: ${(data as any).winners_paid}`,
      });
      fetchPolls();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading polls...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          Poll Resolution & Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {polls.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No polls to manage</p>
        ) : (
          polls.map((poll) => (
            <Card key={poll.id} className="p-4">
              {editingPoll === poll.id ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">Editing Poll</span>
                    <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-7 w-7">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs">Question</Label>
                    <Input
                      value={editQuestion}
                      onChange={(e) => setEditQuestion(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Closes At</Label>
                    <Input
                      type="datetime-local"
                      value={editClosesAt}
                      onChange={(e) => setEditClosesAt(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Options</Label>
                    <div className="space-y-2 mt-1">
                      {editOptions.filter(o => !o.markedForDelete).map((opt, idx) => {
                        const originalIdx = editOptions.indexOf(opt);
                        return (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Input
                              value={opt.text}
                              onChange={(e) => {
                                const updated = [...editOptions];
                                updated[originalIdx] = { ...updated[originalIdx], text: e.target.value };
                                setEditOptions(updated);
                              }}
                              placeholder={`Option ${idx + 1}`}
                              className="text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => {
                                if (opt.isNew) {
                                  setEditOptions(editOptions.filter((_, i) => i !== originalIdx));
                                } else {
                                  const updated = [...editOptions];
                                  updated[originalIdx] = { ...updated[originalIdx], markedForDelete: true };
                                  setEditOptions(updated);
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
                        onClick={() =>
                          setEditOptions([...editOptions, { id: `new-${Date.now()}`, text: "", isNew: true }])
                        }
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleSaveEdit(poll.id)}
                    disabled={saving || !editQuestion.trim()}
                    className="w-full"
                    size="sm"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              ) : (
                /* View Mode */
                <>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-medium text-sm">{poll.question}</p>
                      <p className="text-xs text-muted-foreground">
                        Pool: {poll.total_pool} tokens · Closes: {new Date(poll.closes_at).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {poll.options.map((opt) => (
                          <Badge key={opt.id} variant="outline" className="text-[11px]">
                            {opt.option_text}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(poll)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Badge variant={poll.status === "closed" ? "secondary" : "outline"}>
                        {poll.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select
                        value={selectedWinners[poll.id] || ""}
                        onValueChange={(val) => setSelectedWinners({ ...selectedWinners, [poll.id]: val })}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select winning option" />
                        </SelectTrigger>
                        <SelectContent>
                          {poll.options.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>{opt.option_text}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleResolve(poll.id)}
                      disabled={!selectedWinners[poll.id] || resolving === poll.id}
                    >
                      {resolving === poll.id ? "Resolving..." : "Resolve"}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default PollResolutionPanel;
