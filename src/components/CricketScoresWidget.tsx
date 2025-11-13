import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

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
      const response = await fetch(
        "https://api.cricapi.com/v1/currentMatches?apikey=e60c45e6-5ad0-48d9-8a9e-4acadba7edc3&offset=0"
      );
      const data = await response.json();
      if (data.data) {
        setMatches(data.data.slice(0, 10));
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
    setDialogType('score');
    try {
      const response = await fetch(
        `https://api.cricapi.com/v1/match_info?apikey=e60c45e6-5ad0-48d9-8a9e-4acadba7edc3&id=${matchId}`
      );
      const data = await response.json();
      if (data.data) {
        const matchData = data.data;
        setLiveScore({
          team1: matchData.teams?.[0] || '',
          team2: matchData.teams?.[1] || '',
          score: matchData.score?.[0]?.r && matchData.score?.[0]?.w 
            ? `${matchData.score[0].r}/${matchData.score[0].w} (${matchData.score[0].o} overs)` 
            : matchData.status || 'Match info not available',
          stat: matchData.venue || ''
        });
      }
    } catch (error) {
      console.error("Error fetching live score:", error);
    } finally {
      setScoreLoading(false);
    }
  };

  const fetchMatchInfo = async (matchId: string) => {
    setInfoLoading(true);
    setSelectedMatch(matchId);
    setDialogType('info');
    try {
      const response = await fetch(
        `https://api.cricapi.com/v1/match_info?apikey=e60c45e6-5ad0-48d9-8a9e-4acadba7edc3&id=${matchId}`
      );
      const data = await response.json();
      if (data.data) {
        setMatchInfo(data.data);
      }
    } catch (error) {
      console.error("Error fetching match info:", error);
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

  return (
    <>
      <Card className="w-full bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground">
            Live Cricket Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {matches.map((match) => (
                  <Card key={match.id} className="bg-muted/50 border-border hover:bg-muted transition-colors">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">
                              {match.name}
                            </h3>
                            {match.status === "Live" && (
                              <Badge variant="default" className="bg-accent text-accent-foreground">
                                Live
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {match.matchType} • {formatMatchTime(match.dateTimeGMT)}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            onClick={() => fetchLiveScore(match.id)}
                            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto"
                          >
                            See Live Score
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchMatchInfo(match.id)}
                            className="w-full sm:w-auto"
                          >
                            Match Info
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedMatch !== null} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {dialogType === 'score' ? 'Live Score' : 'Match Information'}
            </DialogTitle>
          </DialogHeader>
          {dialogType === 'score' ? (
            scoreLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : liveScore ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">
                    {liveScore.team1} vs {liveScore.team2}
                  </h3>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-xl font-bold text-foreground">{liveScore.score}</p>
                    {liveScore.stat && (
                      <p className="text-sm text-muted-foreground mt-2">{liveScore.stat}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Unable to load live score</p>
            )
          ) : (
            infoLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : matchInfo ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">
                    {matchInfo.name}
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Status</p>
                      <p className="font-semibold text-foreground">{matchInfo.status}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Venue</p>
                      <p className="font-semibold text-foreground">{matchInfo.venue}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Match Type</p>
                      <p className="font-semibold text-foreground uppercase">{matchInfo.matchType}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Date</p>
                      <p className="font-semibold text-foreground">{formatMatchTime(matchInfo.date)}</p>
                    </div>
                    {matchInfo.score && matchInfo.score.length > 0 && (
                      <div className="bg-muted rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-2">Score</p>
                        {matchInfo.score.map((scoreData, idx) => (
                          <div key={idx} className="mb-2 last:mb-0">
                            <p className="font-semibold text-foreground">
                              {scoreData.inning}: {scoreData.r}/{scoreData.w} ({scoreData.o} overs)
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Unable to load match info</p>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CricketScoresWidget;
