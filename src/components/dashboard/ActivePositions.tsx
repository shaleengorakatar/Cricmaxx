import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Circle, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Position {
  id: string;
  market: string;
  side: "Yes" | "No";
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  tokensCommitted: number;
  status: "active" | "settled" | "pending";
  tokensReturned?: number;
  expiring?: boolean;
  type: 'position' | 'order';
}

interface ActivePositionsProps {
  positions: Position[];
}

/**
 * Positions display using prediction market-safe language
 * Shows "tokens committed" and "tokens returned" instead of P&L
 */
const ActivePositions = ({ positions: initialPositions }: ActivePositionsProps) => {
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [pendingOrders, setPendingOrders] = useState<Position[]>([]);

  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  useEffect(() => {
    fetchPendingOrders();
  }, []);

  const fetchPendingOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        side,
        quantity,
        filled_quantity,
        price,
        status,
        created_at,
        markets (question, expiry_time)
      `)
      .eq('user_id', user.id)
      .in('status', ['pending', 'partial'])
      .order('created_at', { ascending: false });

    if (data && !error) {
      const orders: Position[] = data.map((o: any) => {
        const unfilled = Number(o.quantity) - Number(o.filled_quantity);
        const tokensCommitted = Math.round(unfilled * Number(o.price));
        const isExpiringSoon = o.markets?.expiry_time ? 
          new Date(o.markets.expiry_time).getTime() - Date.now() < 24 * 60 * 60 * 1000 : false;

        return {
          id: o.id,
          market: o.markets?.question || 'Unknown Market',
          side: o.side === 'yes' ? 'Yes' : 'No',
          quantity: unfilled,
          entryPrice: Number(o.price),
          currentPrice: Number(o.price),
          tokensCommitted,
          status: 'pending' as const,
          expiring: isExpiringSoon,
          type: 'order' as const
        };
      });
      setPendingOrders(orders);
    }
  };

  const activePositions = positions.filter(p => p.status === "active");
  const settledPositions = positions.filter(p => p.status === "settled");

  const allEmpty = activePositions.length === 0 && pendingOrders.length === 0 && settledPositions.length === 0;

  return (
    <Card className="p-4 md:p-6">
      <h2 className="text-base md:text-lg font-semibold text-foreground mb-4">Your Positions</h2>
      
      {allEmpty ? (
        <p className="text-center text-muted-foreground py-8">
          No positions yet. Make a prediction in a market to get started.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-blue-500" />
                <span className="text-sm font-medium text-muted-foreground">Pending Orders</span>
                <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">
                  {pendingOrders.length}
                </Badge>
              </div>
              
              {/* Mobile: Card layout */}
              <div className="md:hidden space-y-3">
                {pendingOrders.map((order) => (
                  <div key={order.id} className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium flex-1 line-clamp-2">{order.market}</p>
                      <Badge variant={order.side === "Yes" ? "default" : "secondary"}>
                        {order.side}
                      </Badge>
                    </div>
                    {order.expiring && (
                      <Badge variant="destructive" className="text-xs flex items-center gap-1 w-fit">
                        <AlertCircle className="h-3 w-3" />
                        Expiring today
                      </Badge>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tokens reserved:</span>
                      <span className="font-medium">{order.tokensCommitted}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Limit price:</span>
                      <span className="font-medium">${order.entryPrice.toFixed(2)}</span>
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
                      <th className="text-right py-3 text-sm font-medium text-muted-foreground">Limit Price</th>
                      <th className="text-right py-3 text-sm font-medium text-muted-foreground">Tokens Reserved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border">
                        <td className="py-4 text-sm">
                          <div className="flex items-center gap-2">
                            {order.market}
                            {order.expiring && (
                              <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Expiring today
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-4">
                          <Badge variant={order.side === "Yes" ? "default" : "secondary"}>
                            {order.side}
                          </Badge>
                        </td>
                        <td className="py-4 text-right text-sm font-medium">
                          ${order.entryPrice.toFixed(2)}
                        </td>
                        <td className="py-4 text-right text-sm font-medium">
                          {order.tokensCommitted} tokens
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
