import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { OracleMarketRule } from "@/types/oracle";
import { eventTemplates } from "@/data/oracleTemplates";
import { TrendingUp } from "lucide-react";

interface OracleStep1TemplateProps {
  formData: Partial<OracleMarketRule>;
  setFormData: (data: Partial<OracleMarketRule>) => void;
  generateMarketQuestion: () => string;
}

const OracleStep1Template = ({ formData, setFormData, generateMarketQuestion }: OracleStep1TemplateProps) => {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold">Choose Event Template</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Select the type of prediction market you want to create
        </p>
      </div>

      <RadioGroup
        value={formData.event_template}
        onValueChange={(value) => setFormData({ ...formData, event_template: value })}
        className="space-y-3"
      >
        {eventTemplates.map((template) => (
          <Card 
            key={template.id}
            className={`cursor-pointer transition-all ${
              formData.event_template === template.id 
                ? 'border-accent ring-2 ring-accent ring-offset-2' 
                : 'hover:border-accent/50'
            }`}
            onClick={() => setFormData({ ...formData, event_template: template.id })}
          >
            <CardContent className="flex items-start space-x-3 pt-6">
              <RadioGroupItem value={template.id} id={template.id} className="mt-1" />
              <div className="flex-1">
                <Label htmlFor={template.id} className="text-base font-medium cursor-pointer">
                  {template.name}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {template.category}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </RadioGroup>

      {formData.event_template && (
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <TrendingUp className="w-5 h-5 text-accent mt-0.5" />
              <div>
                <Label className="text-sm font-semibold">Preview</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Users will see: <span className="font-medium text-foreground">{generateMarketQuestion() || "Complete the form to see preview"}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OracleStep1Template;
