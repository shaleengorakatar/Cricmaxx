import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface WinLossAnimationProps {
  type: 'win' | 'loss' | null;
  onComplete?: () => void;
}

export function WinLossAnimation({ type, onComplete }: WinLossAnimationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (type) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [type, onComplete]);

  if (!type || !visible) return null;

  return (
    <>
      {/* Screen flash effect */}
      <div
        className={cn(
          'fixed inset-0 pointer-events-none z-50 transition-opacity duration-300',
          type === 'win' ? 'bg-success/20' : 'bg-destructive/20',
          visible ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Confetti for wins */}
      {type === 'win' && <ConfettiExplosion />}

      {/* Shake animation for losses - applied via CSS class to body */}
      {type === 'loss' && <ShakeEffect />}
    </>
  );
}

function ConfettiExplosion() {
  const [particles, setParticles] = useState<JSX.Element[]>([]);

  useEffect(() => {
    const colors = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#06b6d4'];
    const newParticles: JSX.Element[] = [];

    for (let i = 0; i < 50; i++) {
      const style = {
        left: `${50 + (Math.random() - 0.5) * 60}%`,
        '--x': `${(Math.random() - 0.5) * 300}px`,
        '--y': `${-Math.random() * 400 - 100}px`,
        '--rotate': `${Math.random() * 720}deg`,
        animationDelay: `${Math.random() * 0.2}s`,
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      } as React.CSSProperties;

      newParticles.push(
        <div
          key={i}
          className="fixed w-3 h-3 rounded-sm z-50 animate-confetti-fall"
          style={style}
        />
      );
    }

    setParticles(newParticles);
  }, []);

  return <>{particles}</>;
}

function ShakeEffect() {
  useEffect(() => {
    document.body.classList.add('shake-animation');
    const timer = setTimeout(() => {
      document.body.classList.remove('shake-animation');
    }, 500);
    return () => {
      document.body.classList.remove('shake-animation');
      clearTimeout(timer);
    };
  }, []);

  return null;
}
