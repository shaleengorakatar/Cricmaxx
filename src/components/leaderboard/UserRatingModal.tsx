import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Target, Award, History } from "lucide-react";

interface LeaderboardUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rating_score: number;
  predictions_total: number;
  predictions_correct: number;
}

interface UserRatingModalProps {
  user: LeaderboardUser;
  isOpen: boolean;
  onClose: () => void;
}

const UserRatingModal = ({ user, isOpen, onClose }: UserRatingModalProps) => {
  const winRate = user.predictions_total > 0 
    ? Math.round((user.predictions_correct / user.predictions_total) * 100) 
    : 0;
  const losses = user.predictions_total - user.predictions_correct;

  // Fetch recent positions for this user
  const { data: recentMarkets, isLoading } = useQuery({
    queryKey: ['userRecentMarkets', user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('positions')
        .select(`
          id,
          side,
          status,
          pnl,
          opened_at,
          market_id,
          markets (
            id,
            question,
            status,
            outcome
          )
        `)
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" hideDescription>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback>
                {(user.display_name || user.username || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-bold">{user.display_name || user.username || 'Anonymous'}</p>
              {user.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rating Score */}
          <div className="text-center py-4 bg-primary/10 rounded-lg">
            <p className="text-4xl font-bold text-primary">🔮 {user.rating_score}</p>
            <p className="text-sm text-muted-foreground mt-1">Prediction Rating</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <Target className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">{user.predictions_total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <TrendingUp className="w-5 h-5 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500">{user.predictions_correct}</p>
                <p className="text-xs text-muted-foreground">Wins</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <TrendingDown className="w-5 h-5 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-500">{losses}</p>
                <p className="text-xs text-muted-foreground">Losses</p>
              </CardContent>
            </Card>
          </div>

          {/* Win Rate */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  <span className="font-medium">Win Rate</span>
                </div>
                <span className="text-xl font-bold text-primary">{winRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${winRate}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recent Markets */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-medium">Recent Markets</h3>
            </div>
            
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentMarkets && recentMarkets.length > 0 ? (
              <div className="space-y-2">
                {recentMarkets.map((position) => {
                  const market = position.markets as any;
                  const isWin = market?.outcome && position.side === market.outcome;
                  const isLoss = market?.outcome && position.side !== market.outcome;
                  
                  return (
                    <div 
                      key={position.id}
                      className={`p-3 rounded-lg border ${
                        isWin ? 'bg-green-500/10 border-green-500/20' :
                        isLoss ? 'bg-red-500/10 border-red-500/20' :
                        'bg-muted/50 border-border'
                      }`}
                    >
                      <p className="text-sm font-medium line-clamp-1">
                        {market?.question || 'Unknown Market'}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          position.side === 'yes' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'
                        }`}>
                          {position.side.toUpperCase()}
                        </span>
                        {market?.status === 'resolved' && (
                          <span className={`text-xs font-medium ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                            {isWin ? '✓ Won' : '✗ Lost'}
                          </span>
                        )}
                        {market?.status !== 'resolved' && (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent market activity
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserRatingModal;