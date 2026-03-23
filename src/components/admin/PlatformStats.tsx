import { Card } from "@/components/ui/card";
import { Users, TrendingUp, BarChart3, Clock, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PlatformStats = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      // Fetch counts in parallel
      const [
        { count: totalUsers },
        { count: activeUsers },
        { count: totalMarkets },
        { count: activeMarkets },
        { count: pendingApprovals },
        { data: volumeData },
        { data: todayTradesData },
        { data: pollVotesData },
        { data: contestEntriesData }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('last_active_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('markets').select('*', { count: 'exact', head: true }),
        supabase.from('markets').select('*', { count: 'exact', head: true })
          .in('status', ['approved', 'open']),
        supabase.from('markets').select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('markets').select('volume'),
        supabase.from('trades').select('price, quantity')
          .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('poll_votes').select('amount'),
        supabase.from('contest_entries').select('contest_id, prediction_contests(buy_in_amount)')
      ]);

      const marketVolume = volumeData?.reduce((sum, m) => sum + (Number(m.volume) || 0), 0) || 0;
      const pollVolume = pollVotesData?.reduce((sum, v) => sum + (Number(v.amount) || 0), 0) || 0;
      const contestVolume = contestEntriesData?.reduce((sum, e) => {
        const buyIn = (e as any).prediction_contests?.buy_in_amount;
        return sum + (Number(buyIn) || 0);
      }, 0) || 0;
      const totalVolume = marketVolume + pollVolume + contestVolume;
      const todayTrades = todayTradesData?.length || 0;
      const todayVolume = todayTradesData?.reduce((sum, t) => sum + (Number(t.price) * Number(t.quantity)), 0) || 0;

      return {
        activeUsers: activeUsers || 0,
        totalUsers: totalUsers || 0,
        activeMarkets: activeMarkets || 0,
        totalMarkets: totalMarkets || 0,
        totalVolume,
        todayTrades,
        todayVolume,
        pendingApprovals: pendingApprovals || 0,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4 md:p-5 flex items-center justify-center h-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <Card className="p-4 md:p-5 border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm text-muted-foreground">Total Participants</p>
          <Users className="h-5 w-5 md:h-6 md:w-6 text-primary" />
        </div>
        <p className="text-2xl md:text-3xl font-bold text-foreground">{stats?.totalUsers.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {stats?.activeUsers.toLocaleString()} active in last 24h
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs md:text-sm text-muted-foreground">Active Markets</p>
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-accent" />
          </div>
          <p className="text-xl md:text-2xl font-bold text-foreground">{stats?.activeMarkets}</p>
          <p className="text-xs text-muted-foreground mt-1">
            of {stats?.totalMarkets} total markets
          </p>
        </Card>

        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs md:text-sm text-muted-foreground">Total Volume</p>
            <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-accent" />
          </div>
          <p className="text-xl md:text-2xl font-bold text-foreground">${stats?.totalVolume.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Today: ${stats?.todayVolume.toLocaleString()} ({stats?.todayTrades} trades)
          </p>
        </Card>

        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs md:text-sm text-muted-foreground">Pending Approvals</p>
            <Clock className="h-4 w-4 md:h-5 md:w-5 text-yellow-600" />
          </div>
          <p className="text-xl md:text-2xl font-bold text-foreground">{stats?.pendingApprovals}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Markets awaiting review
          </p>
        </Card>
      </div>
    </div>
  );
};

export default PlatformStats;
