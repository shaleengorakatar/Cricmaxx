import { useTradingPreferences } from '@/hooks/useTradingPreferences';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

interface StreakDisplayProps {
  className?: string;
}

export function StreakDisplay({ className }: StreakDisplayProps) {
  const { predictionStreak } = useTradingPreferences();

  if (predictionStreak < 2) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
        'bg-gradient-to-r from-orange-500/20 to-red-500/20',
        'border border-orange-500/30',
        'text-orange-500 font-bold text-sm',
        'animate-in zoom-in-50 duration-300',
        className
      )}
    >
      <Flame className={cn(
        'h-4 w-4',
        predictionStreak >= 5 && 'animate-pulse'
      )} />
      <span>{predictionStreak} in a row!</span>
      {predictionStreak >= 5 && (
        <span className="ml-1">🔥</span>
      )}
      {predictionStreak >= 10 && (
        <span>🔥</span>
      )}
    </div>
  );
}
