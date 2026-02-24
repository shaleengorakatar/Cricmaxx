import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Check, ArrowRight, PartyPopper, DollarSign, Users, Wallet, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  computeSimplifiedDebts,
  formatCents,
  toCents,
  type UserBalance,
} from "@/lib/settlementAlgorithm";

interface UserData {
  userId: string;
  name: string;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
}

const SimplifiedDebtsPanel = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData[]>([]);
  const [excludedUsers, setExcludedUsers] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch profiles and transaction summaries
      const [profilesRes, txRes] = await Promise.all([
        supabase.from("profiles").select("id, name, display_name, balance"),
        supabase.from("transactions").select("user_id, type, amount"),
      ]);

      if (!profilesRes.data || !txRes.data) return;

      // Aggregate deposits/withdrawals per user
      const txMap = new Map<string, { deposited: number; withdrawn: number }>();
      for (const tx of txRes.data) {
        const entry = txMap.get(tx.user_id) || { deposited: 0, withdrawn: 0 };
        if (tx.type === "deposit") entry.deposited += Number(tx.amount) || 0;
        else if (tx.type === "withdrawal") entry.withdrawn += Number(tx.amount) || 0;
        txMap.set(tx.user_id, entry);
      }

      const users: UserData[] = profilesRes.data
        .map(p => {
          const tx = txMap.get(p.id) || { deposited: 0, withdrawn: 0 };
          const balance = Number(p.balance) || 0;
          return {
            userId: p.id,
            name: p.display_name || p.name,
            balance,
            totalDeposited: tx.deposited,
            totalWithdrawn: tx.withdrawn,
          };
        })
        // Only include users with some activity
        .filter(u => u.balance !== 0 || u.totalDeposited !== 0 || u.totalWithdrawn !== 0);

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

  // Net position: how much the user is UP or DOWN relative to real money deposited
  // net = current_balance - (totalDeposited - totalWithdrawn)
  // positive = won money (creditor, owed payout)
  // negative = lost money (debtor, owes pool)
  const balances: UserBalance[] = useMemo(() => {
    return userData
      .filter(u => !excludedUsers.has(u.userId))
      .map(u => {
        const realMoneyIn = u.totalDeposited - u.totalWithdrawn; // net real cash put in
        const netPnl = u.balance - realMoneyIn; // profit/loss
        return {
          userId: u.userId,
          name: u.name,
          depositedCents: toCents(u.totalDeposited),
          withdrawnCents: toCents(u.totalWithdrawn),
          pollPnlCents: toCents(netPnl),
          contestPnlCents: 0,
          marketPnlCents: 0,
          // netBalance = what they can claim beyond their real deposits
          // positive = won money (owed), negative = lost money (owes)
          netBalanceCents: toCents(netPnl),
        };
      });
  }, [userData, excludedUsers]);

  const settlement = useMemo(() => computeSimplifiedDebts(balances), [balances]);

  const totalPoolCents = useMemo(
    () => userData.filter(u => !excludedUsers.has(u.userId)).reduce((s, u) => s + toCents(u.balance), 0),
    [userData, excludedUsers]
  );

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
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">In-App Balances</p>
            </div>
            <p className="text-lg font-bold">{formatCents(totalPoolCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Owed (Winners)</p>
            </div>
            <p className="text-lg font-bold">{formatCents(settlement.totalOwedCents)}</p>
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

      {excludedUsers.size > 0 && (
        <p className="text-xs text-muted-foreground">
          {excludedUsers.size} user(s) excluded from settlement calculation.
        </p>
      )}

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
          <p className="text-xs text-muted-foreground">
            Net P&L = Current Balance − (Deposited − Withdrawn). Positive = won money. Uncheck to exclude from settlement.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Inc.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Deposited</TableHead>
                  <TableHead className="text-right">Withdrawn</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Net P&L</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...userData]
                  .sort((a, b) => {
                    const netA = a.balance - (a.totalDeposited - a.totalWithdrawn);
                    const netB = b.balance - (b.totalDeposited - b.totalWithdrawn);
                    return netB - netA;
                  })
                  .map(u => {
                    const netPnl = u.balance - (u.totalDeposited - u.totalWithdrawn);
                    const netCents = toCents(netPnl);
                    const excluded = excludedUsers.has(u.userId);
                    return (
                      <TableRow key={u.userId} className={excluded ? "opacity-40" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={!excluded}
                            onCheckedChange={() => toggleExclude(u.userId)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCents(toCents(u.totalDeposited))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCents(toCents(u.totalWithdrawn))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCents(toCents(u.balance))}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold ${netCents > 0 ? "text-green-600" : netCents < 0 ? "text-red-500" : ""}`}>
                          {netCents > 0 ? "+" : ""}{formatCents(netCents)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={netCents > 0 ? "default" : netCents < 0 ? "destructive" : "secondary"}>
                            {netCents > 0 ? "Won" : netCents < 0 ? "Lost" : "Even"}
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
