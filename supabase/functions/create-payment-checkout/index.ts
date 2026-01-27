import Stripe from "https://esm.sh/stripe@17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  amount: number; // Token amount (1 token = 1 USD)
  paymentMethod?: 'stripe' | 'paypal';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    // Authenticate user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      throw new Error("User not authenticated or email not available");
    }

    const user = userData.user;
    console.log(`Creating checkout for user: ${user.id}, email: ${user.email}`);

    const { amount, paymentMethod = 'stripe' }: CheckoutRequest = await req.json();

    // Validate amount
    if (!amount || amount < 10 || amount > 10000) {
      throw new Error("Amount must be between 10 and 10,000 tokens");
    }

    // Calculate cents (1 token = 1 USD)
    const amountInCents = Math.round(amount * 100);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log(`Found existing Stripe customer: ${customerId}`);
    }

    const origin = req.headers.get("origin") || "https://shariz-predict.lovable.app";

    // Build payment method types based on preference
    // Stripe Checkout automatically shows Apple Pay/Google Pay when available
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = ['card'];
    
    // Create checkout session with dynamic pricing
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${amount} CricMaxx Tokens`,
              description: `Add ${amount} tokens to your wallet (1 token = $1 USD)`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_method_types: paymentMethodTypes,
      // Enable automatic payment methods for Apple Pay, Google Pay, etc.
      // payment_method_options: {
      //   card: {
      //     setup_future_usage: 'on_session',
      //   },
      // },
      success_url: `${origin}/wallet?payment=success&session_id={CHECKOUT_SESSION_ID}&amount=${amount}`,
      cancel_url: `${origin}/wallet?payment=cancelled`,
      metadata: {
        user_id: user.id,
        token_amount: amount.toString(),
        payment_type: 'token_purchase',
      },
      // Allow promotion codes if desired
      allow_promotion_codes: true,
    });

    console.log(`Checkout session created: ${session.id}`);

    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
