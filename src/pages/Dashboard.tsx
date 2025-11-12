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
import { Button } from "@/components/ui/button";
import { TrendingUp, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Mock data for demonstration
const mockChartData = [
  { date: "Mon", value: 10000 },
  { date: "Tue", value: 10250 },
  { date: "Wed", value: 10100 },
  { date: "Thu", value: 10450 },
  { date: "Fri", value: 10800 },
  { date: "Sat", value: 10650 },
  { date: "Sun", value: 10950 },
];

const mockPositions = [
  {
    id: "1",
    market: "Will Bitcoin reach $100k by 2025?",
    side: "Yes" as const,
    quantity: 100,
    entryPrice: 0.65,
    currentPrice: 0.72,
    unrealizedPL: 7.00,
  },
  {
    id: "2",
    market: "Will the S&P 500 close above 5000 this quarter?",
    side: "No" as const,
    quantity: 50,
    entryPrice: 0.45,
    currentPrice: 0.38,
    unrealizedPL: 3.50,
  },
  {
    id: "3",
    market: "Will inflation fall below 3% next month?",
    side: "Yes" as const,
    quantity: 200,
    entryPrice: 0.58,
    currentPrice: 0.52,
    unrealizedPL: -12.00,
    expiring: true,
  },
];

interface Transaction {
  id: string;
  date: string;
  type: "deposit" | "withdrawal" | "trade" | "win" | "loss";
  description: string;
  amount: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, profile, loading, user } = useAuth();
  const [balance, setBalance] = useState(profile?.balance || 0);
  const [profitLoss] = useState(950);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
      const formattedTransactions: Transaction[] = data.map(t => ({
        id: t.id,
        date: new Date(t.created_at).toLocaleDateString(),
        description: t.type.charAt(0).toUpperCase() + t.type.slice(1),
        amount: Number(t.amount),
        type: t.type as any
      }));
      setTransactions(formattedTransactions);
    }
  };

  const handleBalanceUpdate = () => {
    fetchBalance();
    fetchTransactions();
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
    }
  }, [user?.id]);

  // Show loading while checking auth
  if (loading || !profile) {
    return null;
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

          {!profile.kyc_verified && (
            <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                Account not verified. Please complete KYC to enable full trading capabilities.
                <Button 
                  variant="link" 
                  className="ml-2 p-0 h-auto text-yellow-900 dark:text-yellow-100 underline"
                  onClick={() => navigate('/kyc-verification')}
                >
                  Verify Now
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
              <PortfolioSummary 
                balance={balance}
                profitLoss={profitLoss}
                isVerified={profile.kyc_verified}
              />
              <PLChart data={mockChartData} />
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
            <ActivePositions positions={mockPositions} />
            <TransactionHistory transactions={transactions} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
