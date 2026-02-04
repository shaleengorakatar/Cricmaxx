import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Position {
  id: string;
  market: string;
  side: "Yes" | "No";
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  tokensCommitted: number;
  status: "active" | "settled" | "pending";
  tokensReturned?: number;
  expiring?: boolean;
  type: 'position' | 'order';
}

interface Transaction {
  id: string;
  date: string;
  type: "deposit" | "withdrawal" | "trade" | "settlement" | "refund";
  description: string;
  amount: number;
  marketName?: string;
}

interface DashboardData {
  balance: number;
  tokensInPlay: number;
  pendingOrderTokens: number;
  positions: Position[];
  pendingOrders: Position[];
  transactions: Transaction[];
  chartData: Array<{ date: string; value: number }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
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

export function useDashboardData(userId: string | undefined): DashboardData {
  const [balance, setBalance] = useState(0);
  const [tokensInPlay, setTokensInPlay] = useState(0);
  const [pendingOrderTokens, setPendingOrderTokens] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Initialize with default chart data to prevent empty state
  const [chartData, setChartData] = useState<Array<{ date: string; value: number }>>([
    { date: 'Today', value: 0 }
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const isMounted = useRef(true);

  const fetchAllData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Only show loading on first load
    if (retryCount === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      // Parallel fetch all dashboard data
      const [profileRes, transactionsRes, positionsRes, ordersRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('balance')
          .eq('id', userId)
          .single(),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('positions')
          .select(`
            id,
            side,
            size,
            entry_price,
            opened_at,
            markets (
              question,
              yes_price,
              no_price,
              expiry_time
            )
          `)
          .eq('user_id', userId)
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(10),
        supabase
          .from('orders')
          .select(`
            id,
            side,
            quantity,
            filled_quantity,
            price,
            status,
            created_at,
            markets (question, expiry_time)
          `)
          .eq('user_id', userId)
          .in('status', ['pending', 'partial'])
          .order('created_at', { ascending: false })
      ]);

      // Check for auth errors in any response
      const authErrorFound = [profileRes, transactionsRes, positionsRes, ordersRes].some(
        res => isAuthError(res.error)
      );

      if (authErrorFound) {
        console.warn('Auth error detected in dashboard data fetch, refreshing session...');
        
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          // Session is truly invalid, need to re-login
          setError('Session expired. Please log in again.');
          toast.error('Session expired', { description: 'Please log in again to continue.' });
          
          // Sign out to clear stale session
          await supabase.auth.signOut();
          return;
        }
        
        // Session refreshed, retry once
        if (retryCount < 1) {
          setRetryCount(prev => prev + 1);
          // Small delay to let the new token propagate
          await new Promise(r => setTimeout(r, 500));
          await fetchAllData();
          return;
        }
      }

      // Process balance
      if (profileRes.data && !profileRes.error) {
        setBalance(Number(profileRes.data.balance) || 0);
      } else if (profileRes.error && !isAuthError(profileRes.error)) {
        console.error('Error fetching balance:', profileRes.error);
      }

      // Process transactions
      if (transactionsRes.data && !transactionsRes.error) {
        const formattedTransactions: Transaction[] = transactionsRes.data.map(t => {
          let transactionType: Transaction["type"] = "trade";
          if (t.type === "deposit") transactionType = "deposit";
          else if (t.type === "withdrawal") transactionType = "withdrawal";
          else if (t.type === "trade") transactionType = "trade";
          else if (t.type === "win" || t.type === "payout" || t.type === "resolution") transactionType = "settlement";
          else if (t.type === "loss") transactionType = "settlement";
          else if (t.type === "refund") transactionType = "refund";

          return {
            id: t.id,
            date: new Date(t.created_at).toLocaleDateString(),
            description: t.type.charAt(0).toUpperCase() + t.type.slice(1),
            amount: Number(t.amount),
            type: transactionType
          };
        });
        setTransactions(formattedTransactions);

        // Generate chart data from transactions
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          return date.toLocaleDateString('en-US', { weekday: 'short' });
        });

        const currentBalance = Number(profileRes.data?.balance) || 0;
        const chartValues = last7Days.map((day) => {
          const dayTransactions = transactionsRes.data.filter(t => {
            const tDate = new Date(t.created_at);
            return tDate.toLocaleDateString('en-US', { weekday: 'short' }) === day;
          });
          
          const dayBalance = dayTransactions.reduce((sum, t) => {
            return sum + (t.balance_after - t.balance_before);
          }, currentBalance);
          
          return { date: day, value: Number(dayBalance) };
        });

        setChartData(chartValues.length > 0 ? chartValues : [{ date: 'Today', value: currentBalance }]);
      }

