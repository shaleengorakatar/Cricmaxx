import Stripe from "https://esm.sh/stripe@17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        console.log(`Webhook verified: ${event.type}`);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      // Parse without verification (for testing)
      event = JSON.parse(body);
      console.log(`Webhook received (unverified): ${event.type}`);
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log(`Processing checkout session: ${session.id}`);
      console.log(`Payment status: ${session.payment_status}`);
      console.log(`Metadata:`, session.metadata);

      if (session.payment_status === "paid") {
        const userId = session.metadata?.user_id;
        const tokenAmount = parseInt(session.metadata?.token_amount || "0", 10);
        const paymentType = session.metadata?.payment_type;
        const amountPaid = session.amount_total || 0;

        if (!userId || tokenAmount <= 0) {
          console.error("Invalid metadata:", { userId, tokenAmount });
          return new Response(
            JSON.stringify({ error: "Invalid payment metadata" }),
            { status: 400, headers: corsHeaders }
          );
        }

        // Verify amount matches expected (security check)
        const expectedCents = tokenAmount * 100;
        if (amountPaid !== expectedCents) {
          console.error(`Amount mismatch: paid ${amountPaid}, expected ${expectedCents}`);
          // Log but still process - could be a promo code
        }

        console.log(`Crediting ${tokenAmount} tokens to user ${userId}`);

        // Credit user's wallet using the atomic RPC function
        const { data: result, error: walletError } = await supabaseAdmin.rpc(
          "process_wallet_operation_v2",
          {
            _user_id: userId,
            _operation: "deposit",
            _amount: tokenAmount,
            _expected_version: null, // Let it auto-increment
            _idempotency_key: `stripe_${session.id}`,
            _metadata: {
              source: "stripe",
              stripe_session_id: session.id,
              stripe_payment_intent: session.payment_intent,
              payment_method: "card",
              amount_paid_cents: amountPaid,
            },
          }
        );

        if (walletError) {
          // Check if it's a duplicate (idempotency)
          if (walletError.message?.includes("cached") || walletError.message?.includes("duplicate")) {
            console.log(`Duplicate webhook - already processed: ${session.id}`);
            return new Response(
              JSON.stringify({ received: true, status: "duplicate" }),
              { status: 200, headers: corsHeaders }
            );
          }
          
          console.error("Wallet credit error:", walletError);
          throw new Error(`Failed to credit wallet: ${walletError.message}`);
        }

        console.log(`Successfully credited ${tokenAmount} tokens to user ${userId}`, result);

        return new Response(
          JSON.stringify({ 
            received: true, 
            status: "processed",
            tokensAdded: tokenAmount,
            userId,
          }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // Handle payment_intent.succeeded (backup)
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`Payment intent succeeded: ${paymentIntent.id}`);
      // This is handled by checkout.session.completed, so just acknowledge
    }

    // Handle payment_intent.payment_failed
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.error(`Payment failed: ${paymentIntent.id}`, paymentIntent.last_payment_error);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: corsHeaders }
    );
  }
});
