import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function mapCountryToRegion(countryCode: string): string {
  if (countryCode === 'IN') return 'India';
  if (['US', 'CA', 'MX'].includes(countryCode)) return 'NA';
  const euCountries = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','GB','NO','CH','IS'];
  if (euCountries.includes(countryCode)) return 'EU';
  if (['SG','MY','TH','VN','PH','ID','MM','KH','LA','BN'].includes(countryCode)) return 'SEA';
  if (['AE','SA','QA','KW','BH','OM','JO','LB','IQ','IR','IL','PS','YE','SY'].includes(countryCode)) return 'Middle East';
  const africanCountries = ['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CD','CG','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW'];
  if (africanCountries.includes(countryCode)) return 'Africa';
  if (['AU','NZ'].includes(countryCode)) return 'Oceania';
  return 'Other';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const posthogKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY')!;

  // Verify caller is admin
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
  
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }
  
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const { data: roleData } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();

  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
  }

  // Get all profiles without a region
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .is('region', null);

  if (profilesError) {
    return new Response(JSON.stringify({ error: profilesError.message }), { status: 500, headers: corsHeaders });
  }

  const results: { updated: number; skipped: number; errors: string[] } = { updated: 0, skipped: 0, errors: [] };

  // Discover PostHog project ID
  let projectId: string;
  try {
    const projRes = await fetch('https://us.i.posthog.com/api/projects/', {
      headers: { Authorization: `Bearer ${posthogKey}` },
    });
    const projData = await projRes.json();
    projectId = projData.results?.[0]?.id;
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Could not find PostHog project' }), { status: 500, headers: corsHeaders });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: `PostHog project lookup failed: ${err.message}` }), { status: 500, headers: corsHeaders });
  }

  // For each user, query PostHog for their last event with geo data
  for (const profile of profiles || []) {
    try {
      // Query PostHog persons by distinct_id
      const searchUrl = `https://us.i.posthog.com/api/projects/${projectId}/persons/?distinct_id=${profile.id}`;
      const phRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${posthogKey}` },
      });

      if (!phRes.ok) {
        results.errors.push(`PostHog API error for ${profile.id}: ${phRes.status}`);
        results.skipped++;
        continue;
      }

      const phData = await phRes.json();
      const person = phData.results?.[0];

      if (!person) {
        results.skipped++;
        continue;
      }

      // Check person properties for geoip country code
      const countryCode = person.properties?.$geoip_country_code || 
                          person.properties?.$initial_geoip_country_code;

      if (!countryCode) {
        results.skipped++;
        continue;
      }

      const region = mapCountryToRegion(countryCode);

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ region })
        .eq('id', profile.id);

      if (updateError) {
        results.errors.push(`Update failed for ${profile.id}: ${updateError.message}`);
      } else {
        results.updated++;
      }
    } catch (err) {
      results.errors.push(`Error for ${profile.id}: ${err.message}`);
      results.skipped++;
    }
  }

  return new Response(JSON.stringify({
    total_profiles: profiles?.length || 0,
    ...results,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
