import { MobileLayout } from "@/layouts/MobileLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import CricketScoresWidget from "@/components/CricketScoresWidget";

const MobileHome = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const quickStats = [
    {
      label: "Balance",
      value: `${profile?.balance.toLocaleString() || 0} credits`,
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      label: "Active",
      value: "0",
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      label: "Today P&L",
      value: "$0.00",
      icon: TrendingDown,
      color: "text-red-600",
    },
  ];

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back{user ? `, ${profile?.name}` : ''}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Ready to make predictions?
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {quickStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4">
                <Icon className={`h-5 w-5 ${stat.color} mb-2`} />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-base font-bold text-foreground mt-1">
                  {stat.value}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Cricket Scores */}
        <div className="mb-6">
          <CricketScoresWidget />
        </div>

        {/* Quick Actions */}
        <Card className="p-4 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Button
              onClick={() => navigate("/mobile/markets")}
              className="w-full h-14 text-base justify-between"
              variant="default"
            >
              <span>Browse Markets</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              onClick={() => navigate("/mobile/wallet")}
              className="w-full h-14 text-base justify-between"
              variant="outline"
            >
              <span>Add Funds</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>

        {/* Market Highlights */}
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Hot Markets
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/mobile/markets")}
            >
              View All
            </Button>
          </div>
          <p className="text-sm text-muted-foreground text-center py-8">
            Loading trending markets...
          </p>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default MobileHome;
