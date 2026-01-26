import { Link, useNavigate } from "react-router-dom";
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
import { User, Settings, LogOut, Menu, Coins } from "lucide-react";
import { NotificationsBell } from "./notifications/NotificationsBell";
import cricmaxxLogo from "@/assets/cricmaxx-logo.png";

const Navigation = () => {
  const { isAuthenticated, signOut, profile, isCreator, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-8">
          <Link to="/" className="flex items-center shrink-0">
            <img 
              src={cricmaxxLogo} 
              alt="CricMaxx" 
              className="h-14 w-auto"
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
            {isAuthenticated && (
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
            {isAuthenticated && isCreator && (
              <NavLink 
                to="/creator"
                className="text-sm text-foreground hover:text-primary transition-colors"
                activeClassName="text-primary font-semibold"
              >
                Creator
              </NavLink>
            )}
            {isAuthenticated && isAdmin && (
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
            {/* Balance Display - Mobile */}
            {isAuthenticated && profile && (
              <Link 
                to="/dashboard" 
                className="flex lg:hidden items-center gap-1.5 px-2 py-1 bg-accent/10 rounded-md hover:bg-accent/20 transition-colors cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold text-accent">
                  {Math.floor(profile.balance ?? 0).toLocaleString()}
                </span>
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[350px]">
                <div className="flex flex-col gap-6 mt-8">
                  <NavLink 
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                    activeClassName="text-primary font-semibold"
                  >
                    Home
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
                  {isAuthenticated && (
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
                  {isAuthenticated && isCreator && (
                    <NavLink 
                      to="/creator"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                      activeClassName="text-primary font-semibold"
                    >
                      Creator
                    </NavLink>
                  )}
                  {isAuthenticated && isAdmin && (
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
                    {isAuthenticated && profile ? (
                      <div className="space-y-4">
                        <div className="px-2 py-2 bg-muted rounded-lg">
                          <p className="text-sm font-medium">{profile.name}</p>
                          <p className="text-xs text-muted-foreground">{profile.email}</p>
                          <p className="text-sm font-semibold text-primary mt-1">
                            Balance: ${profile.balance.toFixed(2)}
                          </p>
                        </div>
                        {!profile.kyc_verified && (
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => {
                              navigate('/kyc-verification');
                              setMobileMenuOpen(false);
                            }}
                          >
                            Complete KYC
                          </Button>
                        )}
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
                            navigate('/auth?mode=login');
                            setMobileMenuOpen(false);
                          }}
                        >
                          Sign In
                        </Button>
                        <Button 
                          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                          onClick={() => {
                            navigate('/auth?mode=signup');
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
            {isAuthenticated && profile ? (
              <>
                {/* Notifications Bell */}
                <NotificationsBell />

                {/* Balance Display - Desktop */}
                <Link 
                  to="/dashboard" 
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
                        Balance: ${profile.balance.toFixed(2)}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Account Settings
                    </DropdownMenuItem>
                    {!profile.kyc_verified && (
                      <DropdownMenuItem onClick={() => navigate('/kyc-verification')}>
                        <User className="w-4 h-4 mr-2" />
                        Complete KYC
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/auth?mode=login')}
                >
                  Sign In
                </Button>
                <Button 
                  size="sm"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => navigate('/auth?mode=signup')}
                >
                  Sign Up
                </Button>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
