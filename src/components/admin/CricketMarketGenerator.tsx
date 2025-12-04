import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface CricketMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo?: { name: string; shortname: string; img: string }[];
  matchStarted: boolean;
  matchEnded: boolean;
}

const CRICAPI_KEY = "e60c45e6-5ad0-48d9-8a9e-4acadba7edc3";

export default function CricketMarketGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const { user } = useAuth();

  const handleGenerateMarkets = async () => {
    if (!user) {
      toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setLastResult(null);

    try {
      // Fetch cricket data directly from client (works reliably)
      console.log("Fetching cricket matches from CricAPI...");
      const response = await fetch(
        `https://api.cricapi.com/v1/currentMatches?apikey=${CRICAPI_KEY}&offset=0`
      );

      if (!response.ok) {
        throw new Error(`CricAPI error: ${response.status}`);
      }

      const cricketData = await response.json();
      const matches: CricketMatch[] = cricketData.data || [];

      console.log(`Found ${matches.length} matches`);

      // Filter matches starting in next 14 days and prioritize international matches
      const now = new Date();
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      // Major international teams to prioritize
      const majorTeams = [
        'India', 'Australia', 'England', 'South Africa', 'New Zealand', 
        'Pakistan', 'West Indies', 'Sri Lanka', 'Bangladesh', 'Afghanistan',
        'Ireland', 'Zimbabwe', 'Netherlands', 'Scotland', 'Nepal', 'UAE'
      ];

      const upcomingMatches = matches.filter((match) => {
        const matchDate = new Date(match.dateTimeGMT);
        const isUpcoming = matchDate > now && matchDate < twoWeeksFromNow && !match.matchEnded;
        if (!isUpcoming) return false;
        
        // Check if it's an international match (teams are countries)
        const hasMajorTeam = match.teams?.some(team => 
          majorTeams.some(major => team.toLowerCase().includes(major.toLowerCase()))
        );
        
        // Prioritize: international formats or matches with major teams
        const isInternational = ['odi', 'test', 't20'].includes(match.matchType?.toLowerCase());
        
        return hasMajorTeam || isInternational;
      });

      console.log(`Filtered to ${upcomingMatches.length} upcoming international/major matches`);

      const createdMarkets: { id: string; question: string }[] = [];
      const errors: { match: string; error: string }[] = [];

      // Create markets for each match
      for (const match of upcomingMatches) {
        try {
          const matchDate = new Date(match.dateTimeGMT);
          const expiryTime = new Date(matchDate.getTime() - 60 * 60 * 1000); // 1 hour before

          if (!match.teams || match.teams.length < 2) continue;

          const teamAName = match.teams[0];
          const teamBName = match.teams[1];
          const matchTypeLabel = match.matchType?.toUpperCase() || 'Match';

          // Market 1: Team Win
          const marketQuestion1 = `Will ${teamAName} win vs ${teamBName}?`;

          const { data: existing1 } = await supabase
            .from('markets')
            .select('id')
            .eq('question', marketQuestion1)
            .maybeSingle();

          if (!existing1) {
            const { data: market1, error: err1 } = await supabase
              .from('markets')
              .insert({
                question: marketQuestion1,
                description: `${matchTypeLabel} - ${match.name} at ${match.venue}`,
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

            if (err1) {
              errors.push({ match: match.name, error: err1.message });
            } else if (market1) {
              await supabase.from('market_oracle_rules').insert({
                market_id: market1.id,
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
                data_source_url: `https://api.cricapi.com/v1/match_info?id=${match.id}`,
                resolution_status: 'pending',
              });
              createdMarkets.push({ id: market1.id, question: marketQuestion1 });
            }
          }

          // Market 2: Century scored (100+ runs) - more exciting than 50+
          const marketQuestion2 = `Will a century (100+ runs) be scored in ${teamAName} vs ${teamBName}?`;

          const { data: existing2 } = await supabase
            .from('markets')
            .select('id')
            .eq('question', marketQuestion2)
            .maybeSingle();

          if (!existing2) {
            const { data: market2, error: err2 } = await supabase
              .from('markets')
              .insert({
                question: marketQuestion2,
                description: `${matchTypeLabel} - ${match.name}. Will any batsman score 100+ runs?`,
                category: 'Cricket',
                type: 'amm',
                yes_price: 0.35,
                no_price: 0.65,
                volume: 0,
                expiry_time: expiryTime.toISOString(),
                status: 'approved',
                created_by: user.id,
                image_url: match.teamInfo?.[0]?.img || null,
              })
              .select()
              .single();

            if (err2) {
              errors.push({ match: match.name, error: err2.message });
            } else if (market2) {
              await supabase.from('market_oracle_rules').insert({
                market_id: market2.id,
                match_id: match.id,
                match_name: match.name,
                match_date: matchDate.toISOString(),
                event_template: 'player_runs',
                entity_type: 'player',
                entity_id: 'any_player',
                entity_name: 'Any Player',
                stat_field: 'score.max_runs',
                comparison_operator: '>=',
                threshold_value: 100,
                outcome_if_true: 'yes',
                outcome_if_false: 'no',
                data_source_url: `https://api.cricapi.com/v1/match_info?id=${match.id}`,
                resolution_status: 'pending',
              });
              createdMarkets.push({ id: market2.id, question: marketQuestion2 });
            }
          }

          // Market 3: High scoring match (T20: 180+, ODI: 300+, Test: skip)
          if (match.matchType?.toLowerCase() === 't20') {
            const marketQuestion3 = `Will ${teamAName} score 180+ runs in their innings?`;

            const { data: existing3 } = await supabase
              .from('markets')
              .select('id')
              .eq('question', marketQuestion3)
              .maybeSingle();

            if (!existing3) {
              const { data: market3, error: err3 } = await supabase
                .from('markets')
                .insert({
                  question: marketQuestion3,
                  description: `${matchTypeLabel} - ${match.name}. Will ${teamAName} post a big total of 180+?`,
                  category: 'Cricket',
                  type: 'amm',
                  yes_price: 0.45,
                  no_price: 0.55,
                  volume: 0,
                  expiry_time: expiryTime.toISOString(),
                  status: 'approved',
                  created_by: user.id,
                  image_url: match.teamInfo?.[0]?.img || null,
                })
                .select()
                .single();

              if (err3) {
                errors.push({ match: match.name, error: err3.message });
              } else if (market3) {
                await supabase.from('market_oracle_rules').insert({
                  market_id: market3.id,
                  match_id: match.id,
                  match_name: match.name,
                  match_date: matchDate.toISOString(),
                  event_template: 'team_score',
                  entity_type: 'team',
                  entity_id: teamAName,
                  entity_name: teamAName,
                  stat_field: 'score.runs',
                  comparison_operator: '>=',
                  threshold_value: 180,
                  outcome_if_true: 'yes',
                  outcome_if_false: 'no',
                  data_source_url: `https://api.cricapi.com/v1/match_info?id=${match.id}`,
                  resolution_status: 'pending',
                });
                createdMarkets.push({ id: market3.id, question: marketQuestion3 });
              }
            }
          }

          // Market 4: 5-wicket haul for bowler (player performance)
          const marketQuestion4 = `Will a bowler take 5+ wickets in ${teamAName} vs ${teamBName}?`;

          const { data: existing4 } = await supabase
            .from('markets')
            .select('id')
            .eq('question', marketQuestion4)
            .maybeSingle();

          if (!existing4) {
            const { data: market4, error: err4 } = await supabase
              .from('markets')
              .insert({
                question: marketQuestion4,
                description: `${matchTypeLabel} - ${match.name}. Will any bowler take a 5-wicket haul?`,
                category: 'Cricket',
                type: 'amm',
                yes_price: 0.25,
                no_price: 0.75,
                volume: 0,
                expiry_time: expiryTime.toISOString(),
                status: 'approved',
                created_by: user.id,
                image_url: match.teamInfo?.[1]?.img || match.teamInfo?.[0]?.img || null,
              })
              .select()
              .single();

            if (err4) {
              errors.push({ match: match.name, error: err4.message });
            } else if (market4) {
              await supabase.from('market_oracle_rules').insert({
                market_id: market4.id,
                match_id: match.id,
                match_name: match.name,
                match_date: matchDate.toISOString(),
                event_template: 'player_wickets',
                entity_type: 'player',
                entity_id: 'any_player',
                entity_name: 'Any Bowler',
                stat_field: 'bowling.max_wickets',
                comparison_operator: '>=',
                threshold_value: 5,
                outcome_if_true: 'yes',
                outcome_if_false: 'no',
                data_source_url: `https://api.cricapi.com/v1/match_info?id=${match.id}`,
                resolution_status: 'pending',
              });
              createdMarkets.push({ id: market4.id, question: marketQuestion4 });
            }
          }
        } catch (err: any) {
          errors.push({ match: match.name, error: err.message });
        }
      }

      const result = {
        success: true,
        message: `Generated ${createdMarkets.length} markets from ${upcomingMatches.length} matches`,
        created_markets: createdMarkets,
        errors: errors.length > 0 ? errors : undefined,
      };

      setLastResult(result);
      toast({
        title: "Markets Generated!",
        description: `Created ${createdMarkets.length} new markets`,
      });
    } catch (error: any) {
      console.error("Error generating markets:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate markets",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          Cricket Market Generator
        </CardTitle>
        <CardDescription>
          Auto-generate prediction markets from live cricket matches in the next 14 days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleGenerateMarkets}
            disabled={isGenerating}
            className="flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Markets...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Generate Markets from Cricket API
              </>
            )}
          </Button>
        </div>

        {lastResult && (
          <div className="mt-4 p-4 bg-secondary/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p className="font-semibold">Generation Complete</p>
            </div>
            
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{lastResult.message}</p>
              
              {lastResult.created_markets && lastResult.created_markets.length > 0 && (
                <div className="space-y-1">
                  <p className="font-medium">Created Markets:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    {lastResult.created_markets.slice(0, 5).map((market: any) => (
                      <li key={market.id} className="truncate">
                        {market.question}
                      </li>
                    ))}
                    {lastResult.created_markets.length > 5 && (
                      <li className="text-xs">
                        +{lastResult.created_markets.length - 5} more...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {lastResult.errors && lastResult.errors.length > 0 && (
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <p className="font-medium">Warnings:</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lastResult.errors.length} market(s) could not be created
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-muted rounded-lg text-xs text-muted-foreground space-y-1">
          <p className="font-semibold">What this does:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Fetches current cricket matches from CricAPI</li>
            <li>Filters for international/major team matches in next 14 days</li>
            <li>Creates 3-4 predictions per match:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>"Will [Team A] win?" - Match winner</li>
                <li>"Will a century be scored?" - 100+ runs</li>
                <li>"Will [Team] score 180+?" - T20 high score</li>
                <li>"Will a bowler take 5+ wickets?" - Bowling feat</li>
              </ul>
            </li>
            <li>Sets expiry = 1 hour before match starts</li>
            <li>Stores resolution logic in oracle rules</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
