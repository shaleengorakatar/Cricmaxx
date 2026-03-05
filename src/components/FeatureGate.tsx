import { ReactNode } from "react";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";

interface FeatureGateProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on a PostHog feature flag.
 * If the flag is disabled, renders the optional fallback (default: nothing).
 */
export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const enabled = useFeatureFlag(flag as any);

  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}
