import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtimeTrades } from "@/hooks/useRealtimeMarket";
import { RealtimeStatus } from "@/components/ui/realtime-indicators";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveTradeFeedProps {
  marketId: string;
  marketQuestion?: string;
  maxHeight?: string;
}

export function LiveTradeFeed({ marketId, marketQuestion, maxHeight = "300px" }: LiveTradeFeedProps) {
  const { trades, isConnected } = useRealtimeTrades(marketId, 15);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Live Trades
          </div>
          <RealtimeStatus isConnected={isConnected} showLabel={false} />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }}>
          {trades.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No recent trades
            </div>
          ) : (
            <div className="divide-y divide-border">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-top-2 duration-300"
                >
                  <div className="flex items-center gap-2">
                    {trade.buyer_side === 'yes' ? (
                      <div className="p-1 rounded bg-green-500/10">
                        <ArrowUpRight className="h-3 w-3 text-green-600" />
                      </div>
                    ) : (
                      <div className="p-1 rounded bg-red-500/10">
                        <ArrowDownRight className="h-3 w-3 text-red-600" />
                      </div>
                    )}
                    <div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          trade.buyer_side === 'yes'
                            ? "border-green-500/30 text-green-600"
                            : "border-red-500/30 text-red-600"
                        )}
                      >
                        {trade.buyer_side.toUpperCase()}
                      </Badge>
                      <span className="ml-2 text-sm font-medium">
                        {trade.quantity} @ ${Number(trade.price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default LiveTradeFeed;
