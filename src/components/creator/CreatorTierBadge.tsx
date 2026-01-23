import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Crown, Medal, Award, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatorTierBadgeProps {
  tier: string;
  verified?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

const TIER_CONFIG = {
  bronze: { 
    color: "from-amber-600 to-amber-800", 
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    textColor: "text-amber-700 dark:text-amber-400",
    borderColor: "border-amber-500/30",
    icon: Medal, 
    label: "Bronze Creator",
    description: "Starter tier - 2% creator fee"
  },
  silver: { 
    color: "from-slate-400 to-slate-600", 
    bgColor: "bg-slate-100 dark:bg-slate-900/30",
    textColor: "text-slate-600 dark:text-slate-400",
    borderColor: "border-slate-500/30",
    icon: Award, 
    label: "Silver Creator",
    description: "2.25% creator fee (+0.25% bonus)"
  },
  gold: { 
    color: "from-yellow-400 to-yellow-600", 
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    textColor: "text-yellow-700 dark:text-yellow-500",
    borderColor: "border-yellow-500/30",
    icon: Crown, 
    label: "Gold Creator",
    description: "2.5% creator fee (+0.5% bonus)"
  },
  platinum: { 
    color: "from-purple-400 to-purple-600", 
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500/30",
    icon: Sparkles, 
    label: "Platinum Creator",
    description: "3% creator fee (+1% bonus)"
  }
};

const CreatorTierBadge = ({ tier, verified, showLabel = false, size = "md" }: CreatorTierBadgeProps) => {
  const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.bronze;
  const TierIcon = config.icon;

  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };

  const badgeSizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm"
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "flex items-center gap-1 border cursor-help transition-all",
              config.bgColor,
              config.textColor,
              config.borderColor,
              badgeSizeClasses[size]
            )}
          >
            <TierIcon className={sizeClasses[size]} />
            {showLabel && <span className="font-medium">{config.label.split(' ')[0]}</span>}
            {verified && (
              <CheckCircle2 className={cn(sizeClasses[size], "text-primary")} />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {verified && (
              <p className="text-xs text-primary flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Verified Creator
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CreatorTierBadge;