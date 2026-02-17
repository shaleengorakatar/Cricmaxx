import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Clock } from "lucide-react";
import { format, isAfter } from "date-fns";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const CRICAPI_KEY = "e60c45e6-5ad0-48d9-8a9e-4acadba7edc3";
const CRICAPI_BASE_URL = "https://api.cricapi.com/v1";
interface Series {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  odi: number;
  t20: number;
  test: number;
  squads: number;
  matches: number;
}

const UpcomingMatches = () => {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUpcomingSeries();
  }, []);

  const fetchUpcomingSeries = async () => {
    try {
      setLoading(true);
      const url = new URL(`${CRICAPI_BASE_URL}/series`);
      url.searchParams.set("apikey", CRICAPI_KEY);
      url.searchParams.set("offset", "0");

      const response = await fetch(url.toString());
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.reason || "Failed to fetch series");
      }
      
      if (json?.data) {
        // Filter for upcoming series (startDate >= today)
        const now = new Date();
        const upcomingSeries = json.data.filter((s: Series) => {
          try {
            const seriesDate = new Date(s.startDate);
            return (
              isAfter(seriesDate, now) ||
              format(seriesDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd")
            );
          } catch {
            return false;
          }
        });
        
        setSeries(upcomingSeries);
      } else {
        setSeries([]);
      }
    } catch (error) {
      console.error("Error fetching series:", error);
      setSeries([]);
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
      
      <main className="flex-1 pt-28 lg:pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Upcoming Cricket Series
            </h1>
            <p className="text-muted-foreground">
              Track upcoming series and find prediction markets
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : series.length === 0 ? (
            <Card className="bg-muted/50 border-border">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <p className="text-xl text-muted-foreground mb-4">
                  No upcoming series found
                </p>
                <Button
                  onClick={fetchUpcomingSeries}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  Refresh
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {series.map((item) => (
                <Card 
                  key={item.id} 
                  className="bg-card border-border hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Series Name */}
                      <div>
                        <h3 className="text-xl font-bold text-foreground mb-2">
                          {item.name}
                        </h3>
                      </div>

                      {/* Date Range */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{formatMatchDate(item.startDate)} - {formatMatchDate(item.endDate)}</span>
                        </div>
                      </div>

                      {/* Match Types */}
                      <div className="flex gap-2 flex-wrap">
                        {item.odi > 0 && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {item.odi} ODI
                          </Badge>
                        )}
                        {item.t20 > 0 && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {item.t20} T20
                          </Badge>
                        )}
                        {item.test > 0 && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {item.test} Test
                          </Badge>
                        )}
                      </div>

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
