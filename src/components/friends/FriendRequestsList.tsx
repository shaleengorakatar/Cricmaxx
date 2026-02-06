import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FriendRequest } from "@/types/friends";
import { Check, X, Clock } from "lucide-react";
import { formatDistanceToNow, isValid } from "date-fns";

interface FriendRequestsListProps {
  inboundRequests: FriendRequest[];
  outboundRequests: FriendRequest[];
  onAccept: (friendshipId: string) => Promise<boolean>;
  onReject: (friendshipId: string) => Promise<boolean>;
}

const FriendRequestsList = ({
  inboundRequests,
  outboundRequests,
  onAccept,
  onReject
}: FriendRequestsListProps) => {
  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'recently';
    const d = new Date(dateStr);
    return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : 'recently';
  };

  if (inboundRequests.length === 0 && outboundRequests.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            No pending friend requests
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Inbound Requests */}
      {inboundRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Received ({inboundRequests.length})
          </h3>
          {inboundRequests.map((request) => (
            <Card key={request.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.profiles.avatar_url || undefined} />
                    <AvatarFallback>
                      {(request.profiles.display_name || request.profiles.username || '?')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {request.profiles.display_name || request.profiles.username}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{request.profiles.username}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {safeFormatDate(request.created_at)}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => onAccept(request.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReject(request.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Outbound Requests */}
      {outboundRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Sent ({outboundRequests.length})
          </h3>
          {outboundRequests.map((request) => (
            <Card key={request.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.profiles.avatar_url || undefined} />
                    <AvatarFallback>
                      {(request.profiles.display_name || request.profiles.username || '?')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {request.profiles.display_name || request.profiles.username}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{request.profiles.username}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {safeFormatDate(request.created_at)}
                    </p>
                  </div>

                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FriendRequestsList;
