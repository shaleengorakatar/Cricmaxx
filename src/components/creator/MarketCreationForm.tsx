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
import { CalendarIcon, AlertCircle, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface MarketCreationFormProps {
  onMarketCreated: () => void;
}

const MarketCreationForm = ({ onMarketCreated }: MarketCreationFormProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<MarketTemplate | "">("");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [resolutionSource, setResolutionSource] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
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

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Incomplete form",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const template = currentTemplate;
      if (!template) return;

      // Generate the full question from template and form data
      const question = generatePreview();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to create a market.",
          variant: "destructive",
        });
        return;
      }

      // Use the date field from the form (matchDate, electionDate, targetDate, or expiryDate)
      const dateField = template.fields.find(f => f.type === 'date');
      let expiryTime: Date;
      
      if (dateField && formData[dateField.name]) {
        expiryTime = new Date(formData[dateField.name]);
      } else {
        // Fallback to 7 days from now
        expiryTime = new Date();
        expiryTime.setDate(expiryTime.getDate() + 7);
      }

      // Insert market into database
      // Creator markets: 2% goes to creator, 1% goes to platform
      const { error: marketError } = await supabase
        .from('markets')
        .insert({
          question,
          description: resolutionSource,
          category: template.category,
          type: 'orderbook',
          status: 'pending', // Requires admin approval
          expiry_time: expiryTime.toISOString(),
          created_by: user.id,
          platform_fee_percent: 1, // Platform gets 1%
          creator_fee_percent: 2,  // Creator gets 2%
        });

      if (marketError) {
        console.error('Market creation error:', marketError);
        throw marketError;
      }

      toast({
        title: "Market submitted for review",
        description: "Your market will be reviewed by Shariz admins and go live once approved.",
      });

      // Reset form
      setSelectedTemplate("");
      setFormData({});
      setResolutionSource("");
      onMarketCreated();
    } catch (error) {
      console.error('Error creating market:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create market. Please try again.",
        variant: "destructive",
      });
    }
  };

  const preview = generatePreview();
  const isFormValid = validateForm();

  return (
    <Card className="p-4 md:p-6">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full mb-4 md:mb-6 group"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="text-lg md:text-xl font-bold text-foreground">Create New Market</h2>
        </div>
        <div className="md:hidden">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-4 md:space-y-6">
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
                      className="h-12"
                    />
                  )}
                  
                   {field.type === "number" && (
                    <Input
                      id={field.name}
                      type="number"
                      placeholder={field.placeholder}
                      value={formData[field.name] || ""}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="h-12"
                    />
                  )}
                  
                   {field.type === "select" && (
                    <Select 
                      value={formData[field.name] || ""} 
                      onValueChange={(value) => handleFieldChange(field.name, value)}
                    >
                      <SelectTrigger className="bg-card h-12">
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
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 h-12 justify-start text-left font-normal",
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
                            onSelect={(date) => {
                              if (date) {
                                // If there's an existing time, preserve it; otherwise default to 23:59 (end of day)
                                const existing = formData[field.name] ? new Date(formData[field.name]) : null;
                                if (existing) {
                                  date.setHours(existing.getHours(), existing.getMinutes());
                                } else {
                                  date.setHours(23, 59, 0, 0);
                                }
                                handleFieldChange(field.name, date.toISOString());
                              }
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="time"
                        className="h-12 w-full sm:w-32"
                        value={formData[field.name] ? format(new Date(formData[field.name]), "HH:mm") : ""}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          const date = formData[field.name] ? new Date(formData[field.name]) : new Date();
                          date.setHours(hours, minutes);
                          handleFieldChange(field.name, date.toISOString());
                        }}
                      />
                    </div>
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

            <div className="bg-muted rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground mb-1">Creator Earnings</p>
                  <p className="text-muted-foreground text-xs">
                    You'll earn <span className="text-green-500 font-semibold">2%</span> of the trading volume on this market. 
                    Platform takes <span className="font-semibold">1%</span> fee. Total fee: 3%.
                    Initial market price starts at 50/50 (Yes: $0.50, No: $0.50).
                  </p>
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button 
              onClick={handleSubmit}
              disabled={!isFormValid}
              className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90 active:scale-95 transition-transform"
            >
              Submit for Approval
            </Button>
          </>
        )}
        </div>
      )}
    </Card>
  );
};

export default MarketCreationForm;
