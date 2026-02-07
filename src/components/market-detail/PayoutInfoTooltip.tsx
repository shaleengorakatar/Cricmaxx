import { HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
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
          <span>How It Works</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How It Works</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-foreground">
          <p>
            You buy a Yes/No contract at today's market price. If your prediction is right, 
            each contract is worth <span className="font-semibold">1 token</span>. If not, it's worth 0 tokens.
          </p>
          
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="font-semibold">Example:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>You pay 30¢ for a Yes contract</li>
              <li>If event happens: contract worth 1 token → net profit = 0.70 tokens</li>
              <li>If not: contract is worth 0 tokens</li>
            </ul>
          </div>

          <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">
              <strong className="text-foreground">Important:</strong> The prediction must happen <em>exactly</em> as stated. 
              If it doesn't occur precisely as described, the market resolves to NO.{" "}
              <Link to="/faq#exact-outcome" className="text-accent hover:underline">
                Learn more →
              </Link>
            </p>
          </div>

          <p className="text-muted-foreground italic">
            All balances are settled between participants after the World Cup 2026 under a gentleman's agreement.
          </p>
        </div>
        <Link to="/faq#payout-calculation" className="w-full">
          <Button variant="outline" className="w-full">
            Read Full FAQ
          </Button>
        </Link>
      </DialogContent>
    </Dialog>
  );
};

export default PayoutInfoTooltip;
