import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Transaction {
  id: string;
  date: string;
  type: "deposit" | "withdrawal" | "trade" | "settlement" | "refund";
  description: string;
  amount: number;
  marketName?: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

/**
 * Audit-friendly transaction history
 * Uses prediction market-safe language: tokens added, committed, settled, redemption
 */
const TransactionHistory = ({ transactions }: TransactionHistoryProps) => {
  const getTypeLabel = (type: Transaction["type"]) => {
    switch (type) {
      case "deposit":
        return "Tokens added";
      case "withdrawal":
        return "Redemption";
      case "trade":
        return "Tokens committed";
      case "settlement":
        return "Tokens settled";
      case "refund":
        return "Tokens returned";
    }
  };

  const getTypeBadge = (type: Transaction["type"]) => {
    switch (type) {
      case "deposit":
        return <Badge variant="secondary" className="text-xs">{getTypeLabel(type)}</Badge>;
      case "withdrawal":
        return <Badge variant="outline" className="text-xs">{getTypeLabel(type)}</Badge>;
      case "trade":
        return <Badge variant="outline" className="text-xs">{getTypeLabel(type)}</Badge>;
      case "settlement":
        return <Badge variant="secondary" className="text-xs">{getTypeLabel(type)}</Badge>;
      case "refund":
        return <Badge variant="secondary" className="text-xs">{getTypeLabel(type)}</Badge>;
    }
  };

  const isCredit = (type: Transaction["type"]) => {
    return type === "deposit" || type === "settlement" || type === "refund";
  };

  // Format amount to avoid floating point display issues
  const formatAmount = (amount: number): string => {
    const rounded = Math.round(amount * 100) / 100;
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
  };

  const formatActivity = (transaction: Transaction) => {
    const prefix = isCredit(transaction.type) ? "+" : "–";
    const amount = formatAmount(Math.abs(transaction.amount));
    
    switch (transaction.type) {
      case "deposit":
        return `${prefix}${amount} Tokens added`;
      case "withdrawal":
        return `${prefix}${amount} Tokens redemption requested`;
      case "trade":
        return `${prefix}${amount} Tokens committed${transaction.marketName ? ` (${transaction.marketName})` : ''}`;
      case "settlement":
        return `${prefix}${amount} Tokens settled${transaction.marketName ? ` (${transaction.marketName})` : ''}`;
      case "refund":
        return `${prefix}${amount} Tokens returned${transaction.marketName ? ` (${transaction.marketName})` : ''}`;
      default:
        return `${prefix}${amount} Tokens`;
    }
  };

  return (
    <Card className="p-4 md:p-6">
      <h2 className="text-base md:text-lg font-semibold text-foreground mb-4">Wallet Activity</h2>
      
      {transactions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No activity yet. Your wallet activity will appear here.
        </p>
      ) : (
        <div className="space-y-2 md:space-y-3">
          {transactions.map((transaction) => (
            <div 
              key={transaction.id} 
              className="flex items-center justify-between p-3 md:p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium">
                  {formatActivity(transaction)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{transaction.date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TransactionHistory;
