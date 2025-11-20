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
import { User, Settings, LogOut, Menu, X } from "lucide-react";

const Navigation = () => {
  const { isAuthenticated, signOut, profile, isCreator, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-primary">
              Shariz
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <NavLink 
              to="/" 
              className="text-foreground hover:text-primary transition-colors"
              activeClassName="text-primary font-semibold"
            >
              Home
            </NavLink>
            <NavLink 
              to="/markets"
              className="text-foreground hover:text-primary transition-colors"
              activeClassName="text-primary font-semibold"
            >
              Markets
            </NavLink>
            <NavLink 
              to="/upcoming-matches"
              className="text-foreground hover:text-primary transition-colors"
              activeClassName="text-primary font-semibold"
            >
              Upcoming Matches
            </NavLink>
            {isAuthenticated && (
              <>
                <NavLink 
                  to="/friends"
                  className="text-foreground hover:text-primary transition-colors"
                  activeClassName="text-primary font-semibold"
                >
                  Friends
                </NavLink>
                <NavLink 
                  to="/dashboard"
                  className="text-foreground hover:text-primary transition-colors"
                  activeClassName="text-primary font-semibold"
                >
                  Dashboard
                </NavLink>
              </>
            )}
            {isAuthenticated && isCreator && (
              <NavLink 
                to="/creator"
                className="text-foreground hover:text-primary transition-colors"
                activeClassName="text-primary font-semibold"
              >
                Creator
              </NavLink>
            )}
            {isAuthenticated && isAdmin && (
              <NavLink 
                to="/admin"
                className="text-foreground hover:text-primary transition-colors"
                activeClassName="text-primary font-semibold"
              >
                Admin
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile Menu Toggle */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="md:hidden">
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
                    to="/upcoming-matches"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                    activeClassName="text-primary font-semibold"
                  >
                    Upcoming Matches
                  </NavLink>
                  {isAuthenticated && (
                    <>
                      <NavLink 
                        to="/friends"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                        activeClassName="text-primary font-semibold"
                      >
                        Friends
                      </NavLink>
                      <NavLink 
                        to="/dashboard"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
                        activeClassName="text-primary font-semibold"
                      >
                        Dashboard
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
                  
                  <div className="border-t border-border pt-6 mt-2">
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
            <div className="hidden md:flex items-center gap-4">
            {isAuthenticated && profile ? (
              <>
                {/* KYC Warning Badge */}
                {!profile.kyc_verified && (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                    <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                      ⚠️ KYC Required
                    </span>
                  </div>
                )}

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <User className="w-4 h-4" />
                      <span className="hidden md:inline">{profile.name}</span>
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
