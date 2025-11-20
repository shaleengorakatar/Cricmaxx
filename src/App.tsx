import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Markets from "./pages/Markets";
import MarketDetail from "./pages/MarketDetail";
import CreatorDashboard from "./pages/CreatorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Friends from "./pages/Friends";
import FriendInvite from "./pages/FriendInvite";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import PasswordReset from "./pages/PasswordReset";
import KYCVerification from "./pages/KYCVerification";
import AccountSettings from "./pages/AccountSettings";
import UpcomingMatches from "./pages/UpcomingMatches";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/kyc-verification" element={<KYCVerification />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/upcoming-matches" element={<UpcomingMatches />} />
          <Route path="/market/:id" element={<MarketDetail />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/invite/:token" element={<FriendInvite />} />
          <Route path="/creator" element={<CreatorDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/settings" element={<AccountSettings />} />
          <Route path="/terms" element={<TermsOfUse />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
