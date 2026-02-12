import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Coins, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WALLET_TERMS, TOKEN_PRESETS, MIN_TOKEN_PURCHASE } from "@/lib/walletTerminology";

interface BuyTokensDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BuyTokensDialog = ({ isOpen, onClose, onSuccess }: BuyTokensDialogProps) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [agreed, setAgreed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= MIN_TOKEN_PURCHASE) {
      setSelectedAmount(parsed);
    } else {
      setSelectedAmount(customAmount ? null : selectedAmount);
    }
  };

  const finalAmount = customAmount ? (parseInt(customAmount, 10) || 0) : (selectedAmount || 0);
  const isValidAmount = finalAmount >= MIN_TOKEN_PURCHASE && agreed;

  const handleAddTokens = async () => {
    if (!isValidAmount || !finalAmount) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('wallet-operations', {
        body: {
          operation: 'deposit',
          amount: finalAmount
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Tokens added",
          description: `${finalAmount} tokens added to your wallet`,
        });
        setSelectedAmount(null);
        setCustomAmount("");
        setAgreed(false);
        onSuccess();
        onClose();
      } else {
        throw new Error(data?.error || 'Failed to add tokens');
      }
    } catch (error) {
      console.error('Add tokens error:', error);
      toast({
        title: "Failed to add tokens",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-accent" />
            {WALLET_TERMS.ADD_TOKENS}
          </DialogTitle>
          <DialogDescription className="text-sm">
            1 Token = $1 USD
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Gentleman's Agreement Notice */}
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-foreground">Closed Beta — Gentleman's Agreement</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Each token = $1 USD. By adding tokens, you agree to settle your balance at the end of the tournament. This is a trust-based system among participants.
                </p>
              </div>
            </div>
          </div>

          {/* Select Amount */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Select Amount</p>
            <div className="grid grid-cols-3 gap-2">
              {TOKEN_PRESETS.map((preset) => (
                <button
                  key={preset.amount}
                  onClick={() => handlePresetSelect(preset.amount)}
                  className={`p-3 rounded-lg border-2 text-center transition-all font-medium text-sm ${
                    selectedAmount === preset.amount && !customAmount
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  {preset.amount} tokens
                </button>
              ))}
            </div>

            {/* Custom amount input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                min={MIN_TOKEN_PURCHASE}
                placeholder={`Custom (min ${MIN_TOKEN_PURCHASE})`}
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className="pl-7 h-12"
              />
            </div>
          </div>

          {/* Agreement checkbox */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="tokenAgreement"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor="tokenAgreement" className="text-xs text-muted-foreground font-normal cursor-pointer leading-relaxed">
              I understand that 1 token = $1 USD and I agree to settle my balance at the end of the tournament.
            </Label>
          </div>
        </div>

        <Button
          onClick={handleAddTokens}
          disabled={isProcessing || !isValidAmount}
          className="w-full h-12 mt-2 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Coins className="mr-2 h-4 w-4" />
              Add {finalAmount > 0 ? finalAmount : 0} Tokens
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default BuyTokensDialog;
