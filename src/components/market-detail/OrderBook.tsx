import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface OrderBookProps {
  marketId: string;
}

interface OrderLevel {
  price: number;
  quantity: number;
}

const OrderBook = ({ marketId }: OrderBookProps) => {
  const [yesOrders, setYesOrders] = useState<OrderLevel[]>([]);
  const [noOrders, setNoOrders] = useState<OrderLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`orderbook-display-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `market_id=eq.${marketId}`
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId]);

  const fetchOrders = async () => {
    const { data: yesData } = await supabase
      .from('orders')
      .select('price, quantity, filled_quantity')
      .eq('market_id', marketId)
      .eq('side', 'yes')
      .in('status', ['pending', 'partial'])
      .order('price', { ascending: false });

    const { data: noData } = await supabase
      .from('orders')
      .select('price, quantity, filled_quantity')
      .eq('market_id', marketId)
      .eq('side', 'no')
      .in('status', ['pending', 'partial'])
      .order('price', { ascending: false });

    const aggregateOrders = (orders: any[]) => {
      const levels: Record<string, number> = {};
      for (const order of orders || []) {
        const remaining = order.quantity - order.filled_quantity;
        if (remaining > 0 && order.price) {
          const priceKey = Number(order.price).toFixed(2);
          levels[priceKey] = (levels[priceKey] || 0) + remaining;
        }
      }
      return Object.entries(levels)
        .map(([price, quantity]) => ({ price: parseFloat(price), quantity }))
        .sort((a, b) => b.price - a.price)
        .slice(0, 5);
    };

    setYesOrders(aggregateOrders(yesData || []));
    setNoOrders(aggregateOrders(noData || []));
    setLoading(false);
  };

  const bestYesBid = yesOrders[0];
  const bestNoAsk = noOrders[0];

  if (loading) {
    return (
      <div className="p-6">
        <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4">Order Book</h3>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-muted rounded-lg"></div>
            <div className="h-20 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  const hasOrders = yesOrders.length > 0 || noOrders.length > 0;

  return (
    <div className="p-0 md:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 px-4 md:px-0 hidden md:block">Order Book</h3>
      
      <div className="space-y-4 px-4 md:px-0 pb-4 md:pb-0">
        {/* Best Prices Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 sm:p-4 min-h-[72px]">
            <p className="text-xs text-muted-foreground mb-1">Best YES Price</p>
            {bestYesBid ? (
              <>
                <p className="text-xl sm:text-lg font-bold text-green-600 dark:text-green-500">
                  {(bestYesBid.price * 100).toFixed(0)}¢
                </p>
                <p className="text-xs text-muted-foreground">{bestYesBid.quantity} shares</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No bids yet</p>
            )}
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 sm:p-4 min-h-[72px]">
            <p className="text-xs text-muted-foreground mb-1">Best NO Price</p>
            {bestNoAsk ? (
              <>
                <p className="text-xl sm:text-lg font-bold text-red-600 dark:text-red-500">
                  {(bestNoAsk.price * 100).toFixed(0)}¢
                </p>
                <p className="text-xs text-muted-foreground">{bestNoAsk.quantity} shares</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No bids yet</p>
            )}
          </div>
        </div>

        {!hasOrders && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No orders yet. Be the first to place a limit order!</p>
          </div>
        )}

        {/* Detailed Order Book Tables - Desktop only */}
        {hasOrders && (
          <div className="hidden md:grid md:grid-cols-2 gap-4">
            {/* Yes Orders */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-foreground">YES Orders</h4>
                <Badge className="bg-green-600">Buy</Badge>
              </div>
              <div className="space-y-1">
                {yesOrders.length > 0 ? (
                  yesOrders.map((order, idx) => (
                    <div key={idx} className="flex justify-between text-xs p-2 bg-green-50 dark:bg-green-950/10 rounded">
                      <span className="font-medium text-green-600 dark:text-green-500">
                        {(order.price * 100).toFixed(0)}¢
                      </span>
                      <span className="text-muted-foreground">{order.quantity} shares</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center text-muted-foreground py-2">No orders</p>
                )}
              </div>
            </div>

            {/* No Orders */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-foreground">NO Orders</h4>
                <Badge variant="destructive">Buy</Badge>
              </div>
              <div className="space-y-1">
                {noOrders.length > 0 ? (
                  noOrders.map((order, idx) => (
                    <div key={idx} className="flex justify-between text-xs p-2 bg-red-50 dark:bg-red-950/10 rounded">
                      <span className="font-medium text-red-600 dark:text-red-500">
                        {(order.price * 100).toFixed(0)}¢
                      </span>
                      <span className="text-muted-foreground">{order.quantity} shares</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center text-muted-foreground py-2">No orders</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile hint */}
        {hasOrders && (
          <p className="text-xs text-center text-muted-foreground md:hidden">
            Full order book available on larger screens
          </p>
        )}
      </div>
    </div>
  );
};

export default OrderBook;
