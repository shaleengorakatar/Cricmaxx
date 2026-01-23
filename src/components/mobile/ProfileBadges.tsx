import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Flame, Star, Medal, Crown, Zap, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileBadge {
  id: string;
  name: string;
  description: string;
  icon: typeof Trophy;
  color: string;
  bgColor: string;
  unlocked: boolean;
}

interface ProfileBadgesProps {
  predictionsTotal: number;
  predictionsCorrect: number;
  streak: number;
  ratingScore: number;
}

export function ProfileBadges({ predictionsTotal, predictionsCorrect, streak, ratingScore }: ProfileBadgesProps) {
  const winRate = predictionsTotal > 0 ? (predictionsCorrect / predictionsTotal) * 100 : 0;

  const badges: ProfileBadge[] = [
    {
      id: 'first-win',
      name: 'First Win',
      description: 'Win your first prediction',
      icon: Trophy,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/20',
      unlocked: predictionsCorrect >= 1,
    },
    {
      id: 'streak-3',
      name: '3 Streak',
      description: 'Win 3 predictions in a row',
      icon: Flame,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/20',
      unlocked: streak >= 3,
    },
    {
      id: 'streak-10',
      name: 'Hot Hand',
      description: 'Win 10 predictions in a row',
      icon: Zap,
      color: 'text-red-500',
      bgColor: 'bg-red-500/20',
      unlocked: streak >= 10,
    },
    {
      id: 'predictions-10',
      name: 'Getting Started',
      description: 'Make 10 predictions',
      icon: Target,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
      unlocked: predictionsTotal >= 10,
    },
    {
      id: 'predictions-50',
      name: 'Active Trader',
      description: 'Make 50 predictions',
      icon: Star,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20',
      unlocked: predictionsTotal >= 50,
    },
    {
      id: 'predictions-100',
      name: 'Pro Trader',
      description: 'Make 100 predictions',
      icon: Crown,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/20',
      unlocked: predictionsTotal >= 100,
    },
    {
      id: 'accuracy-60',
      name: 'Sharp Eye',
      description: 'Maintain 60%+ win rate (min 10 predictions)',
      icon: Medal,
      color: 'text-green-500',
      bgColor: 'bg-green-500/20',
      unlocked: winRate >= 60 && predictionsTotal >= 10,
    },
    {
      id: 'rating-1500',
      name: 'Rising Star',
      description: 'Reach 1500 rating score',
      icon: Award,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/20',
      unlocked: ratingScore >= 1500,
    },
  ];

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const lockedBadges = badges.filter((b) => !b.unlocked);

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-foreground flex items-center gap-2">
        <Trophy className="h-4 w-4 text-accent" />
        Achievements
        <Badge variant="secondary" className="ml-2 text-xs">
          {unlockedBadges.length}/{badges.length}
        </Badge>
      </h3>

      {/* Unlocked badges */}
      {unlockedBadges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unlockedBadges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.id}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                  badge.bgColor,
                  'border border-border/50'
                )}
                title={badge.description}
              >
                <Icon className={cn('h-4 w-4', badge.color)} />
                <span className="text-xs font-medium text-foreground">{badge.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Locked badges (dimmed) */}
      {lockedBadges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lockedBadges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/30 opacity-50"
                title={badge.description}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{badge.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
