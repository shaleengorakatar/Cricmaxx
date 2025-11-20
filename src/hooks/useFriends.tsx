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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/friends-api/list`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();
      if (result.success) {
        setFriends(result.friends);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/friends-api/requests`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();
      if (result.success) {
        setInboundRequests(result.inbound);
        setOutboundRequests(result.outbound);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const fetchFriendsTrades = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/friends-api/ongoing-trades`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();
      if (result.success) {
        setFriendsTrades(result.trades);
      }
    } catch (error) {
      console.error('Error fetching friends trades:', error);
    }
  };

  const generateInviteLink = async (): Promise<InviteLink | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in');
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/friends-api/invite-link`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();
      if (result.success) {
        return {
          invite_url: result.invite_url,
          token: result.token,
          expires_at: result.expires_at
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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/friends-api/search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();
      return result.success ? result.users : [];
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  const addFriend = async (username: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in');
        return false;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/friends-api/add-by-username`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username })
        }
      );

      const result = await response.json();
      if (result.success) {
        toast.success('Friend request sent!');
        await fetchRequests();
        return true;
      } else {
        toast.error(result.error || 'Failed to send friend request');
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/friends-api/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ friendship_id: friendshipId })
        }
      );

      const result = await response.json();
      if (result.success) {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/friends-api/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ friendship_id: friendshipId })
        }
      );

      const result = await response.json();
      if (result.success) {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in');
        return false;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/friends-api/accept-invite`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token })
        }
      );

      const result = await response.json();
      if (result.success) {
        toast.success('Friend added successfully!');
        await fetchFriends();
        return true;
      } else {
        toast.error(result.error || 'Failed to accept invite');
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
