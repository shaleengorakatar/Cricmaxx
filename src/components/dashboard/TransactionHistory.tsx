import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Transaction {
  id: string;
  date: string;
  type: "deposit" | "withdrawal" | "trade" | "win" | "loss";
  description: string;
  amount: number;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

const TransactionHistory = ({ transactions }: TransactionHistoryProps) => {
  const getTypeBadge = (type: Transaction["type"]) => {
    switch (type) {
      case "deposit":
        return <Badge variant="default" className="bg-green-600">Deposit</Badge>;
      case "withdrawal":
        return <Badge variant="secondary">Withdrawal</Badge>;
      case "trade":
        return <Badge variant="outline">Trade</Badge>;
      case "win":
        return <Badge className="bg-green-600">Win</Badge>;
      case "loss":
        return <Badge variant="destructive">Loss</Badge>;
    }
  };

  const isCredit = (type: Transaction["type"]) => {
    return type === "deposit" || type === "win";
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Transaction History</h2>
      
      {transactions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No transactions yet. Your transaction history will appear here.
        </p>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getTypeBadge(transaction.type)}
                  <span className="text-xs text-muted-foreground">{transaction.date}</span>
                </div>
                <p className="text-sm text-foreground truncate">{transaction.description}</p>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-semibold ${isCredit(transaction.type) ? 'text-green-600' : 'text-red-600'}`}>
                  {isCredit(transaction.type) ? '+' : '-'}{Math.abs(transaction.amount).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TransactionHistory;
