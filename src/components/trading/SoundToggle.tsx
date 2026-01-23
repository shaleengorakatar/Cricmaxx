import { useTradingPreferences } from '@/hooks/useTradingPreferences';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SoundToggleProps {
  className?: string;
}

export function SoundToggle({ className }: SoundToggleProps) {
  const { soundEnabled, setSoundEnabled } = useTradingPreferences();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', className)}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Sound effects {soundEnabled ? 'on' : 'off'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
