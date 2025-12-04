import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DollarSign, Percent, TrendingUp, Save } from "lucide-react";

const PlatformFeesPanel = () => {
  const [defaultPlatformFee, setDefaultPlatformFee] = useState<string>("3.00");
  const [defaultCreatorFee, setDefaultCreatorFee] = useState<string>("2.00");
  const queryClient = useQueryClient();

  // Fetch platform revenue from trades
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['platform-revenue'],
    queryFn: async () => {
      // Get all trades with their market fee info
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select(`
          id,
          price,
          quantity,
          created_at,
          market_id,
          markets!inner (
            question,
            platform_fee_percent,
            creator_fee_percent,
            created_by
          )
        `);

      if (tradesError) throw tradesError;

      // Calculate platform revenue per trade
      let totalPlatformRevenue = 0;
      let totalCreatorFees = 0;
      let tradeCount = 0;

      const marketRevenue: Record<string, { 
        question: string; 
        platformFees: number; 
        creatorFees: number;
        tradeCount: number;
      }> = {};

      trades?.forEach((trade: any) => {
        const tradeValue = trade.price * trade.quantity;
        const platformFeePercent = trade.markets?.platform_fee_percent || 3;
        const creatorFeePercent = trade.markets?.creator_fee_percent || 2;
        
        const platformFee = tradeValue * (platformFeePercent / 100);
        const creatorFee = tradeValue * (creatorFeePercent / 100);
        
        totalPlatformRevenue += platformFee;
        totalCreatorFees += creatorFee;
        tradeCount++;

        const marketId = trade.market_id;
        if (!marketRevenue[marketId]) {
          marketRevenue[marketId] = {
            question: trade.markets?.question || 'Unknown Market',
            platformFees: 0,
            creatorFees: 0,
            tradeCount: 0
          };
        }
        marketRevenue[marketId].platformFees += platformFee;
        marketRevenue[marketId].creatorFees += creatorFee;
        marketRevenue[marketId].tradeCount++;
      });

      return {
        totalPlatformRevenue,
        totalCreatorFees,
        tradeCount,
        marketBreakdown: Object.entries(marketRevenue)
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => b.platformFees - a.platformFees)
          .slice(0, 10) // Top 10 markets
      };
    },
    refetchInterval: 30000
  });

  // Update all pending/new markets with default fees
  const updateDefaultFees = useMutation({
    mutationFn: async () => {
      const platformFee = parseFloat(defaultPlatformFee);
      const creatorFee = parseFloat(defaultCreatorFee);

      if (isNaN(platformFee) || platformFee < 0 || platformFee > 10) {
        throw new Error('Platform fee must be between 0% and 10%');
      }
      if (isNaN(creatorFee) || creatorFee < 0 || creatorFee > 10) {
        throw new Error('Creator fee must be between 0% and 10%');
      }

      // Update pending markets with new default fees
      const { error } = await supabase
        .from('markets')
        .update({
          platform_fee_percent: platformFee,
          creator_fee_percent: creatorFee
        })
        .eq('status', 'pending');

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Default fees updated for pending markets');
      queryClient.invalidateQueries({ queryKey: ['platform-revenue'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update fees');
    }
  });

  return (
    <div className="space-y-6">
      {/* Revenue Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Platform Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-primary">
                  ${revenueData?.totalPlatformRevenue.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {revenueData?.tradeCount || 0} trades
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Creator Fees Paid</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-accent">
                  ${revenueData?.totalCreatorFees.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Distributed to creators
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Platform Revenue</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  ${((revenueData?.totalPlatformRevenue || 0)).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  After all deductions
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fee Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Default Fee Configuration</CardTitle>
          <CardDescription>
            Set default platform and creator fees for new markets. These will be applied to pending markets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platformFee">Default Platform Fee (%)</Label>
              <Input
                id="platformFee"
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={defaultPlatformFee}
                onChange={(e) => setDefaultPlatformFee(e.target.value)}
                placeholder="3.00"
              />
              <p className="text-xs text-muted-foreground">
                Fee charged on each trade (0-10%)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="creatorFee">Default Creator Fee (%)</Label>
              <Input
                id="creatorFee"
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={defaultCreatorFee}
                onChange={(e) => setDefaultCreatorFee(e.target.value)}
                placeholder="2.00"
              />
              <p className="text-xs text-muted-foreground">
                Fee paid to market creators (0-10%)
              </p>
            </div>
          </div>
          <Button 
            onClick={() => updateDefaultFees.mutate()}
            disabled={updateDefaultFees.isPending}
            className="mt-4"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateDefaultFees.isPending ? 'Saving...' : 'Update Default Fees'}
          </Button>
        </CardContent>
      </Card>

      {/* Revenue by Market */}
      <Card>
        <CardHeader>
          <CardTitle>Top Revenue Markets</CardTitle>
          <CardDescription>
            Markets generating the most platform fees
          </CardDescription>
        </CardHeader>
        <CardContent>
          {revenueLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : revenueData?.marketBreakdown.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No trading activity yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">Trades</TableHead>
                  <TableHead className="text-right">Platform Fees</TableHead>
                  <TableHead className="text-right">Creator Fees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueData?.marketBreakdown.map((market) => (
                  <TableRow key={market.id}>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {market.question}
                    </TableCell>
                    <TableCell className="text-right">{market.tradeCount}</TableCell>
                    <TableCell className="text-right text-primary">
                      ${market.platformFees.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-accent">
                      ${market.creatorFees.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformFeesPanel;
