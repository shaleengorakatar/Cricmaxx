import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HelpCircle, ChevronDown, TrendingUp, Coins, BarChart2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketHowItWorksProps {
  compact?: boolean;
}

const MarketHowItWorks = ({ compact = false }: MarketHowItWorksProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-3">
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full group">
        <HelpCircle className="h-4 w-4 text-accent shrink-0" />
        <span className="font-medium">How It Works</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform ml-auto", isOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3 text-sm">
          <div className="flex items-start gap-2.5">
            <TrendingUp className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Pick a side — YES or NO</p>
              <p className="text-muted-foreground text-xs">Each market is a binary question. Buy YES if you think it'll happen, NO if you think it won't. Prices range from 1¢ to 99¢ and reflect the crowd's probability estimate.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Coins className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Stake tokens to enter</p>
              <p className="text-muted-foreground text-xs">Choose how much to invest. A $10 bet on YES at 25¢ buys 40 contracts. If YES resolves correctly, each contract pays $1 — a $40 return on your $10 stake.</p>
            </div>
          </div>

          {!compact && (
            <div className="flex items-start gap-2.5">
              <BarChart2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Trade before resolution</p>
                <p className="text-muted-foreground text-xs">Prices shift as more people trade. You can sell your position early to lock in profit or cut losses — you don't have to wait for the outcome.</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5">
            <Trophy className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Win when you're right</p>
              <p className="text-muted-foreground text-xs">When the market resolves, winners get $1 per contract. Losers get $0. Platform takes a small fee from winnings.</p>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default MarketHowItWorks;
