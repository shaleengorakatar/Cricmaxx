import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, Zap } from 'lucide-react';

interface CountdownTimerProps {
  expiryTime: string | Date;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

function getTimeRemaining(expiryTime: Date) {
  const now = new Date().getTime();
  const expiry = expiryTime.getTime();
  const diff = expiry - now;
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }
  
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    total: diff,
  };
}

function getUrgencyLevel(totalMs: number): 'normal' | 'warning' | 'critical' | 'expired' {
  if (totalMs <= 0) return 'expired';
  if (totalMs < 60 * 60 * 1000) return 'critical'; // < 1 hour
  if (totalMs < 24 * 60 * 60 * 1000) return 'warning'; // < 24 hours
  return 'normal';
}

export function CountdownTimer({ expiryTime, className, showIcon = true, compact = false }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(() => 
    getTimeRemaining(new Date(expiryTime))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(new Date(expiryTime)));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [expiryTime]);

  const urgency = getUrgencyLevel(timeRemaining.total);
  
  const urgencyStyles = {
    normal: 'text-muted-foreground',
    warning: 'text-amber-500',
    critical: 'text-destructive animate-pulse',
    expired: 'text-muted-foreground/50',
  };
  
  const urgencyBgStyles = {
    normal: 'bg-muted/50',
    warning: 'bg-amber-500/10 border-amber-500/30',
    critical: 'bg-destructive/10 border-destructive/30',
    expired: 'bg-muted/30',
  };

  const Icon = urgency === 'critical' ? AlertTriangle : urgency === 'warning' ? Zap : Clock;

  if (timeRemaining.total <= 0) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs', urgencyStyles.expired, className)}>
        {showIcon && <Clock className="h-3.5 w-3.5" />}
        <span>Expired</span>
      </div>
    );
  }

  if (compact) {
    // Compact format for cards
    let display = '';
    if (timeRemaining.days > 0) {
      display = `${timeRemaining.days}d ${timeRemaining.hours}h`;
    } else if (timeRemaining.hours > 0) {
      display = `${timeRemaining.hours}h ${timeRemaining.minutes}m`;
    } else {
      display = `${timeRemaining.minutes}m ${timeRemaining.seconds}s`;
    }
    
    return (
      <div className={cn(
        'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border',
        urgencyStyles[urgency],
        urgencyBgStyles[urgency],
        className
      )}>
        {showIcon && <Icon className="h-3.5 w-3.5" />}
        <span>{display}</span>
      </div>
    );
  }

  // Full format with separate units
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && <Icon className={cn('h-4 w-4', urgencyStyles[urgency])} />}
      <div className="flex items-center gap-1">
        {timeRemaining.days > 0 && (
          <TimeUnit value={timeRemaining.days} label="d" urgency={urgency} />
        )}
        <TimeUnit value={timeRemaining.hours} label="h" urgency={urgency} />
        <TimeUnit value={timeRemaining.minutes} label="m" urgency={urgency} />
        {timeRemaining.days === 0 && (
          <TimeUnit value={timeRemaining.seconds} label="s" urgency={urgency} />
        )}
      </div>
    </div>
  );
}

interface TimeUnitProps {
  value: number;
  label: string;
  urgency: 'normal' | 'warning' | 'critical' | 'expired';
}

function TimeUnit({ value, label, urgency }: TimeUnitProps) {
  const urgencyStyles = {
    normal: 'bg-muted text-foreground',
    warning: 'bg-amber-500/20 text-amber-600',
    critical: 'bg-destructive/20 text-destructive',
    expired: 'bg-muted/50 text-muted-foreground',
  };
  
  return (
    <div className={cn(
      'flex items-baseline gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono',
      urgencyStyles[urgency]
    )}>
      <span className="font-bold">{value.toString().padStart(2, '0')}</span>
      <span className="text-[10px] opacity-70">{label}</span>
    </div>
  );
}
