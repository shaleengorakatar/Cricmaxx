import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Circle, CheckCircle2 } from "lucide-react";

interface Position {
  id: string;
  market: string;
  side: "Yes" | "No";
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  tokensCommitted: number;
  status: "active" | "settled";
  tokensReturned?: number;
  expiring?: boolean;
}

interface ActivePositionsProps {
  positions: Position[];
}

/**
 * Positions display using prediction market-safe language
 * Shows "tokens committed" and "tokens returned" instead of P&L
 */
const ActivePositions = ({ positions }: ActivePositionsProps) => {
  const activePositions = positions.filter(p => p.status === "active");
  const settledPositions = positions.filter(p => p.status === "settled");

  return (
    <Card className="p-4 md:p-6">
      <h2 className="text-base md:text-lg font-semibold text-foreground mb-4">Your Positions</h2>
      
      {positions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No positions yet. Take a position in a market to get started.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Active Positions */}
          {activePositions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Circle className="h-3 w-3 text-amber-500 fill-amber-500" />
                <span className="text-sm font-medium text-muted-foreground">Active</span>
              </div>
              
              {/* Mobile: Card layout */}
              <div className="md:hidden space-y-3">
                {activePositions.map((position) => (
                  <div key={position.id} className="p-4 rounded-lg bg-secondary space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium flex-1 line-clamp-2">{position.market}</p>
                      <Badge variant={position.side === "Yes" ? "default" : "secondary"}>
                        {position.side}
                      </Badge>
                    </div>
                    {position.expiring && (
                      <Badge variant="destructive" className="text-xs flex items-center gap-1 w-fit">
                        <AlertCircle className="h-3 w-3" />
                        Expiring today
                      </Badge>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tokens committed:</span>
                      <span className="font-medium">{position.tokensCommitted}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table layout */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 text-sm font-medium text-muted-foreground">Market</th>
                      <th className="text-left py-3 text-sm font-medium text-muted-foreground">Position</th>
                      <th className="text-right py-3 text-sm font-medium text-muted-foreground">Tokens Committed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePositions.map((position) => (
                      <tr key={position.id} className="border-b border-border">
                        <td className="py-4 text-sm">
                          <div className="flex items-center gap-2">
                            {position.market}
                            {position.expiring && (
                              <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Expiring today
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-4">
                          <Badge variant={position.side === "Yes" ? "default" : "secondary"}>
                            {position.side}
                          </Badge>
                        </td>
                        <td className="py-4 text-right text-sm font-medium">
                          {position.tokensCommitted} tokens
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Settled Positions */}
          {settledPositions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span className="text-sm font-medium text-muted-foreground">Settled</span>
              </div>
              
              <div className="space-y-2">
                {settledPositions.map((position) => (
                  <div key={position.id} className="p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground line-clamp-1">{position.market}</p>
                      <p className="text-xs text-muted-foreground">Resolved</p>
                    </div>
                    <p className={`text-sm font-medium ${
                      (position.tokensReturned ?? 0) > 0 
                        ? "text-foreground" 
                        : "text-muted-foreground"
                    }`}>
                      +{position.tokensReturned ?? 0} tokens returned
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default ActivePositions;
