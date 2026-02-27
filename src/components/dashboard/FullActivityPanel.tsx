import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, TrendingUp, TrendingDown, Vote, Swords, BarChart3,
  ArrowRight, DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Types ─────────────────────────────────────────── */

interface PollRecord {
  pollId: string;
  question: string;
  staked: number;
  won: number;
  refunded: number;
  pnl: number;
  result: "won" | "lost" | "refunded" | "active";
}

interface ContestRecord {
  contestId: string;
  title: string;
  buyIn: number;
  payout: number;
  pnl: number;
  rank: number | null;
  result: "won" | "lost" | "active";
}

interface MarketRecord {
  positionId: string;
  question: string;
  side: string;
  size: number;
  entryPrice: number;
  pnl: number;
  result: "won" | "lost" | "active";
}

interface CategoryStats {
  totalPnl: number;
  wins: number;
  losses: number;
  active: number;
  total: number;
}

/* ── Component ─────────────────────────────────────── */

const FullActivityPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pollRecords, setPollRecords] = useState<PollRecord[]>([]);
  const [contestRecords, setContestRecords] = useState<ContestRecord[]>([]);
  const [marketRecords, setMarketRecords] = useState<MarketRecord[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    fetchAll(user.id);
  }, [user?.id]);

  const fetchAll = async (userId: string) => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPolls(userId),
        fetchContests(userId),
        fetchMarkets(userId),
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* ── Polls ──────────────────── */
  const fetchPolls = async (userId: string) => {
    const [{ data: votes }, { data: winnings }, { data: refunds }] = await Promise.all([
      supabase
        .from("poll_votes")
        .select("poll_id, option_id, amount")
        .eq("user_id", userId),
      supabase
        .from("transactions")
        .select("amount, metadata")
        .eq("user_id", userId)
        .eq("metadata->>source", "poll_winnings"),
      supabase
        .from("transactions")
        .select("amount, metadata")
        .eq("user_id", userId)
        .eq("metadata->>source", "poll_refund"),
    ]);

    if (!votes?.length) { setPollRecords([]); return; }

    const pollIds = [...new Set(votes.map(v => v.poll_id))];
    const { data: polls } = await supabase
      .from("prediction_polls")
      .select("id, question, status, winning_option_id")
      .in("id", pollIds);

    // Map winnings by poll_id from metadata
    const winByPoll = new Map<string, number>();
    for (const w of winnings || []) {
      const pid = (w.metadata as any)?.poll_id;
      if (pid) winByPoll.set(pid, (winByPoll.get(pid) || 0) + Number(w.amount));
    }

    const refundByPoll = new Map<string, number>();
    for (const r of refunds || []) {
      const pid = (r.metadata as any)?.poll_id;
      if (pid) refundByPoll.set(pid, (refundByPoll.get(pid) || 0) + Number(r.amount));
    }

    const pollMap = new Map((polls || []).map(p => [p.id, p]));
    const grouped = new Map<string, { staked: number; optionIds: string[] }>();
    for (const v of votes) {
      const g = grouped.get(v.poll_id) || { staked: 0, optionIds: [] };
      g.staked += Number(v.amount);
      g.optionIds.push(v.option_id);
      grouped.set(v.poll_id, g);
    }

    const records: PollRecord[] = [];
    for (const [pollId, g] of grouped) {
      const poll = pollMap.get(pollId);
      const won = winByPoll.get(pollId) || 0;
      const refunded = refundByPoll.get(pollId) || 0;

      let result: PollRecord["result"] = "active";
      if (poll?.status === "resolved") {
        if (refunded > 0 && won === 0) result = "refunded";
        else if (won > 0) result = "won";
        else result = "lost";
      }

      const effectiveStake = g.staked - refunded;
      const pnl = won - effectiveStake;

      records.push({
        pollId,
        question: poll?.question || "Poll",
        staked: g.staked,
        won,
        refunded,
        pnl: result === "active" ? 0 : pnl,
        result,
      });
    }

    records.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
    setPollRecords(records);
  };

  /* ── Contests ──────────────────── */
  const fetchContests = async (userId: string) => {
    const { data: entries } = await supabase
      .from("contest_entries")
      .select("contest_id, rank, payout, prediction_contests(title, status, buy_in_amount)")
      .eq("user_id", userId);

    if (!entries?.length) { setContestRecords([]); return; }

    const records: ContestRecord[] = entries.map((e: any) => {
      const contest = e.prediction_contests;
      const buyIn = Number(contest?.buy_in_amount || 0);
      const payout = Number(e.payout || 0);
      const isResolved = contest?.status === "resolved";

      let result: ContestRecord["result"] = "active";
      if (isResolved) {
        result = payout > 0 ? "won" : "lost";
      }

      return {
        contestId: e.contest_id,
        title: contest?.title || "Contest",
        buyIn,
        payout,
        pnl: isResolved ? payout - buyIn : 0,
        rank: e.rank,
        result,
      };
    });

    records.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
    setContestRecords(records);
  };

  /* ── Markets ──────────────────── */
  const fetchMarkets = async (userId: string) => {
    const { data: positions } = await supabase
      .from("positions")
      .select("id, side, size, entry_price, pnl, status, markets(question)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!positions?.length) { setMarketRecords([]); return; }

    const records: MarketRecord[] = positions.map((p: any) => {
      const pnl = Number(p.pnl || 0);
      let result: MarketRecord["result"] = "active";
      if (p.status === "closed") {
        result = pnl >= 0 ? "won" : "lost";
      }

      return {
        positionId: p.id,
        question: p.markets?.question || "Market",
        side: p.side,
        size: Number(p.size),
        entryPrice: Number(p.entry_price),
        pnl: p.status === "closed" ? pnl : 0,
        result,
      };
    });

    setMarketRecords(records);
  };

  /* ── Stats helpers ──────────────────── */
  const calcStats = (
    records: { pnl: number; result: string }[]
  ): CategoryStats => {
    const resolved = records.filter(r => r.result !== "active" && r.result !== "refunded");
    return {
      totalPnl: resolved.reduce((s, r) => s + r.pnl, 0),
      wins: resolved.filter(r => r.result === "won").length,
      losses: resolved.filter(r => r.result === "lost").length,
      active: records.filter(r => r.result === "active").length,
      total: resolved.length,
    };
  };

  const pollStats = calcStats(pollRecords);
  const contestStats = calcStats(contestRecords);
  const marketStats = calcStats(marketRecords);
  const totalPnl = pollStats.totalPnl + contestStats.totalPnl + marketStats.totalPnl;
  const totalWins = pollStats.wins + contestStats.wins + marketStats.wins;
  const totalLosses = pollStats.losses + contestStats.losses + marketStats.losses;

  if (loading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      {/* Overall Summary */}
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-accent" />
        <h3 className="font-semibold text-foreground">Profit & Loss Overview</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
          <p className={`text-xl font-bold ${totalPnl >= 0 ? "text-green-600" : "text-red-500"}`}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(0)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Win / Loss</p>
          <p className="text-xl font-bold text-foreground">
            <span className="text-green-600">{totalWins}</span>
            {" / "}
            <span className="text-red-500">{totalLosses}</span>
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
          <p className="text-xl font-bold text-foreground">
            {totalWins + totalLosses > 0
              ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(0)
              : 0}%
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Active</p>
          <p className="text-xl font-bold text-accent">
            {pollStats.active + contestStats.active + marketStats.active}
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs defaultValue="polls" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="polls" className="text-xs sm:text-sm gap-1">
            <Vote className="h-3.5 w-3.5 hidden sm:inline" />
            Polls
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{pollRecords.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="contests" className="text-xs sm:text-sm gap-1">
            <Swords className="h-3.5 w-3.5 hidden sm:inline" />
            Contests
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{contestRecords.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="markets" className="text-xs sm:text-sm gap-1">
            <TrendingUp className="h-3.5 w-3.5 hidden sm:inline" />
            Markets
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{marketRecords.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ── Polls Tab ──────────────────── */}
        <TabsContent value="polls">
          <CategoryHeader stats={pollStats} label="Polls" />
          {pollRecords.length === 0 ? (
            <EmptyState label="polls" onClick={() => navigate("/polls")} />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {pollRecords.map(r => (
                <div
                  key={r.pollId}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/polls?highlight=${r.pollId}`)}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{r.question}</p>
                    <p className="text-xs text-muted-foreground">
                      Staked: {r.staked}{r.won > 0 ? ` · Won: ${r.won}` : ""}{r.refunded > 0 ? ` · Refunded: ${r.refunded}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.result !== "active" && r.result !== "refunded" && (
                      <span className={`text-sm font-bold ${r.pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {r.pnl >= 0 ? "+" : ""}{r.pnl.toFixed(0)}
                      </span>
                    )}
                    <ResultBadge result={r.result} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Contests Tab ──────────────────── */}
        <TabsContent value="contests">
          <CategoryHeader stats={contestStats} label="Contests" />
          {contestRecords.length === 0 ? (
            <EmptyState label="contests" onClick={() => navigate("/contests")} />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {contestRecords.map(r => (
                <div
                  key={r.contestId}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Buy-in: {r.buyIn}{r.payout > 0 ? ` · Payout: ${r.payout}` : ""}
                      {r.rank ? ` · Rank: #${r.rank}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.result !== "active" && (
                      <span className={`text-sm font-bold ${r.pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {r.pnl >= 0 ? "+" : ""}{r.pnl.toFixed(0)}
                      </span>
                    )}
                    <ResultBadge result={r.result} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Markets Tab ──────────────────── */}
        <TabsContent value="markets">
          <CategoryHeader stats={marketStats} label="Markets" />
          {marketRecords.length === 0 ? (
            <EmptyState label="markets" onClick={() => navigate("/markets")} />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {marketRecords.map(r => (
                <div
                  key={r.positionId}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge variant={r.side === "yes" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {r.side.toUpperCase()}
                      </Badge>
                      <p className="text-sm font-medium text-foreground truncate">{r.question}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.size} shares @ ${r.entryPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.result !== "active" && (
                      <span className={`text-sm font-bold ${r.pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {r.pnl >= 0 ? "+" : ""}{r.pnl.toFixed(2)}
                      </span>
                    )}
                    <ResultBadge result={r.result} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};

/* ── Sub-components ─────────────────────────────── */

const CategoryHeader = ({ stats, label }: { stats: CategoryStats; label: string }) => (
  <div className="grid grid-cols-4 gap-2 mb-3">
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <p className="text-[10px] text-muted-foreground">P&L</p>
      <p className={`text-sm font-bold ${stats.totalPnl >= 0 ? "text-green-600" : "text-red-500"}`}>
        {stats.totalPnl >= 0 ? "+" : ""}{stats.totalPnl.toFixed(0)}
      </p>
    </div>
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <p className="text-[10px] text-muted-foreground">Won</p>
      <p className="text-sm font-bold text-green-600">{stats.wins}</p>
    </div>
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <p className="text-[10px] text-muted-foreground">Lost</p>
      <p className="text-sm font-bold text-red-500">{stats.losses}</p>
    </div>
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <p className="text-[10px] text-muted-foreground">Active</p>
      <p className="text-sm font-bold text-accent">{stats.active}</p>
    </div>
  </div>
);

const ResultBadge = ({ result }: { result: string }) => {
  switch (result) {
    case "won":
      return (
        <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px]">
          <Trophy className="h-3 w-3 mr-0.5" /> Won
        </Badge>
      );
    case "lost":
      return (
        <Badge variant="destructive" className="text-[10px]">
          <TrendingDown className="h-3 w-3 mr-0.5" /> Lost
        </Badge>
      );
    case "refunded":
      return (
        <Badge variant="outline" className="text-[10px]">
          <DollarSign className="h-3 w-3 mr-0.5" /> Refunded
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">Active</Badge>
      );
  }
};

const EmptyState = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <div className="text-center py-6">
    <p className="text-sm text-muted-foreground mb-2">No {label} activity yet</p>
    <Button variant="outline" size="sm" onClick={onClick}>
      Browse {label} <ArrowRight className="h-3 w-3 ml-1" />
    </Button>
  </div>
);

export default FullActivityPanel;
