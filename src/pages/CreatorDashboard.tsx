import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketCreationForm from "@/components/creator/MarketCreationForm";
import MyMarkets from "@/components/creator/MyMarkets";
import CreatorGuidance from "@/components/creator/CreatorGuidance";
import { Card } from "@/components/ui/card";
import { CreatorMarket } from "@/types/creator";
import { DollarSign, TrendingUp, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

// Mock data for creator markets
const mockCreatorMarkets: CreatorMarket[] = [
  {
    id: "c1",
    question: "Will Virat Kohli score 50+ runs on 15 Dec 2025?",
    status: "open",
    volume: 45000,
    feesEarned: 900,
    createdAt: "2025-11-01T10:00:00Z",
    template: "cricket_player_performance",
  },
  {
    id: "c2",
    question: "Will India defeat Australia on 20 Dec 2025?",
    status: "pending",
    volume: 0,
    feesEarned: 0,
    createdAt: "2025-11-10T14:30:00Z",
    template: "cricket_match_result",
  },
  {
    id: "c3",
    question: "Will Bitcoin reach $100000 by 31 Dec 2025?",
    status: "resolved",
    volume: 125000,
    feesEarned: 2500,
    createdAt: "2025-10-15T09:00:00Z",
    template: "finance_price_target",
    outcome: "yes",
  },
];

const CreatorDashboard = () => {
  const [markets, setMarkets] = useState<CreatorMarket[]>(mockCreatorMarkets);
  const { isAuthenticated, isCreator, loading } = useAuth();
  const navigate = useNavigate();

  const totalEarnings = markets.reduce((sum, market) => sum + market.feesEarned, 0);
  const totalVolume = markets.reduce((sum, market) => sum + market.volume, 0);
  const activeMarkets = markets.filter(m => m.status === "open" || m.status === "approved").length;

  const handleMarketCreated = () => {
    // Refresh markets list
    // In real app, this would fetch from database
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth?mode=login');
    }
  }, [loading, isAuthenticated, navigate]);

  // Show loading while checking auth
  if (loading) {
    return null;
  }

  if (!isCreator) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center pt-20 pb-12">
          <Card className="p-8 max-w-md mx-4">
            <h2 className="text-2xl font-bold text-foreground mb-4">Creator Access Required</h2>
            <p className="text-muted-foreground mb-6">
              You need to be approved as a creator to access this page. 
              Creators can launch automated prediction markets and earn fees from trading volume.
            </p>
            <button className="w-full bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:bg-accent/90">
              Apply to Become a Creator
            </button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Creator Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Create and manage your prediction markets
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
            <Card className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
                  <p className="text-xl md:text-2xl font-bold text-green-600">
                    ${totalEarnings.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-7 w-7 md:h-8 md:w-8 text-green-600" />
              </div>
            </Card>

            <Card className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Volume</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">
                    {totalVolume.toLocaleString()}
                  </p>
                </div>
                <BarChart3 className="h-7 w-7 md:h-8 md:w-8 text-accent" />
              </div>
            </Card>

            <Card className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Markets</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">
                    {activeMarkets}
                  </p>
                </div>
                <TrendingUp className="h-7 w-7 md:h-8 md:w-8 text-accent" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
              {/* Market Creation Form */}
              <MarketCreationForm onMarketCreated={handleMarketCreated} />

              {/* My Markets */}
              <div>
                <h2 className="text-lg md:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  My Markets
                </h2>
                <MyMarkets markets={markets} />
              </div>
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-4 md:space-y-6">
              <CreatorGuidance />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CreatorDashboard;
