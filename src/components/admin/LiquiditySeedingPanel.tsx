import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, Loader2, CheckCircle, AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MarketForSeeding {
  id: string;
  question: string;
  status: string;
  yes_price: number;
  no_price: number;
  volume: number;
  pool_enabled: boolean;
}

const PRICE_LEVELS = [
  { yes: 0.10, no: 0.90 },
  { yes: 0.20, no: 0.80 },
  { yes: 0.30, no: 0.70 },
  { yes: 0.40, no: 0.60 },
  { yes: 0.50, no: 0.50 },
  { yes: 0.60, no: 0.40 },
  { yes: 0.70, no: 0.30 },
  { yes: 0.80, no: 0.20 },
  { yes: 0.90, no: 0.10 },
];

const LiquiditySeedingPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [quantityPerLevel, setQuantityPerLevel] = useState<number>(100);
  const [seedingProgress, setSeedingProgress] = useState<string[]>([]);

  const { data: markets, isLoading } = useQuery({
    queryKey: ['markets-for-seeding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('id, question, status, yes_price, no_price, volume, pool_enabled')
        .in('status', ['approved', 'open'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MarketForSeeding[];
    },
  });

  const togglePoolMutation = useMutation({
    mutationFn: async ({ marketId, enabled }: { marketId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('markets')
        .update({ pool_enabled: enabled })
        .eq('id', marketId);
      
      if (error) throw error;
      return { marketId, enabled };
    },
    onSuccess: ({ enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['markets-for-seeding'] });
      toast({
        title: enabled ? "Pool Enabled" : "Pool Disabled",
        description: `Liquidity pool has been ${enabled ? 'enabled' : 'disabled'} for this market`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update pool status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: existingOrders } = useQuery({
    queryKey: ['existing-orders', selectedMarket],
    queryFn: async () => {
      if (!selectedMarket) return { yes: 0, no: 0 };
      
      const { data, error } = await supabase
        .from('orders')
        .select('side, quantity, filled_quantity')
        .eq('market_id', selectedMarket)
        .in('status', ['pending', 'partial']);

      if (error) throw error;
      
      const yesOrders = data?.filter(o => o.side === 'yes').reduce((sum, o) => sum + Number(o.quantity) - Number(o.filled_quantity), 0) || 0;
      const noOrders = data?.filter(o => o.side === 'no').reduce((sum, o) => sum + Number(o.quantity) - Number(o.filled_quantity), 0) || 0;
      
      return { yes: yesOrders, no: noOrders };
    },
    enabled: !!selectedMarket,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMarket || quantityPerLevel <= 0) {
        throw new Error('Please select a market and enter a valid quantity');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      setSeedingProgress([]);
      const results: string[] = [];

      // Place YES limit orders at different price levels
      for (const level of PRICE_LEVELS) {
        try {
          const { error: yesError } = await supabase.functions.invoke('order-book', {
            body: {
              action: 'place',
              market_id: selectedMarket,
              side: 'yes',
              order_type: 'limit',
              quantity: quantityPerLevel,
              price: level.yes,
            },
          });

          if (yesError) {
            results.push(`❌ YES @ $${level.yes.toFixed(2)}: ${yesError.message}`);
          } else {
            results.push(`✅ YES @ $${level.yes.toFixed(2)}: ${quantityPerLevel} shares`);
          }
          setSeedingProgress([...results]);

          const { error: noError } = await supabase.functions.invoke('order-book', {
            body: {
              action: 'place',
              market_id: selectedMarket,
              side: 'no',
              order_type: 'limit',
              quantity: quantityPerLevel,
              price: level.no,
            },
          });

          if (noError) {
            results.push(`❌ NO @ $${level.no.toFixed(2)}: ${noError.message}`);
          } else {
            results.push(`✅ NO @ $${level.no.toFixed(2)}: ${quantityPerLevel} shares`);
          }
          setSeedingProgress([...results]);
        } catch (err: any) {
          results.push(`❌ Error at level ${level.yes}: ${err.message}`);
          setSeedingProgress([...results]);
        }
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['existing-orders', selectedMarket] });
      queryClient.invalidateQueries({ queryKey: ['markets-for-seeding'] });
      toast({
        title: "Liquidity seeded!",
        description: `Successfully placed orders across ${PRICE_LEVELS.length} price levels`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Seeding failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedMarketData = markets?.find(m => m.id === selectedMarket);

  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">About Liquidity Seeding</p>
            <p className="text-xs">
              This tool places initial limit orders at various price levels to bootstrap market liquidity.
              Orders are placed from the admin account's balance. Each price level gets both YES and NO orders.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Droplets className="h-5 w-5 text-primary" />
          Seed Market Liquidity
        </h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="market-select">Select Market</Label>
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Choose a market to seed" />
              </SelectTrigger>
              <SelectContent className="bg-card max-h-64">
                {markets?.map(market => (
                  <SelectItem key={market.id} value={market.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant={market.volume > 0 ? "default" : "secondary"} className="text-xs">
                        {market.volume > 0 ? `${market.volume} vol` : 'No trades'}
                      </Badge>
                      <span className="truncate max-w-[300px]">{market.question}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMarketData && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Liquidity Pool:</span>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${selectedMarketData.pool_enabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {selectedMarketData.pool_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Switch
                    checked={selectedMarketData.pool_enabled}
                    onCheckedChange={(checked) => togglePoolMutation.mutate({ marketId: selectedMarket, enabled: checked })}
                    disabled={togglePoolMutation.isPending}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current YES Price:</span>
                <span className="font-medium text-green-600">${Number(selectedMarketData.yes_price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current NO Price:</span>
                <span className="font-medium text-red-600">${Number(selectedMarketData.no_price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volume:</span>
                <span className="font-medium">{selectedMarketData.volume} shares</span>
              </div>
              {existingOrders && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending Orders:</span>
                  <span className="font-medium">
                    {existingOrders.yes} YES / {existingOrders.no} NO
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="quantity">Shares per Price Level</Label>
            <Input
              id="quantity"
              type="number"
              value={quantityPerLevel}
              onChange={(e) => setQuantityPerLevel(Number(e.target.value))}
              min={1}
              max={10000}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Total orders: {PRICE_LEVELS.length * 2} ({PRICE_LEVELS.length} YES + {PRICE_LEVELS.length} NO)
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Price Levels to Seed:</p>
            <div className="flex flex-wrap gap-1">
              {PRICE_LEVELS.map((level, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  ${level.yes.toFixed(2)}
                </Badge>
              ))}
            </div>
          </div>

          <Button
            onClick={() => seedMutation.mutate()}
            disabled={!selectedMarket || quantityPerLevel <= 0 || seedMutation.isPending}
            className="w-full h-12"
          >
            {seedMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Seeding Liquidity...
              </>
            ) : (
              <>
                <Droplets className="h-4 w-4 mr-2" />
                Seed Liquidity ({PRICE_LEVELS.length * 2} orders)
              </>
            )}
          </Button>
        </div>
      </Card>

      {seedingProgress.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Seeding Progress
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono bg-muted/50 rounded p-3">
            {seedingProgress.map((msg, i) => (
              <div key={i} className={msg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}>
                {msg}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default LiquiditySeedingPanel;
