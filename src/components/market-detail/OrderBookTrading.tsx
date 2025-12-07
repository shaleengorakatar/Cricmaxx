import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Loader2, Info, X, Lock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface UserPosition {
  id: string;
  side: string;
  size: number;
  entry_price: number;
  status: string;
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
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  
  // Market order eligibility
  const [totalYesOrders, setTotalYesOrders] = useState(0);
  const [totalNoOrders, setTotalNoOrders] = useState(0);
  const marketOrdersEnabled = totalYesOrders >= 5 && totalNoOrders >= 5;

  useEffect(() => {
    fetchOrderBook();
    if (user) {
      fetchUserOrders();
      fetchUserPosition();
    }

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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'positions',
          filter: `market_id=eq.${marketId}`
        },
        () => {
          if (user) fetchUserPosition();
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

    // Count total orders for market order eligibility
    setTotalYesOrders(yesOrders?.length || 0);
    setTotalNoOrders(noOrders?.length || 0);

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

  const fetchUserPosition = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('positions')
      .select('*')
      .eq('market_id', marketId)
      .eq('user_id', user.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    // Combine positions if multiple exist
    if (data && data.length > 0) {
      setUserPosition(data[0]);
    } else {
      setUserPosition(null);
    }
  };

  const handleSimpleTrade = async () => {
    if (!user) {
      toast({ title: "Please sign in to trade", variant: "destructive" });
      return;
    }

    if (!marketOrdersEnabled) {
      toast({ 
        title: "Market orders not yet available", 
        description: "Please use a limit order until more orders are placed.",
        variant: "destructive" 
      });
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
        title: "Prediction placed!",
        description: data.order?.filledQuantity > 0 
          ? `You now own ${data.order.filledQuantity} ${side.toUpperCase()} shares`
          : "Order added to book",
      });

      setInvestAmount("");
      fetchOrderBook();
      fetchUserOrders();
      fetchUserPosition();
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
      fetchUserPosition();
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
  const potentialProfit = estimatedShares * (1 - currentPrice);
  const advancedCost = quantity && limitPrice ? parseFloat(quantity) * parseFloat(limitPrice) : 0;

  return (
    <Card className="p-4 sm:p-6">
      {/* User's Current Position - Show prominently if they have one */}
      {userPosition && (
        <div className={`mb-4 p-4 rounded-lg border-2 ${
          userPosition.side === 'yes' 
            ? 'bg-green-50 dark:bg-green-950/20 border-green-500' 
            : 'bg-red-50 dark:bg-red-950/20 border-red-500'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Your Position</span>
            <Badge variant={userPosition.side === 'yes' ? 'default' : 'destructive'}>
              {userPosition.side.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{userPosition.size}</span>
            <span className="text-muted-foreground">shares</span>
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-muted-foreground">Avg price:</span>
            <span className="font-medium">${Number(userPosition.entry_price).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Potential payout:</span>
            <span className="font-medium text-green-600">${userPosition.size.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Side Selection */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button
          variant={side === "yes" ? "default" : "outline"}
          className={`h-16 ${side === "yes" ? "bg-green-600 hover:bg-green-700" : ""}`}
          onClick={() => setSide("yes")}
        >
          <TrendingUp className="h-5 w-5 mr-2" />
          <div className="text-left">
            <div className="font-bold text-lg">YES</div>
            <div className="text-xs opacity-80">{(yesPrice * 100).toFixed(0)}¢</div>
          </div>
        </Button>
        <Button
          variant={side === "no" ? "default" : "outline"}
          className={`h-16 ${side === "no" ? "bg-red-600 hover:bg-red-700" : ""}`}
          onClick={() => setSide("no")}
        >
          <TrendingDown className="h-5 w-5 mr-2" />
          <div className="text-left">
            <div className="font-bold text-lg">NO</div>
            <div className="text-xs opacity-80">{(noPrice * 100).toFixed(0)}¢</div>
          </div>
        </Button>
      </div>

      {/* Trading Mode Tabs */}
      <Tabs value={tradingMode} onValueChange={(v) => setTradingMode(v as "simple" | "advanced")}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="simple" className="relative">
            Quick Predict
            {!marketOrdersEnabled && (
              <Lock className="h-3 w-3 ml-1 text-muted-foreground" />
            )}
          </TabsTrigger>
          <TabsTrigger value="advanced">Set Your Price</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-4">
          {/* Market order lock notice */}
          {!marketOrdersEnabled && (
            <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-500">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                <strong>Quick predictions unlock after 5 orders on each side.</strong>
                <br />
                <span className="text-muted-foreground">
                  Currently: {totalYesOrders} YES, {totalNoOrders} NO orders. 
                  Use "Set Your Price" to place limit orders now.
                </span>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">
              How much do you want to invest?
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="10.00"
                value={investAmount}
                onChange={(e) => setInvestAmount(e.target.value)}
                className="pl-7 h-12 text-lg"
                min="0"
                step="1"
                disabled={!marketOrdersEnabled}
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[5, 10, 25, 50].map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setInvestAmount(amt.toString())}
                  disabled={!marketOrdersEnabled}
                >
                  ${amt}
                </Button>
              ))}
            </div>
          </div>

          {investAmount && parseFloat(investAmount) > 0 && marketOrdersEnabled && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">You'll get approximately</span>
                <span className="text-xl font-bold">{estimatedShares} shares</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">If {side.toUpperCase()} wins:</span>
                <span className="font-bold text-green-600">+${potentialProfit.toFixed(2)} profit</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">If {side === 'yes' ? 'NO' : 'YES'} wins:</span>
                <span className="font-medium text-red-600">-${investAmount} loss</span>
              </div>
            </div>
          )}

          <Button
            className="w-full h-12 text-lg"
            onClick={handleSimpleTrade}
            disabled={isSubmitting || !investAmount || parseFloat(investAmount) <= 0 || !marketOrdersEnabled}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {marketOrdersEnabled 
              ? `Predict ${side.toUpperCase()}` 
              : 'Use "Set Your Price" Instead'}
          </Button>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <p className="text-sm text-muted-foreground mb-2">
            Set your own price and wait for someone to match, or trade instantly from the pool.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Shares</Label>
              <Input
                type="number"
                placeholder="10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-12"
                min="1"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Price (¢ per share)
              </Label>
              <Input
                type="number"
                placeholder="50"
                value={limitPrice ? (parseFloat(limitPrice) * 100).toString() : ''}
                onChange={(e) => {
                  const cents = parseFloat(e.target.value) || 0;
                  setLimitPrice((cents / 100).toFixed(2));
                }}
                className="h-12"
                min="1"
                max="99"
                step="1"
              />
            </div>
          </div>

          {advancedCost > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total cost:</span>
                <span className="font-bold text-lg">${advancedCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">If {side.toUpperCase()} wins:</span>
                <span className="font-medium text-green-600">
                  +${(parseFloat(quantity) - advancedCost).toFixed(2)} profit
                </span>
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

          {/* Market Depth - Simplified */}
          {(orderBook.yes.length > 0 || orderBook.no.length > 0) && (
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Current Orders</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-green-600 font-medium mb-1">YES Orders ({totalYesOrders})</div>
                  {orderBook.yes.length > 0 ? (
                    orderBook.yes.slice(0, 3).map((level, i) => (
                      <div key={i} className="flex justify-between py-0.5 text-muted-foreground">
                        <span>{(level.price * 100).toFixed(0)}¢</span>
                        <span>{level.quantity} shares</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No orders yet</div>
                  )}
                </div>
                <div>
                  <div className="text-red-600 font-medium mb-1">NO Orders ({totalNoOrders})</div>
                  {orderBook.no.length > 0 ? (
                    orderBook.no.slice(0, 3).map((level, i) => (
                      <div key={i} className="flex justify-between py-0.5 text-muted-foreground">
                        <span>{(level.price * 100).toFixed(0)}¢</span>
                        <span>{level.quantity} shares</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No orders yet</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* User's Open Orders */}
      {userOrders.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium mb-3">Your Pending Orders</h4>
          <div className="space-y-2">
            {userOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between bg-muted/30 rounded p-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={order.side === 'yes' ? 'default' : 'secondary'} className={
                    order.side === 'yes' ? 'bg-green-600' : 'bg-red-600'
                  }>
                    {order.side.toUpperCase()}
                  </Badge>
                  <span>
                    {order.quantity} @ {(Number(order.price) * 100).toFixed(0)}¢
                  </span>
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
        Available balance: <span className="font-semibold text-foreground">${userBalance.toFixed(2)}</span>
      </div>
    </Card>
  );
};

export default OrderBookTrading;
