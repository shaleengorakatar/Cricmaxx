import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WALLET_TERMS } from "@/lib/walletTerminology";

interface WalletHomeProps {
  availableTokens: number;
  tokensInPlay: number;
  openPositions: number;
  settledThisWeek: number;
  onBuyTokens: () => void;
}

const WalletHome = ({
  availableTokens,
  tokensInPlay,
  openPositions,
  settledThisWeek,
  onBuyTokens,
}: WalletHomeProps) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">CricMaxx Wallet</h1>
        <p className="text-xs text-muted-foreground mt-1">Closed Beta • 1 token = $1 USD</p>
      </div>

      {/* Available Tokens */}
      <Card className="p-6 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-full bg-amber-500/20">
            <Coins className="h-5 w-5 text-amber-500" />
          </div>
          <span className="text-sm text-muted-foreground">{WALLET_TERMS.AVAILABLE}</span>
        </div>
        <p className="text-4xl font-bold text-foreground mb-1">
          {availableTokens.toLocaleString()} <span className="text-lg font-normal text-muted-foreground">{WALLET_TERMS.TOKEN_NAME}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          ≈ ${availableTokens.toLocaleString()}.00
        </p>
      </Card>

      {/* In Play */}
      <Card className="p-4 bg-muted/50 border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <span className="text-sm text-muted-foreground">{WALLET_TERMS.IN_PLAY}</span>
            <p className="text-lg font-semibold text-foreground">
              {tokensInPlay.toLocaleString()} {WALLET_TERMS.TOKEN_NAME}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            across {openPositions} {openPositions === 1 ? 'market' : 'markets'}
          </span>
        </div>
      </Card>

      {/* Actions */}
      <Button 
        onClick={onBuyTokens}
        className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90"
      >
        Add Tokens
      </Button>

      {/* Quick Stats */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Stats</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">• Open positions:</span>
            <span className="font-medium">{openPositions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">• Settled this week:</span>
            <span className="font-medium">{settledThisWeek}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default WalletHome;
