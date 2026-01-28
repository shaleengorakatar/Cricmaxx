import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, AlertCircle, Wallet, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WALLET_TERMS } from "@/lib/walletTerminology";
import { useStripeConnect } from "@/hooks/useStripeConnect";

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
  const [selectedCountry, setSelectedCountry] = useState<"US" | "CA">("US");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { status, isLoading: isLoadingStatus, startOnboarding, isConnecting, requestPayout } = useStripeConnect();

  const redeemAmount = parseFloat(amount) || 0;
  const minRedemption = 10; // Stripe minimum
  const isValidAmount = redeemAmount >= minRedemption && redeemAmount <= availableTokens;
  const isConnected = status?.status === "active" && status?.payouts_enabled;

  const handleRequestRedemption = () => {
    if (!isValidAmount) return;
    setStep(2);
  };

  const handleConfirmRedemption = async () => {
    if (!isValidAmount) return;

    setIsProcessing(true);

    try {
      const result = await requestPayout(redeemAmount);

      if (result?.success) {
        toast({
          title: "Payout initiated!",
          description: result.message || `$${redeemAmount} will arrive in 2-5 business days`,
        });
        setAmount("");
        setStep(1);
        onSuccess();
        onClose();
      } else {
        throw new Error(result?.error || "Payout failed");
      }
    } catch (error) {
      console.error("Payout error:", error);
      toast({
        title: "Payout failed",
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

  const renderConnectPrompt = () => (
    <>
      <DialogHeader>
        <DialogTitle>Connect Bank Account</DialogTitle>
        <DialogDescription>
          Connect your bank account to redeem tokens for USD
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 pt-2">
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-start gap-3">
            <Wallet className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Secure Payouts via Stripe</p>
              <p className="text-xs text-muted-foreground">
                Connect your bank account through Stripe's secure platform to receive payouts when you redeem tokens.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Select your country</Label>
          <RadioGroup
            value={selectedCountry}
            onValueChange={(value) => setSelectedCountry(value as "US" | "CA")}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="US" id="country-us" />
              <Label htmlFor="country-us" className="cursor-pointer">🇺🇸 United States</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="CA" id="country-ca" />
              <Label htmlFor="country-ca" className="cursor-pointer">🇨🇦 Canada</Label>
            </div>
          </RadioGroup>
        </div>

        <Button 
          onClick={() => startOnboarding(selectedCountry)} 
          disabled={isConnecting}
          className="w-full h-12"
        >
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opening Stripe...
            </>
          ) : (
            <>
              Connect Bank Account
              <ExternalLink className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          You'll be redirected to Stripe to securely link your bank account
        </p>
      </div>
    </>
  );

  const renderRedeemForm = () => (
    <>
      <DialogHeader>
        <DialogTitle>Redeem Tokens</DialogTitle>
        <DialogDescription>
          Available: {availableTokens.toLocaleString()} tokens (≈ ${availableTokens.toLocaleString()})
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
            Amount to redeem (USD)
          </Label>
          <Input
            id="redeem-amount"
            type="number"
            placeholder={`Min $${minRedemption}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={minRedemption}
            max={availableTokens}
            className="h-12 text-lg mt-2"
            disabled={hasOpenPositions}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Minimum payout: ${minRedemption} • 1 token = $1 USD
          </p>
        </div>

        <Button
          onClick={handleRequestRedemption}
          disabled={!isValidAmount || hasOpenPositions}
          className="w-full h-12"
          variant="outline"
        >
          Continue to Confirmation
        </Button>
      </div>
    </>
  );

  const renderConfirmation = () => (
    <>
      <DialogHeader>
        <DialogTitle>Confirm Payout: ${redeemAmount}</DialogTitle>
        <DialogDescription>
          This amount will be transferred to your connected bank account
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 pt-2">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• Funds typically arrive in 2-5 business days</p>
          <p>• Your token balance will be reduced immediately</p>
          <p>• You'll receive an email confirmation</p>
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
              `Confirm $${redeemAmount} Payout`
            )}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        {isLoadingStatus ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !isConnected ? (
          renderConnectPrompt()
        ) : step === 1 ? (
          renderRedeemForm()
        ) : (
          renderConfirmation()
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RedeemTokensDialog;
