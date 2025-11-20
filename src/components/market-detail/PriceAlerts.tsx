import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface PriceAlert {
  id: string;
  target_price: number;
  side: string;
  condition: string;
  triggered: boolean;
  created_at: string;
}

interface PriceAlertsProps {
  marketId: string;
  currentYesPrice: number;
  currentNoPrice: number;
}

const PriceAlerts = ({ marketId, currentYesPrice, currentNoPrice }: PriceAlertsProps) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [targetPrice, setTargetPrice] = useState("");
  
  const { toast } = useToast();

  useEffect(() => {
    fetchAlerts();
  }, [marketId]);

  const fetchAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('price_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('market_id', marketId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to create price alerts",
          variant: "destructive",
        });
        return;
      }

      const price = parseFloat(targetPrice);
      if (isNaN(price) || price <= 0.01 || price >= 0.99) {
        toast({
          title: "Invalid price",
          description: "Target price must be between $0.01 and $0.99",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('price_alerts')
        .insert({
          user_id: user.id,
          market_id: marketId,
          target_price: price,
          side,
          condition,
        });

      if (error) throw error;

      toast({
        title: "Alert created",
        description: `You'll be notified when ${side.toUpperCase()} price goes ${condition} $${price.toFixed(2)}`,
      });

      setTargetPrice("");
      setShowForm(false);
      fetchAlerts();
    } catch (error) {
      console.error('Error creating alert:', error);
      toast({
        title: "Error",
        description: "Failed to create price alert",
        variant: "destructive",
      });
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('price_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "Alert deleted",
        description: "Price alert has been removed",
      });

      fetchAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast({
        title: "Error",
        description: "Failed to delete price alert",
        variant: "destructive",
      });
    }
  };

  const currentPrice = side === "yes" ? currentYesPrice : currentNoPrice;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Price Alerts</h3>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? "outline" : "default"}
        >
          <Plus className="h-4 w-4 mr-1" />
          {showForm ? "Cancel" : "New Alert"}
        </Button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-muted rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="alert-side" className="text-xs">Outcome</Label>
              <Select value={side} onValueChange={(value: "yes" | "no") => setSide(value)}>
                <SelectTrigger id="alert-side" className="bg-card h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="alert-condition" className="text-xs">Condition</Label>
              <Select value={condition} onValueChange={(value: "above" | "below") => setCondition(value)}>
                <SelectTrigger id="alert-condition" className="bg-card h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  <SelectItem value="above">Goes Above</SelectItem>
                  <SelectItem value="below">Goes Below</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="alert-price" className="text-xs">
              Target Price (Current: ${currentPrice.toFixed(2)})
            </Label>
            <Input
              id="alert-price"
              type="number"
              placeholder="0.50"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              min="0.01"
              max="0.99"
              step="0.01"
              className="h-10"
            />
          </div>
          <Button onClick={createAlert} className="w-full" size="sm">
            Create Alert
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No alerts set. Create one to get notified!
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                alert.triggered ? 'bg-muted/50 border-muted' : 'bg-card border-border'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={alert.side === 'yes' ? 'default' : 'secondary'} className="text-xs">
                    {alert.side.toUpperCase()}
                  </Badge>
                  {alert.triggered && (
                    <Badge variant="outline" className="text-xs">
                      Triggered
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">
                  Alert when price goes {alert.condition} ${alert.target_price.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(alert.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteAlert(alert.id)}
                className="ml-2"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default PriceAlerts;
