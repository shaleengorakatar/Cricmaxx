import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, ArrowRight, PartyPopper, DollarSign, Users, Wallet, UserMinus, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  computeSimplifiedDebts,
  formatCents,
  toCents,
  type UserBalance,
} from "@/lib/settlementAlgorithm";

interface UserPnL {
  userId: string;
  name: string;
  region: string | null;
  pollStaked: number;
  pollWon: number;
  pollPnl: number;
  contestStaked: number;
  contestWon: number;
  contestPnl: number;
  marketPnl: number;
  totalPnl: number;
}

const SimplifiedDebtsPanel = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserPnL[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  // Auto-exclude test accounts: Shaina Saluja & Tre
  const [excludedUsers, setExcludedUsers] = useState<Set<string>>(new Set([
    "82508f2a-8eec-4fd6-8f25-dafab0a8abdb", // shaina saluja
    "bacaf710-ba9b-4013-9423-7c409585ecfb", // tre
  ]));
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [profilesRes, pollStakesRes, pollWinningsRes, pollRefundsRes, contestBuyinsRes, contestWinningsRes, marketPnlRes] = await Promise.all([
        supabase.from("profiles").select("id, name, display_name, region"),
        // Poll stakes on RESOLVED polls only
        supabase.from("poll_votes").select("user_id, amount, prediction_polls!inner(status)").eq("prediction_polls.status", "resolved"),
        // Poll winnings from transactions
        supabase.from("transactions").select("user_id, amount").eq("metadata->>source", "poll_winnings"),
        // Poll refunds (no-winner polls) from transactions
        supabase.from("transactions").select("user_id, amount").eq("metadata->>source", "poll_refund"),
        // Contest buyins on RESOLVED contests only
        supabase.from("contest_entries").select("user_id, prediction_contests!inner(status, buy_in_amount)").eq("prediction_contests.status", "resolved"),
        // Contest winnings from transactions
        supabase.from("transactions").select("user_id, amount").eq("metadata->>source", "contest_winnings"),
        // Market P&L from closed positions
        supabase.from("positions").select("user_id, pnl").eq("status", "closed"),
      ]);

      const pollStakesMap = new Map<string, number>();
      if (pollStakesRes.data) {
        for (const v of pollStakesRes.data) {
          pollStakesMap.set(v.user_id, (pollStakesMap.get(v.user_id) || 0) + Number(v.amount));
        }
      }

      const contestBuyinsMap = new Map<string, number>();
      if (contestBuyinsRes.data) {
        for (const e of contestBuyinsRes.data) {
          const buyin = Number((e.prediction_contests as any)?.buy_in_amount || 0);
          contestBuyinsMap.set(e.user_id, (contestBuyinsMap.get(e.user_id) || 0) + buyin);
        }
      }

      // Aggregate poll winnings
      const pollWinningsMap = new Map<string, number>();
      if (pollWinningsRes.data) {
        for (const t of pollWinningsRes.data) {
          pollWinningsMap.set(t.user_id, (pollWinningsMap.get(t.user_id) || 0) + Number(t.amount));
        }
      }

      // Aggregate poll refunds (subtract from stakes since these polls are a wash)
      const pollRefundsMap = new Map<string, number>();
      if (pollRefundsRes.data) {
        for (const t of pollRefundsRes.data) {
          pollRefundsMap.set(t.user_id, (pollRefundsMap.get(t.user_id) || 0) + Number(t.amount));
        }
      }

      // Aggregate contest winnings
      const contestWinningsMap = new Map<string, number>();
      if (contestWinningsRes.data) {
        for (const t of contestWinningsRes.data) {
          contestWinningsMap.set(t.user_id, (contestWinningsMap.get(t.user_id) || 0) + Number(t.amount));
        }
      }

      // Aggregate market P&L
      const marketPnlMap = new Map<string, number>();
      if (marketPnlRes.data) {
        for (const p of marketPnlRes.data) {
          marketPnlMap.set(p.user_id, (marketPnlMap.get(p.user_id) || 0) + Number(p.pnl || 0));
        }
      }

      // Build per-user P&L
      const profiles = profilesRes.data || [];
      const allUserIds = new Set<string>();
      [pollStakesMap, pollWinningsMap, pollRefundsMap, contestBuyinsMap, contestWinningsMap, marketPnlMap].forEach(m => {
        m.forEach((_, k) => allUserIds.add(k));
      });

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const users: UserPnL[] = Array.from(allUserIds).map(userId => {
        const profile = profileMap.get(userId);
        const pollStaked = pollStakesMap.get(userId) || 0;
        const pollRefunded = pollRefundsMap.get(userId) || 0;
        const effectivePollStaked = pollStaked - pollRefunded; // Remove refunded stakes
        const pollWon = pollWinningsMap.get(userId) || 0;
        const pollPnl = pollWon - effectivePollStaked;
        const contestStaked = contestBuyinsMap.get(userId) || 0;
        const contestWon = contestWinningsMap.get(userId) || 0;
        const contestPnl = contestWon - contestStaked;
        const marketPnl = marketPnlMap.get(userId) || 0;

        return {
          userId,
          name: profile?.display_name || profile?.name || "Unknown",
          region: (profile as any)?.region || null,
          pollStaked,
          pollWon,
          pollPnl,
          contestStaked,
          contestWon,
          contestPnl,
          marketPnl,
          totalPnl: pollPnl + contestPnl + marketPnl,
        };
      }).sort((a, b) => b.totalPnl - a.totalPnl);

      setUserData(users);
    } catch (err) {
      console.error("Error fetching simplified debts data:", err);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleExclude = (userId: string) => {
    setExcludedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const availableRegions = useMemo(() => {
    const regions = new Set<string>();
    userData.forEach(u => { if (u.region) regions.add(u.region); });
    return Array.from(regions).sort();
  }, [userData]);

  const filteredUserData = useMemo(() => {
    if (selectedRegion === "all") return userData;
    if (selectedRegion === "unset") return userData.filter(u => !u.region);
    return userData.filter(u => u.region === selectedRegion);
  }, [userData, selectedRegion]);

  const balances: UserBalance[] = useMemo(() => {
    return filteredUserData
      .filter(u => !excludedUsers.has(u.userId))
      .filter(u => Math.abs(u.totalPnl) > 0.01)
      .map(u => ({
        userId: u.userId,
        name: u.name,
        depositedCents: 0,
        withdrawnCents: 0,
        pollPnlCents: toCents(u.pollPnl),
        contestPnlCents: toCents(u.contestPnl),
        marketPnlCents: toCents(u.marketPnl),
        netBalanceCents: toCents(u.totalPnl),
      }));
  }, [filteredUserData, excludedUsers]);

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

  const creditorCount = balances.filter(b => b.netBalanceCents > 0).length;
  const debtorCount = balances.filter(b => b.netBalanceCents < 0).length;

  return (
    <div className="space-y-6">
      {/* Region Filter */}
      <div className="flex items-center gap-3">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Region:</span>
        <Select value={selectedRegion} onValueChange={setSelectedRegion}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            <SelectItem value="unset">⚠️ No region set</SelectItem>
            {availableRegions.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRegion !== "all" && (
          <Badge variant="outline" className="text-xs">
            Showing {selectedRegion === "unset" ? "users without region" : selectedRegion} only
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Won (Winners)</p>
            </div>
            <p className="text-lg font-bold text-green-600">
              {formatCents(balances.filter(b => b.netBalanceCents > 0).reduce((s, b) => s + b.netBalanceCents, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Lost (Losers)</p>
            </div>
            <p className="text-lg font-bold text-red-500">
              {formatCents(Math.abs(balances.filter(b => b.netBalanceCents < 0).reduce((s, b) => s + b.netBalanceCents, 0)))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Winners / Losers</p>
            </div>
            <p className="text-lg font-bold">{creditorCount} / {debtorCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserMinus className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Excluded / Transfers</p>
            </div>
            <p className="text-lg font-bold">{excludedUsers.size} / {settlement.transfers.length}</p>
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
          <p className="text-xs text-muted-foreground">
            Based on resolved polls, contests & markets only. Deposits/withdrawals excluded.
          </p>
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

      {/* User P&L Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">User P&L Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">
            P&L from resolved betting activity only. Uncheck to exclude from settlement.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Inc.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Poll P&L</TableHead>
                  <TableHead className="text-right">Contest P&L</TableHead>
                  <TableHead className="text-right">Market P&L</TableHead>
                  <TableHead className="text-right">Total P&L</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userData.map(u => {
                  const excluded = excludedUsers.has(u.userId);
                  const pnlCents = toCents(u.totalPnl);
                  return (
                    <TableRow key={u.userId} className={excluded ? "opacity-40" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={!excluded}
                          onCheckedChange={() => toggleExclude(u.userId)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className={`text-right font-mono text-xs ${u.pollPnl > 0 ? "text-green-600" : u.pollPnl < 0 ? "text-red-500" : ""}`}>
                        {u.pollPnl !== 0 ? (u.pollPnl > 0 ? "+" : "") + formatCents(toCents(u.pollPnl)) : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-xs ${u.contestPnl > 0 ? "text-green-600" : u.contestPnl < 0 ? "text-red-500" : ""}`}>
                        {u.contestPnl !== 0 ? (u.contestPnl > 0 ? "+" : "") + formatCents(toCents(u.contestPnl)) : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-xs ${u.marketPnl > 0 ? "text-green-600" : u.marketPnl < 0 ? "text-red-500" : ""}`}>
                        {u.marketPnl !== 0 ? (u.marketPnl > 0 ? "+" : "") + formatCents(toCents(u.marketPnl)) : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${pnlCents > 0 ? "text-green-600" : pnlCents < 0 ? "text-red-500" : ""}`}>
                        {pnlCents > 0 ? "+" : ""}{formatCents(pnlCents)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={pnlCents > 0 ? "default" : pnlCents < 0 ? "destructive" : "secondary"}>
                          {pnlCents > 0 ? "Won" : pnlCents < 0 ? "Lost" : "Even"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimplifiedDebtsPanel;
