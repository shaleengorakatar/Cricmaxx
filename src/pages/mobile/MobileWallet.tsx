import { useState } from "react";
import { MobileLayout } from "@/layouts/MobileLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, ArrowUpCircle, ArrowDownCircle, History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const MobileWallet = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    if (!user || !depositAmount) return;
    
    const amount = parseFloat(depositAmount);
    if (amount <= 0 || amount > 10000) {
      toast({
        title: "Invalid amount",
        description: "Please enter an amount between $0.01 and $10,000",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('wallet-operations', {
        body: {
          operation: 'deposit',
          amount: amount,
        },
      });

      if (error) throw error;

      toast({
        title: "Deposit successful",
        description: `Added ${amount.toFixed(2)} credits to your wallet`,
      });
      setDepositAmount("");
    } catch (error: any) {
      toast({
        title: "Deposit failed",
        description: error.message || "Failed to process deposit",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !withdrawAmount) return;
    
    const amount = parseFloat(withdrawAmount);
    if (amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amount > (profile?.balance || 0)) {
      toast({
        title: "Insufficient balance",
        description: `You only have ${profile?.balance.toFixed(2)} credits`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('wallet-operations', {
        body: {
          operation: 'withdrawal',
          amount: amount,
        },
      });

      if (error) throw error;

      toast({
        title: "Withdrawal successful",
        description: `Withdrew ${amount.toFixed(2)} credits from your wallet`,
      });
      setWithdrawAmount("");
    } catch (error: any) {
      toast({
        title: "Withdrawal failed",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [10, 25, 50, 100, 250, 500];

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

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground mb-6">Wallet</h1>

        {/* Balance Card */}
        <Card className="p-6 mb-6 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5" />
            <p className="text-sm opacity-90">Available Balance</p>
          </div>
          <p className="text-4xl font-bold">
            {profile?.balance.toLocaleString() || 0}
          </p>
          <p className="text-sm opacity-75 mt-1">credits</p>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="deposit" className="text-base">
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Deposit
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="text-base">
              <ArrowDownCircle className="h-4 w-4 mr-2" />
              Withdraw
            </TabsTrigger>
            <TabsTrigger value="history" className="text-base">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-4">
            <Card className="p-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deposit-amount" className="text-base">Amount</Label>
                  <Input
                    id="deposit-amount"
                    type="number"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="h-14 text-lg mt-2"
                  />
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Quick amounts
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {quickAmounts.map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        onClick={() => setDepositAmount(amount.toString())}
                        className="h-12"
                      >
                        ${amount}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleDeposit}
                  disabled={loading || !depositAmount}
                  className="w-full h-14 text-base"
                >
                  Deposit Funds
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4">
            <Card className="p-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="withdraw-amount" className="text-base">Amount</Label>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="h-14 text-lg mt-2"
                  />
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Quick amounts
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {quickAmounts.map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        onClick={() => setWithdrawAmount(amount.toString())}
                        className="h-12"
                        disabled={amount > (profile?.balance || 0)}
                      >
                        ${amount}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleWithdraw}
                  disabled={loading || !withdrawAmount}
                  className="w-full h-14 text-base"
                  variant="destructive"
                >
                  Withdraw Funds
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="p-4">
              <p className="text-center text-muted-foreground py-8">
                Transaction history coming soon
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
};

export default MobileWallet;
