import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactFormRequest {
  email: string;
  issueType: string;
  subject: string;
  description: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { email, issueType, subject, description }: ContactFormRequest = await req.json();

    // Validate required fields
    if (!email || !issueType || !description) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, issueType, and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailSubject = `[CricMaxx Support] [${issueType}] ${subject || "Support Request"}`;
    
    const htmlContent = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a1a; font-size: 24px; border-bottom: 2px solid #eee; padding-bottom: 12px;">
          🏏 New Support Request
        </h1>
        
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0;"><strong>From:</strong> ${email}</p>
          <p style="margin: 0 0 8px 0;"><strong>Issue Type:</strong> ${issueType}</p>
          <p style="margin: 0;"><strong>Subject:</strong> ${subject || "N/A"}</p>
        </div>
        
        <h2 style="color: #333; font-size: 18px; margin-top: 24px;">Description</h2>
        <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; white-space: pre-wrap;">
          ${description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          Reply directly to this email to respond to the user at ${email}
        </p>
      </div>
    `;

    console.log("Sending contact form email for:", email);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CricMaxx Support <onboarding@resend.dev>",
        to: ["support@cricmaxx.com"],
        reply_to: email,
        subject: emailSubject,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await response.json();
    console.log("Email sent successfully:", result);

    return new Response(
      JSON.stringify({ success: true, message: "Your message has been sent successfully!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in contact-form function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send message" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
