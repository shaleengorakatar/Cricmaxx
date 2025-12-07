import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, MapPin, Trophy, Activity } from "lucide-react";
import { format } from "date-fns";

const CRICAPI_KEY = "e60c45e6-5ad0-48d9-8a9e-4acadba7edc3";
const CRICAPI_BASE_URL = "https://api.cricapi.com/v1";

interface Match {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
}

interface LiveScore {
  team1: string;
  team2: string;
  score: string;
  stat?: string;
}

interface MatchInfo {
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  teamInfo?: Array<{
    name: string;
    shortname: string;
    img: string;
  }>;
  score?: Array<{
    r: number;
    w: number;
    o: number;
    inning: string;
  }>;
}

const CricketScoresWidget = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [liveScore, setLiveScore] = useState<LiveScore | null>(null);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [dialogType, setDialogType] = useState<'score' | 'info'>('score');

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const url = new URL(`${CRICAPI_BASE_URL}/currentMatches`);
      url.searchParams.set("apikey", CRICAPI_KEY);
      url.searchParams.set("offset", "0");

      const response = await fetch(url.toString());
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.reason || "Failed to fetch matches");
      }

      if (json?.data) {
        setMatches(json.data.slice(0, 10));
      } else {
        setMatches([]);
      }
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveScore = async (matchId: string) => {
    setScoreLoading(true);
    setSelectedMatch(matchId);
    setDialogType("score");
    try {
      const url = new URL(`${CRICAPI_BASE_URL}/match_info`);
      url.searchParams.set("apikey", CRICAPI_KEY);
      url.searchParams.set("offset", "0");
      url.searchParams.set("id", matchId);

      const response = await fetch(url.toString());
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.reason || "Failed to fetch live score");
      }

      if (json?.data) {
        const matchData = json.data;
        setLiveScore({
          team1: matchData.teams?.[0] || "",
          team2: matchData.teams?.[1] || "",
          score:
            matchData.score?.[0]?.r && matchData.score?.[0]?.w
              ? `${matchData.score[0].r}/${matchData.score[0].w} (${matchData.score[0].o} overs)`
              : matchData.status || "Match info not available",
          stat: matchData.venue || "",
        });
      } else {
        setLiveScore(null);
      }
    } catch (error) {
      console.error("Error fetching live score:", error);
      setLiveScore(null);
    } finally {
      setScoreLoading(false);
    }
  };

  const fetchMatchInfo = async (matchId: string) => {
    setInfoLoading(true);
    setSelectedMatch(matchId);
    setDialogType("info");
    try {
      const url = new URL(`${CRICAPI_BASE_URL}/match_info`);
      url.searchParams.set("apikey", CRICAPI_KEY);
      url.searchParams.set("offset", "0");
      url.searchParams.set("id", matchId);

      const response = await fetch(url.toString());
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.reason || "Failed to fetch match info");
      }

      if (json?.data) {
        setMatchInfo(json.data);
      } else {
        setMatchInfo(null);
      }
    } catch (error) {
      console.error("Error fetching match info:", error);
      setMatchInfo(null);
    } finally {
      setInfoLoading(false);
    }
  };

  const formatMatchTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MMM dd, yyyy 'at' h:mm a");
    } catch {
      return dateString;
    }
  };

  const getMatchTypeColor = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('t20')) return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    if (lowerType.includes('odi')) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (lowerType.includes('test')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  const parseTeams = (name: string): { team1: string; team2: string; matchDesc: string } => {
    // Try to extract teams from match name like "Team A vs Team B, 18th Match"
    const vsMatch = name.match(/^(.+?)\s+vs\s+(.+?)(?:,\s*(.+))?$/i);
    if (vsMatch) {
      return {
        team1: vsMatch[1].trim(),
        team2: vsMatch[2].trim(),
        matchDesc: vsMatch[3]?.trim() || ''
      };
    }
    return { team1: name, team2: '', matchDesc: '' };
  };

  return (
    <>
      <Card className="w-full bg-card border-border overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary to-primary-glow pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Live Cricket Matches
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Loading matches...</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Trophy className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No live matches at the moment</p>
            </div>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="space-y-3 pr-4">
                {matches.map((match) => {
                  const { team1, team2, matchDesc } = parseTeams(match.name);
                  const isLive = match.status?.toLowerCase() === "live";
                  
                  return (
                    <div
                      key={match.id}
                      className="group relative bg-gradient-to-br from-muted/30 to-muted/50 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all duration-300 overflow-hidden"
                    >
                      {/* Live indicator bar */}
                      {isLive && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-accent to-accent/60" />
                      )}
                      
                      <div className="p-4">
                        {/* Header with match type and live badge */}
                        <div className="flex items-center justify-between mb-3">
                          <Badge 
                            variant="outline" 
                            className={`text-xs font-medium uppercase tracking-wide ${getMatchTypeColor(match.matchType)}`}
                          >
                            {match.matchType}
                          </Badge>
                          {isLive && (
                            <Badge className="bg-accent text-accent-foreground animate-pulse flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-white rounded-full" />
                              Live
                            </Badge>
                          )}
                        </div>

                        {/* Teams */}
                        <div className="mb-3">
                          {team2 ? (
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                              <span className="font-semibold text-sm sm:text-base text-foreground">{team1}</span>
                              <span className="text-muted-foreground text-xs sm:text-sm">vs</span>
                              <span className="font-semibold text-sm sm:text-base text-foreground">{team2}</span>
                            </div>
                          ) : (
                            <span className="font-semibold text-sm sm:text-base text-foreground line-clamp-2">{team1}</span>
                          )}
                          {matchDesc && (
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{matchDesc}</p>
                          )}
                        </div>

                        {/* Date and time */}
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground mb-3">
                          <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                          <span>{formatMatchTime(match.dateTimeGMT)}</span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => fetchLiveScore(match.id)}
                            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs sm:text-sm h-8 sm:h-9"
                          >
                            <Activity className="h-3.5 w-3.5 mr-1" />
                            Live Score
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchMatchInfo(match.id)}
                            className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
                          >
                            Info
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedMatch !== null} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent className="bg-background border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {dialogType === 'score' ? (
                <>
                  <Activity className="h-5 w-5 text-accent" />
                  Live Score
                </>
              ) : (
                <>
                  <Trophy className="h-5 w-5 text-primary" />
                  Match Information
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {dialogType === 'score' ? (
            scoreLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : liveScore ? (
              <div className="space-y-4">
                <div className="text-center py-4 bg-gradient-to-br from-muted/50 to-muted rounded-xl">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <span className="font-bold text-lg text-foreground">{liveScore.team1}</span>
                    <span className="px-3 py-1 bg-primary/10 rounded-full text-sm text-muted-foreground font-medium">vs</span>
                    <span className="font-bold text-lg text-foreground">{liveScore.team2}</span>
                  </div>
                  <div className="bg-background/80 backdrop-blur rounded-lg p-4 mx-4">
                    <p className="text-2xl font-bold text-foreground">{liveScore.score}</p>
                    {liveScore.stat && (
                      <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {liveScore.stat}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Unable to load live score</p>
            )
          ) : (
            infoLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : matchInfo ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg text-foreground text-center mb-4">
                  {matchInfo.name}
                </h3>
                <div className="grid gap-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Activity className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                      <p className="font-medium text-foreground">{matchInfo.status}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <MapPin className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Venue</p>
                      <p className="font-medium text-foreground">{matchInfo.venue}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Trophy className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Match Type</p>
                      <p className="font-medium text-foreground uppercase">{matchInfo.matchType}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
                      <p className="font-medium text-foreground">{formatMatchTime(matchInfo.date)}</p>
                    </div>
                  </div>
                  {matchInfo.score && matchInfo.score.length > 0 && (
                    <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Score</p>
                      {matchInfo.score.map((scoreData, idx) => (
                        <div key={idx} className="mb-1 last:mb-0">
                          <p className="font-semibold text-foreground">
                            {scoreData.inning}: {scoreData.r}/{scoreData.w} ({scoreData.o} overs)
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Unable to load match info</p>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CricketScoresWidget;
