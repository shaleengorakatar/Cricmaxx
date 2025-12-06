import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

  // Sync local state with profile when it changes
  useEffect(() => {
    if (profile) {
      setLocalShowOnLeaderboard(profile.show_on_leaderboard ?? true);
    }
  }, [profile?.show_on_leaderboard]);

  // Privacy toggle mutation
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
      // Optimistically update local state
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
      // Revert on error
      setLocalShowOnLeaderboard(!showOnLeaderboard);
      toast({
        title: "Update failed",
        description: "Failed to update visibility. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch global leaderboard from secure view (no email exposure)
  const { data: globalLeaderboard, isLoading: globalLoading } = useQuery({
    queryKey: ['leaderboard', 'global'],
    queryFn: async () => {
      // Use the secure leaderboard_profiles view that only exposes non-sensitive data
      const { data, error } = await supabase
        .from('leaderboard_profiles' as any)
        .select('id, username, display_name, avatar_url, rating_score, predictions_total, predictions_correct')
        .order('rating_score', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as unknown as LeaderboardUser[];
    },
    enabled: isOpen,
  });

  // Fetch user's rank if not in top 20
  const { data: userRank } = useQuery({
    queryKey: ['leaderboard', 'userRank', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      // Use the secure leaderboard_profiles view
      const { data, error } = await supabase
        .from('leaderboard_profiles' as any)
        .select('id, rating_score')
        .order('rating_score', { ascending: false });

      if (error) throw error;
      
      const profiles = data as unknown as { id: string; rating_score: number }[];
      const rank = profiles.findIndex(p => p.id === user.id) + 1;
      return rank > 0 ? rank : null;
    },
    enabled: !!user && isOpen,
  });

  // Fetch friends leaderboard using secure friend_profiles view
  const { data: friendsLeaderboard, isLoading: friendsLoading } = useQuery({
    queryKey: ['leaderboard', 'friends', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Use the secure friend_profiles view that only exposes non-sensitive data
      const { data: friendProfiles, error: friendError } = await supabase
        .from('friend_profiles' as any)
        .select('id, username, display_name, avatar_url, rating_score, predictions_total, predictions_correct, share_trades_with_friends')
        .order('rating_score', { ascending: false });

      if (friendError) throw friendError;

      // Also include current user's profile (they can see their own full data)
      const { data: ownProfile } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, rating_score, predictions_total, predictions_correct, show_on_leaderboard')
        .eq('id', user.id)
        .single();

      // Combine and deduplicate - cast to any to avoid type issues with view
      const allProfiles: any[] = [...((friendProfiles as any[]) || [])];
      if (ownProfile && !allProfiles.find((p: any) => p.id === ownProfile.id)) {
        allProfiles.push(ownProfile);
      }

      // Sort by rating and limit
      return allProfiles
        .sort((a, b) => b.rating_score - a.rating_score)
        .slice(0, 20) as LeaderboardUser[];
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
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Top Traders
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* View Mode Toggle */}
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

            {/* User's current rating with privacy toggle */}
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
                        {userRank && !isUserInTop20 && (
                          <p className="text-xs text-muted-foreground">Rank #{userRank}</p>
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

            {/* Leaderboard */}
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

      {/* User Rating Modal */}
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