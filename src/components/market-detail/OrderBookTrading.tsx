import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface OrderBookTradingProps {
  marketId: string;
  userBalance: number;
  onOrderPlaced: () => void;
}

const OrderBookTrading = ({ marketId, userBalance, onOrderPlaced }: OrderBookTradingProps) => {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const { toast } = useToast();

  const handleSubmit = () => {
    const qty = parseInt(quantity);
    const prc = parseFloat(price);

    if (!quantity || qty <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid quantity greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (orderType === "limit" && (!price || prc <= 0 || prc >= 1)) {
      toast({
        title: "Invalid price",
        description: "Price must be between $0.01 and $0.99",
        variant: "destructive",
      });
      return;
    }

    const estimatedCost = orderType === "limit" ? qty * prc : qty * 0.50;
    if (estimatedCost > userBalance) {
      toast({
        title: "Insufficient balance",
        description: `You need at least ${estimatedCost.toFixed(2)} credits`,
        variant: "destructive",
      });
      return;
    }

    // Simulate order placement
    toast({
      title: "Order placed",
      description: `${orderType === "market" ? "Market" : "Limit"} order for ${qty} ${side.toUpperCase()} shares at ${orderType === "limit" ? `$${prc.toFixed(2)}` : "market price"}`,
    });

    setQuantity("");
    setPrice("");
    onOrderPlaced();
  };

  return (
    <Card className="p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 hidden md:block">Place Order</h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="order-type" className="text-sm sm:text-base">Order Type</Label>
          <Select value={orderType} onValueChange={(value: "limit" | "market") => setOrderType(value)}>
            <SelectTrigger id="order-type" className="bg-card h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="limit" className="text-base py-3">Limit Order</SelectItem>
              <SelectItem value="market" className="text-base py-3">Market Order</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="side" className="text-sm sm:text-base">Outcome</Label>
          <Select value={side} onValueChange={(value: "yes" | "no") => setSide(value)}>
            <SelectTrigger id="side" className="bg-card h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="yes" className="text-base py-3">Yes</SelectItem>
              <SelectItem value="no" className="text-base py-3">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="quantity" className="text-sm sm:text-base">Quantity (shares)</Label>
          <Input
            id="quantity"
            type="number"
            placeholder="100"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            className="h-12 text-base"
          />
        </div>

        {orderType === "limit" && (
          <div>
            <Label htmlFor="price" className="text-sm sm:text-base">Price per share ($)</Label>
            <Input
              id="price"
              type="number"
              placeholder="0.50"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0.01"
              max="0.99"
              step="0.01"
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Price must be between $0.01 and $0.99
            </p>
          </div>
        )}

        <div className="bg-muted rounded-lg p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Estimated cost:</span>
            <span className="font-semibold text-foreground">
              {quantity && (orderType === "limit" ? price : true) 
                ? `${(parseInt(quantity) * (orderType === "limit" ? parseFloat(price) : 0.50)).toFixed(2)} credits`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Available balance:</span>
            <span className="font-semibold text-foreground">{userBalance.toLocaleString()} credits</span>
          </div>
        </div>

        <Button 
          onClick={handleSubmit}
          className={`w-full h-12 text-base font-semibold ${side === "yes" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white active:scale-[0.98] transition-transform`}
        >
          Place {side.toUpperCase()} Order
        </Button>
      </div>
    </Card>
  );
};

export default OrderBookTrading;
