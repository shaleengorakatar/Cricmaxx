import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

interface FriendTrade {
  id: string;
  friendName: string;
  friendAvatar: string | null;
  marketQuestion: string;
  marketId: string;
  side: 'yes' | 'no';
  timestamp: string;
}

export function FriendActivityWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trades, setTrades] = useState<FriendTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFriendActivity();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchFriendActivity = async () => {
    if (!user) return;

    // Get accepted friends
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id, user_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (!friendships || friendships.length === 0) {
      setLoading(false);
      return;
    }

    const friendIds = friendships.map((f) =>
      f.user_id === user.id ? f.friend_id : f.user_id
    );

    // Get recent positions from friends who share trades
    const { data: positions } = await supabase
      .from('positions')
      .select(`
        id,
        side,
        created_at,
        market_id,
        user_id,
        markets!inner(question)
      `)
      .in('user_id', friendIds)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!positions) {
      setLoading(false);
      return;
    }

    // Get friend profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, name, avatar_url, share_trades_with_friends')
      .in('id', friendIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    const friendTrades: FriendTrade[] = positions
      .filter((pos) => {
        const profile = profileMap.get(pos.user_id);
        return profile?.share_trades_with_friends !== false;
      })
      .map((pos) => {
        const profile = profileMap.get(pos.user_id);
        const market = pos.markets as { question: string };
        return {
          id: pos.id,
          friendName: profile?.display_name || profile?.name || 'Friend',
          friendAvatar: profile?.avatar_url,
          marketQuestion: market?.question || 'Unknown market',
          marketId: pos.market_id,
          side: pos.side as 'yes' | 'no',
          timestamp: pos.created_at,
        };
      });

    setTrades(friendTrades);
    setLoading(false);
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Users className="h-5 w-5 text-accent" />
          <h3 className="font-bold text-foreground">Friend Activity</h3>
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Users className="h-5 w-5 text-accent" />
          <h3 className="font-bold text-foreground">Friend Activity</h3>
        </div>
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No friend activity yet. Add friends to see their predictions!
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Users className="h-5 w-5 text-accent" />
        <h3 className="font-bold text-foreground">Friend Activity</h3>
      </div>

      {trades.map((trade) => (
        <Card
          key={trade.id}
          onClick={() => navigate(`/market/${trade.marketId}`)}
          className="p-3 cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.98]"
        >
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                {trade.friendName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-foreground">{trade.friendName}</span>
                <Badge
                  variant={trade.side === 'yes' ? 'default' : 'destructive'}
                  className="text-xs py-0"
                >
                  {trade.side === 'yes' ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {trade.side.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{trade.marketQuestion}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true })}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
