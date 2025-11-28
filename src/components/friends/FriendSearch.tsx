import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2, UserPlus, Check, Clock } from "lucide-react";
import { useFriends } from "@/hooks/useFriends";
import { SearchUser } from "@/types/friends";

interface FriendSearchProps {
  onFriendAdded: () => void;
}

const FriendSearch = ({ onFriendAdded }: FriendSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const { searchUsers, addFriend } = useFriends();
  const [addingUser, setAddingUser] = useState<string | null>(null);

  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setSearching(true);
        const results = await searchUsers(searchQuery.trim());
        setSearchResults(results);
        setSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const handleAddFriend = async (username: string) => {
    setAddingUser(username);
    const success = await addFriend(username);
    setAddingUser(null);
    
    if (success) {
      onFriendAdded();
      // Update search results to reflect new status
      const updated = await searchUsers(searchQuery.trim());
      setSearchResults(updated);
    }
  };

  const getButtonContent = (user: SearchUser) => {
    if (addingUser === user.username) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }

    switch (user.friendship_status) {
      case 'accepted':
        return (
          <>
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Friends</span>
          </>
        );
      case 'pending':
        return (
          <>
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Pending</span>
          </>
        );
      default:
        return (
          <>
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Add</span>
          </>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="w-5 h-5" />
          Search Friends
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          {searching && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-2" />}
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>
                      {(user.display_name || user.username || '?')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {user.display_name || user.username}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAddFriend(user.username)}
                  disabled={
                    user.friendship_status !== 'none' || 
                    addingUser === user.username
                  }
                  className={
                    user.friendship_status === 'accepted'
                      ? 'bg-green-600 hover:bg-green-700'
                      : user.friendship_status === 'pending'
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-accent hover:bg-accent/90'
                  }
                >
                  {getButtonContent(user)}
                </Button>
              </div>
            ))}
          </div>
        )}

        {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No users found matching "{searchQuery}"
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default FriendSearch;
