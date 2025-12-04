import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header to verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { marketId, outcome } = await req.json();

    if (!marketId || !outcome || !['yes', 'no', 'void'].includes(outcome)) {
      return new Response(JSON.stringify({ error: 'Invalid market ID or outcome' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Resolving market ${marketId} with outcome: ${outcome}`);

    // Get market details
    const { data: market, error: marketError } = await supabase
      .from('markets')
      .select('*')
      .eq('id', marketId)
      .single();

    if (marketError || !market) {
      console.error('Market not found:', marketError);
      return new Response(JSON.stringify({ error: 'Market not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all open positions for this market
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('*')
      .eq('market_id', marketId)
      .eq('status', 'open');

    if (positionsError) {
      console.error('Error fetching positions:', positionsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch positions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${positions?.length || 0} open positions`);

    let totalPayouts = 0;
    const payoutResults: any[] = [];

    // Process each position
    for (const position of positions || []) {
      let payout = 0;
      let pnl = 0;
      const cost = position.size * position.entry_price;

      if (outcome === 'void') {
        // Refund the original cost
        payout = cost;
        pnl = 0;
      } else if (position.side === outcome) {
        // Winner: gets $1 per share
        payout = position.size;
        pnl = payout - cost;
      } else {
        // Loser: gets nothing
        payout = 0;
        pnl = -cost;
      }

      totalPayouts += payout;

      // Get user's current balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', position.user_id)
        .single();

      const currentBalance = profile?.balance || 0;
      const newBalance = currentBalance + payout;

      // Update user balance
      if (payout > 0) {
        const { error: balanceError } = await supabase
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', position.user_id);

        if (balanceError) {
          console.error(`Failed to update balance for user ${position.user_id}:`, balanceError);
        }

        // Create payout transaction record
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: position.user_id,
            type: outcome === 'void' ? 'refund' : 'payout',
            amount: payout,
            balance_before: currentBalance,
            balance_after: newBalance,
            status: 'completed',
            metadata: {
              market_id: marketId,
              position_id: position.id,
              outcome: outcome,
              side: position.side,
              shares: position.size,
              pnl: pnl
            }
          });

        if (txError) {
          console.error(`Failed to create transaction for user ${position.user_id}:`, txError);
        }
      }

      // Close the position with PnL
      const { error: closeError } = await supabase
        .from('positions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          pnl: pnl
        })
        .eq('id', position.id);

      if (closeError) {
        console.error(`Failed to close position ${position.id}:`, closeError);
      }

      payoutResults.push({
        positionId: position.id,
        userId: position.user_id,
        side: position.side,
        shares: position.size,
        payout,
        pnl
      });
    }

    // Update market status to resolved
    const newLiquidityPool = (market.liquidity_pool || 0) - totalPayouts;
    
    const { error: updateError } = await supabase
      .from('markets')
      .update({
        status: 'resolved',
        outcome: outcome,
        resolution_time: new Date().toISOString(),
        liquidity_pool: Math.max(0, newLiquidityPool)
      })
      .eq('id', marketId);

    if (updateError) {
      console.error('Failed to update market:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update market status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Market ${marketId} resolved. Total payouts: $${totalPayouts}`);

    return new Response(JSON.stringify({
      success: true,
      marketId,
      outcome,
      positionsProcessed: positions?.length || 0,
      totalPayouts,
      payoutResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Market resolution error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
