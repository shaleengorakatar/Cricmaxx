import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Users, TrendingUp, TrendingDown, Minus, Crown } from "lucide-react";
import UserRatingModal from "@/components/leaderboard/UserRatingModal";

interface LeaderboardUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rating_score: number;
  predictions_total: number;
  predictions_correct: number;
}

const Leaderboard = () => {
  const { user, profile } = useAuth();
  const [viewMode, setViewMode] = useState<'global' | 'friends'>('global');
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);

  // Fetch global leaderboard
  const { data: globalLeaderboard, isLoading: globalLoading } = useQuery({
    queryKey: ['leaderboard', 'global'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, rating_score, predictions_total, predictions_correct')
        .eq('show_on_leaderboard', true)
        .order('rating_score', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as LeaderboardUser[];
    },
  });

  // Fetch user's rank if not in top 20
  const { data: userRank } = useQuery({
    queryKey: ['leaderboard', 'userRank', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, rating_score')
        .eq('show_on_leaderboard', true)
        .order('rating_score', { ascending: false });

      if (error) throw error;
      
      const rank = data.findIndex(p => p.id === user.id) + 1;
      return rank > 0 ? rank : null;
    },
    enabled: !!user,
  });

  // Fetch friends leaderboard
  const { data: friendsLeaderboard, isLoading: friendsLoading } = useQuery({
    queryKey: ['leaderboard', 'friends', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get friend IDs
      const { data: friendships, error: friendError } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (friendError) throw friendError;

      const friendIds = friendships.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      
      // Include self
      friendIds.push(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, rating_score, predictions_total, predictions_correct')
        .in('id', friendIds)
        .eq('show_on_leaderboard', true)
        .order('rating_score', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as LeaderboardUser[];
    },
    enabled: !!user && viewMode === 'friends',
  });

  const leaderboard = viewMode === 'global' ? globalLeaderboard : friendsLeaderboard;
  const isLoading = viewMode === 'global' ? globalLoading : friendsLoading;

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Trophy className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-medium text-muted-foreground">#{rank}</span>;
  };

  const getWinRate = (correct: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((correct / total) * 100);
  };

  const getRatingChange = (rating: number) => {
    // For demo purposes, show random change indicators
    const change = rating - 1000;
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const isUserInTop20 = leaderboard?.some(u => u.id === user?.id);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Top Traders</h1>
            </div>
            
            {user && (
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'global' ? 'default' : 'outline'}
                  onClick={() => setViewMode('global')}
                  size="sm"
                >
                  🌍 Global
                </Button>
                <Button
                  variant={viewMode === 'friends' ? 'default' : 'outline'}
                  onClick={() => setViewMode('friends')}
                  size="sm"
                >
                  <Users className="w-4 h-4 mr-1" />
                  Friends
                </Button>
              </div>
            )}
          </div>

          {/* User's current rating */}
          {profile && (
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback>{profile.name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{profile.display_name || profile.name}</p>
                      <p className="text-sm text-muted-foreground">Your Rating</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">🔮 {profile.rating_score || 1000}</p>
                    {userRank && !isUserInTop20 && (
                      <p className="text-sm text-muted-foreground">You are #{userRank}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {viewMode === 'global' ? 'Global Rankings' : 'Friends Rankings'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="w-5 h-5 rounded" />
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : leaderboard && leaderboard.length > 0 ? (
                <div className="space-y-1">
                  {leaderboard.map((leaderUser, index) => {
                    const rank = index + 1;
                    const isCurrentUser = leaderUser.id === user?.id;
                    
                    return (
                      <button
                        key={leaderUser.id}
                        onClick={() => setSelectedUser(leaderUser)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50 ${
                          isCurrentUser ? 'bg-primary/10 border border-primary/20' : ''
                        } ${rank <= 3 ? 'bg-gradient-to-r from-primary/5 to-transparent' : ''}`}
                      >
                        <div className="w-8 flex justify-center">
                          {getRankIcon(rank)}
                        </div>
                        
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={leaderUser.avatar_url || undefined} />
                          <AvatarFallback>
                            {(leaderUser.display_name || leaderUser.username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 text-left">
                          <p className="font-medium text-foreground flex items-center gap-2">
                            {leaderUser.display_name || leaderUser.username || 'Anonymous'}
                            {isCurrentUser && <span className="text-xs text-primary">(You)</span>}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {leaderUser.predictions_total} predictions • {getWinRate(leaderUser.predictions_correct, leaderUser.predictions_total)}% win rate
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {getRatingChange(leaderUser.rating_score)}
                          <span className="font-bold text-lg text-primary">
                            {leaderUser.rating_score}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {viewMode === 'friends' 
                    ? "No friends on the leaderboard yet. Add some friends to see their rankings!"
                    : "No users on the leaderboard yet."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* User's rank if not in top 20 */}
          {userRank && !isUserInTop20 && viewMode === 'global' && (
            <div className="mt-4 text-center">
              <p className="text-muted-foreground">
                You are ranked <span className="font-bold text-primary">#{userRank}</span> globally
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* User Rating Modal */}
      {selectedUser && (
        <UserRatingModal
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
};

export default Leaderboard;