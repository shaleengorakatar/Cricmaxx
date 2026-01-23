import { useGlobalActivityFeed, GlobalActivity } from '@/hooks/useGlobalActivityFeed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RealtimeStatus } from '@/components/ui/realtime-indicators';
import { Activity, TrendingUp, TrendingDown, ShoppingCart, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItemProps {
  activity: GlobalActivity;
  marketName: string;
}

function ActivityItem({ activity, marketName }: ActivityItemProps) {
  const getIcon = () => {
    switch (activity.type) {
      case 'trade':
        return activity.side === 'yes' ? (
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-rose-500" />
        );
      case 'order':
        return <ShoppingCart className="h-4 w-4 text-blue-500" />;
      case 'market_update':
        return <RefreshCw className="h-4 w-4 text-amber-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeLabel = () => {
    switch (activity.type) {
      case 'trade':
        return (
          <Badge variant="outline" className={activity.side === 'yes' ? 'border-emerald-500/50 text-emerald-600' : 'border-rose-500/50 text-rose-600'}>
            Trade
          </Badge>
        );
      case 'order':
        return (
          <Badge variant="outline" className="border-blue-500/50 text-blue-600">
            Order
          </Badge>
        );
      case 'market_update':
        return (
          <Badge variant="outline" className="border-amber-500/50 text-amber-600">
            Price Update
          </Badge>
        );
      default:
        return <Badge variant="outline">Activity</Badge>;
    }
  };

  const getDescription = () => {
    switch (activity.type) {
      case 'trade':
        return (
          <span>
            <span className={activity.side === 'yes' ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
              {activity.side?.toUpperCase()}
            </span>
            {' '}@ <span className="font-mono font-medium">{(activity.price * 100).toFixed(0)}¢</span>
            {activity.quantity && (
              <span className="text-muted-foreground"> × {activity.quantity}</span>
            )}
          </span>
        );
      case 'order':
        return (
          <span>
            New <span className={activity.side === 'yes' ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
              {activity.side?.toUpperCase()}
            </span>
            {' '}order @ <span className="font-mono font-medium">{(activity.price * 100).toFixed(0)}¢</span>
          </span>
        );
      case 'market_update':
        return (
          <span>
            Price moved to <span className="font-mono font-medium">{(activity.price * 100).toFixed(0)}¢</span>
          </span>
        );
      default:
        return 'Activity recorded';
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50 hover:bg-accent/30 transition-colors">
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {getTypeLabel()}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm truncate text-foreground/80" title={marketName}>
          {marketName}
        </p>
        <p className="text-sm mt-0.5">{getDescription()}</p>
      </div>
    </div>
  );
}

interface GlobalActivityFeedProps {
  limit?: number;
  className?: string;
  compact?: boolean;
}

export function GlobalActivityFeed({ limit = 50, className, compact = false }: GlobalActivityFeedProps) {
  const { activities, isConnected, getMarketName } = useGlobalActivityFeed(limit);

  const stats = {
    trades: activities.filter(a => a.type === 'trade').length,
    orders: activities.filter(a => a.type === 'order').length,
    updates: activities.filter(a => a.type === 'market_update').length,
  };

  return (
    <Card className={className}>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className={compact ? 'text-base' : ''}>Global Activity Feed</CardTitle>
          </div>
          <RealtimeStatus isConnected={isConnected} />
        </div>
        {!compact && (
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">{stats.trades} trades</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs text-muted-foreground">{stats.orders} orders</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-muted-foreground">{stats.updates} updates</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className={compact ? 'pt-0' : ''}>
        <ScrollArea className={compact ? 'h-[300px]' : 'h-[500px]'}>
          <div className="space-y-2 pr-4">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity yet</p>
                <p className="text-xs">Trades and orders will appear here in real-time</p>
              </div>
            ) : (
              activities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  marketName={activity.market_question || getMarketName(activity.market_id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
