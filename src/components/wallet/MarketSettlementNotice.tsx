import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface MarketSettlementNoticeProps {
  isOpen: boolean;
  onClose: () => void;
  marketQuestion: string;
  outcome: "yes" | "no" | "void";
  tokensReturned: number;
}

/**
 * Neutral, financial-tone settlement notice
 * No confetti, no "Congrats" - keeps Shariz in information market territory
 */
const MarketSettlementNotice = ({
  isOpen,
  onClose,
  marketQuestion,
  outcome,
  tokensReturned,
}: MarketSettlementNoticeProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Market Resolved</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {marketQuestion}
          </p>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-1">Outcome:</p>
            <p className="text-xl font-bold text-foreground uppercase">
              {outcome === "void" ? "VOIDED" : outcome}
            </p>
          </div>

          <div className="py-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Tokens returned:</p>
            <p className="text-2xl font-bold text-foreground">
              {tokensReturned} tokens
            </p>
          </div>
        </div>

        <Button 
          onClick={() => {
            onClose();
            navigate("/mobile/wallet");
          }}
          className="w-full h-12"
          variant="outline"
        >
          View Wallet
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default MarketSettlementNotice;
