import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { NavLink } from "./NavLink";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "./ui/dropdown-menu";
import { User, Settings, LogOut, Menu, Coins, PlusCircle } from "lucide-react";
import { NotificationsBell } from "./notifications/NotificationsBell";
import PaymentMethodsDialog from "./wallet/PaymentMethodsDialog";
const cricmaxxLogo = "/assets/cricmaxx-logo.png";

const Navigation = () => {
  const { isAuthenticated, signOut, profile, isCreator, isAdmin, loading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const goToLogin = () => navigate(`/auth?mode=login&redirect=${encodeURIComponent(location.pathname + location.search)}`);
  const goToSignup = () => navigate(`/auth?mode=signup&redirect=${encodeURIComponent(location.pathname + location.search)}`);
  const [showBuyTokensDialog, setShowBuyTokensDialog] = useState(false);
  
  // Only show authenticated links when auth is fully resolved AND user is authenticated
  const showAuthenticatedLinks = !loading && isAuthenticated;
  
  // Don't show sign-in/sign-up buttons while still loading auth or profile
  const showUnauthenticatedButtons = !loading && !profileLoading && !isAuthenticated;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center shrink-0">
            <img 
              src={cricmaxxLogo} 
              alt="CricMaxx" 
              width={96}
              height={64}
              className="h-16 w-auto"
            />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-5 flex-1">
            <NavLink 
              to="/" 
              className="text-sm text-foreground hover:text-primary transition-colors"
              activeClassName="text-primary font-semibold"
            >
              Home
            </NavLink>
            <NavLink 
              to="/polls"
              className="text-sm text-foreground hover:text-primary transition-colors"
              activeClassName="text-primary font-semibold"
            >
              Polls
            </NavLink>
            <NavLink 
              to="/contests"
              className="text-sm text-foreground hover:text-primary transition-colors"
              activeClassName="text-primary font-semibold"
            >
              Contests
            </NavLink>
            <NavLink 
              to="/markets"
              className="text-sm text-foreground hover:text-primary transition-colors"
              activeClassName="text-primary font-semibold"
            >
              Markets
            </NavLink>
            <NavLink 
              to="/rapidpred"
              className="text-sm text-foreground hover:text-primary transition-colors"
              activeClassName="text-primary font-semibold"
            >
              RapidPred
            </NavLink>
            {showAuthenticatedLinks && (
              <>
                <NavLink 
                  to="/dashboard"
                  className="text-sm text-foreground hover:text-primary transition-colors"
                  activeClassName="text-primary font-semibold"
                >
                  Dashboard
                </NavLink>
                <NavLink 
                  to="/friends"
                  className="text-sm text-foreground hover:text-primary transition-colors"
                  activeClassName="text-primary font-semibold"
                >
                  Friends
                </NavLink>
              </>
            )}
            {showAuthenticatedLinks && isCreator && (
              <NavLink 
                to="/creator"
                className="text-sm text-foreground hover:text-primary transition-colors"
                activeClassName="text-primary font-semibold"
              >
                Creator
              </NavLink>
            )}
            {showAuthenticatedLinks && isAdmin && (
              <NavLink 
                to="/admin"
                className="text-sm text-foreground hover:text-primary transition-colors"
                activeClassName="text-primary font-semibold"
              >
                Admin
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2 lg:gap-3">
            {/* Balance Display - Mobile (authenticated) */}
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

            {/* Mobile Sign In Button (unauthenticated) */}
            {showUnauthenticatedButtons && (
              <Button 
                variant="default"
                size="sm"
                className="lg:hidden bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={goToLogin}
              >
                Sign In
              </Button>
            )}

            {/* Mobile Menu Toggle */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[350px] overflow-y-auto">
                <div className="flex flex-col gap-4 mt-8 pb-8">
                  {/* Prominent Auth Section at Top for Guests */}
                  {showUnauthenticatedButtons && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-2">
                      <p className="text-sm font-medium text-foreground mb-3">
                        Join CricMaxx to start predicting!
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                          onClick={() => {
                            goToSignup();
                            setMobileMenuOpen(false);
                          }}
                        >
                          Sign Up
                        </Button>
                        <Button 
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            goToLogin();
                            setMobileMenuOpen(false);
                          }}
                        >
                          Sign In
                        </Button>
                      </div>
                    </div>
                  )}

                  <NavLink 
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                    activeClassName="text-primary font-semibold"
                  >
                    Home
                  </NavLink>
                  <NavLink 
                    to="/polls"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                    activeClassName="text-primary font-semibold"
                  >
                    Polls
                  </NavLink>
                  <NavLink 
                    to="/contests"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                    activeClassName="text-primary font-semibold"
                  >
                    Contests
                  </NavLink>
                  <NavLink 
                    to="/markets"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                    activeClassName="text-primary font-semibold"
                  >
                    Markets
                  </NavLink>
                  <NavLink 
                    to="/rapidpred"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                    activeClassName="text-primary font-semibold"
                  >
                    RapidPred
                  </NavLink>
                  {showAuthenticatedLinks && (
                    <>
                      <NavLink 
                        to="/dashboard"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                        activeClassName="text-primary font-semibold"
                      >
                        Dashboard
                      </NavLink>
                      <NavLink 
                        to="/friends"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                        activeClassName="text-primary font-semibold"
                      >
                        Friends
                      </NavLink>
                    </>
                  )}
                  {showAuthenticatedLinks && isCreator && (
                    <NavLink 
                      to="/creator"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                      activeClassName="text-primary font-semibold"
                    >
                      Creator
                    </NavLink>
                  )}
                  {showAuthenticatedLinks && isAdmin && (
                    <NavLink 
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                      activeClassName="text-primary font-semibold"
                    >
                      Admin
                    </NavLink>
                  )}
                  
                  <div className="border-t border-border pt-6 mt-4">
                    {showAuthenticatedLinks && profile ? (
                      <div className="space-y-4">
                        <div className="px-2 py-2 bg-muted rounded-lg">
                          <p className="text-sm font-medium">{profile.name}</p>
                          <p className="text-xs text-muted-foreground">{profile.email}</p>
                          <p className="text-sm font-semibold text-primary mt-1">
                            Balance: {(profile.balance ?? 0).toFixed(2)} tokens
                          </p>
                          <Button 
                            size="sm"
                            className="w-full mt-2 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              setShowBuyTokensDialog(true);
                            }}
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            Buy Tokens
                          </Button>
                        </div>
                        {/* KYC button hidden per compliance/kyc-visibility-status */}
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => {
                            navigate('/settings');
                            setMobileMenuOpen(false);
                          }}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Account Settings
                        </Button>
                        <Button 
                          variant="destructive" 
                          className="w-full"
                          onClick={() => {
                            signOut();
                            setMobileMenuOpen(false);
                          }}
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Sign Out
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => {
                            goToLogin();
                            setMobileMenuOpen(false);
                          }}
                        >
                          Sign In
                        </Button>
                        <Button 
                          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                          onClick={() => {
                            goToSignup();
                            setMobileMenuOpen(false);
                          }}
                        >
                          Sign Up
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop User Menu/Auth Buttons */}
            <div className="hidden lg:flex items-center gap-3">
            {showAuthenticatedLinks && profile ? (
              <>
                {/* Notifications Bell */}
                <NotificationsBell />

                {/* Balance Display - Desktop */}
                <Link 
                  to="/dashboard#wallet" 
                  className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors cursor-pointer"
                >
                  <Coins className="w-4 h-4 text-accent" />
                  <span className="text-sm font-bold text-accent">
                    {Math.floor(profile.balance ?? 0).toLocaleString()}
                  </span>
                </Link>

                {/* User Menu */}
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
                    {/* KYC menu item hidden per compliance/kyc-visibility-status */}
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
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={goToLogin}
                >
                  Sign In
                </Button>
                <Button 
                  size="sm"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={goToSignup}
                >
                  Sign Up
                </Button>
              </div>
            ) : null}
            </div>
          </div>
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
