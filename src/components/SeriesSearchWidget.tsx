import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

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

const SeriesSearchWidget = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();

  const searchSeries = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    setSearched(true);
    try {
      const response = await fetch(
        `https://api.cricapi.com/v1/series?apikey=e60c45e6-5ad0-48d9-8a9e-4acadba7edc3&offset=0&search=${encodeURIComponent(searchTerm)}`
      );
      const data = await response.json();
      
      if (data.data) {
        setSeries(data.data);
      } else {
        setSeries([]);
      }
    } catch (error) {
      console.error("Error searching series:", error);
      setSeries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      searchSeries();
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="w-full bg-card border-border">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-foreground">
          Search Cricket Series
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Search for series (e.g., IPL, World Cup)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 bg-background border-border text-foreground"
          />
          <Button
            onClick={searchSeries}
            disabled={loading || !searchTerm.trim()}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : searched && series.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No series found for "{searchTerm}"</p>
          </div>
        ) : series.length > 0 ? (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {series.map((item) => (
              <Card key={item.id} className="bg-muted/50 border-border hover:bg-muted transition-colors">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {item.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(item.startDate)} - {formatDate(item.endDate)}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {item.odi > 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                          {item.odi} ODI
                        </Badge>
                      )}
                      {item.t20 > 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                          {item.t20} T20
                        </Badge>
                      )}
                      {item.test > 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                          {item.test} Test
                        </Badge>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => navigate('/creator')}
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      Create Market
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default SeriesSearchWidget;
