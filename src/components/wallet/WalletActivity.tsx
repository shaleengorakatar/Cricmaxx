import { Card } from "@/components/ui/card";
import { getActivityLabel, WalletActivityType } from "@/lib/walletTerminology";

interface ActivityItem {
  id: string;
  type: WalletActivityType;
  amount: number;
  marketName?: string;
  timestamp: string;
}

interface WalletActivityProps {
  activities: ActivityItem[];
}

const WalletActivity = ({ activities }: WalletActivityProps) => {
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Wallet Activity</h3>
      
      {activities.length === 0 ? (
        <p className="text-center text-muted-foreground py-6 text-sm">
          No activity yet
        </p>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => {
            const label = getActivityLabel(activity.type, activity.amount, activity.marketName);
            const isPositive = activity.type === "tokens_added" || activity.type === "tokens_settled";
            
            return (
              <div 
                key={activity.id} 
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    isPositive ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default WalletActivity;
