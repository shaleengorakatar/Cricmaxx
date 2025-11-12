import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: string;
  side: "yes" | "no";
  price: number;
  quantity: number;
}

interface OrderBookProps {
  orders: Order[];
}

const OrderBook = ({ orders }: OrderBookProps) => {
  const yesOrders = orders.filter(o => o.side === "yes").sort((a, b) => b.price - a.price);
  const noOrders = orders.filter(o => o.side === "no").sort((a, b) => b.price - a.price);

  const bestYesBid = yesOrders[0];
  const bestNoAsk = noOrders[0];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Order Book</h3>
      
      <div className="space-y-4">
        {/* Best Prices Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Best Yes Bid</p>
            {bestYesBid ? (
              <>
                <p className="text-lg font-bold text-green-600 dark:text-green-500">
                  ${bestYesBid.price.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">{bestYesBid.quantity} shares</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No bids</p>
            )}
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Best No Ask</p>
            {bestNoAsk ? (
              <>
                <p className="text-lg font-bold text-red-600 dark:text-red-500">
                  ${bestNoAsk.price.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">{bestNoAsk.quantity} shares</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No asks</p>
            )}
          </div>
        </div>

        {/* Order Book Tables */}
        <div className="grid grid-cols-2 gap-4">
          {/* Yes Orders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-foreground">Yes Orders</h4>
              <Badge className="bg-green-600">Buy</Badge>
            </div>
            <div className="space-y-1">
              {yesOrders.slice(0, 5).map(order => (
                <div key={order.id} className="flex justify-between text-xs p-2 bg-green-50 dark:bg-green-950/10 rounded">
                  <span className="font-medium text-green-600 dark:text-green-500">
                    ${order.price.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">{order.quantity}</span>
                </div>
              ))}
              {yesOrders.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-2">No orders</p>
              )}
            </div>
          </div>

          {/* No Orders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-foreground">No Orders</h4>
              <Badge variant="destructive">Sell</Badge>
            </div>
            <div className="space-y-1">
              {noOrders.slice(0, 5).map(order => (
                <div key={order.id} className="flex justify-between text-xs p-2 bg-red-50 dark:bg-red-950/10 rounded">
                  <span className="font-medium text-red-600 dark:text-red-500">
                    ${order.price.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">{order.quantity}</span>
                </div>
              ))}
              {noOrders.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-2">No orders</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default OrderBook;
