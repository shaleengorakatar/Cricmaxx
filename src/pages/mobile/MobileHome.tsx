import { MobileLayout } from "@/layouts/MobileLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import CricketScoresWidget from "@/components/CricketScoresWidget";
import { StreakDisplay } from "@/components/trading/StreakDisplay";
import { HotMarketsWidget } from "@/components/mobile/HotMarketsWidget";
import { FriendActivityWidget } from "@/components/mobile/FriendActivityWidget";
import cricmaxxLogo from "@/assets/cricmaxx-logo.png";

const MobileHome = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const quickStats = [
    {
      label: "Balance",
      value: `${profile?.balance.toLocaleString() || 0}`,
      icon: DollarSign,
      color: "text-success",
    },
    {
      label: "Active",
      value: "0",
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      label: "Today P&L",
      value: "$0.00",
      icon: TrendingDown,
      color: "text-destructive",
    },
  ];

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4 space-y-6">
        {/* Header with Logo and Streak */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={cricmaxxLogo} 
              alt="CricMaxx" 
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {user ? `Hey, ${profile?.name?.split(' ')[0] || ''}!` : 'Welcome!'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Ready to predict?
              </p>
            </div>
          </div>
          <StreakDisplay />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          {quickStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4 bg-card/50 backdrop-blur-sm">
                <Icon className={`h-5 w-5 ${stat.color} mb-2`} />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-base font-bold text-foreground mt-1">
                  {stat.value}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate("/rapid-pred")}
              className="h-14 text-base bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              ⚡ CricMaxx RapidPred
            </Button>
            <Button
              onClick={() => navigate("/mobile/markets")}
              variant="outline"
              className="h-14 text-base"
            >
              Browse Markets
            </Button>
          </div>
        </Card>

        {/* Hot Markets - Live */}
        <HotMarketsWidget />

        {/* Friend Activity */}
        <FriendActivityWidget />

        {/* Cricket Scores */}
        <CricketScoresWidget />

        {/* Add Funds CTA */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Need more tokens?</p>
              <p className="text-sm text-muted-foreground">Top up your wallet</p>
            </div>
            <Button
              onClick={() => navigate("/mobile/wallet")}
              variant="outline"
              size="sm"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default MobileHome;
