import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, User, Key, Trophy } from "lucide-react";

const AccountSettings = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setMfaEnabled(profile.mfa_enabled);
      setShowOnLeaderboard(profile.show_on_leaderboard ?? true);
    }
  }, [profile]);

  if (!user || !profile) {
    return null;
  }

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMFA = async (enabled: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ mfa_enabled: enabled })
        .eq('id', user.id);

      if (error) throw error;

      setMfaEnabled(enabled);
      toast({
        title: enabled ? "MFA Enabled" : "MFA Disabled",
        description: enabled 
          ? "Two-factor authentication has been enabled. You'll be prompted for a code on your next login." 
          : "Two-factor authentication has been disabled.",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update MFA settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6 md:mb-8">Account Settings</h1>

          <div className="space-y-4 md:space-y-6">
            {/* Profile Information */}
            <Card>
              <CardHeader className="px-4 md:px-6">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg md:text-xl">Profile Information</CardTitle>
                </div>
                <CardDescription className="text-sm">Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 md:px-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm md:text-base">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm md:text-base">Email</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    disabled
                    className="h-12 text-base"
                  />
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm md:text-base">Account Balance</Label>
                  <div className="text-xl md:text-2xl font-bold text-primary">
                    ${profile.balance.toFixed(2)}
                  </div>
                </div>
                <Button 
                  onClick={handleUpdateProfile} 
                  disabled={loading}
                  className="h-12 active:scale-95 transition-transform"
                >
                  Save Changes
                </Button>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader className="px-4 md:px-6">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg md:text-xl">Security</CardTitle>
                </div>
                <CardDescription className="text-sm">Manage your account security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 md:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="mfa-toggle" className="text-sm md:text-base">Two-Factor Authentication</Label>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {mfaEnabled 
                        ? "MFA is enabled. You'll be prompted for a code when you sign in." 
                        : "Enable MFA for additional account security"}
                    </p>
                  </div>
                  <Switch
                    id="mfa-toggle"
                    checked={mfaEnabled}
                    onCheckedChange={handleToggleMFA}
                    disabled={loading}
                    className="shrink-0"
                  />
                </div>

                {mfaEnabled && (
                  <div className="bg-muted/50 border border-border rounded-lg p-4">
                    <p className="text-xs md:text-sm text-muted-foreground">
                      In a production app, you would scan this QR code with Google Authenticator or similar app. 
                      For this demo, any 6-digit code will work during login.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Leaderboard Privacy */}
            <Card>
              <CardHeader className="px-4 md:px-6">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg md:text-xl">Leaderboard Privacy</CardTitle>
                </div>
                <CardDescription className="text-sm">Control your visibility on public leaderboards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 md:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="leaderboard-toggle" className="text-sm md:text-base">Show my rating on public leaderboard</Label>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {showOnLeaderboard 
                        ? "Your rating and stats are visible on the global and friends leaderboards" 
                        : "Your rating is hidden from all leaderboards (you can still see your own stats)"}
                    </p>
                  </div>
                  <Switch
                    id="leaderboard-toggle"
                    checked={showOnLeaderboard}
                    onCheckedChange={async (enabled) => {
                      setLoading(true);
                      try {
                        const { error } = await supabase
                          .from('profiles')
                          .update({ show_on_leaderboard: enabled })
                          .eq('id', user.id);

                        if (error) throw error;

                        setShowOnLeaderboard(enabled);
                        toast({
                          title: enabled ? "Visible on Leaderboard" : "Hidden from Leaderboard",
                          description: enabled 
                            ? "Your rating is now visible on public leaderboards." 
                            : "Your rating is now hidden from all leaderboards.",
                        });
                      } catch (error) {
                        toast({
                          title: "Update failed",
                          description: "Failed to update leaderboard visibility. Please try again.",
                          variant: "destructive",
                        });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="shrink-0"
                  />
                </div>
              </CardContent>
            </Card>

            {/* KYC Status hidden per compliance/kyc-visibility-status */}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AccountSettings;
