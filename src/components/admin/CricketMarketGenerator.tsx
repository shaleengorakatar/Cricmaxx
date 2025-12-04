import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function CricketMarketGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleGenerateMarkets = async () => {
    setIsGenerating(true);
    setLastResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("cricket-market-generator", {
        body: { manual: true },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      setLastResult(response.data);
      
      toast({
        title: "Markets Generated!",
        description: `Created ${response.data.created_markets?.length || 0} new markets`,
      });
    } catch (error: any) {
      console.error("Error generating markets:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate markets from cricket data",
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
            <li>Filters for matches starting in next 14 days</li>
            <li>Creates 2 binary predictions per match:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>"Will [Team A] win?"</li>
                <li>"Will any player score 50+ runs?"</li>
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
