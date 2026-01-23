import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell, CheckCircle2, XCircle, AlertTriangle, Check, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ResolutionNotification {
  id: string;
  market_id: string;
  notification_type: string;
  title: string;
  message: string;
  outcome: string | null;
  payout_amount: number | null;
  read: boolean;
  created_at: string;
  markets?: {
    question: string;
  };
}

export function NotificationsBell() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['resolution-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('resolution_notifications')
        .select('*, markets(question)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as ResolutionNotification[];
    },
    enabled: isAuthenticated && !!user?.id,
    refetchInterval: 30000,
  });

  // Subscribe to new notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'resolution_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['resolution-notifications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('resolution_notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resolution-notifications', user?.id] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('resolution_notifications')
        .update({ read: true })
        .eq('user_id', user?.id)
        .eq('read', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resolution-notifications', user?.id] });
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getOutcomeIcon = (outcome: string | null, type: string) => {
    if (type === 'void') return <AlertTriangle className="h-4 w-4 text-warning" />;
    if (outcome === 'yes') return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (outcome === 'no') return <XCircle className="h-4 w-4 text-destructive" />;
    return <Bell className="h-4 w-4 text-muted-foreground" />;
  };

  if (!isAuthenticated) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllReadMutation.mutate()}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-3 hover:bg-muted/50 cursor-pointer transition-colors',
                    !notification.read && 'bg-primary/5'
                  )}
                  onClick={() => {
                    if (!notification.read) {
                      markReadMutation.mutate(notification.id);
                    }
                    navigate(`/market/${notification.market_id}`);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex gap-3">
                    {getOutcomeIcon(notification.outcome, notification.notification_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.markets?.question && (
                        <p className="text-xs text-primary/80 truncate mt-1 flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {notification.markets.question}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
