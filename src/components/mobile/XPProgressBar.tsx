import { Progress } from '@/components/ui/progress';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface XPProgressBarProps {
  ratingScore: number;
  className?: string;
}

// Rating levels and thresholds
const LEVELS = [
  { name: 'Beginner', minRating: 0, color: 'from-gray-500 to-gray-600' },
  { name: 'Apprentice', minRating: 1100, color: 'from-green-500 to-green-600' },
  { name: 'Trader', minRating: 1300, color: 'from-blue-500 to-blue-600' },
  { name: 'Expert', minRating: 1500, color: 'from-purple-500 to-purple-600' },
  { name: 'Master', minRating: 1800, color: 'from-orange-500 to-amber-500' },
  { name: 'Legend', minRating: 2200, color: 'from-yellow-400 to-yellow-500' },
];

function getCurrentLevel(rating: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (rating >= LEVELS[i].minRating) {
      return { level: LEVELS[i], index: i };
    }
  }
  return { level: LEVELS[0], index: 0 };
}

function getNextLevel(currentIndex: number) {
  if (currentIndex >= LEVELS.length - 1) return null;
  return LEVELS[currentIndex + 1];
}

export function XPProgressBar({ ratingScore, className }: XPProgressBarProps) {
  const { level, index } = getCurrentLevel(ratingScore);
  const nextLevel = getNextLevel(index);

  const progressPercent = nextLevel
    ? ((ratingScore - level.minRating) / (nextLevel.minRating - level.minRating)) * 100
    : 100;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-full bg-gradient-to-r', level.color)}>
            <Star className="h-4 w-4 text-white" fill="currentColor" />
          </div>
          <span className="font-bold text-foreground">{level.name}</span>
        </div>
        <span className="text-muted-foreground font-medium">{ratingScore} XP</span>
      </div>

      <div className="relative">
        <Progress value={progressPercent} className="h-3" />
        <div
          className={cn(
            'absolute inset-0 rounded-full bg-gradient-to-r opacity-80',
            level.color
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {nextLevel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{level.minRating} XP</span>
          <span>{nextLevel.minRating} XP to {nextLevel.name}</span>
        </div>
      )}
    </div>
  );
}
