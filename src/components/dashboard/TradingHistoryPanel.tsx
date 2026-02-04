import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, TrendingUp, TrendingDown, Clock } from "lucide-react";
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
  type: 'position' | 'order';
  marketQuestion?: string;
}

// Check if an error is auth-related
function isAuthError(error: any): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  const code = error.code || '';
  return (
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('auth') ||
    message.includes('permission denied') ||
    message.includes('missing sub claim') ||
    code === '401' ||
    code === 'PGRST301' ||
    code === '42501'
  );
}

const TradingHistoryPanel = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "closed" | "pending">("all");
  const { toast } = useToast();
  const [hasRetried, setHasRetried] = useState(false);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let allTrades: Trade[] = [];

      // Fetch positions (filled trades)
      if (filter !== 'pending') {
        let positionQuery = supabase
          .from('positions')
          .select(`
            id,
            market_id,
            side,
            size,
            entry_price,
            pnl,
            status,
            opened_at,
            closed_at,
            markets (question)
          `)
          .eq('user_id', user.id)
          .order('opened_at', { ascending: false });

        if (filter === 'open') {
          positionQuery = positionQuery.eq('status', 'open');
        } else if (filter === 'closed') {
          positionQuery = positionQuery.eq('status', 'closed');
        }

        const { data: positions, error: posError } = await positionQuery;
        
        if (posError) {
          if (isAuthError(posError)) {
            console.warn('Auth error in trading history, attempting session refresh...');
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              setError('Session expired. Please refresh the page.');
              setLoading(false);
              return;
            }
            // Retry once after refresh
            return fetchTrades();
          }
          throw posError;
        }

        const positionTrades: Trade[] = (positions || []).map((p: any) => ({
          id: p.id,
          market_id: p.market_id,
          side: p.side,
          size: p.size,
          entry_price: p.entry_price,
          pnl: p.pnl,
          status: p.status,
          opened_at: p.opened_at,
          closed_at: p.closed_at,
          type: 'position' as const,
          marketQuestion: p.markets?.question
        }));
        allTrades = [...allTrades, ...positionTrades];
      }

      // Fetch pending orders from order book
      if (filter === 'all' || filter === 'pending') {
        const { data: orders, error: ordError } = await supabase
          .from('orders')
          .select(`
            id,
            market_id,
            side,
            quantity,
            filled_quantity,
            price,
            status,
            created_at,
            markets (question)
          `)
          .eq('user_id', user.id)
          .in('status', ['pending', 'partial'])
          .order('created_at', { ascending: false });

        if (ordError) throw ordError;

        const pendingOrders: Trade[] = (orders || []).map((o: any) => ({
          id: o.id,
          market_id: o.market_id,
          side: o.side,
          size: Number(o.quantity) - Number(o.filled_quantity),
          entry_price: o.price,
          pnl: null,
          status: o.status,
          opened_at: o.created_at,
          closed_at: null,
          type: 'order' as const,
          marketQuestion: o.markets?.question
        }));
        allTrades = [...allTrades, ...pendingOrders];
      }

      // Sort by date
      allTrades.sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());

      setTrades(allTrades);
    } catch (err: any) {
      console.error('Error fetching trades:', err);
      if (isAuthError(err)) {
        setError('Session expired. Please refresh the page.');
      } else {
        setError('Failed to load trading history');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch trades when filter changes
  useEffect(() => {
    fetchTrades();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const calculateStats = () => {
    const positions = trades.filter(t => t.type === 'position');
    const closedTrades = positions.filter(t => t.status === 'closed' && t.pnl !== null);
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;
    const activeTrades = positions.filter(t => t.status === 'open').length;
    const pendingOrders = trades.filter(t => t.type === 'order').length;

    return { totalPnL, winRate, activeTrades, totalTrades: closedTrades.length, pendingOrders };
  };

  const stats = calculateStats();

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Trading History</h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            Pending
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Pending</p>
          <p className="text-lg font-bold text-blue-600">{stats.pendingOrders}</p>
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

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive mb-2">{error}</p>
            <button 
              className="text-sm text-primary underline"
              onClick={() => fetchTrades()}
            >
              Try again
            </button>
          </div>
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
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={trade.side === 'yes' ? 'default' : 'secondary'}>
                      {trade.side.toUpperCase()}
                    </Badge>
                    {trade.type === 'order' ? (
                      <Badge variant="outline" className="border-blue-500 text-blue-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {trade.status === 'partial' ? 'Partial' : 'Pending'}
                      </Badge>
                    ) : (
                      <Badge variant={trade.status === 'open' ? 'outline' : 'secondary'}>
                        {trade.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground font-medium line-clamp-1">
                    {trade.marketQuestion || `Market: ${trade.market_id.slice(0, 8)}...`}
                  </p>
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
                  <span className="text-muted-foreground">{trade.type === 'order' ? 'Unfilled: ' : 'Size: '}</span>
                  <span className="font-semibold">{trade.size} shares</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{trade.type === 'order' ? 'Limit: ' : 'Entry: '}</span>
                  <span className="font-semibold">${trade.entry_price.toFixed(2)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">{trade.type === 'order' ? 'Placed: ' : 'Opened: '}</span>
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
