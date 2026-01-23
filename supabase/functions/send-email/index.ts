import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "deposit" | "trade" | "resolution";
  userId: string;
  data: {
    amount?: number;
    marketQuestion?: string;
    side?: string;
    outcome?: string;
    tokensReturned?: number;
  };
}

const EMAIL_TEMPLATES = {
  deposit: (data: EmailRequest["data"]) => ({
    subject: `${data.amount} tokens added to your Shariz wallet`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a1a; font-size: 24px;">Tokens Added</h1>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          <strong>${data.amount} tokens</strong> have been added to your Shariz wallet.
        </p>
        <p style="color: #666; font-size: 14px;">
          These tokens are now available as collateral for taking positions in prediction markets.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          Shariz Tokens are used as collateral to take positions in information markets and are returned when markets resolve.
        </p>
      </div>
    `,
  }),
  trade: (data: EmailRequest["data"]) => ({
    subject: `Position opened: ${data.side?.toUpperCase()} on "${data.marketQuestion?.slice(0, 40)}..."`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a1a; font-size: 24px;">Position Opened</h1>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; font-weight: 600; color: #1a1a1a;">${data.marketQuestion}</p>
        </div>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          You took a <strong style="color: ${data.side === 'yes' ? '#16a34a' : '#dc2626'};">${data.side?.toUpperCase()}</strong> position with <strong>${data.amount} tokens</strong> committed.
        </p>
        <p style="color: #666; font-size: 14px;">
          Your tokens are locked until the market resolves. Check the market page for live updates.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          Shariz Tokens are used as collateral to take positions in information markets and are returned when markets resolve.
        </p>
      </div>
    `,
  }),
  resolution: (data: EmailRequest["data"]) => ({
    subject: `Market resolved: ${data.tokensReturned} tokens returned`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a1a; font-size: 24px;">Market Resolved</h1>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; font-weight: 600; color: #1a1a1a;">${data.marketQuestion}</p>
        </div>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          Outcome: <strong>${data.outcome?.toUpperCase()}</strong>
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 14px;">Tokens returned:</p>
          <p style="margin: 8px 0 0; font-size: 32px; font-weight: bold; color: #16a34a;">${data.tokensReturned}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          Shariz Tokens are used as collateral to take positions in information markets and are returned when markets resolve.
        </p>
      </div>
    `,
  }),
};

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Shariz <notifications@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { type, userId, data }: EmailRequest = await req.json();

    // Get user email from profiles
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("email, name")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.email) {
      console.log("No email found for user:", userId);
      return new Response(
        JSON.stringify({ success: true, message: "No email configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const template = EMAIL_TEMPLATES[type](data);

    const emailResponse = await sendEmail(profile.email, template.subject, template.html);

    console.log("Email sent:", emailResponse);

    // Log the notification
    await supabaseClient.from("email_notifications").insert({
      user_id: userId,
      email_type: type,
      subject: template.subject,
      metadata: data,
    });

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
