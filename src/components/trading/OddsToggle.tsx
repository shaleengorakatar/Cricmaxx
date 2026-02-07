import { useTradingPreferences } from '@/hooks/useTradingPreferences';
import { Button } from '@/components/ui/button';
import { DollarSign, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OddsToggleProps {
  className?: string;
}

export function OddsToggle({ className }: OddsToggleProps) {
  const { oddsFormat, setOddsFormat } = useTradingPreferences();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex rounded-lg border bg-muted p-0.5', className)}>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2 rounded-md transition-all',
                oddsFormat === 'cents' && 'bg-background shadow-sm'
              )}
              onClick={() => setOddsFormat('cents')}
            >
              <DollarSign className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2 rounded-md transition-all',
                oddsFormat === 'american' && 'bg-background shadow-sm'
              )}
              onClick={() => setOddsFormat('american')}
            >
              <Hash className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {oddsFormat === 'cents' ? 'Price in cents' : 'American odds'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
