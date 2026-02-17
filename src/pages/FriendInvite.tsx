import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFriends } from "@/hooks/useFriends";
import { supabase } from "@/integrations/supabase/client";

const FriendInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { acceptInvite } = useFriends();
  const [inviterName, setInviterName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const loadInviteInfo = async () => {
      if (!token) {
        setError("Invalid invite link");
        setLoading(false);
        return;
      }

      try {
        // Fetch invite token info to get inviter details
        const { data: inviteData, error: inviteError } = await supabase
          .from('friend_invite_tokens')
          .select(`
            user_id,
            expires_at,
            used_at,
            profiles:user_id (
              display_name,
              username
            )
          `)
          .eq('token', token)
          .single();

        if (inviteError || !inviteData) {
          setError("Invalid or expired invite link");
          setLoading(false);
          return;
        }

        // Check if expired
        if (new Date(inviteData.expires_at) < new Date()) {
          setError("This invite link has expired");
          setLoading(false);
          return;
        }

        // Check if already used
        if (inviteData.used_at) {
          setError("This invite link has already been used");
          setLoading(false);
          return;
        }

        const profile = inviteData.profiles as any;
        setInviterName(profile?.display_name || profile?.username || "Someone");
        setLoading(false);
      } catch (error) {
        console.error('Error loading invite:', error);
        setError("Failed to load invite details");
        setLoading(false);
      }
    };

    loadInviteInfo();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    setAccepting(true);
    const success = await acceptInvite(token);
    setAccepting(false);

    if (success) {
      setAccepted(true);
      setTimeout(() => {
        navigate('/friends');
      }, 2000);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center pt-28 lg:pt-20 pb-12 px-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>
                Please sign in or create an account to accept this friend invite
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate('/auth?mode=login')}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Sign In / Sign Up
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 flex items-center justify-center pt-28 lg:pt-20 pb-12 px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                <CardTitle>Loading invite...</CardTitle>
              </>
            ) : error ? (
              <>
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <CardTitle>Invalid Invite</CardTitle>
                <CardDescription>{error}</CardDescription>
              </>
            ) : accepted ? (
              <>
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <CardTitle>Friend Added!</CardTitle>
                <CardDescription>
                  You are now friends with {inviterName}. Redirecting to Friends page...
                </CardDescription>
              </>
            ) : (
              <>
                <UserPlus className="w-12 h-12 text-accent mx-auto mb-4" />
                <CardTitle>Friend Invitation</CardTitle>
                <CardDescription>
                  <span className="font-semibold text-foreground">{inviterName}</span> wants to be your friend on Shariz
                </CardDescription>
              </>
            )}
          </CardHeader>

          {!loading && !error && !accepted && (
            <CardContent className="space-y-3">
              <Button 
                onClick={handleAccept}
                disabled={accepting}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {accepting ? "Adding Friend..." : "Accept & Add Friend"}
              </Button>
              <Button 
                onClick={handleCancel}
                variant="outline"
                disabled={accepting}
                className="w-full"
              >
                Cancel
              </Button>
            </CardContent>
          )}

          {error && (
            <CardContent>
              <Button 
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full"
              >
                Go to Home
              </Button>
            </CardContent>
          )}
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default FriendInvite;
