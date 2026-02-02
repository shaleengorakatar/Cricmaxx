import { Badge } from "@/components/ui/badge";
import { Market } from "@/types/market";
import { Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import InfoTooltip from "@/components/InfoTooltip";
import MarketCreatorInfo from "./MarketCreatorInfo";
import SocialShareButtons from "./SocialShareButtons";

interface MarketHeaderProps {
  market: Market;
}

const MarketHeader = ({ market }: MarketHeaderProps) => {
  const expiryDate = new Date(market.expiryTime);
  const isExpired = expiryDate < new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 sm:mb-3 leading-tight">
            {market.question}
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <Badge variant="outline" className="text-xs sm:text-sm">
              {market.category}
            </Badge>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm">
                Expires {format(expiryDate, "MMM dd, yyyy")}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <SocialShareButtons market={market} />
          <Badge 
            variant={isExpired ? "destructive" : "default"}
            className="text-xs sm:text-sm px-3 sm:px-4 py-1 whitespace-nowrap"
          >
            {isExpired ? "Closed" : "Open"}
          </Badge>
        </div>
      </div>

      <div className="bg-muted/50 border border-border rounded-lg p-3 sm:p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs sm:text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium">Event Contract (CFTC Compliance In Progress):</span> This is a fixed-payout binary contract{" "}
              <InfoTooltip content="An event contract is a yes/no prediction that pays a fixed amount ($1.00) if you're correct and nothing ($0.00) if you're wrong. We are in the process of obtaining CFTC regulatory approval." />
              {" "}Pays $1.00 if correct, $0.00 if incorrect. <span className="text-accent font-medium">Beta Release</span> - CFTC compliance in progress.
            </p>
          </div>
        </div>
      </div>

      {market.description && (
        <div className="border-t border-border pt-3 sm:pt-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Market Description</h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{market.description}</p>
        </div>
      )}
    </div>
  );
};

export default MarketHeader;
