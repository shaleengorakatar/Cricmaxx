import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/posthog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, TrendingUp, Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  score?: { r: number; w: number; o: number; inning: string }[];
  series_id: string;
  matchStarted: boolean;
  matchEnded: boolean;
}

interface MarketSuggestion {
  id: string;
  question: string;
  category: string;
  type: "trending" | "upcoming" | "live";
  matchName: string;
  matchDate: string;
  expiryTime: string;
  confidence: number;
  tags: string[];
}

const MarketSuggestions = () => {
  const [suggestions, setSuggestions] = useState<MarketSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cricket-proxy', {
        body: { endpoint: 'currentMatches', params: { offset: 0 } }
      });

      if (error) throw error;

      if (data?.data) {
        const generatedSuggestions = generateSuggestions(data.data);
        setSuggestions(generatedSuggestions);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      toast.error("Failed to load market suggestions");
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = (matches: CricketMatch[]): MarketSuggestion[] => {
    const suggestions: MarketSuggestion[] = [];
    const now = new Date();
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    matches.forEach((match) => {
      const matchDate = new Date(match.dateTimeGMT);
      
      // Skip matches outside 14-day window or already ended
      if (matchDate > fourteenDaysFromNow || match.matchEnded) return;

      const expiryTime = new Date(matchDate.getTime() - 60 * 60 * 1000).toISOString();
      const isLive = match.matchStarted && !match.matchEnded;
      const isUpcoming = !match.matchStarted;

      // Determine suggestion type and confidence
      let type: "trending" | "upcoming" | "live" = "upcoming";
      let confidence = 70;
      const tags: string[] = [];

      if (isLive) {
        type = "live";
        confidence = 95;
        tags.push("🔴 Live");
      } else if (isUpcoming) {
        type = "upcoming";
        const hoursUntil = (matchDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntil < 24) {
          confidence = 90;
          tags.push("⏰ Starting Soon");
        } else if (hoursUntil < 72) {
          confidence = 85;
          tags.push("📅 This Week");
        }
      }

      // Add match type tag
      if (match.matchType === "t20") {
        tags.push("T20");
        confidence += 5;
      } else if (match.matchType === "odi") {
        tags.push("ODI");
        confidence += 3;
      } else if (match.matchType === "test") {
        tags.push("Test");
      }

      // Check for high-profile matches (international)
      const internationalTeams = ["India", "Australia", "England", "Pakistan", "South Africa", "New Zealand", "West Indies", "Sri Lanka", "Bangladesh"];
      const hasInternational = match.teams?.some(team => 
        internationalTeams.some(intTeam => team.includes(intTeam))
      );
      
      if (hasInternational) {
        confidence += 10;
        tags.push("🌍 International");
      }

      // Generate match winner suggestion
      if (match.teams && match.teams.length >= 2) {
        suggestions.push({
          id: `${match.id}-winner`,
          question: `Will ${match.teams[0]} win against ${match.teams[1]}?`,
          category: "Cricket",
          type,
          matchName: match.name,
          matchDate: match.dateTimeGMT,
          expiryTime,
          confidence: Math.min(confidence, 100),
          tags: [...tags, "Match Winner"],
        });

        // Generate run milestone suggestions for non-test matches
        if (match.matchType !== "test") {
          suggestions.push({
            id: `${match.id}-runs`,
            question: `Will any player score 50+ runs in ${match.teams[0]} vs ${match.teams[1]}?`,
            category: "Cricket",
            type,
            matchName: match.name,
            matchDate: match.dateTimeGMT,
            expiryTime,
            confidence: Math.min(confidence - 5, 100),
            tags: [...tags, "Player Performance"],
          });

          // High-scoring match suggestion for T20s
          if (match.matchType === "t20") {
            suggestions.push({
              id: `${match.id}-highscore`,
              question: `Will total runs exceed 350 in ${match.teams[0]} vs ${match.teams[1]}?`,
              category: "Cricket",
              type,
              matchName: match.name,
              matchDate: match.dateTimeGMT,
              expiryTime,
              confidence: Math.min(confidence - 10, 100),
              tags: [...tags, "Total Runs"],
            });
          }
        }

        // Generate century suggestion for ODIs and Tests
        if (match.matchType === "odi" || match.matchType === "test") {
          suggestions.push({
            id: `${match.id}-century`,
            question: `Will any player score a century in ${match.teams[0]} vs ${match.teams[1]}?`,
            category: "Cricket",
            type,
            matchName: match.name,
            matchDate: match.dateTimeGMT,
            expiryTime,
            confidence: Math.min(confidence - 15, 100),
            tags: [...tags, "Century Watch"],
          });
        }
      }
    });

    // Sort by confidence (trending first)
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 12);
  };

  const createMarketFromSuggestion = async (suggestion: MarketSuggestion) => {
    setCreating(suggestion.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please login to create markets");
        return;
      }

      const { error } = await supabase.from('markets').insert({
        question: suggestion.question,
        category: suggestion.category,
        type: 'orderbook',
        expiry_time: suggestion.expiryTime,
        created_by: user.id,
        status: 'pending',
        yes_price: 0.5,
        no_price: 0.5,
        volume: 0,
        description: `Auto-generated market for ${suggestion.matchName}`,
      });

      if (error) throw error;

      trackEvent('market_created', { category: suggestion.category, question: suggestion.question, source: 'suggestion' });
      toast.success("Market created and submitted for approval!");
      // Remove from suggestions
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    } catch (error) {
      console.error("Error creating market:", error);
      toast.error("Failed to create market");
    } finally {
      setCreating(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "live": return <Zap className="h-4 w-4 text-red-500" />;
      case "trending": return <TrendingUp className="h-4 w-4 text-orange-500" />;
      default: return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return "bg-green-500/20 text-green-400";
    if (confidence >= 80) return "bg-yellow-500/20 text-yellow-400";
    return "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <CardTitle className="text-xl font-bold text-foreground">
            AI Market Suggestions
          </CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSuggestions}
          disabled={loading}
        >
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No market suggestions available</p>
            <p className="text-sm text-muted-foreground mt-2">
              Check back when there are upcoming cricket matches
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {suggestions.map((suggestion) => (
              <Card 
                key={suggestion.id} 
                className="bg-muted/30 border-border hover:border-accent/50 transition-colors"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(suggestion.type)}
                      <Badge 
                        variant="secondary" 
                        className={getConfidenceBadge(suggestion.confidence)}
                      >
                        {suggestion.confidence}% match
                      </Badge>
                    </div>
                  </div>

                  <h4 className="font-semibold text-foreground leading-tight">
                    {suggestion.question}
                  </h4>

                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {suggestion.matchName}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {suggestion.tags.map((tag, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="text-xs bg-background/50"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => createMarketFromSuggestion(suggestion)}
                    disabled={creating === suggestion.id}
                  >
                    {creating === suggestion.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Market"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MarketSuggestions;
