import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, ArrowRight, PartyPopper, DollarSign, Users, Wallet, UserMinus, Globe, Download } from "lucide-react";
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
  marketStaked: number;
  marketPnl: number;
  totalStaked: number;
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
      const [profilesRes, pollStakesRes, pollWinningsRes, pollRefundsRes, contestBuyinsRes, contestWinningsRes, marketPnlRes, marketStakesRes] = await Promise.all([
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
        // Market stakes from all positions (entry_price * size = cost)
        supabase.from("positions").select("user_id, entry_price, size"),
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

      // Aggregate market stakes (entry_price * size)
      const marketStakesMap = new Map<string, number>();
      if (marketStakesRes.data) {
        for (const p of marketStakesRes.data) {
          const stake = Number(p.entry_price || 0) * Number(p.size || 0);
          marketStakesMap.set(p.user_id, (marketStakesMap.get(p.user_id) || 0) + stake);
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

  const REGIONS = ["India", "EU", "NA", "SEA", "Middle East", "Africa", "Other"];

  const handleSetRegion = async (userId: string, region: string) => {
    const { error } = await supabase.from("profiles").update({ region } as any).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: "Failed to update region", variant: "destructive" });
      return;
    }
    setUserData(prev => prev.map(u => u.userId === userId ? { ...u, region } : u));
    toast({ title: "Region updated" });
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

  const toBalances = (users: UserPnL[]): UserBalance[] => {
    return users
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
  };

  /**
   * Regional P&L won't sum to zero because users trade cross-region.
   * Scale down the larger side (winners or losers) proportionally so
   * the pool balances without flipping anyone's direction.
   */
  const balanceForRegion = (raw: UserBalance[]): { balances: UserBalance[]; crossRegionImbalanceCents: number } => {
    const totalCredits = raw.filter(b => b.netBalanceCents > 0).reduce((s, b) => s + b.netBalanceCents, 0);
    const totalDebts = Math.abs(raw.filter(b => b.netBalanceCents < 0).reduce((s, b) => s + b.netBalanceCents, 0));

    if (totalCredits === 0 || totalDebts === 0) {
      return { balances: raw, crossRegionImbalanceCents: Math.abs(totalCredits - totalDebts) };
    }

    const imbalance = totalCredits - totalDebts;
    if (Math.abs(imbalance) < 2) {
      return { balances: raw, crossRegionImbalanceCents: 0 };
    }

    // Scale down the larger side to match the smaller side
    const settleableAmount = Math.min(totalCredits, totalDebts);
    const adjusted = raw.map(b => {
      if (imbalance > 0 && b.netBalanceCents > 0) {
        // More credits than debts — scale winners down
        return { ...b, netBalanceCents: Math.round(b.netBalanceCents * (settleableAmount / totalCredits)) };
      } else if (imbalance < 0 && b.netBalanceCents < 0) {
        // More debts than credits — scale losers down (less negative)
        return { ...b, netBalanceCents: Math.round(b.netBalanceCents * (settleableAmount / totalDebts)) };
      }
      return b;
    });

    return { balances: adjusted, crossRegionImbalanceCents: Math.abs(imbalance) };
  };

  // When a specific region is selected, compute single settlement
  const rawBalances: UserBalance[] = useMemo(() => toBalances(filteredUserData), [filteredUserData, excludedUsers]);
  const { balances, crossRegionImbalanceCents } = useMemo(() => balanceForRegion(rawBalances), [rawBalances]);
  const settlement = useMemo(() => computeSimplifiedDebts(balances), [balances]);

  // When "all" is selected, compute per-region settlements
  const perRegionSettlements = useMemo(() => {
    if (selectedRegion !== "all") return [];
    return availableRegions.map(region => {
      const regionUsers = userData.filter(u => u.region === region);
      const rawRegionBalances = toBalances(regionUsers);
      const { balances: regionBalances, crossRegionImbalanceCents: regionImbalance } = balanceForRegion(rawRegionBalances);
      return {
        region,
        rawBalances: rawRegionBalances,
        balances: regionBalances,
        settlement: computeSimplifiedDebts(regionBalances),
        crossRegionImbalanceCents: regionImbalance,
      };
    }).filter(r => r.balances.length > 0);
  }, [userData, availableRegions, excludedUsers, selectedRegion]);

  const handleDownloadExcel = () => {
    const rows: string[][] = [];
    rows.push(["Region", "User", "Global P&L", "Settleable", "Receiving", "Paying", "Remaining", "Status"]);

    const processRegion = (region: string, regionRawBalances: UserBalance[], regionBalances: UserBalance[], regionSettlement: ReturnType<typeof computeSimplifiedDebts>) => {
      regionBalances
        .filter(b => Math.abs(b.netBalanceCents) > 0)
        .sort((a, b) => b.netBalanceCents - a.netBalanceCents)
        .forEach(b => {
          const rawBalance = regionRawBalances.find(r => r.userId === b.userId);
          const globalPnl = rawBalance?.netBalanceCents ?? b.netBalanceCents;
          const receiving = regionSettlement.transfers.filter(t => t.toUserId === b.userId).reduce((s, t) => s + t.amountCents, 0);
          const paying = regionSettlement.transfers.filter(t => t.fromUserId === b.userId).reduce((s, t) => s + t.amountCents, 0);
          const isWinner = globalPnl > 0;
          const remaining = globalPnl - (isWinner ? receiving : -paying);
          const isFullySettled = Math.abs(remaining) < 2;
          rows.push([
            region,
            b.name,
            formatCents(globalPnl),
            formatCents(b.netBalanceCents),
            receiving > 0 ? formatCents(receiving) : "—",
            paying > 0 ? formatCents(paying) : "—",
            isFullySettled ? "$0.00" : (remaining > 0 ? `Gets ${formatCents(remaining)}` : `Owes ${formatCents(Math.abs(remaining))}`),
            isFullySettled ? "Settled" : "Pending",
          ]);
        });

      // Add transfers
      if (regionSettlement.transfers.length > 0) {
        rows.push([]);
        rows.push([`${region} — Transfers`, "From", "To", "Amount"]);
        regionSettlement.transfers.forEach(t => {
          rows.push(["", t.fromName, t.toName, formatCents(t.amountCents)]);
        });
        rows.push([]);
      }
    };

    if (selectedRegion === "all") {
      perRegionSettlements.forEach(({ region, rawBalances: rb, balances: rb2, settlement: rs }) => {
        processRegion(region, rb, rb2, rs);
      });
    } else {
      processRegion(selectedRegion === "unset" ? "No Region" : selectedRegion, rawBalances, balances, settlement);
    }

    const csv = rows.map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `settlement-${selectedRegion}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "Settlement CSV exported" });
  };

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
      {/* Region Filter + Download */}
      <div className="flex items-center gap-3 flex-wrap">
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
        <Button variant="outline" size="sm" onClick={handleDownloadExcel} className="ml-auto gap-2">
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
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

      {/* Settle Up Section - Per Region when "all", single when specific region */}
      {selectedRegion === "all" ? (
        perRegionSettlements.length > 0 ? (
          <div className="space-y-4">
            {perRegionSettlements.map(({ region, rawBalances: regionRawBalances, balances: regionBalances, settlement: regionSettlement, crossRegionImbalanceCents: regionImbalance }) => (
              <Card key={region}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      {region} — Settle Up
                    </CardTitle>
                    {!regionSettlement.allSettled && (
                      <Button variant="outline" size="sm" onClick={() => {
                        const text = regionSettlement.transfers
                          .map(t => `${t.fromName} pays ${t.toName} ${formatCents(t.amountCents)}`)
                          .join("\n");
                        navigator.clipboard.writeText(`${region}:\n${text}`);
                        toast({ title: "Copied!", description: `${region} transfers copied` });
                      }}>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {regionImbalance > 0 && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                      ⚠️ Cross-region imbalance: {formatCents(regionImbalance)} of P&L is from activity with users outside {region}. 
                      Settlements are scaled to what can be settled within this region.
                    </div>
                  )}
                  {regionSettlement.allSettled ? (
                    <div className="text-center py-4">
                      <PartyPopper className="h-8 w-8 mx-auto mb-2 text-accent" />
                      <p className="text-sm font-semibold">All settled in {region} 🎉</p>
                    </div>
                  ) : (
                    <>
                      {/* Per-user summary */}
                      <div className="rounded-lg border overflow-x-auto">
                        <Table>
                          <TableHeader>
                          <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead className="text-right">Global P&L</TableHead>
                              <TableHead className="text-right">Settleable</TableHead>
                              <TableHead className="text-right">Receiving</TableHead>
                              <TableHead className="text-right">Paying</TableHead>
                              <TableHead className="text-right">Remaining</TableHead>
                              <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const rows = regionBalances
                                .filter(b => Math.abs(b.netBalanceCents) > 0)
                                .sort((a, b) => b.netBalanceCents - a.netBalanceCents)
                                .map(b => {
                                  const rawBalance = regionRawBalances.find(r => r.userId === b.userId);
                                  const globalPnl = rawBalance?.netBalanceCents ?? b.netBalanceCents;
                                  const receiving = regionSettlement.transfers
                                    .filter(t => t.toUserId === b.userId)
                                    .reduce((s, t) => s + t.amountCents, 0);
                                  const paying = regionSettlement.transfers
                                    .filter(t => t.fromUserId === b.userId)
                                    .reduce((s, t) => s + t.amountCents, 0);
                                  const isWinner = globalPnl > 0;
                                  // Remaining = global P&L minus what's settleable in this region
                                  const remaining = globalPnl - (isWinner ? receiving : -paying);
                                  const isFullySettled = Math.abs(remaining) < 2;
                                  return { b, globalPnl, receiving, paying, remaining, isFullySettled, isWinner };
                                });
                              const stillOwedCount = rows.filter(r => !r.isFullySettled && r.isWinner).length;
                              const stillOwesCount = rows.filter(r => !r.isFullySettled && !r.isWinner).length;
                              return (
                                <>
                                  {rows.map(({ b, globalPnl, receiving, paying, remaining, isFullySettled, isWinner }) => (
                                    <TableRow key={b.userId}>
                                      <TableCell className="font-medium text-sm">{b.name}</TableCell>
                                      <TableCell className={`text-right font-mono text-xs ${globalPnl > 0 ? "text-green-600" : "text-red-500"}`}>
                                        {globalPnl > 0 ? "+" : ""}{formatCents(globalPnl)}
                                      </TableCell>
                                      <TableCell className={`text-right font-mono text-sm font-bold ${isWinner ? "text-green-600" : "text-red-500"}`}>
                                        {isWinner ? "+" : ""}{formatCents(b.netBalanceCents)}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-sm text-green-600">
                                        {receiving > 0 ? formatCents(receiving) : "—"}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-sm text-red-500">
                                        {paying > 0 ? formatCents(paying) : "—"}
                                      </TableCell>
                                      <TableCell className={`text-right font-mono text-sm font-bold ${isFullySettled ? "text-muted-foreground" : remaining > 0 ? "text-green-600" : "text-red-500"}`}>
                                        {isFullySettled ? "$0.00" : (remaining > 0 ? `Gets ${formatCents(remaining)}` : `Owes ${formatCents(Math.abs(remaining))}`)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Badge variant={isFullySettled ? "default" : "destructive"} className="text-xs">
                                          {isFullySettled ? "✓ Settled" : "Pending"}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {(stillOwedCount > 0 || stillOwesCount > 0) && (
                                    <TableRow>
                                      <TableCell colSpan={7} className="text-xs text-muted-foreground pt-2">
                                        ⚠️ {stillOwedCount > 0 && `${stillOwedCount} user${stillOwedCount !== 1 ? "s" : ""} still owed money`}
                                        {stillOwedCount > 0 && stillOwesCount > 0 && " · "}
                                        {stillOwesCount > 0 && `${stillOwesCount} user${stillOwesCount !== 1 ? "s" : ""} still need${stillOwesCount === 1 ? "s" : ""} to pay more`}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </>
                              );
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                      {/* Transfer list */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Transfers:</p>
                        {regionSettlement.transfers.map((t, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border">
                            <Badge variant="destructive" className="shrink-0 text-xs">{t.fromName}</Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Badge variant="secondary" className="shrink-0 text-xs">{t.toName}</Badge>
                            <span className="ml-auto font-bold text-sm">{formatCents(t.amountCents)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No users with regions assigned yet.</p>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Settle Up{selectedRegion !== "unset" ? ` — ${selectedRegion}` : ""}</CardTitle>
              {!settlement.allSettled && (
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on resolved polls, contests & markets only. Region-locked settlement.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {crossRegionImbalanceCents > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ Cross-region imbalance: {formatCents(crossRegionImbalanceCents)} of P&L is from activity with users outside this region. 
                Settlements are scaled to what can be settled within this region.
              </div>
            )}
            {settlement.allSettled ? (
              <div className="text-center py-8">
                <PartyPopper className="h-12 w-12 mx-auto mb-3 text-accent" />
                <p className="text-lg font-semibold">All settled 🎉</p>
                <p className="text-sm text-muted-foreground">No transfers needed</p>
              </div>
            ) : (
              <>
                {/* Per-user summary */}
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Net P&L</TableHead>
                        <TableHead className="text-right">Receiving</TableHead>
                        <TableHead className="text-right">Paying</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const rows = balances
                          .filter(b => Math.abs(b.netBalanceCents) > 0)
                          .sort((a, b) => b.netBalanceCents - a.netBalanceCents)
                          .map(b => {
                            const receiving = settlement.transfers
                              .filter(t => t.toUserId === b.userId)
                              .reduce((s, t) => s + t.amountCents, 0);
                            const paying = settlement.transfers
                              .filter(t => t.fromUserId === b.userId)
                              .reduce((s, t) => s + t.amountCents, 0);
                            const expected = Math.abs(b.netBalanceCents);
                            const actual = b.netBalanceCents > 0 ? receiving : paying;
                            const gap = expected - actual;
                            const isFullySettled = Math.abs(gap) < 2;
                            const isWinner = b.netBalanceCents > 0;
                            const remaining = isWinner ? gap : -gap;
                            return { b, receiving, paying, remaining, isFullySettled, isWinner };
                          });
                        const stillOwedCount = rows.filter(r => !r.isFullySettled && r.isWinner).length;
                        const stillOwesCount = rows.filter(r => !r.isFullySettled && !r.isWinner).length;
                        return (
                          <>
                            {rows.map(({ b, receiving, paying, remaining, isFullySettled, isWinner }) => (
                              <TableRow key={b.userId}>
                                <TableCell className="font-medium text-sm">{b.name}</TableCell>
                                <TableCell className={`text-right font-mono text-sm font-bold ${isWinner ? "text-green-600" : "text-red-500"}`}>
                                  {isWinner ? "+" : ""}{formatCents(b.netBalanceCents)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-green-600">
                                  {receiving > 0 ? formatCents(receiving) : "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-red-500">
                                  {paying > 0 ? formatCents(paying) : "—"}
                                </TableCell>
                                <TableCell className={`text-right font-mono text-sm font-bold ${isFullySettled ? "text-muted-foreground" : remaining > 0 ? "text-green-600" : "text-red-500"}`}>
                                  {isFullySettled ? "$0.00" : (remaining > 0 ? `Gets ${formatCents(remaining)}` : `Owes ${formatCents(Math.abs(remaining))}`)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={isFullySettled ? "default" : "destructive"} className="text-xs">
                                    {isFullySettled ? "✓ Settled" : "Pending"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                            {(stillOwedCount > 0 || stillOwesCount > 0) && (
                              <TableRow>
                                <TableCell colSpan={6} className="text-xs text-muted-foreground pt-2">
                                  ⚠️ {stillOwedCount > 0 && `${stillOwedCount} user${stillOwedCount !== 1 ? "s" : ""} still owed money`}
                                  {stillOwedCount > 0 && stillOwesCount > 0 && " · "}
                                  {stillOwesCount > 0 && `${stillOwesCount} user${stillOwesCount !== 1 ? "s" : ""} still need${stillOwesCount === 1 ? "s" : ""} to pay more`}
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </div>
                {/* Transfer list */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Transfers:</p>
                  {settlement.transfers.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                      <Badge variant="destructive" className="shrink-0 text-xs">{t.fromName}</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Badge variant="secondary" className="shrink-0 text-xs">{t.toName}</Badge>
                      <span className="ml-auto font-bold text-sm">{formatCents(t.amountCents)}</span>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-2">
                    {settlement.transfers.length} transfer{settlement.transfers.length !== 1 ? "s" : ""} to settle all debts
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

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
                   <TableHead>Region</TableHead>
                   <TableHead className="text-right">Poll P&L</TableHead>
                   <TableHead className="text-right">Contest P&L</TableHead>
                   <TableHead className="text-right">Market P&L</TableHead>
                   <TableHead className="text-right">Total P&L</TableHead>
                   <TableHead className="text-right">Status</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredUserData.map(u => {
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
                       <TableCell>
                         <Select value={u.region || ""} onValueChange={(val) => handleSetRegion(u.userId, val)}>
                           <SelectTrigger className="h-7 w-28 text-xs">
                             <SelectValue placeholder="Set region" />
                           </SelectTrigger>
                           <SelectContent>
                             {REGIONS.map(r => (
                               <SelectItem key={r} value={r}>{r}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </TableCell>
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
