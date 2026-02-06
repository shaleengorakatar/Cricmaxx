import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Parse request body for path and parameters
    const body = req.method === 'POST' ? await req.json() : {};
    const url = new URL(req.url);
    const path = body.path || url.pathname.split('/friends-api')[1] || '';
    const method = body.method || req.method;

    // Route: POST /invite-link - Generate friend invite link
    if (path === '/invite-link' && method === 'POST') {
      const token = crypto.randomUUID().split('-').join('').substring(0, 16);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const { data, error } = await supabaseClient
        .from('friend_invite_tokens')
        .insert({
          user_id: user.id,
          token,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const inviteUrl = `${url.origin}/invite/${token}`;

      return new Response(JSON.stringify({
        success: true,
        invite_url: inviteUrl,
        token,
        expires_at: expiresAt
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: POST /accept-invite - Accept invite via token
    if (path === '/accept-invite' && method === 'POST') {
      const { token } = body;

      // Use service role for cross-user operations
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get invite token details
      const { data: inviteToken, error: tokenError } = await serviceClient
        .from('friend_invite_tokens')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .is('used_at', null)
        .single();

      if (tokenError || !inviteToken) {
        return new Response(JSON.stringify({ error: 'Invalid or expired invite' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      if (inviteToken.user_id === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot add yourself as friend' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Check if friendship already exists
      const { data: existing } = await serviceClient
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${inviteToken.user_id}),and(user_id.eq.${inviteToken.user_id},friend_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: 'Friendship already exists' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Create mutual friendships
      const { error: friendship1Error } = await serviceClient
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: inviteToken.user_id,
          status: 'accepted'
        });

      if (friendship1Error) throw friendship1Error;

      const { error: friendship2Error } = await serviceClient
        .from('friendships')
        .insert({
          user_id: inviteToken.user_id,
          friend_id: user.id,
          status: 'accepted'
        });

      if (friendship2Error) {
        console.error('Error creating reverse invite friendship:', friendship2Error);
      }

      // Mark token as used
      await serviceClient
        .from('friend_invite_tokens')
        .update({ used_by: user.id, used_at: new Date().toISOString() })
        .eq('token', token);

      return new Response(JSON.stringify({
        success: true,
        message: 'Friend added successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: POST /add-by-id - Send friend request by user ID
    if (path === '/add-by-id' && method === 'POST') {
      const { user_id: targetUserId } = body;

      // Input validation
      if (!targetUserId || typeof targetUserId !== 'string') {
        return new Response(JSON.stringify({ error: 'User ID is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      if (targetUserId === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot add yourself' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Verify target user exists
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: targetUser, error: userError } = await serviceClient
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', targetUserId)
        .single();

      if (userError || !targetUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }

      // Check if friendship already exists
      const { data: existing } = await supabaseClient
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          return new Response(JSON.stringify({ error: 'Already friends', status: 'accepted' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        } else if (existing.status === 'pending') {
          return new Response(JSON.stringify({ error: 'Friend request pending', status: 'pending' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
      }

      // Create friend request
      const { error: insertError } = await supabaseClient
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: targetUserId,
          status: 'pending'
        });

      if (insertError) throw insertError;

      return new Response(JSON.stringify({
        success: true,
        message: 'Friend request sent',
        user: targetUser
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: POST /accept - Accept friend request
    if (path === '/accept' && method === 'POST') {
      const { friendship_id } = body;

      if (!friendship_id) {
        return new Response(JSON.stringify({ error: 'Friendship ID is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Use service role to avoid any RLS edge cases
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Verify the friendship exists, is pending, and the current user is the friend_id (recipient)
      const { data: pendingRequest, error: fetchError } = await serviceClient
        .from('friendships')
        .select('id, user_id, friend_id, status')
        .eq('id', friendship_id)
        .eq('friend_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!pendingRequest) {
        return new Response(JSON.stringify({ error: 'Friend request not found or already processed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }

      // Update the pending request to accepted
      const { error: updateError } = await serviceClient
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendship_id);

      if (updateError) throw updateError;

      // Check if reverse friendship already exists
      const { data: existingReverse } = await serviceClient
        .from('friendships')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', pendingRequest.user_id)
        .maybeSingle();

      if (!existingReverse) {
        // Create reverse friendship
        const { error: insertError } = await serviceClient
          .from('friendships')
          .insert({
            user_id: user.id,
            friend_id: pendingRequest.user_id,
            status: 'accepted'
          });

        if (insertError) {
          console.error('Error creating reverse friendship:', insertError);
          // Don't fail the whole request - the accept still succeeded
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Friend request accepted'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: POST /reject - Reject friend request
    if (path === '/reject' && method === 'POST') {
      const { friendship_id } = body;

      if (!friendship_id) {
        return new Response(JSON.stringify({ error: 'Friendship ID is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Use service role to ensure deletion works
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Verify the request belongs to this user and is pending
      const { data: pendingRequest } = await serviceClient
        .from('friendships')
        .select('id')
        .eq('id', friendship_id)
        .eq('friend_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (!pendingRequest) {
        return new Response(JSON.stringify({ error: 'Friend request not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }

      const { error: deleteError } = await serviceClient
        .from('friendships')
        .delete()
        .eq('id', friendship_id);

      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({
        success: true,
        message: 'Friend request rejected'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: /list - List all accepted friends
    if (path === '/list') {
      const { data: friendships, error: friendError } = await supabaseClient
        .from('friendships')
        .select(`
          id,
          friend_id,
          profiles!friendships_friend_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            last_active_at,
            share_trades_with_friends
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (friendError) throw friendError;

      // Get stats for each friend
      const friendsWithStats = await Promise.all(
        (friendships || []).map(async (f: any) => {
          const friendId = f.friend_id;
          
          // Get open positions count
          const { count: openPositions } = await supabaseClient
            .from('positions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', friendId)
            .eq('status', 'open');

          // Calculate win rate from closed positions
          const { data: closedPositions } = await supabaseClient
            .from('positions')
            .select('pnl')
            .eq('user_id', friendId)
            .eq('status', 'closed');

          const winCount = closedPositions?.filter(p => p.pnl > 0).length || 0;
          const totalClosed = closedPositions?.length || 0;
          const winRate = totalClosed > 0 ? Math.round((winCount / totalClosed) * 100) : 0;

          return {
            ...f.profiles,
            active_trades: openPositions || 0,
            win_rate: winRate,
            friendship_id: f.id
          };
        })
      );

      return new Response(JSON.stringify({
        success: true,
        friends: friendsWithStats
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: /requests - Get pending friend requests
    if (path === '/requests') {
      // Inbound requests (people who want to be friends with me)
      const { data: inbound, error: inboundError } = await supabaseClient
        .from('friendships')
        .select(`
          id,
          user_id,
          created_at,
          profiles!friendships_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      // Outbound requests (people I want to be friends with)
      const { data: outbound, error: outboundError } = await supabaseClient
        .from('friendships')
        .select(`
          id,
          friend_id,
          created_at,
          profiles!friendships_friend_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (inboundError || outboundError) throw inboundError || outboundError;

      return new Response(JSON.stringify({
        success: true,
        inbound: inbound || [],
        outbound: outbound || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: /ongoing-trades - Get friends' ongoing trades
    if (path === '/ongoing-trades') {
      // Get all accepted friends
      const { data: friendships } = await supabaseClient
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      const friendIds = friendships?.map(f => f.friend_id) || [];

      if (friendIds.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          trades: []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get open positions for friends who share trades
      const { data: positions, error: posError } = await supabaseClient
        .from('positions')
        .select(`
          id,
          side,
          size,
          entry_price,
          opened_at,
          user_id,
          market_id,
          profiles!positions_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            share_trades_with_friends
          ),
          markets (
            id,
            question,
            category,
            yes_price,
            no_price,
            volume,
            expiry_time,
            status
          )
        `)
        .in('user_id', friendIds)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(50);

      if (posError) throw posError;

      // Filter by share_trades_with_friends
      const filteredTrades = (positions || []).filter((p: any) => p.profiles?.share_trades_with_friends === true);

      return new Response(JSON.stringify({
        success: true,
        trades: filteredTrades
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: /search - Search users by username or email
    if (path === '/search') {
      const query = body.query || url.searchParams.get('query') || '';

      if (query.length < 2) {
        return new Response(JSON.stringify({
          success: true,
          users: []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Search by username or email - use service role to bypass RLS for search
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data: users, error: searchError } = await serviceClient
        .from('profiles')
        .select('id, username, display_name, avatar_url, email')
        .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
        .neq('id', user.id)
        .limit(10);

      if (searchError) throw searchError;

      // Check friendship status for each user
      const usersWithStatus = await Promise.all(
        (users || []).map(async (u: any) => {
          const { data: friendship } = await supabaseClient
            .from('friendships')
            .select('status')
            .or(`and(user_id.eq.${user.id},friend_id.eq.${u.id}),and(user_id.eq.${u.id},friend_id.eq.${user.id})`)
            .maybeSingle();

          return {
            ...u,
            friendship_status: friendship?.status || 'none'
          };
        })
      );

      return new Response(JSON.stringify({
        success: true,
        users: usersWithStatus
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });

  } catch (error) {
    console.error('Error in friends-api:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
