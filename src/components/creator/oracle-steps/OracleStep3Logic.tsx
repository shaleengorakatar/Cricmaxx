import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OracleMarketRule } from "@/types/oracle";
import { statOptions, comparisonOperators } from "@/data/oracleTemplates";
import { Calculator } from "lucide-react";

interface OracleStep3LogicProps {
  formData: Partial<OracleMarketRule>;
  setFormData: (data: Partial<OracleMarketRule>) => void;
}

const OracleStep3Logic = ({ formData, setFormData }: OracleStep3LogicProps) => {
  const availableStats = statOptions[formData.event_template || ""] || [];

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold">Define Resolution Logic</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Specify what stat to track and the threshold for market resolution
        </p>
      </div>

      <div className="space-y-4">
        {/* Stat Selection */}
        <div className="space-y-2">
          <Label>What stat should determine the outcome?</Label>
          <Select
            value={formData.stat_field}
            onValueChange={(value) => {
              const stat = availableStats.find(s => s.value === value);
              setFormData({
                ...formData,
                stat_field: value,
                data_source_url: stat?.apiField || ""
              });
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select stat to track" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {availableStats.map((stat) => (
                <SelectItem key={stat.value} value={stat.value}>
                  {stat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Comparison Operator */}
        <div className="space-y-2">
          <Label>Comparison Type</Label>
          <Select
            value={formData.comparison_operator}
            onValueChange={(value: any) => setFormData({ ...formData, comparison_operator: value })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {comparisonOperators.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Threshold */}
        <div className="space-y-2">
          <Label>Threshold Value</Label>
          <Input
            type="number"
            value={formData.threshold_value}
            onChange={(e) => setFormData({ ...formData, threshold_value: parseFloat(e.target.value) })}
            placeholder="Enter threshold (e.g., 50)"
            min="0"
            step="0.01"
          />
        </div>

        {/* Outcome Mapping */}
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <Label className="text-sm font-semibold">Outcome Mapping</Label>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">If condition is TRUE →</span>
                <Select
                  value={formData.outcome_if_true}
                  onValueChange={(value: any) => setFormData({ ...formData, outcome_if_true: value })}
                >
                  <SelectTrigger className="w-24 h-8 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="yes">YES</SelectItem>
                    <SelectItem value="no">NO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">If condition is FALSE →</span>
                <Select
                  value={formData.outcome_if_false}
                  onValueChange={(value: any) => setFormData({ ...formData, outcome_if_false: value })}
                >
                  <SelectTrigger className="w-24 h-8 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="yes">YES</SelectItem>
                    <SelectItem value="no">NO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logic Preview */}
        {formData.stat_field && formData.threshold_value !== undefined && (
          <Card className="bg-accent/10 border-accent/20">
            <CardContent className="pt-4">
              <div className="flex items-start space-x-3">
                <Calculator className="w-5 h-5 text-accent mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold">Resolution Logic:</div>
                  <div className="mt-2 text-muted-foreground">
                    If <span className="font-medium text-foreground">{formData.entity_name}'s</span>{" "}
                    <span className="font-medium text-foreground">
                      {availableStats.find(s => s.value === formData.stat_field)?.label}
                    </span>{" "}
                    is <span className="font-medium text-foreground">
                      {comparisonOperators.find(o => o.value === formData.comparison_operator)?.label.split('(')[0].trim()}
                    </span>{" "}
                    <span className="font-medium text-foreground">{formData.threshold_value}</span>,
                    market resolves to{" "}
                    <span className="font-bold text-accent uppercase">{formData.outcome_if_true}</span>.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OracleStep3Logic;
