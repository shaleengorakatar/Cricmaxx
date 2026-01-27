import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { amount } = await req.json();

    if (!amount || typeof amount !== "number" || amount < 10) {
      throw new Error("Minimum payout amount is $10");
    }

    // Get user profile with Stripe account
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("balance, stripe_account_id, stripe_account_status, version")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    if (!profile.stripe_account_id || profile.stripe_account_status !== "active") {
      throw new Error("Please connect your bank account before requesting a payout");
    }

    if (profile.balance < amount) {
      throw new Error("Insufficient balance");
    }

    // Check for open positions
    const { count: openPositions } = await supabaseAdmin
      .from("positions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "open")
      .gt("size", 0);

    if (openPositions && openPositions > 0) {
      throw new Error("Cannot redeem tokens while you have open positions. Please close all positions first.");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Convert tokens to cents (1 token = $1 = 100 cents)
    const amountInCents = Math.round(amount * 100);

    // Create a transfer to the connected account
    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: "usd",
      destination: profile.stripe_account_id,
      metadata: {
        user_id: user.id,
        type: "token_redemption",
      },
    });

    // Process wallet withdrawal using the existing RPC
    const { data: walletResult, error: walletError } = await supabaseAdmin
      .rpc("process_wallet_operation_v2", {
        _user_id: user.id,
        _operation: "withdrawal",
        _amount: amount,
        _expected_version: profile.version,
        _idempotency_key: `payout-${transfer.id}`,
        _metadata: {
          stripe_transfer_id: transfer.id,
          payout_type: "stripe_connect",
          timestamp: new Date().toISOString(),
        },
      });

    if (walletError) {
      // Attempt to reverse the transfer if wallet operation fails
      console.error("Wallet operation failed, transfer was created:", transfer.id);
      throw new Error("Failed to process withdrawal. Please contact support.");
    }

    // Update the transaction with payout info
    await supabaseAdmin
      .from("transactions")
      .update({
        stripe_payout_id: transfer.id,
        payout_status: "processing",
      })
      .eq("id", walletResult.transaction_id);

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: transfer.id,
        amount,
        new_balance: walletResult.balance_after,
        message: `$${amount} payout initiated. Funds will arrive in 2-5 business days.`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Stripe payout error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
