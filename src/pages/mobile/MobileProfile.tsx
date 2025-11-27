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
  ChevronRight 
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const MobileProfile = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { isAvailable, biometricType } = useBiometricAuth();
  const { toast } = useToast();

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

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4">
        {/* Profile Header */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                {profile?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">
                {profile?.name || 'User'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {profile?.email}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-lg font-bold text-foreground">
                {profile?.balance.toLocaleString() || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">KYC Status</p>
              <Badge variant={profile?.kyc_verified ? "default" : "secondary"} className="mt-1">
                {profile?.kyc_verified ? "Verified" : "Not Verified"}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Menu Items */}
        <div className="space-y-2 mb-6">
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
        <p className="text-center text-xs text-muted-foreground mt-6">
          Shariz v1.0.0 • Built with Capacitor
        </p>
      </div>
    </MobileLayout>
  );
};

export default MobileProfile;
