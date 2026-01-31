import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Circle, CheckCircle2 } from "lucide-react";

interface Position {
  id: string;
  marketQuestion: string;
  side: "yes" | "no";
  tokensCommitted: number;
  status: "active" | "settled";
  tokensReturned?: number;
}

interface PositionsScreenProps {
  positions: Position[];
}

const PositionsScreen = ({ positions }: PositionsScreenProps) => {
  const activePositions = positions.filter(p => p.status === "active");
  const settledPositions = positions.filter(p => p.status === "settled");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Your Positions</h2>

      {/* Active Positions */}
      {activePositions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Circle className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-medium text-muted-foreground">Active</span>
          </div>
          {activePositions.map((position) => (
            <Card key={position.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2">{position.marketQuestion}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={position.side === "yes" ? "default" : "secondary"}>
                      {position.side.toUpperCase()}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {position.tokensCommitted} tokens
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Settled Positions */}
      {settledPositions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-muted-foreground">Settled</span>
          </div>
          {settledPositions.map((position) => (
            <Card key={position.id} className="p-4 bg-muted/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2 text-muted-foreground">
                    {position.marketQuestion}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Resolved</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${
                    (position.tokensReturned ?? 0) > 0 ? "text-green-600" : "text-muted-foreground"
                  }`}>
                    +{position.tokensReturned ?? 0} tokens returned
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {positions.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No positions yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Make a prediction in a market to get started
          </p>
        </Card>
      )}
    </div>
  );
};

export default PositionsScreen;
