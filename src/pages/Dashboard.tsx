import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PortfolioSummary from "@/components/dashboard/PortfolioSummary";
import PLChart from "@/components/dashboard/PLChart";
import WalletActions from "@/components/dashboard/WalletActions";
import ActivePositions from "@/components/dashboard/ActivePositions";
import TransactionHistory from "@/components/dashboard/TransactionHistory";
import TradingHistoryPanel from "@/components/dashboard/TradingHistoryPanel";
import PaymentMethodsDialog from "@/components/wallet/PaymentMethodsDialog";
import { Button } from "@/components/ui/button";
import { TrendingUp, Settings } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { isAuthenticated, profile, loading, user } = useAuth();
  const [balance, setBalance] = useState(profile?.balance || 0);
  const [profitLoss, setProfitLoss] = useState(0);
  const [pendingOrderTokens, setPendingOrderTokens] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [chartData, setChartData] = useState<Array<{ date: string; value: number }>>([]);
  const [showBuyTokensDialog, setShowBuyTokensDialog] = useState(false);

  // Handle payment success/cancel URL params with polling for webhook processing
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const amount = searchParams.get("amount");
    
    if (paymentStatus === "success" && user?.id) {
      // Clear the URL params immediately
      setSearchParams({});
      
      // Show initial processing toast
      toast({
        title: "Processing payment...",
        description: "Your tokens are being added to your wallet.",
      });

      // Capture userId to avoid stale closure
      const userId = user.id;
      let attempts = 0;
      const maxAttempts = 10;
      let initialBalanceSnapshot: number | null = null;
      
      const pollForUpdate = async () => {
        attempts++;
        
        const { data, error } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', userId)
          .single();
        
        if (data && !error) {
          const newBalance = Number(data.balance) || 0;
          
          // Capture initial balance on first poll
          if (initialBalanceSnapshot === null) {
            initialBalanceSnapshot = newBalance;
          }
          
          // Balance updated - webhook processed (check if balance increased from first poll OR max attempts reached)
          if ((attempts > 1 && newBalance > initialBalanceSnapshot) || attempts >= maxAttempts) {
            setBalance(newBalance);
            fetchTransactions();
            
            if (attempts > 1 && newBalance > initialBalanceSnapshot) {
              const addedTokens = newBalance - initialBalanceSnapshot;
              toast({
                title: "🎉 Payment Successful!",
                description: `${addedTokens} tokens have been added to your wallet.`,
              });
            } else if (amount) {
              // Fallback: show amount from URL if balance didn't update yet
              toast({
                title: "🎉 Payment Successful!",
                description: `${amount} tokens have been added to your wallet.`,
              });
              // One final refresh after a delay
              setTimeout(() => {
                fetchBalance();
                fetchTransactions();
              }, 3000);
            }
            return;
          }
        }
        
        // Keep polling if not updated yet
        if (attempts < maxAttempts) {
          setTimeout(pollForUpdate, 1500);
        }
      };
      
      // Start polling after a short delay to give webhook time
      setTimeout(pollForUpdate, 1000);
      
    } else if (paymentStatus === "cancelled") {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled. No tokens were added.",
        variant: "destructive",
      });
      setSearchParams({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id]);

  // Fetch real-time balance from database
  const fetchBalance = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (data && !error) {
      setBalance(Number(data.balance) || 0);
    }
  };

  // Fetch transactions from database
  const fetchTransactions = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data && !error) {
      const formattedTransactions: Transaction[] = data.map(t => {
        // Map old transaction types to prediction-safe types
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

      // Generate chart data from transactions (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      });

      const chartValues = last7Days.map((day, index) => {
        const dayTransactions = data.filter(t => {
          const tDate = new Date(t.created_at);
          return tDate.toLocaleDateString('en-US', { weekday: 'short' }) === day;
        });
        
        const dayBalance = dayTransactions.reduce((sum, t) => {
          return sum + (t.balance_after - t.balance_before);
        }, balance);
        
        return { date: day, value: Number(dayBalance) };
      });

      setChartData(chartValues.length > 0 ? chartValues : [{ date: 'Today', value: balance }]);
    }
  };

  // Fetch positions from database
  const fetchPositions = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
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
      .eq('user_id', user.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(10);

    if (data && !error) {
      const formattedPositions = data.map(p => {
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
      setProfitLoss(totalTokensInPlay); // Repurpose as "in play" indicator
    }
  };

  // Fetch pending order tokens from unfilled orders
  const fetchPendingOrders = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('orders')
      .select('quantity, filled_quantity, price')
      .eq('user_id', user.id)
      .in('status', ['pending', 'partial']);

    if (data && !error) {
      // Calculate tokens reserved: (quantity - filled_quantity) * price
      const pendingTokens = data.reduce((sum, order) => {
        const unfilled = Number(order.quantity) - Number(order.filled_quantity);
        return sum + Math.round(unfilled * Number(order.price));
      }, 0);
      setPendingOrderTokens(pendingTokens);
    }
  };

  const handleBalanceUpdate = () => {
    fetchBalance();
    fetchTransactions();
    fetchPositions();
    fetchPendingOrders();
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth?mode=login');
    }
  }, [loading, isAuthenticated, navigate]);

  // Initial data fetch
  React.useEffect(() => {
    if (user?.id) {
      fetchBalance();
      fetchTransactions();
      fetchPositions();
      fetchPendingOrders();
    }
  }, [user?.id]);

  // Show loading state while checking auth - with visible feedback
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Wait for profile to load after auth is confirmed
  if (isAuthenticated && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage your portfolio and trading activity</p>
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
              <PortfolioSummary 
                balance={balance}
                profitLoss={profitLoss}
                pendingOrderTokens={pendingOrderTokens}
                isVerified={profile.kyc_verified}
                onBuyTokens={() => setShowBuyTokensDialog(true)}
              />
              <PLChart data={chartData} />
            </div>
            
            <div className="space-y-4 md:space-y-6">
              <WalletActions 
                balance={balance}
                onBalanceUpdate={handleBalanceUpdate}
              />
              <div className="flex flex-col gap-3">
                <Button 
                  className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => navigate('/markets')}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Browse Markets
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full h-12"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Account Settings
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 md:space-y-6">
            <TradingHistoryPanel />
            <ActivePositions positions={positions} />
            <TransactionHistory transactions={transactions} />
          </div>
        </div>
      </main>

      <Footer />

      {/* Buy Tokens Dialog */}
      <PaymentMethodsDialog
        isOpen={showBuyTokensDialog}
        onClose={() => setShowBuyTokensDialog(false)}
        onSuccess={() => {
          setShowBuyTokensDialog(false);
          handleBalanceUpdate();
        }}
      />
    </div>
  );
};

export default Dashboard;
