import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRICAPI_KEY = Deno.env.get('CRICAPI_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if request is authenticated as admin (for manual trigger)
    const authHeader = req.headers.get('Authorization');
    const isManualTrigger = authHeader !== null;

    if (isManualTrigger) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      // Check if user is admin
      const { data: roles } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const isAdmin = roles?.some(r => r.role === 'admin');
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }
    }

    console.log('Starting market auto-resolution process...');

    // Get all pending oracle rules for markets that are past their resolution time
    const { data: pendingRules, error: rulesError } = await supabaseClient
      .from('market_oracle_rules')
      .select(`
        *,
        markets (*)
      `)
      .eq('resolution_status', 'pending')
      .lte('match_date', new Date().toISOString())
      .limit(50);

    if (rulesError) {
      console.error('Error fetching pending rules:', rulesError);
      throw rulesError;
    }

    console.log(`Found ${pendingRules?.length || 0} pending oracle rules to resolve`);

    const results = {
      resolved: 0,
      failed: 0,
      manual_review: 0,
      details: [] as any[]
    };

    // Process each rule
    for (const rule of pendingRules || []) {
      try {
        console.log(`Processing market: ${rule.market_id}`);

        // Fetch match data from CricAPI
        const matchInfoUrl = `https://api.cricapi.com/v1/match_info?apikey=${CRICAPI_KEY}&id=${rule.match_id}`;
        const matchResponse = await fetch(matchInfoUrl);
        const matchData = await matchResponse.json();

        if (matchData.status !== 'success' || !matchData.data) {
          console.error(`Failed to fetch match data for ${rule.match_id}`);
          
          // Mark for manual review
          await supabaseClient
            .from('market_oracle_rules')
            .update({
              resolution_status: 'manual_review',
              resolution_error: 'Failed to fetch match data from API'
            })
            .eq('id', rule.id);
          
          results.manual_review++;
          results.details.push({
            market_id: rule.market_id,
            status: 'manual_review',
            reason: 'API fetch failed'
          });
          continue;
        }

        // Extract the stat value based on rule configuration
        let actualValue: number | null = null;
        
        // Parse stat field path (e.g., "batting.runs")
        const statPath = rule.stat_field.split('.');
        let dataPointer: any = matchData.data;
        
        // Navigate through nested data
        for (const key of statPath) {
          if (dataPointer && typeof dataPointer === 'object') {
            dataPointer = dataPointer[key];
          } else {
            break;
          }
        }

        if (typeof dataPointer === 'number') {
          actualValue = dataPointer;
        } else {
          console.error(`Could not extract stat value for ${rule.stat_field}`);
          
          await supabaseClient
            .from('market_oracle_rules')
            .update({
              resolution_status: 'manual_review',
              resolution_error: `Could not extract stat: ${rule.stat_field}`
            })
            .eq('id', rule.id);
          
          results.manual_review++;
          results.details.push({
            market_id: rule.market_id,
            status: 'manual_review',
            reason: 'Stat extraction failed'
          });
          continue;
        }

        // Apply comparison logic
        let conditionMet = false;
        switch (rule.comparison_operator) {
          case '>=':
            conditionMet = actualValue >= rule.threshold_value;
            break;
          case '>':
            conditionMet = actualValue > rule.threshold_value;
            break;
          case '==':
            conditionMet = actualValue === rule.threshold_value;
            break;
          case '<=':
            conditionMet = actualValue <= rule.threshold_value;
            break;
          case '<':
            conditionMet = actualValue < rule.threshold_value;
            break;
        }

        const outcome = conditionMet ? rule.outcome_if_true : rule.outcome_if_false;

        console.log(`Market ${rule.market_id}: ${actualValue} ${rule.comparison_operator} ${rule.threshold_value} = ${conditionMet} → ${outcome}`);

        // Update oracle rule
        await supabaseClient
          .from('market_oracle_rules')
          .update({
            resolution_status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_value: actualValue
          })
          .eq('id', rule.id);

        // Update market with resolution
        await supabaseClient
          .from('markets')
          .update({
            status: 'resolved',
            outcome: outcome,
            resolution_time: new Date().toISOString()
          })
          .eq('id', rule.market_id);

        results.resolved++;
        results.details.push({
          market_id: rule.market_id,
          status: 'resolved',
          outcome: outcome,
          actual_value: actualValue,
          threshold: rule.threshold_value
        });

        console.log(`Successfully resolved market ${rule.market_id} to ${outcome}`);

      } catch (error) {
        console.error(`Error processing rule ${rule.id}:`, error);
        
        await supabaseClient
          .from('market_oracle_rules')
          .update({
            resolution_status: 'failed',
            resolution_error: String(error)
          })
          .eq('id', rule.id);
        
        results.failed++;
        results.details.push({
          market_id: rule.market_id,
          status: 'failed',
          error: String(error)
        });
      }
    }

    console.log('Auto-resolution complete:', results);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total_processed: (pendingRules?.length || 0),
        resolved: results.resolved,
        failed: results.failed,
        manual_review: results.manual_review
      },
      details: results.details
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Fatal error in market-auto-resolver:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
