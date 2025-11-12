import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WalletActionsProps {
  balance: number;
  onBalanceUpdate: () => void;
}

const WalletActions = ({ balance, onBalanceUpdate }: WalletActionsProps) => {
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleDeposit = async () => {
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (depositAmount > 1000000) {
      toast({
        title: "Amount too large",
        description: "Maximum deposit is 1,000,000 credits",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('wallet-operations', {
        body: {
          operation: 'deposit',
          amount: depositAmount
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Deposit successful",
          description: `${depositAmount.toLocaleString()} credits added to your account`,
        });
        setAmount("");
        setIsDepositOpen(false);
        onBalanceUpdate();
      } else {
        throw new Error(data?.error || 'Deposit failed');
      }
    } catch (error) {
      console.error('Deposit error:', error);
      toast({
        title: "Deposit failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (withdrawAmount > balance) {
      toast({
        title: "Insufficient funds",
        description: "You cannot withdraw more than your available balance",
        variant: "destructive",
      });
      return;
    }

    if (withdrawAmount > 1000000) {
      toast({
        title: "Amount too large",
        description: "Maximum withdrawal is 1,000,000 credits",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('wallet-operations', {
        body: {
          operation: 'withdrawal',
          amount: withdrawAmount
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Withdrawal successful",
          description: `${withdrawAmount.toLocaleString()} credits withdrawn from your account`,
        });
        setAmount("");
        setIsWithdrawOpen(false);
        onBalanceUpdate();
      } else {
        throw new Error(data?.error || 'Withdrawal failed');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      toast({
        title: "Withdrawal failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Card className="p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-foreground mb-4">Wallet</h2>
        <div className="flex gap-3">
          <Button 
            onClick={() => setIsDepositOpen(true)}
            className="flex-1 h-12 bg-accent text-accent-foreground hover:bg-accent/90 active:scale-95 transition-transform"
          >
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Deposit
          </Button>
          <Button 
            onClick={() => setIsWithdrawOpen(true)}
            variant="outline"
            className="flex-1 h-12 active:scale-95 transition-transform"
          >
            <ArrowUpFromLine className="h-4 w-4 mr-2" />
            Withdraw
          </Button>
        </div>
      </Card>

      <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deposit Funds</DialogTitle>
            <DialogDescription>
              Add credits to your Shariz account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="deposit-amount">Amount (credits)</Label>
              <Input
                id="deposit-amount"
                type="number"
                placeholder="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="100"
              />
            </div>
            <Button 
              onClick={handleDeposit} 
              disabled={isProcessing}
              className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Deposit'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Funds</DialogTitle>
            <DialogDescription>
              Withdraw credits from your Shariz account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="withdraw-amount">Amount (credits)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                placeholder="500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                max={balance}
                step="100"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Available: {balance.toLocaleString()} credits
              </p>
            </div>
            <Button 
              onClick={handleWithdraw} 
              disabled={isProcessing}
              className="w-full h-12" 
              variant="outline"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Withdrawal'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WalletActions;
