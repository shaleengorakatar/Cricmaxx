import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { marketTemplates } from "@/data/marketTemplates";
import { MarketTemplate } from "@/types/creator";
import { CalendarIcon, AlertCircle, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface MarketCreationFormProps {
  onMarketCreated: () => void;
}

const MarketCreationForm = ({ onMarketCreated }: MarketCreationFormProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<MarketTemplate | "">("");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [resolutionSource, setResolutionSource] = useState("");
  const { toast } = useToast();

  const currentTemplate = marketTemplates.find(t => t.id === selectedTemplate);

  const generatePreview = () => {
    if (!currentTemplate) return "";
    
    let preview = currentTemplate.questionPattern;
    currentTemplate.fields.forEach(field => {
      const value = formData[field.name];
      if (value) {
        const displayValue = field.type === "date" 
          ? format(new Date(value), "dd MMM yyyy")
          : value;
        preview = preview.replace(`{${field.name}}`, displayValue);
      } else {
        preview = preview.replace(`{${field.name}}`, `[${field.label}]`);
      }
    });
    return preview;
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const validateForm = () => {
    if (!currentTemplate) return false;
    
    for (const field of currentTemplate.fields) {
      if (field.required && !formData[field.name]) {
        return false;
      }
    }
    
    if (!resolutionSource.trim()) {
      return false;
    }
    
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      toast({
        title: "Incomplete form",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Simulate market creation
    toast({
      title: "Market submitted for review",
      description: "Your market will be reviewed by Shariz admins and go live once approved.",
    });

    // Reset form
    setSelectedTemplate("");
    setFormData({});
    setResolutionSource("");
    onMarketCreated();
  };

  const preview = generatePreview();
  const isFormValid = validateForm();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-5 w-5 text-accent" />
        <h2 className="text-xl font-bold text-foreground">Create New Market</h2>
      </div>

      <div className="space-y-6">
        {/* Template Selection */}
        <div>
          <Label htmlFor="template">Market Template</Label>
          <Select value={selectedTemplate} onValueChange={(value: MarketTemplate) => {
            setSelectedTemplate(value);
            setFormData({});
          }}>
            <SelectTrigger id="template" className="bg-card">
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              {marketTemplates.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic Fields */}
        {currentTemplate && (
          <>
            <div className="space-y-4 border-t border-border pt-4">
              {currentTemplate.fields.map(field => (
                <div key={field.name}>
                  <Label htmlFor={field.name}>
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </Label>
                  
                  {field.type === "text" && (
                    <Input
                      id={field.name}
                      type="text"
                      placeholder={field.placeholder}
                      value={formData[field.name] || ""}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    />
                  )}
                  
                  {field.type === "number" && (
                    <Input
                      id={field.name}
                      type="number"
                      placeholder={field.placeholder}
                      value={formData[field.name] || ""}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    />
                  )}
                  
                  {field.type === "select" && (
                    <Select 
                      value={formData[field.name] || ""} 
                      onValueChange={(value) => handleFieldChange(field.name, value)}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue placeholder={field.placeholder} />
                      </SelectTrigger>
                      <SelectContent className="bg-card z-50">
                        {field.options?.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {field.type === "date" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData[field.name] && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData[field.name] ? format(new Date(formData[field.name]), "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-card z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={formData[field.name] ? new Date(formData[field.name]) : undefined}
                          onSelect={(date) => handleFieldChange(field.name, date?.toISOString())}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
              <Label className="text-sm font-semibold text-accent mb-2 block">Question Preview</Label>
              <p className="text-foreground font-medium">
                {preview || "Fill in the fields above to see preview"}
              </p>
            </div>

            {/* Additional Settings */}
            <div className="space-y-4 border-t border-border pt-4">
              <div>
                <Label htmlFor="resolution">
                  Resolution Source <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="resolution"
                  placeholder="e.g., ESPN official scorecard, CoinMarketCap price data, Official election results"
                  value={resolutionSource}
                  onChange={(e) => setResolutionSource(e.target.value)}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Specify where the outcome will be verified
                </p>
              </div>
            </div>

            {/* Creator Fee Info */}
            <div className="bg-muted rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground mb-1">Creator Earnings</p>
                  <p className="text-muted-foreground text-xs">
                    You'll earn 2% of the trading volume on this market as commission. 
                    Platform takes 3% fee. Initial market price starts at 50/50 (Yes: $0.50, No: $0.50).
                  </p>
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button 
              onClick={handleSubmit}
              disabled={!isFormValid}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Submit for Approval
            </Button>
          </>
        )}
      </div>
    </Card>
  );
};

export default MarketCreationForm;
