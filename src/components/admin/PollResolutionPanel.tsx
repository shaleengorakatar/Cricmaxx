import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trophy, Pencil, X, Check, Plus, Trash2, ChevronDown, ChevronUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PollOption {
  id: string;
  option_text: string;
}

interface Poll {
  id: string;
  question: string;
  description?: string | null;
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
  const [selectedWinners, setSelectedWinners] = useState<Record<string, string[]>>({});
  const [resolving, setResolving] = useState<string | null>(null);
  const [editingPoll, setEditingPoll] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editClosesAt, setEditClosesAt] = useState("");
  const [editOptions, setEditOptions] = useState<{ id: string; text: string; isNew?: boolean; markedForDelete?: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedPoll, setExpandedPoll] = useState<string | null>(null);
  const [voters, setVoters] = useState<Record<string, { user_name: string; user_email: string; option_text: string; amount: number }[]>>({});
  const [loadingVoters, setLoadingVoters] = useState<string | null>(null);

  const fetchVoters = async (pollId: string) => {
    if (expandedPoll === pollId) { setExpandedPoll(null); return; }
    setLoadingVoters(pollId);
    const { data } = await supabase
      .from("poll_votes")
      .select("user_id, amount, option_id")
      .eq("poll_id", pollId);

    if (!data?.length) { setVoters(prev => ({ ...prev, [pollId]: [] })); setExpandedPoll(pollId); setLoadingVoters(null); return; }

    const userIds = [...new Set(data.map(v => v.user_id))];
    const optionIds = [...new Set(data.map(v => v.option_id))];

    const [{ data: profiles }, { data: options }] = await Promise.all([
      supabase.from("profiles").select("id, name, email, display_name, username").in("id", userIds),
      supabase.from("poll_options").select("id, option_text").in("id", optionIds),
    ]);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    const optionMap = Object.fromEntries((options || []).map(o => [o.id, o.option_text]));

    const enriched = data.map(v => ({
      user_name: profileMap[v.user_id]?.display_name || profileMap[v.user_id]?.username || profileMap[v.user_id]?.name || "Unknown",
      user_email: profileMap[v.user_id]?.email || "",
      option_text: optionMap[v.option_id] || "Unknown",
      amount: Number(v.amount),
    }));

    setVoters(prev => ({ ...prev, [pollId]: enriched }));
    setExpandedPoll(pollId);
    setLoadingVoters(null);
  };

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
      description: p.description || null,
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
    setEditDescription(poll.description || "");
    const dt = new Date(poll.closes_at);
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditClosesAt(local);
    setEditOptions(poll.options.map(o => ({ id: o.id, text: o.option_text })));
  };

  const cancelEdit = () => {
    setEditingPoll(null);
    setEditQuestion("");
    setEditDescription("");
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
          description: editDescription.trim() || null,
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

  const toggleWinner = (pollId: string, optionId: string) => {
    setSelectedWinners(prev => {
      const current = prev[pollId] || [];
      const updated = current.includes(optionId) 
        ? current.filter(id => id !== optionId) 
        : [...current, optionId];
      return { ...prev, [pollId]: updated };
    });
  };

  const handleResolve = async (pollId: string) => {
    const winningIds = selectedWinners[pollId];
    if (!winningIds?.length || !user) return;

    setResolving(pollId);
    try {
      const { data, error } = await supabase.rpc("resolve_poll", {
        _poll_id: pollId,
        _winning_option_ids: winningIds,
        _admin_id: user.id,
      } as any);

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
                    <Label className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Additional context shown when expanded"
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
                      {poll.description && (
                        <p className="text-xs text-muted-foreground/80 mt-0.5">{poll.description}</p>
                      )}
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
                      {poll.status === "closed" && (
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={async () => {
                          const { error } = await supabase.from("prediction_polls").update({ status: "open" }).eq("id", poll.id);
                          if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                          toast({ title: "Poll reopened" });
                          fetchPolls();
                        }}>
                          Reopen
                        </Button>
                      )}
                      <Badge variant={poll.status === "closed" ? "secondary" : "outline"}>
                        {poll.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Select winning option(s)</Label>
                    <div className="space-y-1.5">
                      {poll.options.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox
                            checked={(selectedWinners[poll.id] || []).includes(opt.id)}
                            onCheckedChange={() => toggleWinner(poll.id, opt.id)}
                          />
                          {opt.option_text}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleResolve(poll.id)}
                        disabled={!(selectedWinners[poll.id]?.length) || resolving === poll.id}
                        className="flex-1"
                      >
                        {resolving === poll.id ? "Resolving..." : `Resolve (${selectedWinners[poll.id]?.length || 0} winner${(selectedWinners[poll.id]?.length || 0) !== 1 ? 's' : ''})`}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (!confirm("Void this poll? All stakes will be refunded.")) return;
                          setResolving(poll.id);
                          try {
                            const { data, error } = await supabase.rpc("void_poll", { _poll_id: poll.id, _admin_id: user!.id });
                            if (error) throw error;
                            toast({ title: "Poll voided!", description: `${(data as any).refunded} voters refunded ${(data as any).total_refunded} tokens total.` });
                            fetchPolls();
                          } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                          } finally {
                            setResolving(null);
                          }
                        }}
                        disabled={resolving === poll.id}
                      >
                        Void
                      </Button>
                    </div>
                  </div>

                  {/* Participants toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs text-muted-foreground"
                    onClick={() => fetchVoters(poll.id)}
                    disabled={loadingVoters === poll.id}
                  >
                    <Users className="h-3.5 w-3.5 mr-1" />
                    {loadingVoters === poll.id ? "Loading..." : expandedPoll === poll.id ? "Hide Participants" : "Show Participants"}
                    {expandedPoll === poll.id ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                  </Button>

                  {expandedPoll === poll.id && (
                    <div className="mt-2">
                      {(voters[poll.id]?.length ?? 0) === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No participants yet</p>
                      ) : (
                        <div className="rounded-md border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs h-8 px-2">User</TableHead>
                                <TableHead className="text-xs h-8 px-2">Option</TableHead>
                                <TableHead className="text-xs h-8 px-2 text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {voters[poll.id].map((v, i) => (
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
