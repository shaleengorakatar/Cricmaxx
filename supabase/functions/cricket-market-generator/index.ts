const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface CricketMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo: Array<{
    name: string;
    shortname: string;
    img: string;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT for authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isAdmin = roles?.some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    console.log('Fetching cricket matches...');

    // Fetch current matches from CricAPI
    const cricApiKey = Deno.env.get('CRICAPI_KEY');
    if (!cricApiKey) {
      throw new Error('CRICAPI_KEY not configured');
    }

    const response = await fetch(
      `https://api.cricapi.com/v1/currentMatches?apikey=${cricApiKey}&offset=0`
    );

    if (!response.ok) {
      throw new Error(`CricAPI error: ${response.status}`);
    }

    const cricketData = await response.json();
    const matches: CricketMatch[] = cricketData.data || [];

    console.log(`Found ${matches.length} matches`);

    // Filter matches starting in next 14 days
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const upcomingMatches = matches.filter((match) => {
      const matchDate = new Date(match.dateTimeGMT);
      return matchDate > now && matchDate < twoWeeksFromNow;
    });

    console.log(`Filtered to ${upcomingMatches.length} matches in next 14 days`);

    const createdMarkets = [];
    const errors = [];

    // For each match, create 2 markets
    for (const match of upcomingMatches) {
      try {
        const matchDate = new Date(match.dateTimeGMT);
        const expiryTime = new Date(matchDate.getTime() - 60 * 60 * 1000); // 1 hour before match

        // Skip if match already started
        if (matchDate < now) continue;

        // Market 1: Will [Team A] win?
        if (match.teams && match.teams.length >= 2) {
          const teamAName = match.teams[0];
          const marketQuestion = `Will ${teamAName} win vs ${match.teams[1]}?`;

          // Check if market already exists
          const { data: existingMarket } = await supabaseClient
            .from('markets')
            .select('id')
            .eq('question', marketQuestion)
            .single();

          if (!existingMarket) {
            const { data: market, error: marketError } = await supabaseClient
              .from('markets')
              .insert({
                question: marketQuestion,
                description: `${match.matchType} - ${match.name} at ${match.venue}`,
                category: 'Cricket',
                type: 'amm',
                yes_price: 0.50,
                no_price: 0.50,
                volume: 0,
                expiry_time: expiryTime.toISOString(),
                status: 'approved',
                created_by: user.id,
                image_url: match.teamInfo?.[0]?.img || null,
              })
              .select()
              .single();

            if (marketError) {
              errors.push({ match: match.name, market: 'Team Win', error: marketError.message });
              continue;
            }

            // Create oracle rule for resolution
            await supabaseClient.from('market_oracle_rules').insert({
              market_id: market.id,
              match_id: match.id,
              match_name: match.name,
              match_date: matchDate.toISOString(),
              event_template: 'match_winner',
              entity_type: 'team',
              entity_id: teamAName,
              entity_name: teamAName,
              stat_field: 'match.winner',
              comparison_operator: '==',
              threshold_value: 1,
              outcome_if_true: 'yes',
              outcome_if_false: 'no',
              data_source_url: `https://api.cricapi.com/v1/match_info?apikey=${cricApiKey}&id=${match.id}`,
              resolution_status: 'pending',
            });

            createdMarkets.push({ id: market.id, question: marketQuestion });
          }
        }

        // Market 2: Will top player score 50+ runs?
        if (match.teams && match.teams.length >= 1) {
          // Use a generic "Top Batsman" for now since we don't have player data
          const marketQuestion = `Will any player score 50+ runs in ${match.teams[0]} vs ${match.teams[1]}?`;

          const { data: existingMarket2 } = await supabaseClient
            .from('markets')
            .select('id')
            .eq('question', marketQuestion)
            .single();

          if (!existingMarket2) {
            const { data: market2, error: market2Error } = await supabaseClient
              .from('markets')
              .insert({
                question: marketQuestion,
                description: `${match.matchType} - ${match.name} at ${match.venue}`,
                category: 'Cricket',
                type: 'amm',
                yes_price: 0.50,
                no_price: 0.50,
                volume: 0,
                expiry_time: expiryTime.toISOString(),
                status: 'approved',
                created_by: user.id,
                image_url: match.teamInfo?.[0]?.img || null,
              })
              .select()
              .single();

            if (market2Error) {
              errors.push({ match: match.name, market: 'Player Score', error: market2Error.message });
              continue;
            }

            // Create oracle rule for resolution
            await supabaseClient.from('market_oracle_rules').insert({
              market_id: market2.id,
              match_id: match.id,
              match_name: match.name,
              match_date: matchDate.toISOString(),
              event_template: 'player_runs',
              entity_type: 'match',
              entity_id: match.id,
              entity_name: match.name,
              stat_field: 'score.max_runs',
              comparison_operator: '>=',
              threshold_value: 50,
              outcome_if_true: 'yes',
              outcome_if_false: 'no',
              data_source_url: `https://api.cricapi.com/v1/match_info?apikey=${cricApiKey}&id=${match.id}`,
              resolution_status: 'pending',
            });

            createdMarkets.push({ id: market2.id, question: marketQuestion });
          }
        }
      } catch (err: any) {
        errors.push({ match: match.name, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${createdMarkets.length} markets from ${upcomingMatches.length} matches`,
        created_markets: createdMarkets,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Cricket market generator error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message === 'Unauthorized' ? 401 : 400,
      }
    );
  }
});
