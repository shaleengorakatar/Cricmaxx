import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { WALLET_TERMS } from "@/lib/walletTerminology";
import PaymentMethodsDialog from "@/components/wallet/PaymentMethodsDialog";
import RedeemTokensDialog from "@/components/wallet/RedeemTokensDialog";

interface WalletActionsProps {
  balance: number;
  onBalanceUpdate: () => void;
  hasOpenPositions?: boolean;
  userId?: string;
}

const WalletActions = ({ balance, onBalanceUpdate, hasOpenPositions = false, userId }: WalletActionsProps) => {
  const [isBuyOpen, setIsBuyOpen] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);

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

      {/* Buy Tokens Dialog */}
      <PaymentMethodsDialog
        isOpen={isBuyOpen}
        onClose={() => setIsBuyOpen(false)}
        onSuccess={onBalanceUpdate}
      />

      {/* Redeem Tokens Dialog - Now uses Stripe Connect */}
      <RedeemTokensDialog
        isOpen={isRedeemOpen}
        onClose={() => setIsRedeemOpen(false)}
        onSuccess={onBalanceUpdate}
        availableTokens={balance}
        hasOpenPositions={hasOpenPositions}
        userId={userId}
      />
    </>
  );
};

export default WalletActions;
