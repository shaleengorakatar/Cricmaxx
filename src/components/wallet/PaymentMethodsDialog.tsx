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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-accent" />
            {WALLET_TERMS.BUY_TOKENS}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {WALLET_TERMS.COLLATERAL_DESC}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Amount Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Select Amount</label>
            <div className="grid grid-cols-2 gap-2">
              {TOKEN_PRESETS.map((preset) => (
                <button
                  key={preset.amount}
                  onClick={() => handlePresetSelect(preset.amount)}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition-all",
                    selectedAmount === preset.amount
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <span className="font-medium text-sm">{preset.display}</span>
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Custom amount (min $10)"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className={cn(
                  "pl-7",
                  customAmount && !selectedAmount ? "border-accent" : ""
                )}
              />
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Payment Method</label>
            
            {/* Stripe (Cards + Digital Wallets) */}
            <button
              onClick={() => setSelectedMethod('stripe')}
              className={cn(
                "w-full p-4 rounded-lg border-2 text-left transition-all",
                selectedMethod === 'stripe'
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Card, Apple Pay, Google Pay</p>
                    <p className="text-xs text-muted-foreground">Secure payment via Stripe</p>
                  </div>
                </div>
                {selectedMethod === 'stripe' && (
                  <Check className="h-5 w-5 text-accent" />
                )}
              </div>
              
              {/* Payment method logos */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  {/* Visa */}
                  <div className="h-6 w-9 bg-[#1A1F71] rounded flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">VISA</span>
                  </div>
                  {/* Mastercard */}
                  <div className="h-6 w-9 bg-gradient-to-r from-[#EB001B] to-[#F79E1B] rounded flex items-center justify-center">
                    <div className="flex -space-x-1">
                      <div className="h-3 w-3 rounded-full bg-[#EB001B] opacity-80"></div>
                      <div className="h-3 w-3 rounded-full bg-[#F79E1B] opacity-80"></div>
                    </div>
                  </div>
                  {/* Apple Pay */}
                  <div className="h-6 px-2 bg-black rounded flex items-center justify-center">
                    <span className="text-white text-[8px] font-medium"> Pay</span>
                  </div>
                  {/* Google Pay */}
                  <div className="h-6 px-2 bg-white border rounded flex items-center justify-center">
                    <span className="text-[8px] font-medium">
                      <span className="text-[#4285F4]">G</span>
                      <span className="text-[#EA4335]"> </span>
                      <span className="text-black">Pay</span>
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* PayPal */}
            <button
              onClick={() => setSelectedMethod('paypal')}
              className={cn(
                "w-full p-4 rounded-lg border-2 text-left transition-all opacity-60",
                selectedMethod === 'paypal'
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 flex items-center justify-center">
                    <span className="text-[#003087] font-bold text-xs">P</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">PayPal</p>
                    <p className="text-xs text-muted-foreground">Coming soon</p>
                  </div>
                </div>
                {selectedMethod === 'paypal' && (
                  <Check className="h-5 w-5 text-accent" />
                )}
              </div>
            </button>
          </div>

          {/* Summary */}
          {isValidAmount && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span>${finalAmount}.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tokens</span>
                <span className="font-medium">{finalAmount} tokens</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-medium">Total</span>
                <span className="font-bold text-accent">${finalAmount}.00</span>
              </div>
            </div>
          )}

          {/* Security note */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Payments secured with bank-level encryption</span>
          </div>

          {/* Pay button */}
          <Button
            onClick={handlePayment}
            disabled={isProcessing || !isValidAmount || selectedMethod === 'paypal'}
            className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90"
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentMethodsDialog;
