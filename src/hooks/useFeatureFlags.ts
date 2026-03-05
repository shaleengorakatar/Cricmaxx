import { useState, useEffect, useCallback } from "react";
import { posthog } from "@/lib/posthog";

// Feature flag keys — create these in your PostHog dashboard
export const FEATURE_FLAGS = {
  ORDER_BOOK_TRADING: "enable-order-book-trading",
  PREDICTION_CONTESTS: "enable-prediction-contests",
  ORACLE_MARKETS: "enable-oracle-markets",
  POLLS: "enable-polls",
} as const;

type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * Check if a single feature flag is enabled.
 * Returns `false` while loading, then the resolved value.
 */
export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  const [enabled, setEnabled] = useState(() => !!posthog.isFeatureEnabled(flag));

  useEffect(() => {
    // PostHog flags may load async — listen for ready
    const update = () => setEnabled(!!posthog.isFeatureEnabled(flag));

    posthog.onFeatureFlags(update);
    // Also check immediately in case flags are already loaded
    update();
  }, [flag]);

  return enabled;
}

/**
 * Get all app feature flags at once.
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<FeatureFlagKey, boolean>>(() => ({
    [FEATURE_FLAGS.ORDER_BOOK_TRADING]: !!posthog.isFeatureEnabled(FEATURE_FLAGS.ORDER_BOOK_TRADING),
    [FEATURE_FLAGS.PREDICTION_CONTESTS]: !!posthog.isFeatureEnabled(FEATURE_FLAGS.PREDICTION_CONTESTS),
    [FEATURE_FLAGS.ORACLE_MARKETS]: !!posthog.isFeatureEnabled(FEATURE_FLAGS.ORACLE_MARKETS),
    [FEATURE_FLAGS.POLLS]: !!posthog.isFeatureEnabled(FEATURE_FLAGS.POLLS),
  }));

  useEffect(() => {
    const update = () => {
      setFlags({
        [FEATURE_FLAGS.ORDER_BOOK_TRADING]: !!posthog.isFeatureEnabled(FEATURE_FLAGS.ORDER_BOOK_TRADING),
        [FEATURE_FLAGS.PREDICTION_CONTESTS]: !!posthog.isFeatureEnabled(FEATURE_FLAGS.PREDICTION_CONTESTS),
        [FEATURE_FLAGS.ORACLE_MARKETS]: !!posthog.isFeatureEnabled(FEATURE_FLAGS.ORACLE_MARKETS),
        [FEATURE_FLAGS.POLLS]: !!posthog.isFeatureEnabled(FEATURE_FLAGS.POLLS),
      });
    };

    posthog.onFeatureFlags(update);
    update();
  }, []);

  return flags;
}
