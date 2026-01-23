import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Settings, Check } from 'lucide-react';
import { useTradingPreferences } from '@/hooks/useTradingPreferences';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface QuickPredictProps {
  yesPrice: number;
  noPrice: number;
  onPredict: (side: 'yes' | 'no', amount: number) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

const QUICK_AMOUNTS = [1, 5, 10, 25];

export function QuickPredict({ yesPrice, noPrice, onPredict, disabled, className }: QuickPredictProps) {
  const { quickPredictAmount, setQuickPredictAmount, formatOdds } = useTradingPreferences();
  const [isLoading, setIsLoading] = useState<'yes' | 'no' | null>(null);

  const handleQuickPredict = async (side: 'yes' | 'no') => {
    setIsLoading(side);
    try {
      await onPredict(side, quickPredictAmount);
    } finally {
      setIsLoading(null);
    }
  };

  const yesWin = (quickPredictAmount / yesPrice) - quickPredictAmount;
  const noWin = (quickPredictAmount / noPrice) - quickPredictAmount;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with amount selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Quick Predict</span>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5">
              <span className="font-bold">${quickPredictAmount}</span>
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1">Quick amount</p>
              <div className="grid grid-cols-4 gap-1">
                {QUICK_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    variant={quickPredictAmount === amount ? 'default' : 'outline'}
                    size="sm"
                    className="h-8"
                    onClick={() => setQuickPredictAmount(amount)}
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Quick predict buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => handleQuickPredict('yes')}
          disabled={disabled || isLoading !== null}
          className="h-auto py-3 flex flex-col items-center gap-1 bg-success/10 hover:bg-success/20 text-success border border-success/30"
          variant="outline"
        >
          {isLoading === 'yes' ? (
            <div className="h-6 w-6 rounded-full border-2 border-success border-t-transparent animate-spin" />
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                <span className="font-bold">YES</span>
              </div>
              <span className="text-xs opacity-80">{formatOdds(yesPrice)}</span>
              <span className="text-[10px] opacity-60">Win ${yesWin.toFixed(2)}</span>
            </>
          )}
        </Button>

        <Button
          onClick={() => handleQuickPredict('no')}
          disabled={disabled || isLoading !== null}
          className="h-auto py-3 flex flex-col items-center gap-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30"
          variant="outline"
        >
          {isLoading === 'no' ? (
            <div className="h-6 w-6 rounded-full border-2 border-destructive border-t-transparent animate-spin" />
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-bold">NO</span>
              </div>
              <span className="text-xs opacity-80">{formatOdds(noPrice)}</span>
              <span className="text-[10px] opacity-60">Win ${noWin.toFixed(2)}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
