import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, BarChart3, Clock, PlusCircle } from "lucide-react";
import { WALLET_TERMS } from "@/lib/walletTerminology";

interface PortfolioSummaryProps {
  balance: number;
  profitLoss: number; // Repurposed as "tokens in play"
  pendingOrderTokens?: number; // NEW: tokens reserved in pending orders
  onBuyTokens?: () => void;
}

/**
 * Portfolio summary using prediction market-safe language
 * Shows "Available Tokens", "In Play", and "Pending Orders"
 * KYC verification requirement removed for beta phase
 */
const PortfolioSummary = ({ balance, profitLoss, pendingOrderTokens = 0, onBuyTokens }: PortfolioSummaryProps) => {
  const tokensInPlay = profitLoss; // Repurposed

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base md:text-lg font-semibold text-foreground">CricMaxx Wallet</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Available Tokens - Primary */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center justify-between sm:flex-col sm:items-start">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-xs text-muted-foreground">{WALLET_TERMS.AVAILABLE}</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                {(balance ?? 0).toLocaleString()}
              </p>
            </div>
            <Button
              size="sm"
              onClick={onBuyTokens}
              className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 sm:w-full sm:mt-2"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Buy Tokens
            </Button>
          </div>
        </div>

        {/* In Play - Secondary */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between sm:block">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{WALLET_TERMS.IN_PLAY}</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                {(tokensInPlay ?? 0).toLocaleString()}
              </p>
            </div>
            <p className="text-xs text-muted-foreground sm:mt-0.5">
              Filled positions
            </p>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center justify-between sm:block">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                {(pendingOrderTokens ?? 0).toLocaleString()}
              </p>
            </div>
            <p className="text-xs text-muted-foreground sm:mt-0.5">
              In order book
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PortfolioSummary;
