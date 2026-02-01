import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Friend, FriendRequest, FriendTrade, SearchUser, InviteLink } from '@/types/friends';
import { toast } from 'sonner';

export const useFriends = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inboundRequests, setInboundRequests] = useState<FriendRequest[]>([]);
  const [outboundRequests, setOutboundRequests] = useState<FriendRequest[]>([]);
  const [friendsTrades, setFriendsTrades] = useState<FriendTrade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('friends-api', {
        body: { path: '/list' }
      });

      if (error) throw error;
      if (data?.success) {
        setFriends(data.friends);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('friends-api', {
        body: { path: '/requests' }
      });

      if (error) throw error;
      if (data?.success) {
        setInboundRequests(data.inbound);
        setOutboundRequests(data.outbound);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const fetchFriendsTrades = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('friends-api', {
        body: { path: '/ongoing-trades' }
      });

      if (error) throw error;
      if (data?.success) {
        setFriendsTrades(data.trades);
      }
    } catch (error) {
      console.error('Error fetching friends trades:', error);
    }
  };

  const generateInviteLink = async (): Promise<InviteLink | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('friends-api', {
        body: { path: '/invite-link', method: 'POST' }
      });

      if (error) throw error;
      if (data?.success) {
        return {
          invite_url: data.invite_url,
          token: data.token,
          expires_at: data.expires_at
        };
      }
      return null;
    } catch (error) {
      console.error('Error generating invite link:', error);
      toast.error('Failed to generate invite link');
      return null;
    }
  };

  const searchUsers = async (query: string): Promise<SearchUser[]> => {
    try {
      if (query.length < 2) return [];

      const { data, error } = await supabase.functions.invoke('friends-api', {
        body: { path: '/search', query }
      });

      if (error) throw error;
      return data?.success ? data.users : [];
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  const addFriend = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('friends-api', {
        body: { path: '/add-by-id', method: 'POST', user_id: userId }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success('Friend request sent!');
        await fetchRequests();
        return true;
      } else {
        toast.error(data?.error || 'Failed to send friend request');
        return false;
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      toast.error('Failed to send friend request');
      return false;
    }
  };

  const acceptFriend = async (friendshipId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('friends-api', {
        body: { path: '/accept', method: 'POST', friendship_id: friendshipId }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success('Friend request accepted!');
        await Promise.all([fetchFriends(), fetchRequests()]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error accepting friend:', error);
      toast.error('Failed to accept friend request');
      return false;
    }
  };

  const rejectFriend = async (friendshipId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('friends-api', {
        body: { path: '/reject', method: 'POST', friendship_id: friendshipId }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success('Friend request rejected');
        await fetchRequests();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error rejecting friend:', error);
      toast.error('Failed to reject friend request');
      return false;
    }
  };

  const acceptInvite = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('friends-api', {
        body: { path: '/accept-invite', method: 'POST', token }
      });

      if (error) throw error;
      if (data?.success) {
        toast.success('Friend added successfully!');
        await fetchFriends();
        return true;
      } else {
        toast.error(data?.error || 'Failed to accept invite');
        return false;
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast.error('Failed to accept invite');
      return false;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchFriends(),
        fetchRequests(),
        fetchFriendsTrades()
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    friends,
    inboundRequests,
    outboundRequests,
    friendsTrades,
    loading,
    fetchFriends,
    fetchRequests,
    fetchFriendsTrades,
    generateInviteLink,
    searchUsers,
    addFriend,
    acceptFriend,
    rejectFriend,
    acceptInvite
  };
};
