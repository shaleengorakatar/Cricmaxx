import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Trade {
  id: string;
  market_id: string;
  side: string;
  size: number;
  entry_price: number;
  pnl: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

const TradingHistoryPanel = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchTrades();
  }, [filter]);

  const fetchTrades = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('positions')
        .select('*')
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error('Error fetching trades:', error);
      toast({
        title: "Error",
        description: "Failed to load trading history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== null);
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;
    const activeTrades = trades.filter(t => t.status === 'open').length;

    return { totalPnL, winRate, activeTrades, totalTrades: closedTrades.length };
  };

  const stats = calculateStats();

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Trading History</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "open" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("open")}
          >
            Open
          </Button>
          <Button
            variant={filter === "closed" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("closed")}
          >
            Closed
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-muted rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
          <p className={`text-lg font-bold ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
          </p>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
          <p className="text-lg font-bold text-foreground">{stats.winRate.toFixed(1)}%</p>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Active</p>
          <p className="text-lg font-bold text-primary">{stats.activeTrades}</p>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Closed</p>
          <p className="text-lg font-bold text-foreground">{stats.totalTrades}</p>
        </div>
      </div>

      {/* Trades List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : trades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No {filter !== 'all' ? filter : ''} trades found
          </div>
        ) : (
          trades.map((trade) => (
            <div
              key={trade.id}
              className="bg-card border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={trade.side === 'yes' ? 'default' : 'secondary'}>
                      {trade.side.toUpperCase()}
                    </Badge>
                    <Badge variant={trade.status === 'open' ? 'outline' : 'secondary'}>
                      {trade.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Market ID: {trade.market_id.slice(0, 8)}...</p>
                </div>
                {trade.status === 'closed' && trade.pnl !== null && (
                  <div className="flex items-center gap-1">
                    {trade.pnl >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`font-bold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Size: </span>
                  <span className="font-semibold">{trade.size} shares</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Entry: </span>
                  <span className="font-semibold">${trade.entry_price.toFixed(2)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Opened: </span>
                  <span className="text-xs">{new Date(trade.opened_at).toLocaleString()}</span>
                </div>
                {trade.closed_at && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Closed: </span>
                    <span className="text-xs">{new Date(trade.closed_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default TradingHistoryPanel;
