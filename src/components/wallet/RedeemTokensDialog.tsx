import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WALLET_TERMS } from "@/lib/walletTerminology";

interface RedeemTokensDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableTokens: number;
  hasOpenPositions: boolean;
}

const RedeemTokensDialog = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  availableTokens,
  hasOpenPositions 
}: RedeemTokensDialogProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const redeemAmount = parseFloat(amount) || 0;
  const isValidAmount = redeemAmount >= WALLET_TERMS.MIN_REDEMPTION && redeemAmount <= availableTokens;

  const handleRequestRedemption = () => {
    if (!isValidAmount) return;
    setStep(2);
  };

  const handleConfirmRedemption = async () => {
    if (!isValidAmount) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('wallet-operations', {
        body: {
          operation: 'withdrawal',
          amount: redeemAmount
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Redemption requested",
          description: `${redeemAmount} tokens redemption is being processed`,
        });
        setAmount("");
        setStep(1);
        onSuccess();
        onClose();
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

  const handleClose = () => {
    setStep(1);
    setAmount("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Redeem Tokens</DialogTitle>
              <DialogDescription>
                Available: {availableTokens.toLocaleString()} tokens
              </DialogDescription>
            </DialogHeader>

            {hasOpenPositions && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {WALLET_TERMS.REDEMPTION_DESC}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="redeem-amount" className="text-sm text-muted-foreground">
                  Amount to redeem
                </Label>
                <Input
                  id="redeem-amount"
                  type="number"
                  placeholder={`Min ${WALLET_TERMS.MIN_REDEMPTION} tokens`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={WALLET_TERMS.MIN_REDEMPTION}
                  max={availableTokens}
                  className="h-12 text-lg mt-2"
                  disabled={hasOpenPositions}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Minimum redemption: {WALLET_TERMS.MIN_REDEMPTION} tokens
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                {WALLET_TERMS.REDEMPTION_DESC}
              </p>

              <Button
                onClick={handleRequestRedemption}
                disabled={!isValidAmount || hasOpenPositions}
                className="w-full h-12"
                variant="outline"
              >
                {WALLET_TERMS.REQUEST_REDEMPTION}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Redeem {redeemAmount} tokens?</DialogTitle>
              <DialogDescription>
                ≈ ${redeemAmount.toFixed(2)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• {WALLET_TERMS.REDEMPTION_DELAY}</p>
                <p>• {WALLET_TERMS.VERIFICATION_NOTE}</p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 h-12"
                  disabled={isProcessing}
                >
                  Back
                </Button>
                <Button
                  onClick={handleConfirmRedemption}
                  disabled={isProcessing}
                  className="flex-1 h-12"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Confirm"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RedeemTokensDialog;
