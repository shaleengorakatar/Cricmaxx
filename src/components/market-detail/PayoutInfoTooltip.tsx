import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PayoutInfoTooltip = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <HelpCircle className="h-4 w-4" />
          <span>How Payouts Work</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How Payouts Work</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-foreground">
          <p>
            You buy a Yes/No share at today's market price. If your prediction is right, 
            you get <span className="font-semibold">$1 per share</span>. If not, your share is worth $0.
          </p>
          
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="font-semibold">Example:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>You pay $0.30 for a Yes share</li>
              <li>If event happens: you earn $1 → net profit = $0.70</li>
              <li>If not: your share expires worthless</li>
            </ul>
          </div>

          <p className="text-muted-foreground italic">
            This is not betting — it's a federally-approved event contract.
          </p>
        </div>
        <Button onClick={() => {}} className="w-full">Got it</Button>
      </DialogContent>
    </Dialog>
  );
};

export default PayoutInfoTooltip;
