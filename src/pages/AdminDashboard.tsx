import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PlatformStats from "@/components/admin/PlatformStats";
import MarketApprovalPanel from "@/components/admin/MarketApprovalPanel";
import MarketResolutionPanel from "@/components/admin/MarketResolutionPanel";
import OracleResolutionPanel from "@/components/admin/OracleResolutionPanel";
import UserManagementPanel from "@/components/admin/UserManagementPanel";
import MonitoringPanel from "@/components/admin/MonitoringPanel";
import CricketMarketGenerator from "@/components/admin/CricketMarketGenerator";
import { CreatorApplicationsPanel } from "@/components/admin/CreatorApplicationsPanel";
import PlatformFeesPanel from "@/components/admin/PlatformFeesPanel";
import LiquiditySeedingPanel from "@/components/admin/LiquiditySeedingPanel";
import LoadTestPanel from "@/components/admin/LoadTestPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth?mode=login');
    }
  }, [loading, isAuthenticated, navigate]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <Shield className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          <div className="mb-6 md:mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-6 w-6 md:h-8 md:w-8 text-accent" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Dashboard</h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage markets, users, and monitor platform activity
            </p>
          </div>

          <div className="mb-6 md:mb-8">
            <PlatformStats />
          </div>

          <Tabs defaultValue="approvals" className="space-y-4 md:space-y-6">
            {/* Mobile: Scrollable pill tabs */}
            <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-hide">
              <TabsList className="inline-flex h-auto p-1 gap-1 bg-muted/50 rounded-lg min-w-max md:grid md:grid-cols-5 lg:grid-cols-9 md:w-full">
                <TabsTrigger value="approvals" className="text-xs px-3 py-2 whitespace-nowrap data-[state=active]:bg-background">
                  Approvals
                </TabsTrigger>
                <TabsTrigger value="creators" className="text-xs px-3 py-2 whitespace-nowrap data-[state=active]:bg-background">
                  Creators
                </TabsTrigger>
                <TabsTrigger value="generator" className="text-xs px-3 py-2 whitespace-nowrap data-[state=active]:bg-background">
                  Generate
                </TabsTrigger>
                <TabsTrigger value="liquidity" className="text-xs px-3 py-2 whitespace-nowrap data-[state=active]:bg-background">
                  Liquidity
                </TabsTrigger>
                <TabsTrigger value="resolution" className="text-xs px-3 py-2 whitespace-nowrap data-[state=active]:bg-background">
                  Resolve
                </TabsTrigger>
                <TabsTrigger value="users" className="text-xs px-3 py-2 whitespace-nowrap data-[state=active]:bg-background">
                  Users
                </TabsTrigger>
                <TabsTrigger value="fees" className="text-xs px-3 py-2 whitespace-nowrap data-[state=active]:bg-background">
                  Fees
                </TabsTrigger>
                <TabsTrigger value="monitoring" className="text-xs px-3 py-2 whitespace-nowrap data-[state=active]:bg-background">
                  Monitor
                </TabsTrigger>
                <TabsTrigger value="loadtest" className="text-xs px-3 py-2 whitespace-nowrap data-[state=active]:bg-background">
                  Load Test
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="approvals">
              <MarketApprovalPanel />
            </TabsContent>

            <TabsContent value="creators">
              <CreatorApplicationsPanel />
            </TabsContent>

            <TabsContent value="generator">
              <CricketMarketGenerator />
            </TabsContent>

            <TabsContent value="liquidity">
              <LiquiditySeedingPanel />
            </TabsContent>

            <TabsContent value="resolution">
              <div className="space-y-6">
                <MarketResolutionPanel />
                <OracleResolutionPanel />
              </div>
            </TabsContent>

            <TabsContent value="users">
              <UserManagementPanel />
            </TabsContent>

            <TabsContent value="fees">
              <PlatformFeesPanel />
            </TabsContent>

            <TabsContent value="monitoring">
              <MonitoringPanel />
            </TabsContent>

            <TabsContent value="loadtest">
              <LoadTestPanel />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
