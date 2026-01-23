import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CRICKET_DATA_API_KEY = Deno.env.get("CRICKET_DATA_API_KEY");
const BASE_URL = "https://api.cricketdata.org/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CricketDataRequest {
  endpoint: string;
  params?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!CRICKET_DATA_API_KEY) {
      console.error("CRICKET_DATA_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Cricket API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { endpoint, params = {} }: CricketDataRequest = await req.json();

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Endpoint required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build URL with params
    const url = new URL(`${BASE_URL}/${endpoint}`);
    url.searchParams.set("apikey", CRICKET_DATA_API_KEY);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    console.log(`Fetching cricket data: ${endpoint}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Cricket API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Cricket API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in cricket-data-proxy:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
