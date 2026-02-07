import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Coins, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WALLET_TERMS, TOKEN_PRESETS, MIN_TOKEN_PURCHASE } from "@/lib/walletTerminology";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PaymentMethodsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PaymentMethodsDialog = ({ isOpen, onClose, onSuccess }: PaymentMethodsDialogProps) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);
  const { toast } = useToast();

  const finalAmount = selectedAmount || (customAmount ? parseInt(customAmount, 10) : 0);
  const isValidAmount = finalAmount >= MIN_TOKEN_PURCHASE && finalAmount <= 10000;

  const handleCustomAmountChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setCustomAmount(numericValue);
    setSelectedAmount(null);
  };

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleAddTokens = async () => {
    if (!isValidAmount || !hasAccepted) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('wallet-operations', {
        body: {
          operation: 'deposit',
          amount: finalAmount,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Tokens added!",
          description: `${finalAmount} tokens added to your wallet`,
        });
        setSelectedAmount(null);
        setCustomAmount("");
        setHasAccepted(false);
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
      <DialogContent className="max-w-sm max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-accent" />
            {WALLET_TERMS.ADD_TOKENS}
          </DialogTitle>
          <DialogDescription className="text-xs">
            1 Token = $1 USD
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {/* Gentleman's Agreement Notice */}
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground block mb-1">Closed Beta — Gentleman's Agreement</span>
              Each token = $1 USD. By adding tokens, you agree to settle your balance at the end of the tournament. This is a trust-based system among participants.
            </AlertDescription>
          </Alert>

          {/* Amount Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Select Amount</label>
            <div className="grid grid-cols-3 gap-2">
              {TOKEN_PRESETS.map((preset) => (
                <button
                  key={preset.amount}
                  onClick={() => handlePresetSelect(preset.amount)}
                  className={cn(
                    "py-3 px-2 rounded-md border text-center transition-all text-sm font-medium",
                    selectedAmount === preset.amount
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                  >
                    {preset.amount} tokens
                  </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder={`Custom (min ${MIN_TOKEN_PURCHASE})`}
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className={cn(
                  "pl-7 h-9 text-sm",
                  customAmount && !selectedAmount ? "border-accent" : ""
                )}
              />
            </div>
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasAccepted}
              onChange={(e) => setHasAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
            />
            <span className="text-xs text-muted-foreground">
              I understand that 1 token = $1 USD and I agree to settle my balance at the end of the tournament.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="border-t bg-background px-4 py-3 space-y-3">
          {isValidAmount && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Tokens to add</span>
              <span className="font-bold text-accent text-lg">{finalAmount}</span>
            </div>
          )}

          <Button
            onClick={handleAddTokens}
            disabled={isProcessing || !isValidAmount || !hasAccepted}
            className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Coins className="mr-2 h-4 w-4" />
                Add {finalAmount || 0} Tokens
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentMethodsDialog;
