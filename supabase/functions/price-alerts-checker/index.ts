import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Market {
  id: string;
  yes_price: number;
  no_price: number;
}

interface PriceAlert {
  id: string;
  user_id: string;
  market_id: string;
  target_price: number;
  side: 'yes' | 'no';
  condition: 'above' | 'below';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting price alerts check...');

    // Get all untriggered alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('triggered', false);

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
      throw alertsError;
    }

    if (!alerts || alerts.length === 0) {
      console.log('No active alerts to check');
      return new Response(
        JSON.stringify({ message: 'No active alerts', checked: 0, triggered: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking ${alerts.length} alerts`);

    // Get unique market IDs
    const marketIds = [...new Set(alerts.map((a: PriceAlert) => a.market_id))];

    // Fetch current prices for all markets
    const { data: markets, error: marketsError } = await supabase
      .from('markets')
      .select('id, yes_price, no_price')
      .in('id', marketIds);

    if (marketsError) {
      console.error('Error fetching markets:', marketsError);
      throw marketsError;
    }

    const marketPrices = new Map(
      (markets || []).map((m: Market) => [m.id, { yes_price: m.yes_price, no_price: m.no_price }])
    );

    let triggeredCount = 0;
    const triggeredAlerts: string[] = [];

    // Check each alert
    for (const alert of alerts as PriceAlert[]) {
      const market = marketPrices.get(alert.market_id);
      if (!market) continue;

      const currentPrice = alert.side === 'yes' ? market.yes_price : market.no_price;
      let shouldTrigger = false;

      if (alert.condition === 'above' && currentPrice >= alert.target_price) {
        shouldTrigger = true;
      } else if (alert.condition === 'below' && currentPrice <= alert.target_price) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        console.log(`Alert ${alert.id} triggered: ${alert.side} price ${currentPrice} ${alert.condition} ${alert.target_price}`);
        triggeredAlerts.push(alert.id);
        triggeredCount++;
      }
    }

    // Update triggered alerts in batch
    if (triggeredAlerts.length > 0) {
      const { error: updateError } = await supabase
        .from('price_alerts')
        .update({ 
          triggered: true, 
          triggered_at: new Date().toISOString() 
        })
        .in('id', triggeredAlerts);

      if (updateError) {
        console.error('Error updating alerts:', updateError);
        throw updateError;
      }

      console.log(`Successfully triggered ${triggeredCount} alerts`);
    }

    return new Response(
      JSON.stringify({
        message: 'Price alerts checked successfully',
        checked: alerts.length,
        triggered: triggeredCount,
        triggeredIds: triggeredAlerts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in price alerts checker:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
