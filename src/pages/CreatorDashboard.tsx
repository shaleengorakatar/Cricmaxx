import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MarketCreationForm from "@/components/creator/MarketCreationForm";
import OracleMarketForm from "@/components/creator/OracleMarketForm";
import MyMarkets from "@/components/creator/MyMarkets";
import CreatorGuidance from "@/components/creator/CreatorGuidance";
import MarketSuggestions from "@/components/creator/MarketSuggestions";
import CreatorAnalytics from "@/components/creator/CreatorAnalytics";
import { CreatorApplicationForm } from "@/components/creator/CreatorApplicationForm";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CreatorMarket } from "@/types/creator";
import { DollarSign, TrendingUp, BarChart3, Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ApplicationData {
  description: string;
  follower_count: number;
  social_media_platform: string;
  social_media_handle: string;
  creator_type: string | null;
  previous_experience: string | null;
}

const CreatorDashboard = () => {
  const [markets, setMarkets] = useState<CreatorMarket[]>([]);
  const [applicationStatus, setApplicationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [applicationData, setApplicationData] = useState<ApplicationData | null>(null);
  const [isEditingApplication, setIsEditingApplication] = useState(false);
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
        .select('status, description, follower_count, social_media_platform, social_media_handle, creator_type, previous_experience')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking application:', error);
      }
      
      const status = data?.status as 'pending' | 'approved' | 'rejected' | undefined;
      setApplicationStatus(status || 'none');
      if (data) {
        setApplicationData({
          description: data.description,
          follower_count: data.follower_count,
          social_media_platform: data.social_media_platform,
          social_media_handle: data.social_media_handle,
          creator_type: data.creator_type,
          previous_experience: data.previous_experience,
        });
      }
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
    setIsEditingApplication(false);
  };

  // Show loading state while checking auth
  if (loading || loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading creator dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isCreator) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 pt-28 lg:pt-20 pb-12">
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

            {applicationStatus === 'pending' && !isEditingApplication && (
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
                  <div className="bg-muted/50 p-4 rounded-lg text-left mb-6">
                    <p className="text-sm font-medium mb-2">What happens next?</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Admin reviews your profile and social media presence</li>
                      <li>• We verify your follower count and engagement</li>
                      <li>• If approved, you'll gain creator access immediately</li>
                      <li>• You'll be notified via email about the decision</li>
                    </ul>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditingApplication(true)}
                    className="w-full sm:w-auto"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Update Application
                  </Button>
                </div>
              </Card>
            )}

            {applicationStatus === 'pending' && isEditingApplication && applicationData && (
              <div className="space-y-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsEditingApplication(false)}
                  className="mb-2"
                >
                  ← Back to Status
                </Button>
                <CreatorApplicationForm 
                  onApplicationSubmitted={handleApplicationSubmitted}
                  existingApplication={{
                    description: applicationData.description,
                    followerCount: String(applicationData.follower_count),
                    socialMediaPlatform: applicationData.social_media_platform,
                    socialMediaHandle: applicationData.social_media_handle,
                    creatorType: applicationData.creator_type || '',
                    previousExperience: applicationData.previous_experience || '',
                  }}
                  isEditing={true}
                />
              </div>
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
      
      <main className="flex-1 pt-28 lg:pt-20 pb-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Creator Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Create and manage your prediction markets
            </p>
          </div>

          {/* Creator Analytics - Full Width */}
          <CreatorAnalytics />

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
                <MyMarkets markets={markets} onMarketResolved={fetchMarkets} />
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
