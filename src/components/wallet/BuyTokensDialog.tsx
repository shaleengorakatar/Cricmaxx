import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
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
  const [isCustom, setIsCustom] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount("");
  };

  const handleCustomSelect = () => {
    setIsCustom(true);
    setSelectedAmount(null);
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= MIN_TOKEN_PURCHASE) {
      setSelectedAmount(parsed);
    } else {
      setSelectedAmount(null);
    }
  };

  const finalAmount = isCustom ? (parseInt(customAmount, 10) || null) : selectedAmount;
  const isValidAmount = finalAmount !== null && finalAmount >= MIN_TOKEN_PURCHASE;

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
          title: "Dollars added",
          description: `$${finalAmount} added to your wallet`,
        });
        setSelectedAmount(null);
        setCustomAmount("");
        setIsCustom(false);
        onSuccess();
        onClose();
      } else {
        throw new Error(data?.error || 'Failed to add tokens');
      }
    } catch (error) {
      console.error('Add tokens error:', error);
      toast({
        title: "Failed to add dollars",
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
          <DialogTitle>{WALLET_TERMS.ADD_TOKENS}</DialogTitle>
          <DialogDescription className="text-sm">
            {WALLET_TERMS.COLLATERAL_DESC}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {TOKEN_PRESETS.map((preset) => (
            <button
              key={preset.amount}
              onClick={() => handlePresetSelect(preset.amount)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedAmount === preset.amount && !isCustom
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <span className="font-medium">{preset.display}</span>
            </button>
          ))}

          {/* Custom amount option */}
          <button
            onClick={handleCustomSelect}
            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
              isCustom
                ? "border-accent bg-accent/10"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <span className="font-medium">Custom amount</span>
          </button>

          {isCustom && (
            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={MIN_TOKEN_PURCHASE}
                  placeholder={`${MIN_TOKEN_PURCHASE}+`}
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className="pl-7"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum ${MIN_TOKEN_PURCHASE}
              </p>
            </div>
          )}
        </div>

        <Button
          onClick={handleAddTokens}
          disabled={isProcessing || !isValidAmount}
          className="w-full h-12 mt-4 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            WALLET_TERMS.ADD_TOKENS
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default BuyTokensDialog;
