import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Scale, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Database,
  User,
  Calendar,
  ExternalLink,
  Shield
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ResolutionRulesProps {
  marketId: string;
  expiryTime: string;
  status: string;
  outcome?: string | null;
}

interface OracleRule {
  id: string;
  event_template: string;
  entity_name: string;
  stat_field: string;
  comparison_operator: string;
  threshold_value: number;
  outcome_if_true: string;
  outcome_if_false: string;
  data_source_url: string;
  resolution_status: string;
  resolution_value?: number;
  resolved_at?: string;
}

interface ResolutionLogEntry {
  id: string;
  action: string;
  source: string;
  outcome: string | null;
  notes: string | null;
  error_message: string | null;
  performed_by_name: string;
  created_at: string;
}

interface MarketResolutionData {
  resolution_window_hours: number;
  resolution_source: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
}

export function ResolutionRules({ marketId, expiryTime, status, outcome }: ResolutionRulesProps) {
  // Fetch oracle rules for this market
  const { data: oracleRules } = useQuery({
    queryKey: ['oracle-rules', marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_oracle_rules')
        .select('*')
        .eq('market_id', marketId);
      
      if (error) throw error;
      return data as OracleRule[];
    },
  });

  // Fetch market resolution data
  const { data: marketData } = useQuery({
    queryKey: ['market-resolution-data', marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('resolution_window_hours, resolution_source, resolved_by, resolved_at, resolution_notes')
        .eq('id', marketId)
        .single();
      
      if (error) throw error;
      return data as MarketResolutionData;
    },
  });

  // Fetch resolution history
  const { data: resolutionHistory } = useQuery({
    queryKey: ['resolution-history', marketId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_market_resolution_history', {
        market_uuid: marketId
      });
      
      if (error) throw error;
      return data as ResolutionLogEntry[];
    },
  });

  const expiryDate = new Date(expiryTime);
  const resolutionWindowHours = marketData?.resolution_window_hours || 24;
  const resolvesByDate = new Date(expiryDate.getTime() + resolutionWindowHours * 60 * 60 * 1000);
  const hasOracleRules = oracleRules && oracleRules.length > 0;
  const isResolved = status === 'resolved';

  const getOutcomeIcon = (outcomeValue: string | null) => {
    if (outcomeValue === 'yes') return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (outcomeValue === 'no') return <XCircle className="h-4 w-4 text-destructive" />;
    if (outcomeValue === 'void') return <AlertTriangle className="h-4 w-4 text-warning" />;
    return null;
  };

  const getSourceBadge = (source: string) => {
    const styles: Record<string, string> = {
      oracle: 'bg-accent/10 text-accent border-accent/30',
      admin_manual: 'bg-primary/10 text-primary border-primary/30',
      system_fallback: 'bg-warning/10 text-warning border-warning/30',
    };
    const labels: Record<string, string> = {
      oracle: 'Auto (Oracle)',
      admin_manual: 'Manual',
      system_fallback: 'Fallback',
    };
    return (
      <Badge variant="outline" className={cn('text-xs', styles[source] || '')}>
        {labels[source] || source}
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="resolution" className="border-0">
          <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Resolution Rules</span>
              {isResolved && (
                <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/30">
                  Resolved
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* Resolution Timing */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Resolution Timeline</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isResolved ? (
                      <>
                        Resolved on{' '}
                        <span className="font-medium text-foreground">
                          {marketData?.resolved_at 
                            ? format(new Date(marketData.resolved_at), 'MMM d, yyyy \'at\' h:mm a')
                            : 'Unknown'}
                        </span>
                      </>
                    ) : (
                      <>
                        Resolves within{' '}
                        <span className="font-medium text-foreground">{resolutionWindowHours} hours</span>
                        {' '}after event ends
                        <span className="block text-muted-foreground/70 mt-0.5">
                          (by {format(resolvesByDate, 'MMM d, yyyy \'at\' h:mm a')})
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Oracle Rules */}
              {hasOracleRules && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Automated Resolution (Oracle)</span>
                  </div>
                  {oracleRules.map((rule) => (
                    <div key={rule.id} className="p-3 rounded-lg bg-accent/5 border border-accent/20 space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">{rule.entity_name}</span>
                        {' '}{rule.stat_field} {rule.comparison_operator} {rule.threshold_value}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-success/10 text-success">
                          If true → {rule.outcome_if_true.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                          If false → {rule.outcome_if_false.toUpperCase()}
                        </span>
                      </div>
                      {rule.resolution_status === 'resolved' && rule.resolution_value !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Actual value: <span className="font-mono font-medium">{rule.resolution_value}</span>
                        </p>
                      )}
                      <a 
                        href={rule.data_source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Data Source
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* Fallback Resolution */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Fallback Resolution</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasOracleRules 
                      ? 'If automated resolution fails, an admin will manually resolve with full audit trail.'
                      : 'This market will be manually resolved by an admin after the event concludes.'}
                  </p>
                </div>
              </div>

              {/* Resolution History */}
              {resolutionHistory && resolutionHistory.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Resolution History
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {resolutionHistory.map((entry) => (
                        <div 
                          key={entry.id} 
                          className="flex items-start gap-3 p-2 rounded-lg bg-card border border-border/50"
                        >
                          {getOutcomeIcon(entry.outcome)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getSourceBadge(entry.source)}
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-xs mt-1">
                              {entry.action === 'succeeded' && entry.outcome && (
                                <span className="font-medium">
                                  Resolved {entry.outcome.toUpperCase()}
                                </span>
                              )}
                              {entry.action === 'failed' && (
                                <span className="text-destructive">
                                  Resolution failed: {entry.error_message || 'Unknown error'}
                                </span>
                              )}
                              {entry.action === 'attempted' && (
                                <span className="text-muted-foreground">
                                  Resolution attempted
                                </span>
                              )}
                            </p>
                            {entry.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {entry.notes}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {entry.performed_by_name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Resolved Outcome Display */}
              {isResolved && outcome && (
                <>
                  <Separator />
                  <div className={cn(
                    "p-4 rounded-lg text-center",
                    outcome === 'yes' && "bg-success/10 border border-success/30",
                    outcome === 'no' && "bg-destructive/10 border border-destructive/30",
                    outcome === 'void' && "bg-warning/10 border border-warning/30"
                  )}>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      {getOutcomeIcon(outcome)}
                      <span className="font-bold text-lg">
                        Resolved {outcome.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {marketData?.resolved_at && format(new Date(marketData.resolved_at), 'MMMM d, yyyy \'at\' h:mm a')}
                    </p>
                    {marketData?.resolution_notes && (
                      <p className="text-xs text-muted-foreground mt-2">
                        "{marketData.resolution_notes}"
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
