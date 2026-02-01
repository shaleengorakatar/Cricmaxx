import { HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";

interface FeatureHelpTooltipProps {
  title: string;
  description: string;
  faqId?: string; // ID to link to specific FAQ section
}

const FeatureHelpTooltip = ({ title, description, faqId }: FeatureHelpTooltipProps) => {
  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button className="inline-flex items-center justify-center focus:outline-none">
          <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 z-50" align="start">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          {faqId && (
            <Link to={`/faq#${faqId}`}>
              <Button variant="link" size="sm" className="h-auto p-0 text-primary">
                Learn more in FAQ →
              </Button>
            </Link>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default FeatureHelpTooltip;