      // Process positions
      if (positionsRes.data && !positionsRes.error) {
        const formattedPositions: Position[] = positionsRes.data.map(p => {
          const market = p.markets as any;
          const currentPrice = p.side === 'yes' ? Number(market?.yes_price || 0) : Number(market?.no_price || 0);
          const tokensCommitted = Math.round(Number(p.size) * Number(p.entry_price));
          const isExpiringSoon = market?.expiry_time ? 
            new Date(market.expiry_time).getTime() - Date.now() < 24 * 60 * 60 * 1000 : false;

          return {
            id: p.id,
            market: market?.question || 'Unknown Market',
            side: p.side === 'yes' ? 'Yes' as const : 'No' as const,
            quantity: Number(p.size),
            entryPrice: Number(p.entry_price),
            currentPrice: currentPrice,
            tokensCommitted: tokensCommitted,
            status: "active" as const,
            expiring: isExpiringSoon,
            type: 'position' as const
          };
        });

        setPositions(formattedPositions);

        // Calculate total tokens in play
        const totalTokensInPlay = formattedPositions.reduce((sum, pos) => sum + pos.tokensCommitted, 0);
        setTokensInPlay(totalTokensInPlay);
      }

      // Process pending orders
      if (ordersRes.data && !ordersRes.error) {
        // Calculate pending tokens total
        const pendingTokens = ordersRes.data.reduce((sum, order: any) => {
          const unfilled = Number(order.quantity) - Number(order.filled_quantity);
          return sum + Math.round(unfilled * Number(order.price));
        }, 0);
        setPendingOrderTokens(pendingTokens);

        // Format for ActivePositions display
        const formattedOrders: Position[] = ordersRes.data.map((o: any) => {
          const unfilled = Number(o.quantity) - Number(o.filled_quantity);
          const tokensCommitted = Math.round(unfilled * Number(o.price));
          const isExpiringSoon = o.markets?.expiry_time ? 
            new Date(o.markets.expiry_time).getTime() - Date.now() < 24 * 60 * 60 * 1000 : false;

          return {
            id: o.id,
            market: o.markets?.question || 'Unknown Market',
            side: o.side === 'yes' ? 'Yes' as const : 'No' as const,
            quantity: unfilled,
            entryPrice: Number(o.price),
            currentPrice: Number(o.price),
            tokensCommitted,
            status: 'pending' as const,
            expiring: isExpiringSoon,
            type: 'order' as const
          };
        });
        setPendingOrders(formattedOrders);
      }

      setRetryCount(0); // Reset retry count on success
      
      if (!isMounted.current) return;
      setLoading(false);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      if (isMounted.current) {
        setError('Failed to load dashboard data');
        setLoading(false);
      }
    }
  }, [userId, retryCount]);

  // Initial fetch when userId is available
  useEffect(() => {
    isMounted.current = true;
    if (userId) {
      fetchAllData();
    }
    return () => {
      isMounted.current = false;
    };
  }, [userId, fetchAllData]);

  return {
    balance,
    tokensInPlay,
    pendingOrderTokens,
    positions,
    pendingOrders,
    transactions,
    chartData,
    loading,
    error,
    refetch: fetchAllData
  };
}
