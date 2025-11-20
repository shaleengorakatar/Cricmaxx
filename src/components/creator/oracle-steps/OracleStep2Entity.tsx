import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Calendar } from "lucide-react";
import { OracleMarketRule, CricketMatch } from "@/types/oracle";
import { toast } from "sonner";

interface OracleStep2EntityProps {
  formData: Partial<OracleMarketRule>;
  setFormData: (data: Partial<OracleMarketRule>) => void;
}

const OracleStep2Entity = ({ formData, setFormData }: OracleStep2EntityProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<CricketMatch | null>(null);
  const [entityName, setEntityName] = useState(formData.entity_name || "");

  useEffect(() => {
    if (formData.match_id && !selectedMatch) {
      fetchMatches();
    }
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.cricapi.com/v1/series?apikey=e60c45e6-5ad0-48d9-8a9e-4acadba7edc3&offset=0${searchTerm ? `&search=${searchTerm}` : ''}`
      );
      const data = await response.json();
      
      if (data.status === "success" && data.data) {
        setMatches(data.data);
      } else {
        toast.error("No matches found");
        setMatches([]);
      }
    } catch (error) {
      console.error("Error fetching matches:", error);
      toast.error("Failed to fetch matches");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchSelect = (match: CricketMatch) => {
    setSelectedMatch(match);
    setFormData({
      ...formData,
      match_id: match.id,
      match_name: match.name,
      match_date: match.dateTimeGMT
    });
  };

  const handleEntitySubmit = () => {
    if (!entityName.trim()) {
      toast.error("Please enter player/team name");
      return;
    }

    const isPlayer = formData.event_template?.includes('player');
    
    setFormData({
      ...formData,
      entity_type: isPlayer ? 'player' : 'team',
      entity_id: entityName.toLowerCase().replace(/\s+/g, '_'),
      entity_name: entityName
    });
    
    toast.success(`${isPlayer ? 'Player' : 'Team'} selected successfully`);
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold">Select Match & Entity</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Search for a cricket match and specify the player or team
        </p>
      </div>

      {/* Match Search */}
      <div className="space-y-3">
        <Label>Search Match</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Search by series or match name (e.g., IPL)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchMatches()}
          />
          <Button onClick={fetchMatches} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Match Results */}
      {matches.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {matches.map((match) => (
            <Card
              key={match.id}
              className={`cursor-pointer transition-all ${
                selectedMatch?.id === match.id
                  ? 'border-accent ring-2 ring-accent ring-offset-2'
                  : 'hover:border-accent/50'
              }`}
              onClick={() => handleMatchSelect(match)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="font-medium">{match.name}</div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  {new Date(match.dateTimeGMT).toLocaleDateString()} • {match.matchType}
                </div>
                {match.venue && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {match.venue}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Entity Selection */}
      {selectedMatch && (
        <div className="space-y-3">
          <Label>
            Enter {formData.event_template?.includes('player') ? 'Player' : 'Team'} Name
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder={formData.event_template?.includes('player') ? "e.g., Virat Kohli" : "e.g., India"}
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleEntitySubmit()}
            />
            <Button onClick={handleEntitySubmit} className="bg-accent text-accent-foreground">
              Confirm
            </Button>
          </div>
          {formData.entity_name && (
            <p className="text-sm text-accent">
              ✓ Selected: {formData.entity_name}
            </p>
          )}
        </div>
      )}

      {selectedMatch && formData.entity_name && (
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="pt-4">
            <div className="text-sm">
              <div className="font-semibold">Selection Summary:</div>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <div>Match: {selectedMatch.name}</div>
                <div>
                  {formData.entity_type === 'player' ? 'Player' : 'Team'}: {formData.entity_name}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OracleStep2Entity;
