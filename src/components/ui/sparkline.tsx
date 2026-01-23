import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeColor?: string;
  fillColor?: string;
}

export function Sparkline({
  data,
  width = 60,
  height = 20,
  className,
  strokeColor = "hsl(var(--success))",
  fillColor = "hsl(var(--success) / 0.1)",
}: SparklineProps) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return "";

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });

    return `M${points.join(" L")}`;
  }, [data, width, height]);

  const areaPath = useMemo(() => {
    if (!data || data.length < 2) return "";

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });

    return `M0,${height} L${points.join(" L")} L${width},${height} Z`;
  }, [data, width, height]);

  // Determine trend color
  const trend = data.length >= 2 ? data[data.length - 1] - data[0] : 0;
  const trendStroke = trend >= 0 ? strokeColor : "hsl(var(--destructive))";
  const trendFill = trend >= 0 ? fillColor : "hsl(var(--destructive) / 0.1)";

  if (!data || data.length < 2) {
    return (
      <div 
        className={cn("flex items-center justify-center", className)}
        style={{ width, height }}
      >
        <div className="w-full h-0.5 bg-muted rounded" />
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={areaPath}
        fill={trendFill}
        stroke="none"
      />
      <path
        d={path}
        fill="none"
        stroke={trendStroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
