import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MobileLayout } from "@/layouts/MobileLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, BarChart3, History, ArrowDownCircle, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import WalletHome from "@/components/wallet/WalletHome";
import PositionsScreen from "@/components/wallet/PositionsScreen";
import WalletActivity from "@/components/wallet/WalletActivity";
import PaymentMethodsDialog from "@/components/wallet/PaymentMethodsDialog";
import RedeemTokensDialog from "@/components/wallet/RedeemTokensDialog";
import PaymentHistory from "@/components/wallet/PaymentHistory";
import { Button } from "@/components/ui/button";
import { WalletActivityType } from "@/lib/walletTerminology";
import { useToast } from "@/hooks/use-toast";

interface Position {
  id: string;
  marketQuestion: string;
  side: "yes" | "no";
  tokensCommitted: number;
  status: "active" | "settled";
  tokensReturned?: number;
}

interface ActivityItem {
  id: string;
  type: WalletActivityType;
  amount: number;
  marketName?: string;
  timestamp: string;
}

const MobileWallet = () => {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [tokensInPlay, setTokensInPlay] = useState(0);
  const [settledThisWeek, setSettledThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("wallet");

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

      // Poll for balance update (webhook may take a few seconds)
      let attempts = 0;
      const maxAttempts = 10;
      const initialBalance = profile?.balance || 0;
      
      const pollForUpdate = async () => {
        attempts++;
        
        const { data, error } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', user.id)
          .single();
        
        if (data && !error) {
          const newBalance = Number(data.balance) || 0;
          
          // Balance updated - webhook processed
          if (newBalance > initialBalance || attempts >= maxAttempts) {
            fetchWalletData();
            
            if (newBalance > initialBalance) {
              const addedTokens = newBalance - initialBalance;
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
              setTimeout(fetchWalletData, 3000);
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
  }, [searchParams, user?.id, profile?.balance]);

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch open positions
      const { data: positionsData } = await supabase
        .from("positions")
        .select(`
          id,
          side,
          size,
          entry_price,
          status,
          market_id,
          markets (question)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (positionsData) {
        const formattedPositions: Position[] = positionsData.map((p: any) => ({
          id: p.id,
          marketQuestion: p.markets?.question || "Unknown Market",
          side: p.side as "yes" | "no",
          tokensCommitted: Number(p.size) * Number(p.entry_price),
          status: p.status === "open" ? "active" : "settled",
          tokensReturned: p.status === "closed" ? Number(p.size) : 0,
        }));

        setPositions(formattedPositions);

        // Calculate tokens in play
        const inPlay = formattedPositions
          .filter(p => p.status === "active")
          .reduce((sum, p) => sum + p.tokensCommitted, 0);
        setTokensInPlay(Math.round(inPlay));

        // Count settled this week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const settled = formattedPositions.filter(p => p.status === "settled").length;
        setSettledThisWeek(settled);
      }

      // Fetch transactions for activity
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (transactionsData) {
        const formattedActivities: ActivityItem[] = transactionsData.map((t: any) => {
          let type: WalletActivityType = "tokens_added";
          if (t.type === "deposit") type = "tokens_added";
          else if (t.type === "withdrawal") type = "redemption_requested";
          else if (t.type === "trade") type = "tokens_committed";
          else if (t.type === "resolution" || t.type === "payout") type = "tokens_settled";

          return {
            id: t.id,
            type,
            amount: Math.abs(Number(t.amount)),
            timestamp: t.created_at,
          };
        });
        setActivities(formattedActivities);
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceUpdate = () => {
    fetchWalletData();
  };

  if (!user) {
    return (
      <MobileLayout>
        <div className="px-4 pt-6 flex flex-col items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground text-center">
            Please sign in to access your wallet
          </p>
        </div>
      </MobileLayout>
    );
  }

  const availableTokens = Math.round(profile?.balance || 0);
  const openPositionsCount = positions.filter(p => p.status === "active").length;

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4">
        <Tabs defaultValue="wallet" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="wallet" className="text-sm">
              <Coins className="h-4 w-4 mr-1.5" />
              Wallet
            </TabsTrigger>
            <TabsTrigger value="positions" className="text-sm">
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Positions
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-sm">
              <CreditCard className="h-4 w-4 mr-1.5" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-sm">
              <History className="h-4 w-4 mr-1.5" />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallet" className="space-y-4">
            <WalletHome
              availableTokens={availableTokens}
              tokensInPlay={tokensInPlay}
              openPositions={openPositionsCount}
              settledThisWeek={settledThisWeek}
              onBuyTokens={() => setBuyDialogOpen(true)}
            />
            
            {/* Redeem button - separate, less prominent */}
            <Button
              variant="ghost"
              onClick={() => setRedeemDialogOpen(true)}
              className="w-full text-muted-foreground"
              disabled={availableTokens < 10 || openPositionsCount > 0}
            >
              <ArrowDownCircle className="h-4 w-4 mr-2" />
              Request Redemption
            </Button>
          </TabsContent>

          <TabsContent value="positions">
            <PositionsScreen positions={positions} />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-medium">Payment History</h3>
              <PaymentHistory />
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <WalletActivity activities={activities} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <PaymentMethodsDialog
        isOpen={buyDialogOpen}
        onClose={() => setBuyDialogOpen(false)}
        onSuccess={handleBalanceUpdate}
      />

      <RedeemTokensDialog
        isOpen={redeemDialogOpen}
        onClose={() => setRedeemDialogOpen(false)}
        onSuccess={handleBalanceUpdate}
        availableTokens={availableTokens}
        hasOpenPositions={openPositionsCount > 0}
        userId={user?.id}
      />
    </MobileLayout>
  );
};

export default MobileWallet;
