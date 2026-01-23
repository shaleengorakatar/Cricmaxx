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

    // Process payouts
    const notifications: any[] = [];
    
    for (const position of positions || []) {
      let payout = 0;
      let pnl = 0;

      if (outcome === 'void') {
        // Full refund
        payout = position.size * position.entry_price;
        pnl = 0;
      } else if (position.side === outcome) {
        // Winner gets $1 per share
        payout = position.size;
        pnl = payout - (position.size * position.entry_price);
      } else {
        // Loser gets nothing
        payout = 0;
        pnl = -(position.size * position.entry_price);
      }

      // Update user balance
      if (payout > 0) {
        await supabase.rpc("increment_balance", {
          user_id: position.user_id,
          amount: payout,
        });
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", position.user_id)
        .single();

      await supabase.from("transactions").insert({
        user_id: position.user_id,
        type: outcome === 'void' ? 'refund' : 'payout',
        amount: payout,
        balance_before: (profile?.balance || 0) - payout,
        balance_after: profile?.balance || 0,
        metadata: {
          market_id: marketId,
          position_id: position.id,
          outcome,
          side: position.side,
          shares: position.size,
        },
      });

      // Create notification
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
            ? `You won $${payout.toFixed(2)} on your ${position.side.toUpperCase()} prediction!`
            : `Market resolved ${outcome.toUpperCase()}. Your ${position.side.toUpperCase()} position expired.`,
        outcome,
        payout_amount: payout,
      });
    }

    // Insert notifications
    if (notifications.length > 0) {
      await supabase.from("resolution_notifications").insert(notifications);
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
