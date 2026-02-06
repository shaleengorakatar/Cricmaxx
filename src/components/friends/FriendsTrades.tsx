import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FriendTrade } from "@/types/friends";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import { formatDistanceToNow, isValid } from "date-fns";
import { useNavigate } from "react-router-dom";

interface FriendsTradesProps {
  trades: FriendTrade[];
  onRefresh: () => void;
}

const FriendsTrades = ({ trades }: FriendsTradesProps) => {
  const navigate = useNavigate();

  if (trades.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Your friends don't have any ongoing trades yet
          </p>
        </CardContent>
      </Card>
    );
  }

  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'unknown';
    const d = new Date(dateStr);
    return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : 'unknown';
  };

  return (
    <div className="space-y-4">
      {trades.map((trade) => {
        const market = trade.markets;
        const friend = trade.profiles;
        const isYes = trade.side === 'yes';
        const yesPrice = Number(market?.yes_price) || 0;
        const noPrice = Number(market?.no_price) || 0;
        const entryPrice = Number(trade.entry_price) || 0;
        const tradeSize = Number(trade.size) || 0;
        const currentPrice = isYes ? yesPrice : noPrice;
        const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
        const isProfitable = pnlPercent > 0;

        return (
          <Card 
            key={trade.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/market/${market.id}`)}
          >
            <CardContent className="pt-4 pb-4">
              {/* Friend Info Header */}
              <div className="flex items-center gap-2 mb-3">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={friend.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {(friend.display_name || friend.username || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {friend.display_name || friend.username}
                  </span>{" "}
                  is {isYes ? 'long on' : 'short on'}{" "}
                  <span className={`font-semibold ${isYes ? 'text-green-600' : 'text-red-600'}`}>
                    {trade.side.toUpperCase()}
                  </span>
                </p>
              </div>

              {/* Market Question */}
              <h3 className="font-semibold text-base mb-2 line-clamp-2">
                {market.question}
              </h3>

              {/* Market Stats */}
              <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
                <Badge variant="secondary">{market.category}</Badge>
                
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">YES</span>
                  <span className="font-medium text-green-600">
                    ₹{yesPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">NO</span>
                  <span className="font-medium text-red-600">
                    ₹{noPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">
                    {safeFormatDate(market?.expiry_time)}
                  </span>
                </div>
              </div>

              {/* Trade Details */}
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Entry: </span>
                    <span className="font-medium">₹{entryPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Size: </span>
                    <span className="font-medium">{tradeSize}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current: </span>
                    <span className="font-medium">₹{currentPrice.toFixed(2)}</span>
                  </div>
                </div>

                <div className={`flex items-center gap-1 text-sm font-semibold ${
                  isProfitable ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isProfitable ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {pnlPercent > 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Opened {safeFormatDate(trade.opened_at)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default FriendsTrades;
