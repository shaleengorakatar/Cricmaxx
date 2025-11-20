import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { OracleMarketRule } from "@/types/oracle";
import { CheckCircle2, Clock, Database, TrendingUp } from "lucide-react";
import { statOptions, comparisonOperators } from "@/data/oracleTemplates";

interface OracleStep4ConfirmProps {
  formData: Partial<OracleMarketRule>;
  generateMarketQuestion: () => string;
}

const OracleStep4Confirm = ({ formData, generateMarketQuestion }: OracleStep4ConfirmProps) => {
  const availableStats = statOptions[formData.event_template || ""] || [];
  const selectedStat = availableStats.find(s => s.value === formData.stat_field);
  const selectedComparison = comparisonOperators.find(o => o.value === formData.comparison_operator);

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold">Confirm Oracle Rule</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Review your market configuration before submitting
        </p>
      </div>

      {/* Market Question Preview */}
      <Card className="border-accent/30">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-accent mt-0.5" />
            <div className="flex-1">
              <Label className="text-sm font-semibold">Market Question</Label>
              <p className="text-lg font-medium mt-2">{generateMarketQuestion()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Details */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <Label className="text-sm">Match</Label>
              <p className="text-sm font-medium">{formData.match_name}</p>
              <p className="text-xs text-muted-foreground">
                {formData.match_date ? new Date(formData.match_date).toLocaleString() : ""}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm">Entity</Label>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{formData.entity_type}</Badge>
              <span className="text-sm font-medium">{formData.entity_name}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resolution Logic */}
      <Card className="bg-accent/10 border-accent/20">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-accent mt-0.5" />
            <div className="space-y-3 flex-1">
              <div>
                <Label className="text-sm font-semibold">Auto-Resolution Rule</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  This market will automatically resolve using Cricket API data
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Stat being tracked:</span>
                  <span className="font-medium">{selectedStat?.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Comparison:</span>
                  <span className="font-medium">
                    {selectedComparison?.label.split('(')[0].trim()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Threshold:</span>
                  <span className="font-medium">{formData.threshold_value}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-muted-foreground">If TRUE → Resolves to:</span>
                  <Badge variant={formData.outcome_if_true === 'yes' ? 'default' : 'secondary'}>
                    {formData.outcome_if_true?.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">If FALSE → Resolves to:</span>
                  <Badge variant={formData.outcome_if_false === 'yes' ? 'default' : 'secondary'}>
                    {formData.outcome_if_false?.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Data Source */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Database className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1 text-sm">
              <Label className="text-sm">Data Source</Label>
              <p className="text-xs text-muted-foreground mt-1 break-all">
                Cricket API ({selectedStat?.apiField})
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Resolution Notice */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-center">
            <span className="font-semibold">Market will auto-resolve</span> on{" "}
            {formData.match_date ? new Date(formData.match_date).toLocaleDateString() : "[date]"}.
            Winners will receive automatic payouts ($1 per winning share).
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OracleStep4Confirm;
