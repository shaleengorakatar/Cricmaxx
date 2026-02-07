import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TradeStatus = 'idle' | 'submitting' | 'matching' | 'filling' | 'success' | 'partial' | 'failed' | 'no-liquidity';

interface TradeStatusOverlayProps {
  status: TradeStatus;
  side?: 'yes' | 'no';
  filledQuantity?: number;
  totalQuantity?: number;
  avgPrice?: number;
  error?: string;
  totalCost?: number;
  netPayout?: number;
  netProfit?: number;
  effectiveOdds?: number;
  onComplete?: () => void;
}

const statusConfig: Record<TradeStatus, { 
  icon: React.ComponentType<any>; 
  title: string; 
  subtitle: string; 
  color: string;
  bgColor: string;
  animate?: boolean;
}> = {
  idle: { 
    icon: Loader2, 
    title: '', 
    subtitle: '', 
    color: 'text-muted-foreground',
    bgColor: 'bg-background/80'
  },
  submitting: { 
    icon: Loader2, 
    title: 'Submitting Order', 
    subtitle: 'Sending to market...', 
    color: 'text-primary',
    bgColor: 'bg-background/95',
    animate: true
  },
  matching: { 
    icon: Loader2, 
    title: 'Finding Match', 
    subtitle: 'Scanning order book...', 
    color: 'text-accent',
    bgColor: 'bg-background/95',
    animate: true
  },
  filling: { 
    icon: Sparkles, 
    title: 'Filling Order', 
    subtitle: 'Executing trade...', 
    color: 'text-success',
    bgColor: 'bg-success/10',
    animate: true
  },
  success: { 
    icon: CheckCircle2, 
    title: 'Trade Complete!', 
    subtitle: 'Position opened successfully', 
    color: 'text-success',
    bgColor: 'bg-success/10'
  },
  partial: { 
    icon: AlertTriangle, 
    title: 'Partially Filled', 
    subtitle: 'Some of your order was matched', 
    color: 'text-warning',
    bgColor: 'bg-warning/10'
  },
  failed: { 
    icon: XCircle, 
    title: 'Trade Failed', 
    subtitle: 'Could not complete order', 
    color: 'text-destructive',
    bgColor: 'bg-destructive/10'
  },
  'no-liquidity': { 
    icon: AlertTriangle, 
    title: 'No Liquidity', 
    subtitle: 'No matching orders available', 
    color: 'text-warning',
    bgColor: 'bg-warning/10'
  }
};

export function TradeStatusOverlay({
  status,
  side,
  filledQuantity,
  totalQuantity,
  avgPrice,
  error,
  totalCost,
  netPayout,
  netProfit,
  effectiveOdds,
  onComplete
}: TradeStatusOverlayProps) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    if (status === 'submitting') setProgress(20);
    else if (status === 'matching') setProgress(50);
    else if (status === 'filling') setProgress(80);
    else if (status === 'success' || status === 'partial') setProgress(100);
    else if (status === 'failed' || status === 'no-liquidity') setProgress(0);
  }, [status]);

  useEffect(() => {
    if (status === 'success' || status === 'failed' || status === 'no-liquidity') {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, onComplete]);

  const config = statusConfig[status];
  const Icon = config.icon;
  const isVisible = status !== 'idle';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          
          {/* Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={cn(
              "relative z-10 w-[90%] max-w-sm rounded-2xl p-6 shadow-2xl border",
              config.bgColor
            )}
          >
            {/* Progress bar */}
            {(status === 'submitting' || status === 'matching' || status === 'filling') && (
              <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden rounded-t-2xl bg-muted">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]"
                  initial={{ width: 0 }}
                  animate={{ 
                    width: `${progress}%`,
                    backgroundPosition: ['0% 0%', '100% 0%']
                  }}
                  transition={{ 
                    width: { duration: 0.5, ease: 'easeOut' },
                    backgroundPosition: { duration: 1, repeat: Infinity, ease: 'linear' }
                  }}
                />
              </div>
            )}

            <div className="flex flex-col items-center text-center space-y-4">
              {/* Icon */}
              <motion.div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center",
                  status === 'success' && "bg-success/20",
                  status === 'failed' && "bg-destructive/20",
                  status === 'partial' && "bg-warning/20",
                  status === 'no-liquidity' && "bg-warning/20",
                  (status === 'submitting' || status === 'matching' || status === 'filling') && "bg-primary/20"
                )}
                animate={config.animate ? { rotate: 360 } : {}}
                transition={config.animate ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
              >
                <Icon className={cn("w-8 h-8", config.color, config.animate && "animate-spin")} />
              </motion.div>

              {/* Side indicator */}
              {side && status !== 'failed' && (
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                  side === 'yes' ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                )}>
                  {side === 'yes' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {side.toUpperCase()}
                </div>
              )}

              {/* Title */}
              <div>
                <h3 className={cn("text-xl font-bold", config.color)}>
                  {config.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {error || config.subtitle}
                </p>
              </div>

              {/* Trade details */}
              {(status === 'success' || status === 'partial') && filledQuantity !== undefined && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full p-4 rounded-xl bg-background/50 space-y-2"
                >
                  {totalCost !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">You invested</span>
                      <span className="font-semibold">${totalCost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Contracts bought</span>
                    <span className="font-semibold">
                      {filledQuantity}{totalQuantity && totalQuantity !== filledQuantity && ` / ${totalQuantity}`}
                    </span>
                  </div>
                  {effectiveOdds !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Effective odds</span>
                      <span className="font-semibold">{effectiveOdds.toFixed(0)}%</span>
                    </div>
                  )}
                  {avgPrice !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg. price</span>
                      <span className="font-semibold">{(avgPrice * 100).toFixed(0)}¢</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                    <span className="text-muted-foreground font-medium">If correct, you win</span>
                    <span className="font-bold text-success text-base">
                      ${netPayout !== undefined ? netPayout.toFixed(2) : filledQuantity.toFixed(2)}
                    </span>
                  </div>
                  {netProfit !== undefined && netProfit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Net profit</span>
                      <span className="font-bold text-success">+${netProfit.toFixed(2)}</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Success celebration */}
              {status === 'success' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-2xl"
                >
                  🎉
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
