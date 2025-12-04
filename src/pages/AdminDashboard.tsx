import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield } from "lucide-react";
import {
  PendingMarket,
  AdminMarket,
  AdminUser,
  FraudAlert,
  RecentActivity,
  PlatformStats as PlatformStatsType,
} from "@/types/admin";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

// Mock data
const mockPendingMarkets: PendingMarket[] = [
  {
    id: "pm1",
    question: "Will Rohit Sharma score 100+ runs in the next T20 match?",
    creator: "Priya Sharma",
    creatorId: "u123",
    category: "Cricket",
    expiryTime: "2025-12-15T14:00:00Z",
    resolutionSource: "ESPN official scorecard",
    submittedAt: "2025-11-10T09:30:00Z",
  },
  {
    id: "pm2",
    question: "Will Tesla stock close above $300 by end of Q4 2025?",
    creator: "Raj Kumar",
    creatorId: "u456",
    category: "Finance",
    expiryTime: "2025-12-31T21:00:00Z",
    resolutionSource: "NASDAQ official closing price",
    submittedAt: "2025-11-11T11:15:00Z",
  },
];

const mockMarketsToResolve: AdminMarket[] = [
  {
    id: "am1",
    question: "Will India qualify for World Cup 2025?",
    status: "closed",
    volume: 235000,
    expiryTime: "2025-11-01T18:00:00Z",
  },
];

const mockUsers: AdminUser[] = [
  {
    id: "u1",
    email: "john@example.com",
    name: "John Doe",
    signupDate: "2025-09-15T10:00:00Z",
    kycVerified: true,
    balance: 12500,
    role: "trader",
    isBanned: false,
    totalVolume: 45000,
  },
  {
    id: "u2",
    email: "priya@example.com",
    name: "Priya Sharma",
    signupDate: "2025-10-01T14:30:00Z",
    kycVerified: true,
    balance: 8750,
    role: "creator",
    isBanned: false,
    totalVolume: 125000,
  },
  {
    id: "u3",
    email: "suspicious@example.com",
    name: "Test User",
    signupDate: "2025-11-10T08:00:00Z",
    kycVerified: false,
    balance: 25000,
    role: "trader",
    isBanned: false,
    totalVolume: 180000,
  },
];

const mockAlerts: FraudAlert[] = [
  {
    id: "a1",
    userId: "u3",
    userName: "Test User",
    alertType: "high_volume",
    description: "Trading volume of 180,000 shares exceeded 24h threshold of 100,000",
    timestamp: "2025-11-11T15:30:00Z",
    severity: "high",
    status: "pending",
  },
  {
    id: "a2",
    userId: "u5",
    userName: "Multiple Account User",
    alertType: "suspicious_ip",
    description: "3 accounts created from same IP address within 2 hours",
    timestamp: "2025-11-11T12:00:00Z",
    severity: "medium",
    status: "pending",
  },
];

const mockActivity: RecentActivity[] = [
  {
    id: "ra1",
    timestamp: new Date().toISOString(),
    userId: "u1",
    userName: "John Doe",
    action: "Trade Executed",
    details: "Bought 200 YES shares in Bitcoin market",
    amount: 140,
  },
  {
    id: "ra2",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    userId: "u2",
    userName: "Priya Sharma",
    action: "Market Created",
    details: "Submitted new cricket market for approval",
  },
  {
    id: "ra3",
    timestamp: new Date(Date.now() - 600000).toISOString(),
    userId: "u3",
    userName: "Test User",
    action: "Withdrawal",
    details: "Withdrew funds to external wallet",
    amount: 5000,
  },
];

const mockStats: PlatformStatsType = {
  activeUsers: 1245,
  totalUsers: 3890,
  activeMarkets: 28,
  totalMarkets: 156,
  totalVolume: 4250000,
  todayTrades: 1847,
  todayVolume: 285000,
  pendingApprovals: 2,
};

const AdminDashboard = () => {
  const [pendingMarkets, setPendingMarkets] = useState(mockPendingMarkets);
  const [users, setUsers] = useState(mockUsers);
  const [alerts, setAlerts] = useState(mockAlerts);
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

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

  const handleApprove = (id: string) => {
    setPendingMarkets(prev => prev.filter(m => m.id !== id));
  };

  const handleReject = (id: string) => {
    setPendingMarkets(prev => prev.filter(m => m.id !== id));
  };

  const handleToggleKYC = (id: string) => {
    setUsers(prev => prev.map(u => 
      u.id === id ? { ...u, kycVerified: !u.kycVerified } : u
    ));
  };

  const handleToggleBan = (id: string) => {
    setUsers(prev => prev.map(u => 
      u.id === id ? { ...u, isBanned: !u.isBanned } : u
    ));
  };

  const handlePromoteToCreator = (id: string) => {
    setUsers(prev => prev.map(u => 
      u.id === id ? { ...u, role: "creator" as const } : u
    ));
  };

  const handleMarkAlertReviewed = (id: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === id ? { ...a, status: "reviewed" as const } : a
    ));
  };

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
            <PlatformStats stats={mockStats} />
          </div>

          <Tabs defaultValue="approvals" className="space-y-4 md:space-y-6">
            <div className="overflow-x-auto -mx-4 px-4">
              <TabsList className="grid w-full grid-cols-2 min-w-[600px] md:min-w-0 md:w-auto md:inline-grid md:grid-cols-6">
                <TabsTrigger value="approvals" className="text-xs md:text-sm">Market Approvals</TabsTrigger>
                <TabsTrigger value="creators" className="text-xs md:text-sm">Creator Apps</TabsTrigger>
                <TabsTrigger value="generator" className="text-xs md:text-sm">Auto Generate</TabsTrigger>
                <TabsTrigger value="resolution" className="text-xs md:text-sm">Resolution</TabsTrigger>
                <TabsTrigger value="users" className="text-xs md:text-sm">Users</TabsTrigger>
                <TabsTrigger value="monitoring" className="text-xs md:text-sm">Monitoring</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="approvals">
              <MarketApprovalPanel 
                markets={pendingMarkets}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </TabsContent>

            <TabsContent value="creators">
              <CreatorApplicationsPanel />
            </TabsContent>

            <TabsContent value="generator">
              <CricketMarketGenerator />
            </TabsContent>

            <TabsContent value="resolution">
              <div className="space-y-6">
                <MarketResolutionPanel />
                <OracleResolutionPanel />
              </div>
            </TabsContent>

            <TabsContent value="users">
              <UserManagementPanel 
                users={users}
                onToggleKYC={handleToggleKYC}
                onToggleBan={handleToggleBan}
                onPromoteToCreator={handlePromoteToCreator}
              />
            </TabsContent>

            <TabsContent value="monitoring">
              <MonitoringPanel />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
