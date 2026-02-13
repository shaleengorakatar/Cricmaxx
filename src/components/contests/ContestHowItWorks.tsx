import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HelpCircle, ChevronDown, Trophy, Coins, Users, Star, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContestHowItWorksProps {
  compact?: boolean;
}

const ContestHowItWorks = ({ compact = false }: ContestHowItWorksProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn("mb-4", compact ? "mt-4" : "")}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full group">
        <HelpCircle className="h-4 w-4 text-accent shrink-0" />
        <span className="font-medium">How It Works</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform ml-auto", isOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3 text-sm">
          <div className="flex items-start gap-2.5">
            <Coins className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Pay the buy-in</p>
              <p className="text-muted-foreground text-xs">Each contest has a fixed token entry fee. All buy-ins go into the prize pot.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Answer prediction questions</p>
              <p className="text-muted-foreground text-xs">Each question has a point value. Yes/No, multiple choice, or subjective — answer before the contest closes. You can edit your predictions anytime while it's open.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Star className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Earn points for correct answers</p>
              <p className="text-muted-foreground text-xs">After the event, admins set correct answers. Your total points determine your rank. If scores are tied, Tiebreaker 1 decides. If still tied, Tiebreaker 2 decides. If still tied after both, players share the combined prize pool of the positions they occupy.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Trophy className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Win from the prize pot</p>
              <p className="text-muted-foreground text-xs">
                Top 3 win: <span className="font-semibold text-foreground">1st — 50%</span>, <span className="font-semibold text-foreground">2nd — 30%</span>, <span className="font-semibold text-foreground">3rd — 20%</span> of the total pot. If two players are fully tied for 1st, they split the combined 1st + 2nd prize equally (40% each), and 3rd gets 20%. If fewer than 3 join, the contest is voided and buy-ins refunded.
              </p>
            </div>
          </div>

          {!compact && (
            <div className="flex items-start gap-2.5">
              <Users className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Minimum participants required</p>
                <p className="text-muted-foreground text-xs">Contests need at least 3 participants to resolve. Otherwise, everyone gets their tokens back.</p>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ContestHowItWorks;
