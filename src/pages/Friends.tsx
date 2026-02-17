import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FriendSearch from "@/components/friends/FriendSearch";
import InviteLinkGenerator from "@/components/friends/InviteLinkGenerator";
import FriendsList from "@/components/friends/FriendsList";
import FriendRequestsList from "@/components/friends/FriendRequestsList";
import FriendsTrades from "@/components/friends/FriendsTrades";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useFriends } from "@/hooks/useFriends";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const Friends = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const {
    friends,
    inboundRequests,
    outboundRequests,
    friendsTrades,
    loading,
    fetchFriends,
    fetchRequests,
    fetchFriendsTrades,
    acceptFriend,
    rejectFriend
  } = useFriends();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth?mode=login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center pt-28 lg:pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const pendingCount = inboundRequests.length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-28 lg:pt-20 pb-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Friends</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Connect with friends and see what they're trading
            </p>
          </div>

          {/* Search & Invite Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <ErrorBoundary fallbackTitle="Failed to load friend search">
              <FriendSearch onFriendAdded={fetchRequests} />
            </ErrorBoundary>
            <ErrorBoundary fallbackTitle="Failed to load invite link">
              <InviteLinkGenerator />
            </ErrorBoundary>
          </div>

          {/* Main Content - Desktop: Two columns, Mobile: Stacked */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Friends List (narrow on desktop) */}
            <div className="lg:col-span-1 space-y-6">
              <Tabs defaultValue="friends" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="friends" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Friends</span>
                    <span className="sm:hidden">All</span>
                    {friends.length > 0 && (
                      <span className="ml-1 text-xs">({friends.length})</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Requests</span>
                    <span className="sm:hidden">Req</span>
                    {pendingCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent text-accent-foreground rounded-full">
                        {pendingCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="friends" className="mt-4">
                  <ErrorBoundary fallbackTitle="Failed to load friends list">
                    <FriendsList friends={friends} onRefresh={fetchFriends} />
                  </ErrorBoundary>
                </TabsContent>

                <TabsContent value="requests" className="mt-4">
                  <ErrorBoundary fallbackTitle="Failed to load friend requests">
                    <FriendRequestsList
                      inboundRequests={inboundRequests}
                      outboundRequests={outboundRequests}
                      onAccept={acceptFriend}
                      onReject={rejectFriend}
                    />
                  </ErrorBoundary>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Column: Friends' Trades Feed (wide on desktop) */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-accent" />
                <h2 className="text-lg md:text-xl font-bold text-foreground">
                  Friends' Ongoing Trades
                </h2>
              </div>
              <ErrorBoundary fallbackTitle="Failed to load friends' trades">
                <FriendsTrades trades={friendsTrades} onRefresh={fetchFriendsTrades} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Friends;
