import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WALLET_TERMS } from "@/lib/walletTerminology";
import PaymentMethodsDialog from "@/components/wallet/PaymentMethodsDialog";

interface WalletActionsProps {
  balance: number;
  onBalanceUpdate: () => void;
}

const WalletActions = ({ balance, onBalanceUpdate }: WalletActionsProps) => {
  const [isBuyOpen, setIsBuyOpen] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleRequestRedemption = async () => {
    const amount = parseFloat(redeemAmount);
    if (isNaN(amount) || amount < WALLET_TERMS.MIN_REDEMPTION) {
      toast({
        title: "Invalid amount",
        description: `Minimum redemption is ${WALLET_TERMS.MIN_REDEMPTION} tokens`,
        variant: "destructive",
      });
      return;
    }

    if (amount > balance) {
      toast({
        title: "Insufficient tokens",
        description: "You cannot redeem more than your available tokens",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('wallet-operations', {
        body: {
          operation: 'withdrawal',
          amount: amount
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Redemption requested",
          description: `${amount} tokens redemption is being processed`,
        });
        setRedeemAmount("");
        setIsRedeemOpen(false);
        onBalanceUpdate();
      } else {
        throw new Error(data?.error || 'Failed to request redemption');
      }
    } catch (error) {
      console.error('Redemption error:', error);
      toast({
        title: "Redemption failed",
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
            onClick={() => setIsBuyOpen(true)}
            className="flex-1 h-12 bg-accent text-accent-foreground hover:bg-accent/90 active:scale-95 transition-transform"
          >
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            {WALLET_TERMS.BUY_TOKENS}
          </Button>
          <Button 
            onClick={() => setIsRedeemOpen(true)}
            variant="outline"
            className="flex-1 h-12 active:scale-95 transition-transform"
          >
            <ArrowUpFromLine className="h-4 w-4 mr-2" />
            Redeem
          </Button>
        </div>
      </Card>

      {/* Buy Tokens Dialog - Now using PaymentMethodsDialog */}
      <PaymentMethodsDialog
        isOpen={isBuyOpen}
        onClose={() => setIsBuyOpen(false)}
        onSuccess={onBalanceUpdate}
      />

      {/* Redeem Tokens Dialog */}
      <Dialog open={isRedeemOpen} onOpenChange={setIsRedeemOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redeem Tokens</DialogTitle>
            <DialogDescription>
              Available: {balance.toLocaleString()} tokens
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="redeem-amount" className="text-sm text-muted-foreground">
                Amount to redeem
              </Label>
              <Input
                id="redeem-amount"
                type="number"
                placeholder={`Min ${WALLET_TERMS.MIN_REDEMPTION} tokens`}
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                min={WALLET_TERMS.MIN_REDEMPTION}
                max={balance}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {WALLET_TERMS.REDEMPTION_DESC}
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• {WALLET_TERMS.REDEMPTION_DELAY}</p>
              <p>• {WALLET_TERMS.VERIFICATION_NOTE}</p>
            </div>
            <Button 
              onClick={handleRequestRedemption} 
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
                WALLET_TERMS.REQUEST_REDEMPTION
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WalletActions;
