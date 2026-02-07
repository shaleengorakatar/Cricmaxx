import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine } from "lucide-react";
import PaymentMethodsDialog from "@/components/wallet/PaymentMethodsDialog";

interface WalletActionsProps {
  balance: number;
  onBalanceUpdate: () => void;
  hasOpenPositions?: boolean;
  userId?: string;
}

const WalletActions = ({ balance, onBalanceUpdate }: WalletActionsProps) => {
  const [isBuyOpen, setIsBuyOpen] = useState(false);

  return (
    <>
      <Card className="p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-foreground mb-4">Wallet</h2>
        <Button 
          onClick={() => setIsBuyOpen(true)}
          className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90 active:scale-95 transition-transform"
        >
          <ArrowDownToLine className="h-4 w-4 mr-2" />
          Add Tokens
        </Button>
      </Card>

      <PaymentMethodsDialog
        isOpen={isBuyOpen}
        onClose={() => setIsBuyOpen(false)}
        onSuccess={onBalanceUpdate}
      />
    </>
  );
};

export default WalletActions;
