import { MobileLayout } from "@/layouts/MobileLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  User, 
  Settings, 
  Shield, 
  Bell, 
  HelpCircle, 
  LogOut,
  Fingerprint,
  ChevronRight,
  Share2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ProfileBadges } from "@/components/mobile/ProfileBadges";
import { XPProgressBar } from "@/components/mobile/XPProgressBar";
import { useTradingPreferences } from "@/hooks/useTradingPreferences";

const MobileProfile = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { isAvailable, biometricType } = useBiometricAuth();
  const { toast } = useToast();
  const { predictionStreak } = useTradingPreferences();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleBiometricSetup = () => {
    if (!isAvailable) {
      toast({
        title: "Biometric auth not available",
        description: "Your device doesn't support biometric authentication or you're in a web browser. Export to native app for biometric support.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Coming soon",
      description: "Biometric authentication setup will be available after building the native app",
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join me on CricMaxx',
        text: 'Make cricket predictions and win on CricMaxx! 🏏',
        url: window.location.origin,
      });
    } else {
      navigator.clipboard.writeText(window.location.origin);
      toast({ title: "Link copied!" });
    }
  };

  const menuItems = [
    {
      icon: User,
      label: "Account Settings",
      onClick: () => navigate("/account-settings"),
    },
    {
      icon: Shield,
      label: "Security",
      onClick: () => navigate("/account-settings"),
    },
    {
      icon: Fingerprint,
      label: "Biometric Login",
      onClick: handleBiometricSetup,
      badge: !isAvailable ? "Setup Required" : undefined,
    },
    {
      icon: Bell,
      label: "Notifications",
      onClick: () => toast({ title: "Coming soon" }),
    },
    {
      icon: Settings,
      label: "Preferences",
      onClick: () => toast({ title: "Coming soon" }),
    },
    {
      icon: Share2,
      label: "Invite Friends",
      onClick: handleShare,
    },
    {
      icon: HelpCircle,
      label: "Help & Support",
      onClick: () => toast({ title: "Coming soon" }),
    },
  ];

  if (!user) {
    return (
      <MobileLayout>
        <div className="px-4 pt-6 pb-4">
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <p className="text-muted-foreground text-center">
              Please sign in to view your profile
            </p>
            <Button onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const winRate = profile?.predictions_total && profile.predictions_total > 0
    ? Math.round((profile.predictions_correct / profile.predictions_total) * 100)
    : 0;

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4 space-y-6">
        {/* Profile Header */}
        <Card className="p-6 bg-gradient-to-br from-card to-card/50">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/20">
              <AvatarFallback className="text-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                {profile?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">
                {profile?.name || 'User'}
              </h2>
              <p className="text-sm text-muted-foreground">
                @{profile?.username || profile?.email?.split('@')[0]}
              </p>
            </div>
          </div>

          {/* XP Progress */}
          <XPProgressBar ratingScore={profile?.rating_score || 1000} className="mb-4" />

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {profile?.predictions_total || 0}
              </p>
              <p className="text-xs text-muted-foreground">Predictions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">
                {winRate}%
              </p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {profile?.balance?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-muted-foreground">Balance</p>
            </div>
          </div>
        </Card>

        {/* Badges */}
        <Card className="p-4">
          <ProfileBadges
            predictionsTotal={profile?.predictions_total || 0}
            predictionsCorrect={profile?.predictions_correct || 0}
            streak={predictionStreak}
            ratingScore={profile?.rating_score || 1000}
          />
        </Card>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.label}
                className="p-4 active:scale-[0.98] transition-transform cursor-pointer"
                onClick={item.onClick}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-base font-medium text-foreground">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Sign Out Button */}
        <Button
          onClick={handleSignOut}
          variant="destructive"
          className="w-full h-14 text-base"
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sign Out
        </Button>

        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground">
          CricMaxx v1.0.0 • Built with Capacitor
        </p>
      </div>
    </MobileLayout>
  );
};

export default MobileProfile;
