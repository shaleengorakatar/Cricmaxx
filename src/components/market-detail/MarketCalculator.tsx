import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator } from "lucide-react";

interface MarketCalculatorProps {
  yesPrice: number;
  noPrice: number;
}

const MarketCalculator = ({ yesPrice, noPrice }: MarketCalculatorProps) => {
  const [amount, setAmount] = useState("");
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");

  const currentPrice = outcome === "yes" ? yesPrice : noPrice;
  const currentOdds = Math.round(currentPrice * 100);
  
  const shares = amount ? Math.floor(parseFloat(amount) / currentPrice) : 0;
  const cost = shares * currentPrice;
  const maxPayout = shares * 1.0;
  const potentialProfit = maxPayout - cost;
  const roi = cost > 0 ? ((potentialProfit / cost) * 100) : 0;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Market Calculator</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="calc-amount" className="text-sm">Investment Amount (tokens)</Label>
          <Input
            id="calc-amount"
            type="number"
            placeholder="100.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            step="0.01"
            className="h-12 text-base"
          />
        </div>

        <div>
          <Label htmlFor="calc-outcome" className="text-sm">Predicted Outcome</Label>
          <Select value={outcome} onValueChange={(value: "yes" | "no") => setOutcome(value)}>
            <SelectTrigger id="calc-outcome" className="bg-card h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              <SelectItem value="yes" className="text-base py-3">Yes</SelectItem>
              <SelectItem value="no" className="text-base py-3">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {amount && parseFloat(amount) > 0 && (
          <div className="bg-primary/5 rounded-lg p-4 space-y-3 border border-primary/20">
            <h4 className="font-semibold text-sm text-foreground">Calculation Results</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current {outcome} price:</span>
                <span className="font-semibold text-foreground">{currentOdds}¢</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price per contract:</span>
                <span className="font-semibold text-foreground">{(currentPrice * 100).toFixed(0)}¢</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contracts purchased:</span>
                <span className="font-semibold text-foreground">{shares}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual cost:</span>
                <span className="font-semibold text-foreground">{cost.toFixed(2)} tokens</span>
              </div>
              
              <div className="h-px bg-border my-2"></div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max payout if correct:</span>
                <span className="font-bold text-green-600">{maxPayout.toFixed(2)} tokens</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Potential profit:</span>
                <span className="font-bold text-accent">{potentialProfit.toFixed(2)} tokens</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">ROI if correct:</span>
                <span className="font-bold text-primary">{roi.toFixed(1)}%</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loss if wrong:</span>
                <span className="font-bold text-red-600">-{cost.toFixed(2)} tokens</span>
              </div>
            </div>
          </div>
        )}

        {(!amount || parseFloat(amount) <= 0) && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Enter an amount to see potential outcomes
          </div>
        )}
      </div>
    </Card>
  );
};

export default MarketCalculator;
