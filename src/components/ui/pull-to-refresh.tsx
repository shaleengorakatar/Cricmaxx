import { useState, useRef, ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  threshold?: number;
}

export const PullToRefresh = ({
  onRefresh,
  children,
  className,
  threshold = 80,
}: PullToRefreshProps) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    if (containerRef.current?.scrollTop !== 0) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0 && startY.current > 0) {
      // Apply resistance to make pull feel natural
      const resistance = 0.4;
      setPullDistance(Math.min(diff * resistance, threshold + 20));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold / 2);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    startY.current = 0;
  };

  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center transition-opacity duration-200",
          showIndicator ? "opacity-100" : "opacity-0"
        )}
        style={{
          top: Math.max(pullDistance - 40, 8),
        }}
      >
        <div className="bg-primary/10 backdrop-blur-sm rounded-full p-2 border border-primary/20">
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <ArrowDown
              className={cn(
                "h-5 w-5 text-primary transition-transform duration-200",
                progress >= 1 && "rotate-180"
              )}
            />
          )}
        </div>
      </div>

      {/* Content with pull transform */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? "transform 0.2s ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
};
