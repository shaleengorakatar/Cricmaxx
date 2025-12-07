import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TradingModeProvider } from "@/hooks/useTradingMode";
import Index from "./pages/Index";

// Lazy load all non-critical pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Markets = lazy(() => import("./pages/Markets"));
const MarketDetail = lazy(() => import("./pages/MarketDetail"));
const CreatorDashboard = lazy(() => import("./pages/CreatorDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Friends = lazy(() => import("./pages/Friends"));
const FriendInvite = lazy(() => import("./pages/FriendInvite"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const PasswordReset = lazy(() => import("./pages/PasswordReset"));
const KYCVerification = lazy(() => import("./pages/KYCVerification"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const RapidPred = lazy(() => import("./pages/RapidPred"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MobileHome = lazy(() => import("./pages/mobile/MobileHome"));
const MobileMarkets = lazy(() => import("./pages/mobile/MobileMarkets"));
const MobileMyPredictions = lazy(() => import("./pages/mobile/MobileMyPredictions"));
const MobileWallet = lazy(() => import("./pages/mobile/MobileWallet"));
const MobileProfile = lazy(() => import("./pages/mobile/MobileProfile"));
const MobileAuth = lazy(() => import("./pages/mobile/MobileAuth"));
const MobileSwipePreds = lazy(() => import("./pages/mobile/MobileSwipePreds"));

const queryClient = new QueryClient();

// Minimal loading fallback to avoid layout shift
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TradingModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/password-reset" element={<PasswordReset />} />
              <Route path="/kyc-verification" element={<KYCVerification />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/markets" element={<Markets />} />
              <Route path="/rapidpred" element={<RapidPred />} />
              <Route path="/market/:id" element={<MarketDetail />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/invite/:token" element={<FriendInvite />} />
              <Route path="/creator" element={<CreatorDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/settings" element={<AccountSettings />} />
              <Route path="/account-settings" element={<AccountSettings />} />
              <Route path="/terms" element={<TermsOfUse />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              {/* Mobile Routes */}
              <Route path="/mobile" element={<MobileHome />} />
              <Route path="/mobile/auth" element={<MobileAuth />} />
              <Route path="/mobile/markets" element={<MobileMarkets />} />
              <Route path="/mobile/swipepreds" element={<MobileSwipePreds />} />
              <Route path="/mobile/predictions" element={<MobileMyPredictions />} />
              <Route path="/mobile/wallet" element={<MobileWallet />} />
              <Route path="/mobile/profile" element={<MobileProfile />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </TradingModeProvider>
  </QueryClientProvider>
);

export default App;
