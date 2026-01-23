import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WALLET_TERMS, TOKEN_PRESETS } from "@/lib/walletTerminology";

interface BuyTokensDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BuyTokensDialog = ({ isOpen, onClose, onSuccess }: BuyTokensDialogProps) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleAddTokens = async () => {
    if (!selectedAmount) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('wallet-operations', {
        body: {
          operation: 'deposit',
          amount: selectedAmount
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Tokens added",
          description: `${selectedAmount} tokens added to your wallet`,
        });
        setSelectedAmount(null);
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
          <DialogTitle>{WALLET_TERMS.ADD_TOKENS}</DialogTitle>
          <DialogDescription className="text-sm">
            {WALLET_TERMS.COLLATERAL_DESC}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {TOKEN_PRESETS.map((preset) => (
            <button
              key={preset.amount}
              onClick={() => setSelectedAmount(preset.amount)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedAmount === preset.amount
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <span className="font-medium">{preset.display}</span>
            </button>
          ))}
        </div>

        <Button
          onClick={handleAddTokens}
          disabled={isProcessing || !selectedAmount}
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
