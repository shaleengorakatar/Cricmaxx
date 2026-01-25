import { Card } from "@/components/ui/card";
import { Coins, BarChart3, CheckCircle2 } from "lucide-react";
import { WALLET_TERMS } from "@/lib/walletTerminology";

interface PortfolioSummaryProps {
  balance: number;
  profitLoss: number; // Repurposed as "tokens in play"
  isVerified: boolean;
}

/**
 * Portfolio summary using prediction market-safe language
 * Shows "Available Tokens" and "In Play" instead of balance and P&L
 */
const PortfolioSummary = ({ balance, profitLoss, isVerified }: PortfolioSummaryProps) => {
  const tokensInPlay = profitLoss; // Repurposed

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base md:text-lg font-semibold text-foreground">CricMaxx Wallet</h2>
        {isVerified && (
          <div className="flex items-center gap-1 text-sm text-accent">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Verified</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Available Tokens - Primary */}
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="h-4 w-4 text-amber-500" />
            <p className="text-xs text-muted-foreground">{WALLET_TERMS.AVAILABLE}</p>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-foreground">
            {balance.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            ≈ ${balance.toLocaleString()}.00
          </p>
        </div>

        {/* In Play - Secondary */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{WALLET_TERMS.IN_PLAY}</p>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-foreground">
            {tokensInPlay.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {WALLET_TERMS.TOKEN_NAME}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default PortfolioSummary;
