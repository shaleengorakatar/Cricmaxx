import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, ArrowRight, PartyPopper, DollarSign, Users, Wallet } from "lucide-react";
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
      // Use profiles.balance as the single source of truth
      // It already reflects all deposits, withdrawals, poll/contest/market P&L
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, display_name, balance");

      if (!profiles) return;

      const activeUsers: UserData[] = profiles
        .filter(p => (Number(p.balance) || 0) !== 0)
        .map(p => ({
          userId: p.id,
          name: p.display_name || p.name,
          balance: Number(p.balance) || 0,
        }));

      setUserData(activeUsers);
    } catch (err) {
      console.error("Error fetching simplified debts data:", err);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const balances: UserBalance[] = useMemo(() => {
    return userData.map(u => ({
      userId: u.userId,
      name: u.name,
      depositedCents: 0,
      withdrawnCents: 0,
      pollPnlCents: 0,
      contestPnlCents: 0,
      marketPnlCents: 0,
      // Balance IS the net position: positive = owed money, negative = owes money
      netBalanceCents: toCents(u.balance),
    }));
  }, [userData]);

  const settlement = useMemo(() => computeSimplifiedDebts(balances), [balances]);

  const totalBalanceCents = useMemo(
    () => balances.reduce((s, b) => s + b.netBalanceCents, 0),
    [balances]
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
              <p className="text-xs text-muted-foreground">Total Pool (All Balances)</p>
            </div>
            <p className="text-lg font-bold">{formatCents(totalBalanceCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Owed (Creditors)</p>
            </div>
            <p className="text-lg font-bold">{formatCents(settlement.totalOwedCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Users Owed</p>
            </div>
            <p className="text-lg font-bold">{creditorCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Transfers Needed</p>
            </div>
            <p className="text-lg font-bold">{settlement.transfers.length}</p>
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
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...balances]
                  .sort((a, b) => b.netBalanceCents - a.netBalanceCents)
                  .map(b => (
                    <TableRow key={b.userId}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCents(b.netBalanceCents)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={b.netBalanceCents > 0 ? "default" : b.netBalanceCents < 0 ? "destructive" : "secondary"}>
                          {b.netBalanceCents > 0 ? "Owed" : b.netBalanceCents < 0 ? "Owes" : "Settled"}
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
