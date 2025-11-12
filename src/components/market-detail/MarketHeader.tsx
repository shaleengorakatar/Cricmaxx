import { Badge } from "@/components/ui/badge";
import { Market } from "@/types/market";
import { Clock, User, Building2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface MarketHeaderProps {
  market: Market;
}

const MarketHeader = ({ market }: MarketHeaderProps) => {
  const expiryDate = new Date(market.expiryTime);
  const isExpired = expiryDate < new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {market.question}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="outline" className="text-sm">
              {market.category}
            </Badge>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Expires {format(expiryDate, "MMM dd, yyyy 'at' HH:mm")}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              {market.type === "orderbook" ? (
                <>
                  <Building2 className="h-4 w-4" />
                  <span>Exchange Market</span>
                </>
              ) : (
                <>
                  <User className="h-4 w-4" />
                  <span>Creator Market</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Badge 
          variant={isExpired ? "destructive" : "default"}
          className="text-sm px-4 py-1"
        >
          {isExpired ? "Closed" : "Open"}
        </Badge>
      </div>

      <div className="bg-muted/50 border border-border rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">CFTC-Regulated Event Contract:</span> This is a fixed-payout binary contract. 
            Pays $1.00 if the outcome is correct, $0.00 if incorrect. All trades are federally compliant under CFTC regulations.
          </p>
        </div>
      </div>

      {market.description && (
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Market Description</h3>
          <p className="text-sm text-muted-foreground">{market.description}</p>
        </div>
      )}
    </div>
  );
};

export default MarketHeader;
