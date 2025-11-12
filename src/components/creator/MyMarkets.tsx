import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreatorMarket } from "@/types/creator";
import { TrendingUp, Clock, CheckCircle, Flag, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface MyMarketsProps {
  markets: CreatorMarket[];
}

const MyMarkets = ({ markets }: MyMarketsProps) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: CreatorMarket["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "approved":
      case "open":
        return (
          <Badge className="flex items-center gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Open
          </Badge>
        );
      case "resolved":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Flag className="h-3 w-3" />
            Resolved
          </Badge>
        );
    }
  };

  if (markets.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No markets yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first market using the form above
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {markets.map(market => (
        <Card key={market.id} className="p-4 md:p-5 hover:shadow-md transition-shadow active:scale-[0.99]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm md:text-base font-semibold text-foreground mb-2 line-clamp-2">
                {market.question}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Created {format(new Date(market.createdAt), "MMM dd, yyyy")}</span>
              </div>
            </div>
            {getStatusBadge(market.status)}
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Volume</p>
              <p className="text-sm font-semibold text-foreground">
                {market.volume.toLocaleString()} shares
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Fees Earned</p>
              <p className="text-sm font-semibold text-green-600">
                ${market.feesEarned.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <p className="text-sm font-semibold text-foreground capitalize">
                {market.status}
              </p>
            </div>
            {market.outcome && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Outcome</p>
                <Badge variant={market.outcome === "yes" ? "default" : "secondary"}>
                  {market.outcome.toUpperCase()}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => navigate(`/market/${market.id}`)}
              className="flex-1 h-10 md:h-9 active:scale-95 transition-transform"
            >
              <Eye className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">View Details</span>
              <span className="sm:hidden">View</span>
            </Button>
            {market.status === "pending" && (
              <Button size="sm" variant="ghost" className="h-10 md:h-9 text-destructive active:scale-95 transition-transform">
                Cancel
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};

export default MyMarkets;
