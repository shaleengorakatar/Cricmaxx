import { MobileLayout } from "@/layouts/MobileLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { StreakDisplay } from "@/components/trading/StreakDisplay";
import { HotMarketsWidget } from "@/components/mobile/HotMarketsWidget";

const MobileHome = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  return (
    <MobileLayout>
      <div className="px-4 pt-4 pb-4 space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {user ? `Hey, ${profile?.name?.split(' ')[0] || ''}!` : 'Welcome!'}
              </h1>
              <div className="flex items-center gap-2 text-sm">
                <Coins className="h-3.5 w-3.5 text-accent" />
                <span className="font-semibold text-accent">
                  {Math.floor(profile?.balance ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <StreakDisplay />
        </div>

        {/* Quick Actions - More Compact */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => navigate("/rapidpred")}
            className="h-12 text-sm bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            ⚡ RapidPred
          </Button>
          <Button
            onClick={() => navigate("/mobile/markets")}
            variant="outline"
            className="h-12 text-sm"
          >
            Browse Markets
          </Button>
        </div>

        {/* Hot Markets - Primary Content */}
        <HotMarketsWidget />
      </div>
    </MobileLayout>
  );
};

export default MobileHome;
