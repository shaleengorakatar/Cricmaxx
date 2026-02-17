import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import PortfolioSummary from "@/components/dashboard/PortfolioSummary";
import PLChart from "@/components/dashboard/PLChart";
import WalletActions from "@/components/dashboard/WalletActions";
import ActivePositions from "@/components/dashboard/ActivePositions";
import TransactionHistory from "@/components/dashboard/TransactionHistory";
import PollActivityPanel from "@/components/dashboard/PollActivityPanel";
import TradingHistoryPanel from "@/components/dashboard/TradingHistoryPanel";
import PaymentMethodsDialog from "@/components/wallet/PaymentMethodsDialog";
import { Button } from "@/components/ui/button";
import { TrendingUp, Settings, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDashboardData } from "@/hooks/useDashboardData";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { isAuthenticated, profile, loading, user, profileError, profileLoading, refetchProfile } = useAuth();
  const [showBuyTokensDialog, setShowBuyTokensDialog] = useState(false);
  const [showProfileRecovery, setShowProfileRecovery] = useState(false);

  // Use the centralized dashboard data hook
  const dashboardData = useDashboardData(user?.id);

  // Handle payment success/cancel URL params
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const amount = searchParams.get("amount");
    
    if (paymentStatus === "success" && user?.id) {
      setSearchParams({});
      
      toast({
        title: "Processing payment...",
        description: "Your tokens are being added to your wallet.",
      });

      // Poll for balance update
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
          
          if (initialBalanceSnapshot === null) {
            initialBalanceSnapshot = newBalance;
          }
          
          if ((attempts > 1 && newBalance > initialBalanceSnapshot) || attempts >= maxAttempts) {
            dashboardData.refetch();
            
            if (attempts > 1 && newBalance > initialBalanceSnapshot) {
              const addedTokens = newBalance - initialBalanceSnapshot;
              toast({
                title: "🎉 Payment Successful!",
                description: `${addedTokens} tokens have been added to your wallet.`,
              });
            } else if (amount) {
              toast({
                title: "🎉 Payment Successful!",
                description: `${amount} tokens have been added to your wallet.`,
              });
              setTimeout(() => dashboardData.refetch(), 3000);
            }
            return;
          }
        }
        
        if (attempts < maxAttempts) {
          setTimeout(pollForUpdate, 1500);
        }
      };
      
      setTimeout(pollForUpdate, 1000);
      
    } else if (paymentStatus === "cancelled") {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled. No tokens were added.",
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, user?.id, setSearchParams, toast, dashboardData]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth?mode=login', { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  // Profile loading timeout - show recovery after 10s
  useEffect(() => {
    if (!loading && isAuthenticated && !profile && !profileError) {
      const timeout = setTimeout(() => setShowProfileRecovery(true), 10000);
      return () => clearTimeout(timeout);
    } else {
      setShowProfileRecovery(false);
    }
  }, [loading, isAuthenticated, profile, profileError]);

  // Show loading state while checking auth
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

  // If not authenticated after loading is complete
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Wait for profile to load
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          {profileError || showProfileRecovery ? (
            <>
              <p className="text-muted-foreground mb-4">
                {profileError ? 'Failed to load profile.' : 'Taking longer than expected...'}
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={refetchProfile} variant="outline" disabled={profileLoading}>
                  {profileLoading ? 'Retrying...' : 'Retry'}
                </Button>
                <Button 
                  variant="ghost" 
                  className="text-xs"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading your profile...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Use dashboard data with fallback to profile balance
  const displayBalance = dashboardData.balance || profile.balance || 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-28 lg:pt-20 pb-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Dashboard</h1>
              <p className="text-sm md:text-base text-muted-foreground">Manage your portfolio and trading activity</p>
            </div>
            {dashboardData.error && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => dashboardData.refetch()}
                disabled={dashboardData.loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${dashboardData.loading ? 'animate-spin' : ''}`} />
                Retry
              </Button>
            )}
          </div>

          {dashboardData.error && (
            <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {dashboardData.error}. <button className="underline" onClick={() => dashboardData.refetch()}>Try again</button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
              <PortfolioSummary 
                balance={displayBalance}
                profitLoss={dashboardData.tokensInPlay}
                pendingOrderTokens={dashboardData.pendingOrderTokens}
                onBuyTokens={() => setShowBuyTokensDialog(true)}
              />
              <PLChart data={dashboardData.chartData} />
            </div>
            
            <div id="wallet-section" className="space-y-4 md:space-y-6">
              <WalletActions 
                balance={displayBalance}
                onBalanceUpdate={() => dashboardData.refetch()}
                userId={user?.id}
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
            <ErrorBoundary fallbackTitle="Failed to load poll activity">
              <PollActivityPanel />
            </ErrorBoundary>
            <ErrorBoundary fallbackTitle="Failed to load trading history">
              <TradingHistoryPanel />
            </ErrorBoundary>
            <ErrorBoundary fallbackTitle="Failed to load positions">
              <ActivePositions positions={dashboardData.positions} pendingOrders={dashboardData.pendingOrders} />
            </ErrorBoundary>
            <ErrorBoundary fallbackTitle="Failed to load transactions">
              <TransactionHistory transactions={dashboardData.transactions} />
            </ErrorBoundary>
          </div>
        </div>
      </main>

      <Footer />

      <PaymentMethodsDialog
        isOpen={showBuyTokensDialog}
        onClose={() => setShowBuyTokensDialog(false)}
        onSuccess={() => {
          setShowBuyTokensDialog(false);
          dashboardData.refetch();
        }}
      />
    </div>
  );
};

export default Dashboard;
