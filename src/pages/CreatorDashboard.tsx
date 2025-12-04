import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketCreationForm from "@/components/creator/MarketCreationForm";
import OracleMarketForm from "@/components/creator/OracleMarketForm";
import MyMarkets from "@/components/creator/MyMarkets";
import CreatorGuidance from "@/components/creator/CreatorGuidance";
import MarketSuggestions from "@/components/creator/MarketSuggestions";
import { CreatorApplicationForm } from "@/components/creator/CreatorApplicationForm";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CreatorMarket } from "@/types/creator";
import { DollarSign, TrendingUp, BarChart3, Sparkles, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const CreatorDashboard = () => {
  const [markets, setMarkets] = useState<CreatorMarket[]>([]);
  const [applicationStatus, setApplicationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const { isAuthenticated, isCreator, loading, user } = useAuth();
  const navigate = useNavigate();

  const totalEarnings = markets.reduce((sum, market) => sum + market.feesEarned, 0);
  const totalVolume = markets.reduce((sum, market) => sum + market.volume, 0);
  const activeMarkets = markets.filter(m => m.status === "open" || m.status === "approved").length;

  // Fetch creator's markets from database
  const fetchMarkets = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (data && !error) {
      const formattedMarkets: CreatorMarket[] = data.map(m => {
        // Map category to template type
        const templateMap: Record<string, CreatorMarket['template']> = {
          'cricket': 'cricket_player_performance',
          'Cricket': 'cricket_player_performance',
          'politics': 'politics_election',
          'Politics': 'politics_election',
          'finance': 'finance_price_target',
          'Finance': 'finance_price_target'
        };

        return {
          id: m.id,
          question: m.question,
          status: m.status as CreatorMarket['status'],
          volume: Number(m.volume),
          feesEarned: Number(m.volume) * 0.02, // 2% commission
          createdAt: m.created_at,
          template: templateMap[m.category] || 'custom_yesno',
          outcome: m.outcome as CreatorMarket['outcome']
        };
      });
      setMarkets(formattedMarkets);
    }
  };

  const handleMarketCreated = () => {
    fetchMarkets();
  };

  // Check application status and fetch markets
  useEffect(() => {
    const checkApplicationStatus = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('creator_applications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking application:', error);
      }
      
      const status = data?.status as 'pending' | 'approved' | 'rejected' | undefined;
      setApplicationStatus(status || 'none');
      setLoadingStatus(false);
    };

    if (user) {
      checkApplicationStatus();
      if (isCreator) {
        fetchMarkets();
      }
    }
  }, [user, isCreator]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth?mode=login');
    }
  }, [loading, isAuthenticated, navigate]);

  const handleApplicationSubmitted = () => {
    setApplicationStatus('pending');
  };

  // Show loading while checking auth
  if (loading || loadingStatus) {
    return null;
  }

  if (!isCreator) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 pt-20 pb-12">
          <div className="container mx-auto px-4 max-w-2xl">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Creator Dashboard</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Apply to become a creator and start earning from your markets
              </p>
            </div>

            {applicationStatus === 'none' && (
              <CreatorApplicationForm onApplicationSubmitted={handleApplicationSubmitted} />
            )}

            {applicationStatus === 'pending' && (
              <Card className="p-8">
                <div className="text-center">
                  <Badge variant="secondary" className="mb-4">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Application Under Review
                  </Badge>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Application Submitted</h2>
                  <p className="text-muted-foreground mb-6">
                    Your creator application is currently under review by our admin team. 
                    We typically review applications within 24-48 hours. You'll receive an email once your application is processed.
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg text-left">
                    <p className="text-sm font-medium mb-2">What happens next?</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Admin reviews your profile and social media presence</li>
                      <li>• We verify your follower count and engagement</li>
                      <li>• If approved, you'll gain creator access immediately</li>
                      <li>• You'll be notified via email about the decision</li>
                    </ul>
                  </div>
                </div>
              </Card>
            )}

            {applicationStatus === 'rejected' && (
              <Card className="p-8">
                <div className="text-center">
                  <Badge variant="destructive" className="mb-4">
                    Application Not Approved
                  </Badge>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Application Update</h2>
                  <p className="text-muted-foreground mb-6">
                    Unfortunately, your creator application was not approved at this time. 
                    This may be due to not meeting the minimum follower requirements or other criteria.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You may reapply after growing your following or providing additional information. 
                    Contact support if you have questions.
                  </p>
                </div>
              </Card>
            )}
          </div>
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
              {/* Market Creation Forms with Tabs */}
              <Tabs defaultValue="template" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="template" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Template Markets
                  </TabsTrigger>
                  <TabsTrigger value="oracle" className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Auto-Resolve Markets
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="template">
                  <MarketCreationForm onMarketCreated={handleMarketCreated} />
                </TabsContent>
                
                <TabsContent value="oracle">
                  <OracleMarketForm onMarketCreated={handleMarketCreated} />
                </TabsContent>
              </Tabs>

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
              <MarketSuggestions />
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
