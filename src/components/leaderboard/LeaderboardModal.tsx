import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Users, TrendingUp, TrendingDown, Minus, Eye, EyeOff } from "lucide-react";
import UserRatingModal from "@/components/leaderboard/UserRatingModal";
import { useToast } from "@/hooks/use-toast";

interface LeaderboardUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rating_score: number;
  predictions_total: number;
  predictions_correct: number;
}

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LeaderboardModal = ({ isOpen, onClose }: LeaderboardModalProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'global' | 'friends'>('global');
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [localShowOnLeaderboard, setLocalShowOnLeaderboard] = useState(profile?.show_on_leaderboard ?? true);

  useEffect(() => {
    if (profile) {
      setLocalShowOnLeaderboard(profile.show_on_leaderboard ?? true);
    }
  }, [profile?.show_on_leaderboard]);

  const privacyMutation = useMutation({
    mutationFn: async (showOnLeaderboard: boolean) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('profiles')
        .update({ show_on_leaderboard: showOnLeaderboard })
        .eq('id', user.id);
      if (error) throw error;
      return showOnLeaderboard;
    },
    onMutate: async (showOnLeaderboard) => {
      setLocalShowOnLeaderboard(showOnLeaderboard);
    },
    onSuccess: (showOnLeaderboard) => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      toast({
        title: showOnLeaderboard ? "Visible on Leaderboard" : "Hidden from Leaderboard",
        description: showOnLeaderboard 
          ? "Your rating is now visible on public leaderboards." 
          : "Your rating is now hidden from all leaderboards.",
      });
    },
    onError: (_, showOnLeaderboard) => {
      setLocalShowOnLeaderboard(!showOnLeaderboard);
      toast({
        title: "Update failed",
        description: "Failed to update visibility. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch global leaderboard using SECURITY DEFINER RPC function (bypasses RLS)
  const { data: globalLeaderboard, isLoading: globalLoading } = useQuery({
    queryKey: ['leaderboard', 'global'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard_cached', { _limit: 50 });
      if (error) throw error;
      // RPC returns jsonb array
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return (parsed || []) as LeaderboardUser[];
    },
    enabled: isOpen,
  });

  // Fetch user's rank
  const userRank = globalLeaderboard?.findIndex(u => u.id === user?.id);
  const userRankDisplay = userRank !== undefined && userRank >= 0 ? userRank + 1 : null;

  // Fetch friends leaderboard: get friend IDs then filter global data
  const { data: friendsLeaderboard, isLoading: friendsLoading } = useQuery({
    queryKey: ['leaderboard', 'friends', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get friend IDs from friendships (user has RLS access to their own friendships)
      const { data: friendships, error: friendError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (friendError) throw friendError;
      const friendIds = new Set(friendships?.map(f => f.friend_id) || []);
      friendIds.add(user.id); // Include self

      // Get all leaderboard data and filter to friends
      const { data, error } = await supabase.rpc('get_leaderboard_cached', { _limit: 50 });
      if (error) throw error;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Filter to only friends + self
      const friendsOnly = (parsed || []).filter((u: LeaderboardUser) => friendIds.has(u.id));
      
      // If current user is not in the leaderboard (no predictions yet), add them
      if (profile && !friendsOnly.find((u: LeaderboardUser) => u.id === user.id)) {
        friendsOnly.push({
          id: user.id,
          username: profile.username,
          display_name: profile.display_name || profile.name,
          avatar_url: profile.avatar_url,
          rating_score: profile.rating_score || 1000,
          predictions_total: profile.predictions_total || 0,
          predictions_correct: profile.predictions_correct || 0,
        });
      }

      return friendsOnly.sort((a: LeaderboardUser, b: LeaderboardUser) => b.rating_score - a.rating_score) as LeaderboardUser[];
    },
    enabled: !!user && viewMode === 'friends' && isOpen,
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
    const change = rating - 1000;
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const isUserInTop20 = leaderboard?.some(u => u.id === user?.id);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col" hideDescription>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Top Traders
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {user && (
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'global' ? 'default' : 'outline'}
                  onClick={() => setViewMode('global')}
                  size="sm"
                  className="flex-1"
                >
                  🌍 Global
                </Button>
                <Button
                  variant={viewMode === 'friends' ? 'default' : 'outline'}
                  onClick={() => setViewMode('friends')}
                  size="sm"
                  className="flex-1"
                >
                  <Users className="w-4 h-4 mr-1" />
                  Friends
                </Button>
              </div>
            )}

            {profile && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{profile.name?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{profile.display_name || profile.name}</p>
                        {userRankDisplay && !isUserInTop20 && (
                          <p className="text-xs text-muted-foreground">Rank #{userRankDisplay}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 px-2 py-1 bg-background rounded border">
                        {localShowOnLeaderboard ? (
                          <Eye className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-muted-foreground" />
                        )}
                        <Switch
                          checked={localShowOnLeaderboard}
                          onCheckedChange={(checked) => privacyMutation.mutate(checked)}
                          disabled={privacyMutation.isPending}
                          className="scale-75"
                        />
                      </div>
                      <span className="text-lg font-bold text-primary">🔮 {profile.rating_score || 1000}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-1">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="w-5 h-5 rounded" />
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-5 w-12" />
                    </div>
                  ))}
                </div>
              ) : leaderboard && leaderboard.length > 0 ? (
                leaderboard.map((leaderUser, index) => {
                  const rank = index + 1;
                  const isCurrentUser = leaderUser.id === user?.id;
                  
                  return (
                    <button
                      key={leaderUser.id}
                      onClick={() => setSelectedUser(leaderUser)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors hover:bg-muted/50 ${
                        isCurrentUser ? 'bg-primary/10 border border-primary/20' : ''
                      } ${rank <= 3 ? 'bg-gradient-to-r from-primary/5 to-transparent' : ''}`}
                    >
                      <div className="w-6 flex justify-center shrink-0">
                        {getRankIcon(rank)}
                      </div>
                      
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={leaderUser.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {(leaderUser.display_name || leaderUser.username || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-foreground text-sm truncate flex items-center gap-1">
                          {leaderUser.display_name || leaderUser.username || 'Anonymous'}
                          {isCurrentUser && <span className="text-xs text-primary">(You)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {leaderUser.predictions_total} preds • {getWinRate(leaderUser.predictions_correct, leaderUser.predictions_total)}%
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {getRatingChange(leaderUser.rating_score)}
                        <span className="font-bold text-primary">
                          {leaderUser.rating_score}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {viewMode === 'friends' 
                    ? "No friends on the leaderboard yet."
                    : "No users on the leaderboard yet."}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedUser && (
        <UserRatingModal
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
};

export default LeaderboardModal;