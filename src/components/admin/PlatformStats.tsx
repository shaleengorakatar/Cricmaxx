import { Card } from "@/components/ui/card";
import { PlatformStats as PlatformStatsType } from "@/types/admin";
import { Users, TrendingUp, BarChart3, Clock } from "lucide-react";

interface PlatformStatsProps {
  stats: PlatformStatsType;
}

const PlatformStats = ({ stats }: PlatformStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm text-muted-foreground">Active Users</p>
          <Users className="h-4 w-4 md:h-5 md:w-5 text-accent" />
        </div>
        <p className="text-xl md:text-2xl font-bold text-foreground">{stats.activeUsers.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">
          of {stats.totalUsers.toLocaleString()} total
        </p>
      </Card>

      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm text-muted-foreground">Active Markets</p>
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-accent" />
        </div>
        <p className="text-xl md:text-2xl font-bold text-foreground">{stats.activeMarkets}</p>
        <p className="text-xs text-muted-foreground mt-1">
          of {stats.totalMarkets} total markets
        </p>
      </Card>

      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm text-muted-foreground">Total Volume</p>
          <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-accent" />
        </div>
        <p className="text-xl md:text-2xl font-bold text-foreground">{stats.totalVolume.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Today: {stats.todayVolume.toLocaleString()} ({stats.todayTrades} trades)
        </p>
      </Card>

      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm text-muted-foreground">Pending Approvals</p>
          <Clock className="h-4 w-4 md:h-5 md:w-5 text-yellow-600" />
        </div>
        <p className="text-xl md:text-2xl font-bold text-foreground">{stats.pendingApprovals}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Markets awaiting review
        </p>
      </Card>
    </div>
  );
};

export default PlatformStats;
