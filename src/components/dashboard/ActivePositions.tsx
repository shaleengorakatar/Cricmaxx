import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface Position {
  id: string;
  market: string;
  side: "Yes" | "No";
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPL: number;
  expiring?: boolean;
}

interface ActivePositionsProps {
  positions: Position[];
}

const ActivePositions = ({ positions }: ActivePositionsProps) => {
  return (
    <Card className="p-4 md:p-6">
      <h2 className="text-base md:text-lg font-semibold text-foreground mb-4">Active Positions</h2>
      
      {positions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No active positions. Start trading to see your positions here.
        </p>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="md:hidden space-y-3">
            {positions.map((position) => {
              const isProfitable = position.unrealizedPL >= 0;
              return (
                <div key={position.id} className="p-4 rounded-lg bg-secondary space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex-1">{position.market}</p>
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
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Quantity</p>
                      <p className="font-medium">{position.quantity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Entry Price</p>
                      <p className="font-medium">${position.entryPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Current Price</p>
                      <p className="font-medium">${position.currentPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">P&L</p>
                      <p className={`font-semibold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfitable ? '+' : ''}{position.unrealizedPL.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Market</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Side</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground">Quantity</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground">Entry</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground">Current</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground">P&L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => {
                  const isProfitable = position.unrealizedPL >= 0;
                  return (
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
                      <td className="py-4 text-right text-sm">{position.quantity}</td>
                      <td className="py-4 text-right text-sm">${position.entryPrice.toFixed(2)}</td>
                      <td className="py-4 text-right text-sm">${position.currentPrice.toFixed(2)}</td>
                      <td className={`py-4 text-right text-sm font-semibold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfitable ? '+' : ''}{position.unrealizedPL.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
};

export default ActivePositions;
