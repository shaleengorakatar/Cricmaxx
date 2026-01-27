import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CreditCard, Wallet, Check, Shield, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WALLET_TERMS, TOKEN_PRESETS } from "@/lib/walletTerminology";
import { cn } from "@/lib/utils";

interface PaymentMethodsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentMethod = 'stripe' | 'paypal';

const PaymentMethodsDialog = ({ isOpen, onClose, onSuccess }: PaymentMethodsDialogProps) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('stripe');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const finalAmount = selectedAmount || (customAmount ? parseInt(customAmount, 10) : 0);
  const isValidAmount = finalAmount >= 10 && finalAmount <= 10000;

  const handlePayment = async () => {
    if (!isValidAmount) {
      toast({
        title: "Invalid amount",
        description: "Please select or enter an amount between $10 and $10,000",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      if (selectedMethod === 'stripe') {
        // Create Stripe checkout session
        const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
          body: {
            amount: finalAmount,
            paymentMethod: 'stripe',
          }
        });

        if (error) throw error;

        if (data?.url) {
          // Open Stripe Checkout in new tab
          window.open(data.url, '_blank');
          toast({
            title: "Redirecting to checkout",
            description: "Complete your payment in the new tab",
          });
          onClose();
        } else {
          throw new Error('No checkout URL received');
        }
      } else if (selectedMethod === 'paypal') {
        // PayPal integration placeholder
        toast({
          title: "PayPal coming soon",
          description: "PayPal payments will be available shortly",
        });
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomAmountChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setCustomAmount(numericValue);
    setSelectedAmount(null);
  };

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-accent" />
            {WALLET_TERMS.BUY_TOKENS}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {/* Amount Selection - Compact grid */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Select Amount</label>
            <div className="grid grid-cols-4 gap-1.5">
              {TOKEN_PRESETS.map((preset) => (
                <button
                  key={preset.amount}
                  onClick={() => handlePresetSelect(preset.amount)}
                  className={cn(
                    "py-2 px-1 rounded-md border text-center transition-all text-xs font-medium",
                    selectedAmount === preset.amount
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  ${preset.amount}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Custom (min $10)"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className={cn(
                  "pl-7 h-9 text-sm",
                  customAmount && !selectedAmount ? "border-accent" : ""
                )}
              />
            </div>
          </div>

          {/* Payment Method - Compact */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
            
            <button
              onClick={() => setSelectedMethod('stripe')}
              className={cn(
                "w-full p-3 rounded-lg border text-left transition-all",
                selectedMethod === 'stripe'
                  ? "border-accent bg-accent/5"
                  : "border-border"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Card, Apple Pay, Google Pay</span>
                </div>
                {selectedMethod === 'stripe' && <Check className="h-4 w-4 text-accent" />}
              </div>
              <div className="flex items-center gap-1 mt-2">
                <div className="h-5 w-7 bg-[#1A1F71] rounded flex items-center justify-center">
                  <span className="text-white text-[6px] font-bold">VISA</span>
                </div>
                <div className="h-5 w-7 bg-gradient-to-r from-[#EB001B] to-[#F79E1B] rounded" />
                <div className="h-5 px-1.5 bg-black rounded">
                  <span className="text-white text-[6px]"> Pay</span>
                </div>
                <div className="h-5 px-1.5 bg-white border rounded">
                  <span className="text-[6px]">G Pay</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedMethod('paypal')}
              className={cn(
                "w-full p-3 rounded-lg border text-left transition-all opacity-50",
                selectedMethod === 'paypal' ? "border-accent" : "border-border"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[#003087] font-bold text-sm">P</span>
                  <span className="text-sm">PayPal <span className="text-xs text-muted-foreground">(Coming soon)</span></span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Fixed footer with summary and button */}
        <div className="border-t bg-background px-4 py-3 space-y-3">
          {isValidAmount && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-accent text-lg">${finalAmount}.00</span>
            </div>
          )}

          <Button
            onClick={handlePayment}
            disabled={isProcessing || !isValidAmount || selectedMethod === 'paypal'}
            className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay ${finalAmount || 0}.00
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Secured with bank-level encryption</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentMethodsDialog;
