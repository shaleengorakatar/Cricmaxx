import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResolutionRequest {
  marketId: string;
  outcome: 'yes' | 'no' | 'void';
  source: 'oracle' | 'admin_manual' | 'system_fallback';
  notes?: string;
  apiResponse?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { marketId, outcome, source, notes, apiResponse }: ResolutionRequest = await req.json();

    if (!marketId || !outcome || !source) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log resolution attempt
    await supabase.from("market_resolution_log").insert({
      market_id: marketId,
      action: "attempted",
      performed_by: user.id,
      source,
      outcome,
      notes,
      api_response: apiResponse,
    });

    // Get market and positions
    const { data: market, error: marketError } = await supabase
      .from("markets")
      .select("*")
      .eq("id", marketId)
      .single();

    if (marketError || !market) {
      await supabase.from("market_resolution_log").insert({
        market_id: marketId,
        action: "failed",
        performed_by: user.id,
        source,
        error_message: "Market not found",
      });
      return new Response(
        JSON.stringify({ error: "Market not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all positions for this market
    const { data: positions, error: positionsError } = await supabase
      .from("positions")
      .select("*")
      .eq("market_id", marketId)
      .eq("status", "open");

    if (positionsError) {
      await supabase.from("market_resolution_log").insert({
        market_id: marketId,
        action: "failed",
        performed_by: user.id,
        source,
        error_message: `Failed to fetch positions: ${positionsError.message}`,
      });
      throw positionsError;
    }

    // Process payouts and update ratings
    const notifications: any[] = [];
    
    for (const position of positions || []) {
      let payout = 0;
      let pnl = 0;
      const cost = position.size * position.entry_price;
      let isCorrect = false;

      if (outcome === 'void') {
        // Full refund
        payout = cost;
        pnl = 0;
      } else if (position.side === outcome) {
        // Winner gets $1 per share
        payout = position.size;
        pnl = payout - cost;
        isCorrect = true;
      } else {
        // Loser gets nothing
        payout = 0;
        pnl = -cost;
        isCorrect = false;
      }

      // Get user's current profile for balance and rating
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance, rating_score, predictions_total, predictions_correct")
        .eq("id", position.user_id)
        .single();

      const currentBalance = profile?.balance || 0;
      const newBalance = currentBalance + payout;

      // Calculate rating change (skip for void outcomes)
      let newRating = profile?.rating_score || 1000;
      let newTotal = profile?.predictions_total || 0;
      let newCorrect = profile?.predictions_correct || 0;

      if (outcome !== 'void') {
        newTotal += 1;
        if (isCorrect) {
          newRating += 100; // +100 for correct prediction
          newCorrect += 1;
        } else {
          newRating -= 50; // -50 for incorrect prediction
        }
        newRating = Math.max(0, newRating);
      }

      // Update user balance AND rating in one call
      const updateData: Record<string, unknown> = {
        predictions_total: newTotal,
        predictions_correct: newCorrect,
        rating_score: newRating,
      };
      if (payout > 0) {
        updateData.balance = newBalance;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", position.user_id);

      if (profileError) {
        console.error(`Failed to update profile for user ${position.user_id}:`, profileError);
      } else {
        console.log(`Updated user ${position.user_id}: rating ${newRating}, predictions ${newTotal}, correct ${newCorrect}`);
      }

      // Close position
      await supabase
        .from("positions")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          pnl,
        })
        .eq("id", position.id);

      // Create transaction record
      if (payout > 0) {
        await supabase.from("transactions").insert({
          user_id: position.user_id,
          type: outcome === 'void' ? 'refund' : 'payout',
          amount: payout,
          balance_before: currentBalance,
          balance_after: newBalance,
          status: 'completed',
          metadata: {
            market_id: marketId,
            position_id: position.id,
            outcome,
            side: position.side,
            shares: position.size,
            pnl,
            rating_change: outcome === 'void' ? 0 : (isCorrect ? 100 : -50),
            new_rating: newRating,
          },
        });
      }

      // Create notification
      const ratingChangeText = outcome === 'void' ? '' : isCorrect ? ' Rating +100 🔮' : ' Rating -50';
      notifications.push({
        user_id: position.user_id,
        market_id: marketId,
        notification_type: outcome === 'void' ? 'void' : 'payout',
        title: outcome === 'void' 
          ? 'Market Voided' 
          : position.side === outcome 
            ? '🎉 You Won!' 
            : 'Market Resolved',
        message: outcome === 'void'
          ? `Your position has been refunded: $${payout.toFixed(2)}`
          : position.side === outcome
            ? `You won $${payout.toFixed(2)} on your ${position.side.toUpperCase()} prediction!${ratingChangeText}`
            : `Market resolved ${outcome.toUpperCase()}. Your ${position.side.toUpperCase()} position expired.${ratingChangeText}`,
        outcome,
        payout_amount: payout,
      });
    }

    // Insert notifications
    if (notifications.length > 0) {
      await supabase.from("resolution_notifications").insert(notifications);
    }

    // Cancel all pending/partial limit orders for this market and refund users
    const { data: cancelledOrders, error: cancelOrdersError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("market_id", marketId)
      .in("status", ["pending", "partial"])
      .select("id, user_id, price, quantity, filled_quantity, side");

    if (cancelOrdersError) {
      console.error("Error cancelling orders:", cancelOrdersError);
    } else {
      console.log(`Cancelled ${cancelledOrders?.length || 0} pending orders`);

      // Refund reserved balance for unfilled portions of cancelled orders
      for (const order of cancelledOrders || []) {
        const unfilledQuantity = order.quantity - order.filled_quantity;
        if (unfilledQuantity > 0 && order.price) {
          const refundAmount = unfilledQuantity * order.price;

          // Refund the user's balance
          const { error: refundError } = await supabase.rpc(
            "process_wallet_operation_pooled",
            {
              _user_id: order.user_id,
              _operation: "deposit",
              _amount: refundAmount,
              _metadata: {
                type: "order_cancellation_refund",
                order_id: order.id,
                market_id: marketId,
                reason: "market_resolved",
              },
            }
          );

          if (refundError) {
            console.error(`Failed to refund user ${order.user_id}:`, refundError);
          }
        }
      }
    }

    // Update market status
    await supabase
      .from("markets")
      .update({
        status: "resolved",
        outcome,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_source: source,
        resolution_notes: notes,
      })
      .eq("id", marketId);

    // Refresh materialized views for leaderboard and market stats
    try {
      await supabase.rpc('refresh_leaderboard');
      await supabase.rpc('refresh_market_stats');
      console.log('Refreshed materialized views');
    } catch (mvError) {
      console.error('Failed to refresh materialized views:', mvError);
    }

    // Log success
    await supabase.from("market_resolution_log").insert({
      market_id: marketId,
      action: "succeeded",
      performed_by: user.id,
      source,
      outcome,
      notes,
      api_response: apiResponse,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Market resolved as ${outcome.toUpperCase()}`,
        positionsProcessed: positions?.length || 0,
        notificationsSent: notifications.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error resolving market:", error);
    const message = error instanceof Error ? error.message : "Resolution failed";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
