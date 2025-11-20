import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Friend } from "@/types/friends";
import { TrendingUp, BarChart3, EyeOff, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FriendsListProps {
  friends: Friend[];
  onRefresh: () => void;
}

const FriendsList = ({ friends }: FriendsListProps) => {
  const getOnlineStatus = (lastActiveAt: string) => {
    const lastActive = new Date(lastActiveAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);
    
    return diffMinutes < 15; // Online if active within last 15 minutes
  };

  if (friends.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            You don't have any friends yet. Invite someone using your link above!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {friends.map((friend) => {
        const isOnline = getOnlineStatus(friend.last_active_at);
        
        return (
          <Card key={friend.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={friend.avatar_url || undefined} />
                    <AvatarFallback>
                      {(friend.display_name || friend.username || '?')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Circle
                    className={`absolute -bottom-1 -right-1 w-3 h-3 ${
                      isOnline ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {friend.display_name || friend.username}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{friend.username}
                      </p>
                    </div>

                    {!friend.share_trades_with_friends && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        <span className="hidden sm:inline">Private</span>
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>{friend.win_rate}% win rate</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      <span>{friend.active_trades} active</span>
                    </div>
                  </div>

                  {!isOnline && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last active {formatDistanceToNow(new Date(friend.last_active_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default FriendsList;
