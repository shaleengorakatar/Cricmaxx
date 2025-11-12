import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Market } from "@/types/market";
import { TrendingUp, Clock, BarChart3, BookOpen, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface MarketCardProps {
  market: Market;
}

const MarketCard = ({ market }: MarketCardProps) => {
  const navigate = useNavigate();
  const expiryDate = new Date(market.expiryTime);
  const timeToExpiry = formatDistanceToNow(expiryDate, { addSuffix: true });
  const isExpiringSoon = expiryDate.getTime() - Date.now() < 24 * 60 * 60 * 1000; // Less than 24 hours

  const handleClick = () => {
    navigate(`/market/${market.id}`);
  };

  return (
    <Card 
      className="p-5 cursor-pointer hover:shadow-lg transition-all duration-300 hover:border-accent/50 group"
      onClick={handleClick}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-2 flex-1">
            {market.question}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="text-xs">
              {market.category}
            </Badge>
          </div>
        </div>

        {/* Market Type Indicator */}
        <div className="flex items-center gap-2">
          {market.type === "orderbook" ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              <span>Order Book</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              <span>Automated Market</span>
            </div>
          )}
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Yes</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-500">
              ${market.yesPrice.toFixed(2)}
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">No</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-500">
              ${market.noPrice.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs">
              {market.volume.toLocaleString()} vol
            </span>
          </div>
          <div className={`flex items-center gap-1 ${isExpiringSoon ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'}`}>
            <Clock className="h-4 w-4" />
            <span className="text-xs">
              {isExpiringSoon && "⚠️ "}
              Expires {timeToExpiry}
            </span>
          </div>
        </div>

        {/* Trade Button */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-accent group-hover:text-accent/80 transition-colors">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">View Market</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MarketCard;
