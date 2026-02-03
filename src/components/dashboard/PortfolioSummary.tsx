import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, BarChart3, CheckCircle2, Clock, PlusCircle } from "lucide-react";
import { WALLET_TERMS } from "@/lib/walletTerminology";

interface PortfolioSummaryProps {
  balance: number;
  profitLoss: number; // Repurposed as "tokens in play"
  pendingOrderTokens?: number; // NEW: tokens reserved in pending orders
  isVerified: boolean;
  onBuyTokens?: () => void;
}

/**
 * Portfolio summary using prediction market-safe language
 * Shows "Available Tokens", "In Play", and "Pending Orders"
 */
const PortfolioSummary = ({ balance, profitLoss, pendingOrderTokens = 0, isVerified, onBuyTokens }: PortfolioSummaryProps) => {
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

      <div className="grid grid-cols-3 gap-3">
        {/* Available Tokens - Primary */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-xs text-muted-foreground">{WALLET_TERMS.AVAILABLE}</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-foreground">
            {balance.toLocaleString()}
          </p>
          <Button
            size="sm"
            onClick={onBuyTokens}
            className="mt-2 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 w-full"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Buy Tokens
          </Button>
        </div>

        {/* In Play - Secondary */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{WALLET_TERMS.IN_PLAY}</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-foreground">
            {tokensInPlay.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Filled positions
          </p>
        </div>

        {/* Pending Orders - NEW */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-500" />
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-foreground">
            {pendingOrderTokens.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            In order book
          </p>
        </div>
      </div>
    </Card>
  );
};

export default PortfolioSummary;
