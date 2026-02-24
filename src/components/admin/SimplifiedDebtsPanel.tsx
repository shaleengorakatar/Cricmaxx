import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, ArrowRight, PartyPopper, DollarSign, TrendingUp, TrendingDown, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  computeNetBalances,
  computeSimplifiedDebts,
  formatCents,
  toCents,
  type UserBalance,
  type SettlementResult,
} from "@/lib/settlementAlgorithm";

interface UserData {
  userId: string;
  name: string;
  deposited: number;
  withdrawn: number;
  pollPnl: number;
  contestPnl: number;
  marketPnl: number;
}

const SimplifiedDebtsPanel = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData[]>([]);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, display_name");

      if (!profiles) return;

      // Fetch transactions grouped by user
      const { data: deposits } = await supabase
        .from("transactions")
        .select("user_id, amount")
        .eq("type", "deposit");

      const { data: withdrawals } = await supabase
        .from("transactions")
        .select("user_id, amount")
        .eq("type", "withdrawal");

      // Fetch poll P&L: votes placed minus winnings
      const { data: pollVotes } = await supabase
        .from("poll_votes")
        .select("user_id, amount, option_id, poll_id");

      const { data: resolvedPolls } = await supabase
        .from("prediction_polls")
        .select("id, winning_option_id, total_pool")
        .eq("status", "resolved");

      // Fetch contest P&L
      const { data: contestEntries } = await supabase
        .from("contest_entries")
        .select("user_id, payout, contest_id");

      const { data: resolvedContests } = await supabase
        .from("prediction_contests")
        .select("id, buy_in_amount")
        .eq("status", "resolved");

      // Fetch market P&L
      const { data: closedPositions } = await supabase
        .from("positions")
        .select("user_id, pnl")
        .eq("status", "closed");

      // Aggregate per user
      const userMap = new Map<string, UserData>();

      for (const p of profiles) {
        userMap.set(p.id, {
          userId: p.id,
          name: p.display_name || p.name,
          deposited: 0,
          withdrawn: 0,
          pollPnl: 0,
          contestPnl: 0,
          marketPnl: 0,
        });
      }

      // Sum deposits
      for (const d of deposits || []) {
        const u = userMap.get(d.user_id);
        if (u) u.deposited += Number(d.amount) || 0;
      }

      // Sum withdrawals
      for (const w of withdrawals || []) {
        const u = userMap.get(w.user_id);
        if (u) u.withdrawn += Number(w.amount) || 0;
      }

      // Compute poll P&L: winnings - stakes (for resolved polls only)
      const resolvedPollIds = new Set((resolvedPolls || []).map(p => p.id));
      const resolvedPollMap = new Map((resolvedPolls || []).map(p => [p.id, p]));

      // Group votes by poll to compute per-option totals for payout calculation
      const pollOptionTotals = new Map<string, Map<string, number>>(); // pollId -> optionId -> totalStaked
      const pollTotalStaked = new Map<string, number>(); // pollId -> total

      for (const v of pollVotes || []) {
        if (!resolvedPollIds.has(v.poll_id)) continue;
        if (!pollOptionTotals.has(v.poll_id)) pollOptionTotals.set(v.poll_id, new Map());
        const optMap = pollOptionTotals.get(v.poll_id)!;
        optMap.set(v.option_id, (optMap.get(v.option_id) || 0) + Number(v.amount));
        pollTotalStaked.set(v.poll_id, (pollTotalStaked.get(v.poll_id) || 0) + Number(v.amount));
      }

      for (const v of pollVotes || []) {
        if (!resolvedPollIds.has(v.poll_id)) continue;
        const u = userMap.get(v.user_id);
        if (!u) continue;

        const poll = resolvedPollMap.get(v.poll_id);
        if (!poll) continue;

        const staked = Number(v.amount) || 0;
        u.pollPnl -= staked; // subtract stake

        // If they picked the winner, compute payout proportionally
        if (poll.winning_option_id === v.option_id) {
          const totalPool = pollTotalStaked.get(v.poll_id) || 0;
          const winnerPool = pollOptionTotals.get(v.poll_id)?.get(v.option_id) || 0;
          if (winnerPool > 0) {
            const payout = (staked / winnerPool) * totalPool;
            u.pollPnl += payout;
          }
        }
      }

      // Contest P&L
      const resolvedContestMap = new Map((resolvedContests || []).map(c => [c.id, c]));
      for (const e of contestEntries || []) {
        const u = userMap.get(e.user_id);
        const contest = resolvedContestMap.get(e.contest_id);
        if (!u || !contest) continue;
        u.contestPnl -= Number(contest.buy_in_amount) || 0;
        u.contestPnl += Number(e.payout) || 0;
      }

      // Market P&L
      for (const pos of closedPositions || []) {
        const u = userMap.get(pos.user_id);
        if (u) u.marketPnl += Number(pos.pnl) || 0;
      }

      // Filter out users with zero activity
      const activeUsers = Array.from(userMap.values()).filter(
        u => u.deposited !== 0 || u.withdrawn !== 0 || u.pollPnl !== 0 || u.contestPnl !== 0 || u.marketPnl !== 0
      );

      setUserData(activeUsers);
    } catch (err) {
      console.error("Error fetching simplified debts data:", err);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const balances = useMemo(() => {
    const raw = userData.map(u => ({
      userId: u.userId,
      name: u.name,
      depositedCents: toCents(u.deposited),
      withdrawnCents: toCents(u.withdrawn),
      pollPnlCents: toCents(u.pollPnl),
      contestPnlCents: toCents(u.contestPnl),
      marketPnlCents: toCents(u.marketPnl),
    }));
    return computeNetBalances(raw);
  }, [userData]);

  const settlement = useMemo(() => computeSimplifiedDebts(balances), [balances]);

  const handleCopy = () => {
    if (settlement.allSettled) return;
    const text = settlement.transfers
      .map(t => `${t.fromName} pays ${t.toName} ${formatCents(t.amountCents)}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied!", description: "Transfer list copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Deposited</p>
            </div>
            <p className="text-lg font-bold">{formatCents(settlement.totalPoolDepositedCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Withdrawn</p>
            </div>
            <p className="text-lg font-bold">{formatCents(settlement.totalPoolWithdrawnCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total P&L</p>
            </div>
            <p className="text-lg font-bold">{formatCents(settlement.totalPoolPnlCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Owed</p>
            </div>
            <p className="text-lg font-bold">{formatCents(settlement.totalOwedCents)}</p>
          </CardContent>
        </Card>
      </div>

      {settlement.roundingAdjustmentCents !== 0 && (
        <p className="text-xs text-muted-foreground">
          Rounding adjustment: {formatCents(settlement.roundingAdjustmentCents)} applied to balance the pool.
        </p>
      )}

      {/* Settle Up Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Settle Up</CardTitle>
            {!settlement.allSettled && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {settlement.allSettled ? (
            <div className="text-center py-8">
              <PartyPopper className="h-12 w-12 mx-auto mb-3 text-accent" />
              <p className="text-lg font-semibold">All settled 🎉</p>
              <p className="text-sm text-muted-foreground">No transfers needed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlement.transfers.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
                >
                  <Badge variant="destructive" className="shrink-0 text-xs">
                    {t.fromName}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {t.toName}
                  </Badge>
                  <span className="ml-auto font-bold text-sm">{formatCents(t.amountCents)}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-2">
                {settlement.transfers.length} transfer{settlement.transfers.length !== 1 ? "s" : ""} to settle all debts
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Balances Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">User Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Deposited</TableHead>
                  <TableHead className="text-right">Withdrawn</TableHead>
                  <TableHead className="text-right">Poll P&L</TableHead>
                  <TableHead className="text-right">Contest P&L</TableHead>
                  <TableHead className="text-right">Market P&L</TableHead>
                  <TableHead className="text-right">Net Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances
                  .sort((a, b) => b.netBalanceCents - a.netBalanceCents)
                  .map(b => (
                    <TableRow key={b.userId}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-right">{formatCents(b.depositedCents)}</TableCell>
                      <TableCell className="text-right">{formatCents(b.withdrawnCents)}</TableCell>
                      <TableCell className="text-right">
                        <span className={b.pollPnlCents > 0 ? "text-green-600" : b.pollPnlCents < 0 ? "text-red-500" : ""}>
                          {formatCents(b.pollPnlCents)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={b.contestPnlCents > 0 ? "text-green-600" : b.contestPnlCents < 0 ? "text-red-500" : ""}>
                          {formatCents(b.contestPnlCents)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={b.marketPnlCents > 0 ? "text-green-600" : b.marketPnlCents < 0 ? "text-red-500" : ""}>
                          {formatCents(b.marketPnlCents)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        <Badge variant={b.netBalanceCents > 0 ? "default" : b.netBalanceCents < 0 ? "destructive" : "secondary"}>
                          {b.netBalanceCents > 0 ? "Owed " : b.netBalanceCents < 0 ? "Owes " : ""}
                          {formatCents(b.netBalanceCents)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimplifiedDebtsPanel;
