import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting fraud detection scan...');

    // Call the fraud detection function
    const { error: detectionError } = await supabaseClient.rpc('detect_fraud_patterns');

    if (detectionError) {
      console.error('Fraud detection error:', detectionError);
      return new Response(
        JSON.stringify({ error: 'Fraud detection failed', details: detectionError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get summary of new alerts
    const { data: newAlerts, error: alertsError } = await supabaseClient
      .from('fraud_alerts')
      .select('id, alert_type, severity, status')
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute

    if (alertsError) {
      console.error('Error fetching new alerts:', alertsError);
    }

    console.log(`Fraud detection complete. New alerts: ${newAlerts?.length || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Fraud detection scan completed',
        newAlertsCount: newAlerts?.length || 0,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
