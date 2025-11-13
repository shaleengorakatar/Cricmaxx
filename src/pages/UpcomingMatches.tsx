import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Clock } from "lucide-react";
import { format, isAfter } from "date-fns";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

interface Match {
  unique_id: string;
  team1: string;
  team2: string;
  date: string;
  matchStarted: boolean;
  dateTimeGMT: string;
}

const UpcomingMatches = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUpcomingMatches();
  }, []);

  const fetchUpcomingMatches = async () => {
    try {
      const response = await fetch(
        "https://cricapi.com/api/matches?apikey=e60c45e6-5ad0-48d9-8a9e-4acadba7edc3"
      );
      const data = await response.json();
      
      if (data.matches) {
        // Filter for upcoming matches (date > today and not started)
        const now = new Date();
        const upcomingMatches = data.matches.filter((match: Match) => {
          try {
            const matchDate = new Date(match.dateTimeGMT);
            return isAfter(matchDate, now) && !match.matchStarted;
          } catch {
            return false;
          }
        });
        
        setMatches(upcomingMatches);
      }
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatMatchDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  const formatMatchTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "h:mm a");
    } catch {
      return "";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Upcoming Cricket Matches
            </h1>
            <p className="text-muted-foreground">
              Track upcoming matches and find prediction markets
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : matches.length === 0 ? (
            <Card className="bg-muted/50 border-border">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <p className="text-xl text-muted-foreground mb-4">
                  No upcoming matches found
                </p>
                <Button
                  onClick={fetchUpcomingMatches}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  Refresh
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match) => (
                <Card 
                  key={match.unique_id} 
                  className="bg-card border-border hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Teams */}
                      <div>
                        <h3 className="text-xl font-bold text-foreground mb-2">
                          {match.team1} vs {match.team2}
                        </h3>
                      </div>

                      {/* Date & Time */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{formatMatchDate(match.dateTimeGMT)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{formatMatchTime(match.dateTimeGMT)}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <Badge 
                        variant="secondary" 
                        className="bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        Upcoming
                      </Badge>

                      {/* CTA Button */}
                      <Button
                        onClick={() => navigate('/creator')}
                        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                      >
                        Track Market
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default UpcomingMatches;
