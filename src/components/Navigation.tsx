import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { NavLink } from "./NavLink";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "./ui/dropdown-menu";
import { User, Settings, LogOut, Coins, PlusCircle } from "lucide-react";
import { NotificationsBell } from "./notifications/NotificationsBell";
import PaymentMethodsDialog from "./wallet/PaymentMethodsDialog";
const cricmaxxLogo = "/assets/cricmaxx-logo.png";

const Navigation = () => {
  const { isAuthenticated, signOut, profile, isCreator, isAdmin, loading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const goToLogin = () => navigate(`/auth?mode=login&redirect=${encodeURIComponent(location.pathname + location.search)}`);
  const goToSignup = () => navigate(`/auth?mode=signup&redirect=${encodeURIComponent(location.pathname + location.search)}`);
  const [showBuyTokensDialog, setShowBuyTokensDialog] = useState(false);
  
  // Only show authenticated links when auth is fully resolved AND user is authenticated
  const showAuthenticatedLinks = !loading && isAuthenticated;
  
  // Don't show sign-in/sign-up buttons while still loading auth or profile
  const showUnauthenticatedButtons = !loading && !profileLoading && !isAuthenticated;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center shrink-0">
            <img 
              src={cricmaxxLogo} 
              alt="CricMaxx" 
              width={160}
              height={100}
              className="h-14 lg:h-20 w-auto"
            />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-5 flex-1">
            <NavLink to="/" className="text-sm text-foreground hover:text-primary transition-colors" activeClassName="text-primary font-semibold">Home</NavLink>
            <NavLink to="/polls" className="text-sm text-foreground hover:text-primary transition-colors" activeClassName="text-primary font-semibold">Polls</NavLink>
            <NavLink to="/contests" className="text-sm text-foreground hover:text-primary transition-colors" activeClassName="text-primary font-semibold">Contests</NavLink>
            <NavLink to="/markets" className="text-sm text-foreground hover:text-primary transition-colors" activeClassName="text-primary font-semibold">Markets</NavLink>
            <NavLink to="/rapidpred" className="text-sm text-foreground hover:text-primary transition-colors" activeClassName="text-primary font-semibold">RapidPred</NavLink>
            {showAuthenticatedLinks && (
              <>
                <NavLink to="/dashboard" className="text-sm text-foreground hover:text-primary transition-colors" activeClassName="text-primary font-semibold">Dashboard</NavLink>
                <NavLink to="/friends" className="text-sm text-foreground hover:text-primary transition-colors" activeClassName="text-primary font-semibold">Friends</NavLink>
              </>
            )}
            {showAuthenticatedLinks && isCreator && (
              <NavLink to="/creator" className="text-sm text-foreground hover:text-primary transition-colors" activeClassName="text-primary font-semibold">Creator</NavLink>
            )}
            {showAuthenticatedLinks && isAdmin && (
              <NavLink to="/admin" className="text-sm text-foreground hover:text-primary transition-colors" activeClassName="text-primary font-semibold">Admin</NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2 lg:gap-3">
            {/* Mobile: Balance chip */}
            {showAuthenticatedLinks && profile && (
              <Link 
                to="/dashboard#wallet" 
                className="flex lg:hidden items-center gap-1.5 px-2 py-1 bg-accent/10 rounded-md hover:bg-accent/20 transition-colors cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold text-accent">
                  {Math.floor(profile.balance ?? 0).toLocaleString()}
                </span>
              </Link>
            )}

            {/* Mobile: Auth buttons always visible */}
            {showUnauthenticatedButtons && (
              <div className="flex lg:hidden items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={goToLogin}>
                  Log in
                </Button>
                <Button size="sm" className="h-8 text-xs px-3 bg-accent text-accent-foreground hover:bg-accent/90" onClick={goToSignup}>
                  Sign up
                </Button>
              </div>
            )}

            {/* Mobile: Notifications + Profile for authenticated */}
            {showAuthenticatedLinks && (
              <div className="flex lg:hidden items-center gap-1">
                <NotificationsBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <User className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {profile && (
                      <div className="px-2 py-1.5">
                        <p className="text-sm font-medium">{profile.name}</p>
                        <p className="text-xs text-muted-foreground">{profile.email}</p>
                        <p className="text-xs font-semibold text-primary mt-1">
                          Balance: {(profile.balance ?? 0).toFixed(2)} tokens
                        </p>
                        <Button 
                          size="sm"
                          className="w-full mt-2 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                          onClick={() => setShowBuyTokensDialog(true)}
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          Buy Tokens
                        </Button>
                      </div>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Account Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Desktop User Menu/Auth Buttons */}
            <div className="hidden lg:flex items-center gap-3">
            {showAuthenticatedLinks && profile ? (
              <>
                <NotificationsBell />
                <Link 
                  to="/dashboard#wallet" 
                  className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors cursor-pointer"
                >
                  <Coins className="w-4 h-4 text-accent" />
                  <span className="text-sm font-bold text-accent">
                    {Math.floor(profile.balance ?? 0).toLocaleString()}
                  </span>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 max-w-[140px]">
                      <User className="w-4 h-4 shrink-0" />
                      <span className="truncate">{profile.name?.split(' ')[0]}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{profile.name}</p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                      <p className="text-xs font-semibold text-primary mt-1">
                        Balance: {(profile.balance ?? 0).toFixed(2)} tokens
                      </p>
                      <Button 
                        size="sm"
                        className="w-full mt-2 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                        onClick={() => setShowBuyTokensDialog(true)}
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        Buy Tokens
                      </Button>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Account Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : showUnauthenticatedButtons ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToLogin}>Sign In</Button>
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={goToSignup}>Sign Up</Button>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Horizontal scrolling category tabs */}
      <div className="lg:hidden overflow-x-auto scrollbar-hide border-t border-border/40">
        <div className="flex items-center gap-1 px-4 py-1.5 min-w-max">
          {[
            { label: "Trending", to: "/" },
            { label: "Markets", to: "/markets" },
            { label: "Polls", to: "/polls" },
            { label: "Contests", to: "/contests" },
            { label: "RapidPred", to: "/rapidpred" },
            ...(showAuthenticatedLinks ? [
              { label: "Dashboard", to: "/dashboard" },
              { label: "Friends", to: "/friends" },
            ] : []),
            ...(showAuthenticatedLinks && isCreator ? [{ label: "Creator", to: "/creator" }] : []),
            ...(showAuthenticatedLinks && isAdmin ? [{ label: "Admin", to: "/admin" }] : []),
          ].map((tab) => {
            const isActive = location.pathname === tab.to || (tab.to === "/" && location.pathname === "/");
            return (
              <button
                key={tab.to}
                onClick={() => navigate(tab.to)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-full transition-colors",
                  isActive
                    ? "text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Buy Tokens Dialog */}
      <PaymentMethodsDialog
        isOpen={showBuyTokensDialog}
        onClose={() => setShowBuyTokensDialog(false)}
        onSuccess={() => setShowBuyTokensDialog(false)}
      />
    </nav>
  );
};

export default Navigation;
