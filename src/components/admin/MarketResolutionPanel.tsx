import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Flag, AlertCircle, Loader2, History, ExternalLink, 
  CheckCircle2, XCircle, AlertTriangle, Database, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface OracleRule {
  id: string;
  event_template: string;
  stat_field: string;
  data_source_url: string;
  comparison_operator: string;
  threshold_value: number;
  outcome_if_true: string;
  outcome_if_false: string;
  entity_name?: string;
}

interface ResolutionLog {
  id: string;
  action: string;
  source: string;
  outcome: string | null;
  notes: string | null;
  error_message: string | null;
  performed_by_name: string;
  created_at: string;
}

interface MarketToResolve {
  id: string;
  question: string;
  status: string;
  volume: number;
  expiryTime: string;
  liquidityPool: number;
  resolutionWindowHours: number | null;
  oracleRules: OracleRule[];
  resolutionHistory: ResolutionLog[];
}

interface OracleApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  fetchedAt?: string;
}

const MarketResolutionPanel = () => {
  const [markets, setMarkets] = useState<MarketToResolve[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, "yes" | "no" | "void">>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [oracleData, setOracleData] = useState<Record<string, OracleApiResponse>>({});
  const [fetchingOracle, setFetchingOracle] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMarketsToResolve();
  }, []);

  const fetchMarketsToResolve = async () => {
    try {
      // Fetch markets
      const { data: marketsData, error: marketsError } = await supabase
        .from('markets')
        .select('*')
        .in('status', ['approved', 'open', 'closed'])
        .order('expiry_time', { ascending: true });

      if (marketsError) throw marketsError;

      // Fetch oracle rules and resolution history for each market
      const enrichedMarkets = await Promise.all(
        (marketsData || []).map(async (m) => {
          // Get oracle rules
          const { data: rulesData } = await supabase
            .from('market_oracle_rules')
            .select('*')
            .eq('market_id', m.id);

          // Get resolution history using RPC
          const { data: historyData } = await supabase
            .rpc('get_market_resolution_history', { market_uuid: m.id });

          return {
            id: m.id,
            question: m.question,
            status: m.status,
            volume: Number(m.volume),
            expiryTime: m.expiry_time,
            liquidityPool: Number(m.liquidity_pool),
            resolutionWindowHours: m.resolution_window_hours,
            oracleRules: rulesData || [],
            resolutionHistory: historyData || [],
          };
        })
      );

      setMarkets(enrichedMarkets);
    } catch (error: any) {
      console.error('Error fetching markets:', error);
      toast({
        title: "Error",
        description: "Failed to fetch markets for resolution",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOracleData = async (market: MarketToResolve) => {
    if (market.oracleRules.length === 0) {
      toast({
        title: "No Oracle Rules",
        description: "This market doesn't have oracle rules configured",
        variant: "destructive",
      });
      return;
    }

    setFetchingOracle(market.id);

    try {
      const rule = market.oracleRules[0];
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) throw new Error('Not authenticated');

      // Call cricket data proxy to fetch live data
      const response = await supabase.functions.invoke('cricket-data-proxy', {
        body: { 
          endpoint: rule.data_source_url,
          statField: rule.stat_field
        },
      });

      if (response.error) throw response.error;

      const apiData = response.data;
      
      // Evaluate the rule
      const actualValue = extractStatValue(apiData, rule.stat_field);
      const thresholdMet = evaluateComparison(actualValue, rule.comparison_operator, rule.threshold_value);
      
      setOracleData(prev => ({
        ...prev,
        [market.id]: {
          success: true,
          data: {
            raw: apiData,
            actualValue,
            threshold: rule.threshold_value,
            operator: rule.comparison_operator,
            thresholdMet,
            suggestedOutcome: thresholdMet ? rule.outcome_if_true : rule.outcome_if_false,
          },
          fetchedAt: new Date().toISOString(),
        }
      }));

      // Auto-select suggested outcome
      const suggestedOutcome = (thresholdMet ? rule.outcome_if_true : rule.outcome_if_false).toLowerCase() as "yes" | "no";
      setResolutions(prev => ({ ...prev, [market.id]: suggestedOutcome }));

      toast({
        title: "Oracle Data Fetched",
        description: `Suggested outcome: ${suggestedOutcome.toUpperCase()} (${actualValue} ${rule.comparison_operator} ${rule.threshold_value})`,
      });

    } catch (error: any) {
      console.error('Error fetching oracle data:', error);
      setOracleData(prev => ({
        ...prev,
        [market.id]: {
          success: false,
          error: error.message || 'Failed to fetch oracle data',
        }
      }));
      toast({
        title: "Oracle Fetch Failed",
        description: error.message || "Failed to fetch oracle data",
        variant: "destructive",
      });
    } finally {
      setFetchingOracle(null);
    }
  };

  const extractStatValue = (data: any, statField: string): number => {
    // Navigate nested object path like "batting.ODIs.runs"
    const paths = statField.split('.');
    let value = data;
    for (const path of paths) {
      value = value?.[path];
    }
    return Number(value) || 0;
  };

  const evaluateComparison = (actual: number, operator: string, threshold: number): boolean => {
    switch (operator) {
      case '>=': return actual >= threshold;
      case '>': return actual > threshold;
      case '<=': return actual <= threshold;
      case '<': return actual < threshold;
      case '==': return actual === threshold;
      case '!=': return actual !== threshold;
      default: return false;
    }
  };

  const handleResolve = async (market: MarketToResolve) => {
    const outcome = resolutions[market.id];
    if (!outcome) {
      toast({
        title: "Select outcome",
        description: "Please select an outcome before settling",
        variant: "destructive",
      });
      return;
    }

    setResolving(market.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Use the enhanced resolve-market function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-market`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            marketId: market.id,
            outcome,
            source: oracleData[market.id]?.success ? 'oracle' : 'admin_manual',
            notes: notes[market.id] || null,
            apiResponse: oracleData[market.id]?.data || null,
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Resolution failed');
      }

      toast({
        title: "Market resolved successfully!",
        description: `Outcome: ${outcome.toUpperCase()}. ${data.positionsProcessed} positions processed, ${data.notificationsSent} notifications sent.`,
      });

      // Remove from list
      setMarkets(prev => prev.filter(m => m.id !== market.id));
    } catch (error: any) {
      console.error('Resolution error:', error);
      toast({
        title: "Resolution failed",
        description: error.message || "Failed to resolve market",
        variant: "destructive",
      });
    } finally {
      setResolving(null);
    }
  };

  const getOutcomeIcon = (outcome: string | null) => {
    switch (outcome?.toLowerCase()) {
      case 'yes': return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case 'no': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'void': return <AlertTriangle className="h-4 w-4 text-accent" />;
      default: return null;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'oracle': return <Badge variant="secondary">Oracle</Badge>;
      case 'admin_manual': return <Badge variant="outline">Manual</Badge>;
      case 'system_fallback': return <Badge variant="destructive">Fallback</Badge>;
      default: return <Badge variant="secondary">{source}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading markets...</p>
        </div>
      </Card>
    );
  }

  if (markets.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No markets to resolve</h3>
          <p className="text-sm text-muted-foreground">
            All expired markets have been resolved
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 md:p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-medium">Important:</span> Resolving a market will immediately process payouts. 
            All actions are logged in the audit trail for compliance.
          </p>
        </div>
      </div>

      {markets.map(market => (
        <Card key={market.id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base font-semibold leading-tight">
                {market.question}
              </CardTitle>
              <div className="flex gap-2 shrink-0">
                <Badge variant={market.status === 'closed' ? 'default' : 'secondary'}>
                  {market.status}
                </Badge>
                {market.oracleRules.length > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Database className="h-3 w-3" />
                    Oracle
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Market Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground block text-xs">Volume</span>
                <span className="font-medium">{market.volume.toLocaleString()} shares</span>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground block text-xs">Liquidity Pool</span>
                <span className="font-medium text-accent">${market.liquidityPool.toFixed(2)}</span>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground block text-xs">Expires</span>
                <span className="font-medium">{format(new Date(market.expiryTime), "MMM dd, HH:mm")}</span>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground block text-xs">Resolution Window</span>
                <span className="font-medium">{market.resolutionWindowHours || 24}h after expiry</span>
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {/* Oracle Data Section */}
              {market.oracleRules.length > 0 && (
                <AccordionItem value="oracle">
                  <AccordionTrigger className="text-sm font-medium py-2">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Oracle Data Verification
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {/* Oracle Rules */}
                      {market.oracleRules.map((rule) => (
                        <div key={rule.id} className="p-3 bg-muted/30 rounded-lg border text-sm">
                          <p className="font-medium mb-2">{rule.entity_name || rule.event_template}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Condition: </span>
                              <code className="bg-muted px-1 rounded">
                                {rule.stat_field} {rule.comparison_operator} {rule.threshold_value}
                              </code>
                            </div>
                            <div>
                              <span className="text-muted-foreground">If True: </span>
                              <Badge variant="outline" className="text-xs">{rule.outcome_if_true}</Badge>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Data Source: </span>
                              <a 
                                href={rule.data_source_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1"
                              >
                                {rule.data_source_url.substring(0, 50)}...
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Fetch Oracle Data Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchOracleData(market)}
                        disabled={fetchingOracle === market.id}
                        className="w-full"
                      >
                        {fetchingOracle === market.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Fetching Live Data...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Fetch & Verify Oracle Data
                          </>
                        )}
                      </Button>

                      {/* Oracle Data Result */}
                      {oracleData[market.id] && (
                        <div className={`p-3 rounded-lg border ${
                          oracleData[market.id].success 
                            ? 'bg-primary/10 border-primary/30' 
                            : 'bg-destructive/10 border-destructive/30'
                        }`}>
                          {oracleData[market.id].success ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-primary">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="font-medium">Data Retrieved Successfully</span>
                              </div>
                              <div className="text-sm space-y-1">
                                <p>
                                  <span className="text-muted-foreground">Actual Value: </span>
                                  <strong>{oracleData[market.id].data?.actualValue}</strong>
                                </p>
                                <p>
                                  <span className="text-muted-foreground">Threshold: </span>
                                  {oracleData[market.id].data?.operator} {oracleData[market.id].data?.threshold}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">Suggested Outcome: </span>
                                  <Badge variant={
                                    oracleData[market.id].data?.suggestedOutcome?.toLowerCase() === 'yes'
                                      ? 'default'
                                      : 'destructive'
                                  }>
                                    {oracleData[market.id].data?.suggestedOutcome}
                                  </Badge>
                                </p>
                              </div>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-xs">
                                    View Raw API Response
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                                  <DialogHeader>
                                    <DialogTitle>Raw API Response</DialogTitle>
                                    <DialogDescription>
                                      Fetched at {oracleData[market.id].fetchedAt && 
                                        format(new Date(oracleData[market.id].fetchedAt!), "PPpp")}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
                                    {JSON.stringify(oracleData[market.id].data?.raw, null, 2)}
                                  </pre>
                                </DialogContent>
                              </Dialog>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-destructive">
                              <XCircle className="h-4 w-4" />
                              <span>{oracleData[market.id].error}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Resolution History Section */}
              {market.resolutionHistory.length > 0 && (
                <AccordionItem value="history">
                  <AccordionTrigger className="text-sm font-medium py-2">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Resolution History ({market.resolutionHistory.length})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Action</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                          <TableHead className="text-xs">Outcome</TableHead>
                          <TableHead className="text-xs">By</TableHead>
                          <TableHead className="text-xs">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {market.resolutionHistory.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">
                              <Badge variant={
                                log.action === 'succeeded' ? 'default' :
                                log.action === 'failed' ? 'destructive' : 'secondary'
                              }>
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {getSourceBadge(log.source)}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1">
                                {getOutcomeIcon(log.outcome)}
                                {log.outcome?.toUpperCase() || '-'}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{log.performed_by_name}</TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(log.created_at), "MMM dd, HH:mm")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {market.resolutionHistory.some(h => h.notes) && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                        <span className="font-medium">Notes: </span>
                        {market.resolutionHistory.find(h => h.notes)?.notes}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* Resolution Controls */}
            <div className="border-t pt-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`outcome-${market.id}`} className="text-sm font-medium mb-2 block">
                    Select Outcome
                  </Label>
                  <Select 
                    value={resolutions[market.id] || ""} 
                    onValueChange={(value: "yes" | "no" | "void") => 
                      setResolutions(prev => ({ ...prev, [market.id]: value }))
                    }
                    disabled={resolving === market.id}
                  >
                    <SelectTrigger className="bg-card h-11" id={`outcome-${market.id}`}>
                      <SelectValue placeholder="Choose outcome" />
                    </SelectTrigger>
                    <SelectContent className="bg-card z-50">
                      <SelectItem value="yes">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          YES - Yes holders win $1.00
                        </div>
                      </SelectItem>
                      <SelectItem value="no">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-destructive" />
                          NO - No holders win $1.00
                        </div>
                      </SelectItem>
                      <SelectItem value="void">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-accent" />
                          VOID - Refund all positions
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor={`notes-${market.id}`} className="text-sm font-medium mb-2 block">
                    Resolution Notes (Audit Trail)
                  </Label>
                  <Textarea
                    id={`notes-${market.id}`}
                    placeholder="Enter resolution justification for audit trail..."
                    value={notes[market.id] || ''}
                    onChange={(e) => setNotes(prev => ({ ...prev, [market.id]: e.target.value }))}
                    disabled={resolving === market.id}
                    className="h-11 min-h-[44px] resize-none"
                  />
                </div>
              </div>

              {/* Source indicator */}
              {oracleData[market.id]?.success && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Database className="h-3 w-3" />
                  Resolution will be logged as <strong>Oracle-verified</strong>
                </div>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] transition-transform"
                    disabled={resolving === market.id || !resolutions[market.id]}
                  >
                    {resolving === market.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing Resolution...
                      </>
                    ) : (
                      <>
                        <Flag className="h-4 w-4 mr-2" />
                        Resolve Market
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Market Resolution</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>You are about to resolve this market:</p>
                        <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                          <p><strong>Outcome:</strong> {resolutions[market.id]?.toUpperCase()}</p>
                          <p><strong>Source:</strong> {oracleData[market.id]?.success ? 'Oracle Verified' : 'Admin Manual'}</p>
                          {notes[market.id] && (
                            <p><strong>Notes:</strong> {notes[market.id]}</p>
                          )}
                        </div>
                        <p className="text-destructive">
                          This action cannot be undone. Payouts will be processed immediately.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => handleResolve(market)}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      Confirm Resolution
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MarketResolutionPanel;
