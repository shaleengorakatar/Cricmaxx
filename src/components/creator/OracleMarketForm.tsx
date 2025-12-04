import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OracleMarketRule } from "@/types/oracle";
import { eventTemplates } from "@/data/oracleTemplates";
import OracleStep1Template from "./oracle-steps/OracleStep1Template";
import OracleStep2Entity from "./oracle-steps/OracleStep2Entity";
import OracleStep3Logic from "./oracle-steps/OracleStep3Logic";
import OracleStep4Confirm from "./oracle-steps/OracleStep4Confirm";

interface OracleMarketFormProps {
  onMarketCreated: () => void;
}

const OracleMarketForm = ({ onMarketCreated }: OracleMarketFormProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<Partial<OracleMarketRule>>({
    event_template: "",
    match_id: "",
    match_name: "",
    match_date: "",
    entity_type: "player",
    entity_id: "",
    entity_name: "",
    stat_field: "",
    comparison_operator: ">=",
    threshold_value: 50,
    outcome_if_true: "yes",
    outcome_if_false: "no",
    data_source_url: ""
  });

  const steps = [
    { number: 1, title: "Choose Template", component: OracleStep1Template },
    { number: 2, title: "Select Entity", component: OracleStep2Entity },
    { number: 3, title: "Define Logic", component: OracleStep3Logic },
    { number: 4, title: "Confirm Rule", component: OracleStep4Confirm }
  ];

  const progress = (currentStep / steps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!formData.event_template;
      case 2:
        return !!formData.match_id && !!formData.entity_id && !!formData.entity_name;
      case 3:
        return !!formData.stat_field && formData.threshold_value !== undefined;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateMarketQuestion = () => {
    const template = eventTemplates.find(t => t.id === formData.event_template);
    if (!template) return "";

    return template.pattern
      .replace("{player}", formData.entity_name || "[PLAYER]")
      .replace("{team}", formData.entity_name || "[TEAM]")
      .replace("{threshold}", String(formData.threshold_value || "[THRESHOLD]"))
      .replace("{match}", formData.match_name || "[MATCH]")
      .replace("{opponent}", "opponent");
  };

  const handleSubmit = async () => {
    if (!canProceed()) {
      toast.error("Please complete all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create markets");
        return;
      }

      const question = generateMarketQuestion();
      const template = eventTemplates.find(t => t.id === formData.event_template);

      // Create market first
      // Creator markets: 2% goes to creator, 1% goes to platform
      const { data: market, error: marketError } = await supabase
        .from('markets')
        .insert({
          question,
          description: `Oracle-based market for ${formData.match_name}`,
          category: template?.category.split(' - ')[0] || 'Cricket',
          type: 'orderbook',
          yes_price: 0.50,
          no_price: 0.50,
          volume: 0,
          status: 'pending',
          expiry_time: formData.match_date,
          created_by: user.id,
          platform_fee_percent: 1, // Platform gets 1%
          creator_fee_percent: 2,  // Creator gets 2%
        })
        .select()
        .single();

      if (marketError) throw marketError;

      // Create oracle rule
      const { error: oracleError } = await supabase
        .from('market_oracle_rules')
        .insert({
          market_id: market.id,
          event_template: formData.event_template!,
          match_id: formData.match_id!,
          match_name: formData.match_name!,
          match_date: formData.match_date!,
          entity_type: formData.entity_type!,
          entity_id: formData.entity_id!,
          entity_name: formData.entity_name!,
          stat_field: formData.stat_field!,
          comparison_operator: formData.comparison_operator!,
          threshold_value: formData.threshold_value!,
          outcome_if_true: formData.outcome_if_true!,
          outcome_if_false: formData.outcome_if_false!,
          data_source_url: `cricket-proxy:match_info:${formData.match_id}`
        });

      if (oracleError) throw oracleError;

      toast.success("Oracle market created successfully! Awaiting admin approval.");
      
      // Reset form
      setFormData({
        event_template: "",
        match_id: "",
        match_name: "",
        match_date: "",
        entity_type: "player",
        entity_id: "",
        entity_name: "",
        stat_field: "",
        comparison_operator: ">=",
        threshold_value: 50,
        outcome_if_true: "yes",
        outcome_if_false: "no",
        data_source_url: ""
      });
      setCurrentStep(1);
      onMarketCreated();

    } catch (error: any) {
      console.error('Error creating oracle market:', error);
      toast.error(error.message || "Failed to create market");
    } finally {
      setIsSubmitting(false);
    }
  };

  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Oracle-Based Market</CardTitle>
        <CardDescription>
          Set up automatic resolution using cricket API data
        </CardDescription>
        <div className="mt-4">
          <div className="flex justify-between mb-2 text-sm text-muted-foreground">
            {steps.map((step) => (
              <span 
                key={step.number}
                className={currentStep >= step.number ? "text-accent font-medium" : ""}
              >
                Step {step.number}: {step.title}
              </span>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <CurrentStepComponent 
          formData={formData}
          setFormData={setFormData}
          generateMarketQuestion={generateMarketQuestion}
        />

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || isSubmitting}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < steps.length ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSubmitting ? "Creating..." : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Create Market
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OracleMarketForm;
