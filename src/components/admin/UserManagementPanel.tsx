import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, ShieldCheck, Sparkles, Loader2, Search, Crown, ChevronLeft, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  region: string | null;
  created_at: string;
  kyc_verified: boolean;
  balance: number;
  roles: ('trader' | 'creator' | 'admin')[];
  totalVolume: number;
}

interface PollHistory {
  poll_question: string;
  option_text: string;
  amount: number;
  poll_status: string;
  won: boolean;
  payout: number;
  created_at: string;
}

interface ContestHistory {
  contest_title: string;
  buy_in: number;
  score: number;
  rank: number | null;
  payout: number | null;
  status: string;
  created_at: string;
}

interface UserTradeStats {
  pendingOrders: number;
  completedTrades: number;
  resolvedPositions: number;
  tokensWon: number;
  tokensLost: number;
  totalDeposits: number;
  positions: Array<{
    market_question: string;
    side: string;
    size: number;
    entry_price: number;
    status: string;
    pnl: number | null;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    balance_after: number;
    created_at: string;
  }>;
  pollHistory: PollHistory[];
  contestHistory: ContestHistory[];
}

const UserManagementPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Fetch all users
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, name, username, region, created_at, kyc_verified, balance')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap = new Map<string, ('trader' | 'creator' | 'admin')[]>();
      roles?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        roleMap.set(r.user_id, [...existing, r.role as 'trader' | 'creator' | 'admin']);
      });

      const { data: positions } = await supabase
        .from('positions')
        .select('user_id, size, entry_price');

      const volumeMap = new Map<string, number>();
      positions?.forEach(p => {
        const current = volumeMap.get(p.user_id) || 0;
        volumeMap.set(p.user_id, current + (Number(p.size) * Number(p.entry_price)));
      });

      return profiles?.map(profile => ({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        username: profile.username,
        region: (profile as any).region || null,
        created_at: profile.created_at,
        kyc_verified: profile.kyc_verified || false,
        balance: profile.balance || 0,
        roles: roleMap.get(profile.id) || ['trader'],
        totalVolume: volumeMap.get(profile.id) || 0,
      })) as AdminUser[];
    },
    refetchInterval: 60000,
  });

  // Fetch detailed stats for selected user
  const { data: userStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['admin-user-detail', selectedUserId],
    queryFn: async (): Promise<UserTradeStats> => {
      if (!selectedUserId) throw new Error("No user selected");

      const [ordersRes, tradesRes, positionsRes, transactionsRes, pollVotesRes, contestEntriesRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status')
          .eq('user_id', selectedUserId),
        supabase
          .from('trades')
          .select('id, buyer_id, seller_id')
          .or(`buyer_id.eq.${selectedUserId},seller_id.eq.${selectedUserId}`),
        supabase
          .from('positions')
          .select('market_id, side, size, entry_price, status, pnl')
          .eq('user_id', selectedUserId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('transactions')
          .select('id, type, amount, balance_after, created_at, metadata')
          .eq('user_id', selectedUserId)
          .order('created_at', { ascending: false })
          .limit(100),
        // Poll votes with poll & option details
        supabase
          .from('poll_votes')
          .select('id, amount, created_at, option_id, poll_id, poll_options(option_text), prediction_polls(question, status, winning_option_id, total_pool)')
          .eq('user_id', selectedUserId)
          .order('created_at', { ascending: false })
          .limit(50),
        // Contest entries
        supabase
          .from('contest_entries')
          .select('id, score, total_points, rank, payout, created_at, contest_id, prediction_contests(title, status, buy_in_amount)')
          .eq('user_id', selectedUserId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      // Fetch market questions for positions
      const marketIds = [...new Set(positionsRes.data?.map(p => p.market_id) || [])];
      const { data: markets } = marketIds.length > 0
        ? await supabase.from('markets').select('id, question').in('id', marketIds)
        : { data: [] };

      const marketMap = new Map<string, string>(markets?.map(m => [m.id, m.question] as [string, string]) || []);

      const pendingOrders = ordersRes.data?.filter(o => o.status === 'pending' || o.status === 'partial').length || 0;
      const completedTrades = tradesRes.data?.length || 0;
      const resolvedPositions = positionsRes.data?.filter(p => p.status === 'closed').length || 0;

      const closedPositions = positionsRes.data?.filter(p => p.status === 'closed' && p.pnl !== null) || [];
      const marketTokensWon = closedPositions.filter(p => (p.pnl || 0) > 0).reduce((sum, p) => sum + (p.pnl || 0), 0);
      const marketTokensLost = Math.abs(closedPositions.filter(p => (p.pnl || 0) < 0).reduce((sum, p) => sum + (p.pnl || 0), 0));

      // Poll winnings/losses - calculate NET profit per poll
      const allTransactions = transactionsRes.data || [];
      const pollVotes = pollVotesRes.data || [];
      
      // Build a map of poll_id -> payout amount from transactions
      const pollPayoutMap = new Map<string, number>();
      allTransactions.forEach(t => {
        const meta = t.metadata as any;
        if (meta?.source === 'poll_winnings') {
          const pollId = meta?.poll_id;
          if (pollId) {
            pollPayoutMap.set(pollId, (pollPayoutMap.get(pollId) || 0) + Number(t.amount));
          }
        }
      });

      // Build a map of poll_id -> refund amount
      const pollRefundMap = new Map<string, number>();
      allTransactions.forEach(t => {
        const meta = t.metadata as any;
        if (meta?.source === 'poll_refund') {
          const pollId = meta?.poll_id;
          if (pollId) {
            pollRefundMap.set(pollId, (pollRefundMap.get(pollId) || 0) + Number(t.amount));
          }
        }
      });

      // Calculate net poll P&L per poll
      let pollNetWinnings = 0;
      let pollLosses = 0;
      pollVotes.forEach((vote: any) => {
        const poll = vote.prediction_polls;
        const stake = Number(vote.amount);
        const pollId = vote.poll_id;
        const payout = pollPayoutMap.get(pollId) || 0;
        const refund = pollRefundMap.get(pollId) || 0;

        if (refund > 0) {
          // Refunded poll - no win or loss
          return;
        }

        if (poll?.status === 'resolved') {
          if (poll?.winning_option_id && vote.option_id === poll.winning_option_id) {
            // Won: net profit = payout - stake
            const netProfit = payout - stake;
            if (netProfit > 0) pollNetWinnings += netProfit;
          } else if (poll?.winning_option_id && vote.option_id !== poll.winning_option_id) {
            // Lost: full stake
            pollLosses += stake;
          }
        }
      });

      // Contest winnings/losses - use NET profit (payout - buyIn)
      let contestNetWinnings = 0;
      let contestLosses = 0;
      const contestEntries = contestEntriesRes.data || [];
      contestEntries.forEach((entry: any) => {
        const contest = entry.prediction_contests;
        if (contest?.status === 'resolved') {
          const payout = Number(entry.payout || 0);
          const buyIn = Number(contest.buy_in_amount || 0);
          if (payout > buyIn) {
            // Net profit only
            contestNetWinnings += (payout - buyIn);
          } else if (payout < buyIn) {
            contestLosses += (buyIn - payout);
          }
        }
      });

      const tokensWon = marketTokensWon + pollNetWinnings + contestNetWinnings;
      const tokensLost = marketTokensLost + pollLosses + contestLosses;

      const totalDeposits = allTransactions.filter(t => t.type === 'deposit' && !(t.metadata as any)?.source?.startsWith('poll_')).reduce((sum, t) => sum + t.amount, 0) || 0;

      // Build poll history
      const pollHistory: PollHistory[] = pollVotes.map((vote: any) => {
        const poll = vote.prediction_polls;
        const won = poll?.status === 'resolved' && poll?.winning_option_id === vote.option_id;
        // Calculate proportional payout if won
        let payout = 0;
        if (won && poll?.total_pool) {
          // Approximate — actual payout comes from transactions
          payout = Number(vote.amount); // At minimum they get their stake back equivalent
        }
        return {
          poll_question: poll?.question || 'Unknown Poll',
          option_text: vote.poll_options?.option_text || 'Unknown',
          amount: Number(vote.amount),
          poll_status: poll?.status || 'unknown',
          won,
          payout,
          created_at: vote.created_at,
        };
      });

      // Build contest history
      const contestHistoryData: ContestHistory[] = contestEntries.map((entry: any) => {
        const contest = entry.prediction_contests;
        return {
          contest_title: contest?.title || 'Unknown Contest',
          buy_in: Number(contest?.buy_in_amount || 0),
          score: entry.score,
          rank: entry.rank,
          payout: entry.payout ? Number(entry.payout) : null,
          status: contest?.status || 'unknown',
          created_at: entry.created_at,
        };
      });

      return {
        pendingOrders,
        completedTrades,
        resolvedPositions,
        tokensWon: Math.round(tokensWon * 100) / 100,
        tokensLost: Math.round(tokensLost * 100) / 100,
        totalDeposits: Math.round(totalDeposits * 100) / 100,
        positions: positionsRes.data?.map(p => ({
          market_question: marketMap.get(p.market_id) || 'Unknown Market' as string,
          side: p.side,
          size: p.size,
          entry_price: p.entry_price,
          status: p.status,
          pnl: p.pnl ?? 0,
        })) || [],
        recentTransactions: transactionsRes.data || [],
        pollHistory,
        contestHistory: contestHistoryData,
      };
    },
    enabled: !!selectedUserId,
  });

  const filteredUsers = users?.filter(user => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query)
    );
  });

  const selectedUser = users?.find(u => u.id === selectedUserId);

  // Mutations
  const toggleKYCMutation = useMutation({
    mutationFn: async ({ userId, currentStatus }: { userId: string; currentStatus: boolean }) => {
      const { error } = await supabase.from('profiles').update({ kyc_verified: !currentStatus }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: variables.currentStatus ? "KYC removed" : "KYC verified" });
    },
    onError: () => { toast({ title: "Error", description: "Failed to update KYC", variant: "destructive" }); },
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'creator' | 'admin' }) => {
      const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', userId).eq('role', role).single();
      if (existing) throw new Error(`Already has ${role} role`);
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: (_, v) => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast({ title: `${v.role} role assigned` }); },
    onError: (e: Error) => { toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'creator' | 'admin' }) => {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
      if (error) throw error;
    },
    onSuccess: (_, v) => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast({ title: `${v.role} role removed` }); },
    onError: () => { toast({ title: "Error", description: "Failed to remove role", variant: "destructive" }); },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedUserId(null);
      toast({ title: "User account deleted" });
    },
    onError: (e: Error) => { toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const getHighestRole = (roles: string[]): string => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('creator')) return 'creator';
    return 'trader';
  };

  if (isLoading) {
    return <Card className="p-8 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></Card>;
  }

  // ─── User Detail View ───
  if (selectedUserId && selectedUser) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to Users
        </Button>

        {/* User Header */}
        <Card className="p-4 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">{selectedUser.name}</h2>
              {selectedUser.username && <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>}
              <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Joined {format(new Date(selectedUser.created_at), "MMM d, yyyy")}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant={getHighestRole(selectedUser.roles) === 'admin' ? 'default' : 'secondary'}>
                {getHighestRole(selectedUser.roles)}
              </Badge>
              {selectedUser.kyc_verified && <Badge className="bg-green-600"><ShieldCheck className="h-3 w-3 mr-1" />KYC</Badge>}
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        {isLoadingStats ? (
          <Card className="p-8 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></Card>
        ) : userStats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-xl font-bold text-foreground">{selectedUser.balance.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">tokens</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Total Deposited</p>
                <p className="text-xl font-bold text-foreground">{userStats.totalDeposits.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">tokens added</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Net Won</p>
                <p className="text-xl font-bold text-green-500">+{userStats.tokensWon.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">profit from wins</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Net Lost</p>
                <p className="text-xl font-bold text-red-500">-{userStats.tokensLost.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">stakes on losses</p>
              </Card>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Pending Orders</p>
                <p className="text-lg font-bold text-amber-500">{userStats.pendingOrders}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Completed Trades</p>
                <p className="text-lg font-bold text-foreground">{userStats.completedTrades}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Resolved Positions</p>
                <p className="text-lg font-bold text-foreground">{userStats.resolvedPositions}</p>
              </Card>
            </div>

            {/* History Tabs */}
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="positions">Positions ({userStats.positions.length})</TabsTrigger>
                <TabsTrigger value="polls">Polls ({userStats.pollHistory.length})</TabsTrigger>
                <TabsTrigger value="contests">Contests ({userStats.contestHistory.length})</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
              </TabsList>

              {/* Positions Tab */}
              <TabsContent value="positions">
                <Card className="p-4">
                  {userStats.positions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No positions yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-1 text-xs text-muted-foreground">Market</th>
                            <th className="text-center py-2 px-1 text-xs text-muted-foreground">Side</th>
                            <th className="text-right py-2 px-1 text-xs text-muted-foreground">Size</th>
                            <th className="text-right py-2 px-1 text-xs text-muted-foreground">Entry</th>
                            <th className="text-center py-2 px-1 text-xs text-muted-foreground">Status</th>
                            <th className="text-right py-2 px-1 text-xs text-muted-foreground">P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userStats.positions.map((pos, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 px-1 text-xs max-w-[200px] truncate">{pos.market_question}</td>
                              <td className="py-2 px-1 text-center">
                                <Badge variant="outline" className={`text-[10px] ${pos.side === 'yes' ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'}`}>
                                  {pos.side.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="py-2 px-1 text-right text-xs">{pos.size}</td>
                              <td className="py-2 px-1 text-right text-xs">{pos.entry_price}¢</td>
                              <td className="py-2 px-1 text-center">
                                <Badge variant={pos.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                                  {pos.status}
                                </Badge>
                              </td>
                              <td className={`py-2 px-1 text-right text-xs font-medium ${(pos.pnl || 0) > 0 ? 'text-green-500' : (pos.pnl || 0) < 0 ? 'text-red-500' : ''}`}>
                                {pos.pnl !== null ? (pos.pnl > 0 ? '+' : '') + pos.pnl.toFixed(2) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Polls Tab */}
              <TabsContent value="polls">
                <Card className="p-4">
                  {userStats.pollHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No poll participation yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-1 text-xs text-muted-foreground">Poll</th>
                            <th className="text-left py-2 px-1 text-xs text-muted-foreground">Voted</th>
                            <th className="text-right py-2 px-1 text-xs text-muted-foreground">Staked</th>
                            <th className="text-center py-2 px-1 text-xs text-muted-foreground">Status</th>
                            <th className="text-center py-2 px-1 text-xs text-muted-foreground">Result</th>
                            <th className="text-right py-2 px-1 text-xs text-muted-foreground">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userStats.pollHistory.map((poll, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 px-1 text-xs max-w-[200px] truncate">{poll.poll_question}</td>
                              <td className="py-2 px-1 text-xs max-w-[100px] truncate">{poll.option_text}</td>
                              <td className="py-2 px-1 text-right text-xs">{poll.amount} tokens</td>
                              <td className="py-2 px-1 text-center">
                                <Badge variant={poll.poll_status === 'resolved' ? 'secondary' : 'default'} className="text-[10px]">
                                  {poll.poll_status}
                                </Badge>
                              </td>
                              <td className="py-2 px-1 text-center">
                                {poll.poll_status === 'resolved' ? (
                                  <Badge variant="outline" className={`text-[10px] ${poll.won ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'}`}>
                                    {poll.won ? 'Won' : 'Lost'}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-2 px-1 text-right text-[10px] text-muted-foreground">
                                {format(new Date(poll.created_at), "MMM d")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Contests Tab */}
              <TabsContent value="contests">
                <Card className="p-4">
                  {userStats.contestHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No contest participation yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-1 text-xs text-muted-foreground">Contest</th>
                            <th className="text-right py-2 px-1 text-xs text-muted-foreground">Buy-in</th>
                            <th className="text-right py-2 px-1 text-xs text-muted-foreground">Score</th>
                            <th className="text-center py-2 px-1 text-xs text-muted-foreground">Rank</th>
                            <th className="text-right py-2 px-1 text-xs text-muted-foreground">Payout</th>
                            <th className="text-center py-2 px-1 text-xs text-muted-foreground">Status</th>
                            <th className="text-right py-2 px-1 text-xs text-muted-foreground">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userStats.contestHistory.map((contest, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 px-1 text-xs max-w-[200px] truncate">{contest.contest_title}</td>
                              <td className="py-2 px-1 text-right text-xs">{contest.buy_in}</td>
                              <td className="py-2 px-1 text-right text-xs">{contest.score}</td>
                              <td className="py-2 px-1 text-center text-xs">
                                {contest.rank ? (
                                  <Badge variant="outline" className={`text-[10px] ${contest.rank <= 3 ? 'text-amber-500 border-amber-500/30' : ''}`}>
                                    #{contest.rank}
                                  </Badge>
                                ) : '—'}
                              </td>
                              <td className={`py-2 px-1 text-right text-xs font-medium ${(contest.payout || 0) > 0 ? 'text-green-500' : ''}`}>
                                {contest.payout ? `+${contest.payout}` : '—'}
                              </td>
                              <td className="py-2 px-1 text-center">
                                <Badge variant={contest.status === 'resolved' ? 'secondary' : 'default'} className="text-[10px]">
                                  {contest.status}
                                </Badge>
                              </td>
                              <td className="py-2 px-1 text-right text-[10px] text-muted-foreground">
                                {format(new Date(contest.created_at), "MMM d")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Transactions Tab */}
              <TabsContent value="transactions">
                <Card className="p-4">
                  {userStats.recentTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {userStats.recentTransactions.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <div className="flex items-center gap-2">
                            {tx.type === 'deposit' ? (
                              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <div>
                              <p className="text-xs font-medium capitalize">{tx.type}</p>
                              <p className="text-[10px] text-muted-foreground">{format(new Date(tx.created_at), "MMM d, h:mm a")}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-medium ${tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                              {tx.type === 'deposit' ? '+' : '-'}{tx.amount}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Bal: {tx.balance_after}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>

            {/* Admin Actions */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Admin Actions</h3>
              <div className="flex gap-2 flex-wrap">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline"><Shield className="h-3 w-3 mr-1" />Toggle KYC</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Toggle KYC</AlertDialogTitle>
                      <AlertDialogDescription>
                        {selectedUser.kyc_verified ? `Remove KYC for ${selectedUser.name}?` : `Verify ${selectedUser.name}?`}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => toggleKYCMutation.mutate({ userId: selectedUser.id, currentStatus: selectedUser.kyc_verified })}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {!selectedUser.roles.includes('creator') ? (
                  <Button size="sm" variant="outline" onClick={() => assignRoleMutation.mutate({ userId: selectedUser.id, role: 'creator' })}>
                    <Sparkles className="h-3 w-3 mr-1" />Add Creator
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-destructive border-destructive" onClick={() => removeRoleMutation.mutate({ userId: selectedUser.id, role: 'creator' })}>
                    <Sparkles className="h-3 w-3 mr-1" />Remove Creator
                  </Button>
                )}

                {!selectedUser.roles.includes('admin') ? (
                  <Button size="sm" variant="outline" className="border-primary text-primary" onClick={() => assignRoleMutation.mutate({ userId: selectedUser.id, role: 'admin' })}>
                    <Crown className="h-3 w-3 mr-1" />Add Admin
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-destructive border-destructive" onClick={() => removeRoleMutation.mutate({ userId: selectedUser.id, role: 'admin' })}>
                    <Crown className="h-3 w-3 mr-1" />Remove Admin
                  </Button>
                )}
                {!selectedUser.roles.includes('admin') && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive">
                        <Trash2 className="h-3 w-3 mr-1" />Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <strong>{selectedUser.name}</strong>'s account, profile, and all associated data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteUserMutation.mutate(selectedUser.id)}
                        >
                          Delete Permanently
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </Card>
          </>
        ) : null}
      </div>
    );
  }

  // ─── User List View ───
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <p className="text-xs text-muted-foreground px-1">{filteredUsers?.length || 0} users • Click to view details</p>

      {!filteredUsers || filteredUsers.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{searchQuery ? "No users match your search" : "No users found"}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map(user => (
            <Card
              key={user.id}
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedUserId(user.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-foreground truncate">{user.name}</p>
                    <Badge variant={getHighestRole(user.roles) === 'admin' ? 'default' : 'outline'} className="text-[10px] shrink-0">
                      {getHighestRole(user.roles)}
                    </Badge>
                    {user.region && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {user.region}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.username ? `@${user.username} • ` : ''}{user.email}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-foreground">{user.balance.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">tokens</p>
                  </div>
                  <div className="text-right sm:hidden">
                    <p className="text-xs font-medium">{user.balance.toLocaleString()} tkns</p>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserManagementPanel;
