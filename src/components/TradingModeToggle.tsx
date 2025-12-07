import { useTradingMode } from "@/hooks/useTradingMode";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, LineChart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TradingModeToggleProps {
  compact?: boolean;
}

const TradingModeToggle = ({ compact = false }: TradingModeToggleProps) => {
  const { isProMode, toggleMode } = useTradingMode();

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleMode}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors text-xs font-medium"
            >
              {isProMode ? (
                <>
                  <LineChart className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">Pro</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <span className="hidden sm:inline">Simple</span>
                </>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isProMode ? "Pro Mode: Advanced trading features" : "Simple Mode: Easy predictions"}</p>
            <p className="text-xs text-muted-foreground">Click to switch</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
      <div className="flex items-center gap-2">
        <Sparkles className={`h-4 w-4 ${!isProMode ? "text-accent" : "text-muted-foreground"}`} />
        <span className={`text-sm ${!isProMode ? "font-medium" : "text-muted-foreground"}`}>Simple</span>
      </div>
      <Switch
        checked={isProMode}
        onCheckedChange={toggleMode}
        aria-label="Toggle trading mode"
      />
      <div className="flex items-center gap-2">
        <LineChart className={`h-4 w-4 ${isProMode ? "text-primary" : "text-muted-foreground"}`} />
        <span className={`text-sm ${isProMode ? "font-medium" : "text-muted-foreground"}`}>Pro</span>
      </div>
    </div>
  );
};

export default TradingModeToggle;
