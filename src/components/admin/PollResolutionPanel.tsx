import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy } from "lucide-react";
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
          Poll Resolution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {polls.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No polls to resolve</p>
        ) : (
          polls.map((poll) => (
            <Card key={poll.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-medium text-sm">{poll.question}</p>
                  <p className="text-xs text-muted-foreground">
                    Pool: {poll.total_pool} tokens · Closes: {new Date(poll.closes_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant={poll.status === "closed" ? "secondary" : "outline"}>
                  {poll.status}
                </Badge>
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
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default PollResolutionPanel;
