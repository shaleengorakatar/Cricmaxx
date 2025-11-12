import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WalletActionsProps {
  balance: number;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
}

const WalletActions = ({ balance, onDeposit, onWithdraw }: WalletActionsProps) => {
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const { toast } = useToast();

  const handleDeposit = () => {
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    onDeposit(depositAmount);
    toast({
      title: "Deposit successful",
      description: `${depositAmount.toLocaleString()} credits added to your account`,
    });
    setAmount("");
    setIsDepositOpen(false);
  };

  const handleWithdraw = () => {
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

    onWithdraw(withdrawAmount);
    toast({
      title: "Withdrawal successful",
      description: `${withdrawAmount.toLocaleString()} credits withdrawn from your account`,
    });
    setAmount("");
    setIsWithdrawOpen(false);
  };

  return (
    <>
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Wallet</h2>
        <div className="flex gap-3">
          <Button 
            onClick={() => setIsDepositOpen(true)}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Deposit
          </Button>
          <Button 
            onClick={() => setIsWithdrawOpen(true)}
            variant="outline"
            className="flex-1"
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
            <Button onClick={handleDeposit} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              Confirm Deposit
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
            <Button onClick={handleWithdraw} className="w-full" variant="outline">
              Confirm Withdrawal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WalletActions;
