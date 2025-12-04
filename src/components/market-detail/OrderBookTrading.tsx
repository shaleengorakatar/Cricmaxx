import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Loader2, Info, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OrderBookTradingProps {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  userBalance: number;
}

interface OrderBookLevel {
  price: number;
  quantity: number;
}

interface UserOrder {
  id: string;
  side: string;
  price: number;
  quantity: number;
  filled_quantity: number;
  status: string;
  created_at: string;
}

const OrderBookTrading = ({ marketId, yesPrice, noPrice, userBalance }: OrderBookTradingProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tradingMode, setTradingMode] = useState<"simple" | "advanced">("simple");
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Simple mode state
  const [investAmount, setInvestAmount] = useState("");
  
  // Advanced mode state
  const [limitPrice, setLimitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  
  // Order book state
  const [orderBook, setOrderBook] = useState<{ yes: OrderBookLevel[]; no: OrderBookLevel[] }>({ yes: [], no: [] });
  const [userOrders, setUserOrders] = useState<UserOrder[]>([]);

  useEffect(() => {
    fetchOrderBook();
    if (user) fetchUserOrders();

    // Subscribe to real-time order book updates
    const channel = supabase
      .channel(`orderbook-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `market_id=eq.${marketId}`
        },
        () => {
          fetchOrderBook();
          if (user) fetchUserOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, user]);

  const fetchOrderBook = async () => {
    const { data: yesOrders } = await supabase
      .from('orders')
      .select('price, quantity, filled_quantity')
      .eq('market_id', marketId)
      .eq('side', 'yes')
      .in('status', ['pending', 'partial'])
      .order('price', { ascending: false });

    const { data: noOrders } = await supabase
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

    setOrderBook({
      yes: aggregateOrders(yesOrders || []),
      no: aggregateOrders(noOrders || [])
    });
  };

  const fetchUserOrders = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('market_id', marketId)
      .eq('user_id', user.id)
      .in('status', ['pending', 'partial'])
      .order('created_at', { ascending: false });

    setUserOrders(data || []);
  };

  const handleSimpleTrade = async () => {
    if (!user) {
      toast({ title: "Please sign in to trade", variant: "destructive" });
      return;
    }

    const amount = parseFloat(investAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }

    if (amount > userBalance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const bestPrice = side === "yes" ? yesPrice : noPrice;
      const estimatedShares = Math.floor(amount / Math.max(bestPrice, 0.01));

      const { data, error } = await supabase.functions.invoke('order-book', {
        body: {
          action: 'place',
          marketId,
          side,
          orderType: 'market',
          quantity: estimatedShares
        }
      });

      if (error) throw error;

      toast({
        title: "Order placed!",
        description: data.order?.filledQuantity > 0 
          ? `Filled ${data.order.filledQuantity} shares at avg price $${data.order.avgFillPrice?.toFixed(2) || 'N/A'}`
          : "Order added to order book",
      });

      setInvestAmount("");
      fetchOrderBook();
      fetchUserOrders();
    } catch (error: any) {
      toast({
        title: "Order failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvancedTrade = async () => {
    if (!user) {
      toast({ title: "Please sign in to trade", variant: "destructive" });
      return;
    }

    const price = parseFloat(limitPrice);
    const qty = parseFloat(quantity);

    if (!price || price <= 0 || price >= 1) {
      toast({ title: "Price must be between $0.01 and $0.99", variant: "destructive" });
      return;
    }

    if (!qty || qty <= 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }

    const cost = qty * price;
    if (cost > userBalance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('order-book', {
        body: {
          action: 'place',
          marketId,
          side,
          orderType: 'limit',
          quantity: qty,
          price
        }
      });

      if (error) throw error;

      const status = data.order?.filledQuantity >= qty ? 'Filled' : 
        data.order?.filledQuantity > 0 ? 'Partially filled' : 'Placed in order book';

      toast({
        title: status,
        description: `${data.order?.filledQuantity || 0}/${qty} shares @ $${price.toFixed(2)}`,
      });

      setLimitPrice("");
      setQuantity("");
      fetchOrderBook();
      fetchUserOrders();
    } catch (error: any) {
      toast({
        title: "Order failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const { error } = await supabase.functions.invoke('order-book', {
        body: { action: 'cancel', orderId }
      });

      if (error) throw error;

      toast({ title: "Order cancelled" });
      fetchUserOrders();
      fetchOrderBook();
    } catch (error: any) {
      toast({
        title: "Cancel failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const currentPrice = side === "yes" ? yesPrice : noPrice;
  const estimatedShares = investAmount ? Math.floor(parseFloat(investAmount) / Math.max(currentPrice, 0.01)) : 0;
  const estimatedPayout = estimatedShares * 1;
  const advancedCost = quantity && limitPrice ? parseFloat(quantity) * parseFloat(limitPrice) : 0;

  return (
    <Card className="p-4 sm:p-6">
      {/* Side Selection */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button
          variant={side === "yes" ? "default" : "outline"}
          className={`h-14 ${side === "yes" ? "bg-green-600 hover:bg-green-700" : ""}`}
          onClick={() => setSide("yes")}
        >
          <TrendingUp className="h-5 w-5 mr-2" />
          <div className="text-left">
            <div className="font-bold">YES</div>
            <div className="text-xs opacity-80">${yesPrice.toFixed(2)}</div>
          </div>
        </Button>
        <Button
          variant={side === "no" ? "default" : "outline"}
          className={`h-14 ${side === "no" ? "bg-red-600 hover:bg-red-700" : ""}`}
          onClick={() => setSide("no")}
        >
          <TrendingDown className="h-5 w-5 mr-2" />
          <div className="text-left">
            <div className="font-bold">NO</div>
            <div className="text-xs opacity-80">${noPrice.toFixed(2)}</div>
          </div>
        </Button>
      </div>

      {/* Trading Mode Tabs */}
      <Tabs value={tradingMode} onValueChange={(v) => setTradingMode(v as "simple" | "advanced")}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="simple">Simple</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">
              How much to invest?
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="0.00"
                value={investAmount}
                onChange={(e) => setInvestAmount(e.target.value)}
                className="pl-7 h-12 text-lg"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {investAmount && parseFloat(investAmount) > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current odds:</span>
                <span className="font-medium">{(currentPrice * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. shares:</span>
                <span className="font-medium">~{estimatedShares}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Potential payout:</span>
                <span className="font-medium text-green-600">${estimatedPayout.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max loss:</span>
                <span className="font-medium text-red-600">${investAmount}</span>
              </div>
            </div>
          )}

          <Button
            className="w-full h-12"
            onClick={handleSimpleTrade}
            disabled={isSubmitting || !investAmount || parseFloat(investAmount) <= 0}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Buy {side.toUpperCase()} (Market Order)
          </Button>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Shares</Label>
              <Input
                type="number"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-12"
                min="1"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Price ($)</Label>
              <Input
                type="number"
                placeholder="0.50"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="h-12"
                min="0.01"
                max="0.99"
                step="0.01"
              />
            </div>
          </div>

          {advancedCost > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total cost:</span>
                <span className="font-medium">${advancedCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Potential payout:</span>
                <span className="font-medium text-green-600">${(parseFloat(quantity) * 1).toFixed(2)}</span>
              </div>
            </div>
          )}

          <Button
            className="w-full h-12"
            onClick={handleAdvancedTrade}
            disabled={isSubmitting || !quantity || !limitPrice}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Place Limit Order
          </Button>

          {/* Market Depth */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              Market Depth
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">
                      Shows pending buy orders. Your limit order matches with opposite side orders.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-green-600 font-medium mb-1">YES Bids</div>
                {orderBook.yes.length > 0 ? (
                  orderBook.yes.map((level, i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span>${level.price.toFixed(2)}</span>
                      <span className="text-muted-foreground">{level.quantity}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">No orders</div>
                )}
              </div>
              <div>
                <div className="text-red-600 font-medium mb-1">NO Bids</div>
                {orderBook.no.length > 0 ? (
                  orderBook.no.map((level, i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span>${level.price.toFixed(2)}</span>
                      <span className="text-muted-foreground">{level.quantity}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">No orders</div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* User's Open Orders */}
      {userOrders.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium mb-3">Your Open Orders</h4>
          <div className="space-y-2">
            {userOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between bg-muted/30 rounded p-2 text-sm">
                <div>
                  <Badge variant={order.side === 'yes' ? 'default' : 'secondary'} className="mr-2">
                    {order.side.toUpperCase()}
                  </Badge>
                  {order.filled_quantity}/{order.quantity} @ ${Number(order.price).toFixed(2)}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancelOrder(order.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance display */}
      <div className="border-t pt-3 mt-4 text-sm text-muted-foreground text-center">
        Available: ${userBalance.toFixed(2)}
      </div>
    </Card>
  );
};

export default OrderBookTrading;
