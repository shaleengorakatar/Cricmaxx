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
import { Shield, User, Key } from "lucide-react";

const AccountSettings = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setMfaEnabled(profile.mfa_enabled);
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
          <h1 className="text-3xl font-bold text-foreground mb-8">Account Settings</h1>

          <div className="space-y-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <CardTitle>Profile Information</CardTitle>
                </div>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Account Balance</Label>
                  <div className="text-2xl font-bold text-primary">
                    ${profile.balance.toFixed(2)}
                  </div>
                </div>
                <Button onClick={handleUpdateProfile} disabled={loading}>
                  Save Changes
                </Button>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <CardTitle>Security</CardTitle>
                </div>
                <CardDescription>Manage your account security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="mfa-toggle">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
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
                  />
                </div>

                {mfaEnabled && (
                  <div className="bg-muted/50 border border-border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      In a production app, you would scan this QR code with Google Authenticator or similar app. 
                      For this demo, any 6-digit code will work during login.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KYC Status */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  <CardTitle>Verification Status</CardTitle>
                </div>
                <CardDescription>Your account verification information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    profile.kyc_verified 
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {profile.kyc_verified ? '✓ Verified' : '⚠ Not Verified'}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {profile.kyc_verified 
                      ? 'Your identity has been verified'
                      : 'Complete KYC verification to enable full trading access'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AccountSettings;
