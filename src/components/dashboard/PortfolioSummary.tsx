import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";

interface PortfolioSummaryProps {
  balance: number;
  profitLoss: number;
  isVerified: boolean;
}

const PortfolioSummary = ({ balance, profitLoss, isVerified }: PortfolioSummaryProps) => {
  const isProfitable = profitLoss >= 0;

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base md:text-lg font-semibold text-foreground">Portfolio Summary</h2>
        {isVerified && (
          <div className="flex items-center gap-1 text-sm text-accent">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Verified</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Balance</p>
          <p className="text-2xl md:text-3xl font-bold text-foreground">
            {balance.toLocaleString()} <span className="text-base md:text-lg text-muted-foreground">credits</span>
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Total P&L</p>
          <div className="flex items-center gap-2">
            <p className={`text-xl md:text-2xl font-bold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {isProfitable ? '+' : ''}{profitLoss.toLocaleString()}
            </p>
            {isProfitable ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PortfolioSummary;
