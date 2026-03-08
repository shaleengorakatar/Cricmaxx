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
 * Defaults to `true` if the flag doesn't exist in PostHog (opt-out model).
 */
export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  const [enabled, setEnabled] = useState(true); // Default to true

  useEffect(() => {
    // PostHog flags may load async — listen for ready
    const update = () => {
      const value = posthog.isFeatureEnabled(flag);
      // Only disable if explicitly set to false; undefined/null means not configured = enabled
      setEnabled(value !== false);
    };

    posthog.onFeatureFlags(update);
    // Also check immediately in case flags are already loaded
    update();
  }, [flag]);

  return enabled;
}

/**
 * Get all app feature flags at once.
 * Defaults to `true` if flags don't exist in PostHog (opt-out model).
 */
export function useFeatureFlags() {
  const getFlag = (key: FeatureFlagKey) => posthog.isFeatureEnabled(key) !== false;

  const [flags, setFlags] = useState<Record<FeatureFlagKey, boolean>>(() => ({
    [FEATURE_FLAGS.ORDER_BOOK_TRADING]: true,
    [FEATURE_FLAGS.PREDICTION_CONTESTS]: true,
    [FEATURE_FLAGS.ORACLE_MARKETS]: true,
    [FEATURE_FLAGS.POLLS]: true,
  }));

  useEffect(() => {
    const update = () => {
      setFlags({
        [FEATURE_FLAGS.ORDER_BOOK_TRADING]: getFlag(FEATURE_FLAGS.ORDER_BOOK_TRADING),
        [FEATURE_FLAGS.PREDICTION_CONTESTS]: getFlag(FEATURE_FLAGS.PREDICTION_CONTESTS),
        [FEATURE_FLAGS.ORACLE_MARKETS]: getFlag(FEATURE_FLAGS.ORACLE_MARKETS),
        [FEATURE_FLAGS.POLLS]: getFlag(FEATURE_FLAGS.POLLS),
      });
    };

    posthog.onFeatureFlags(update);
    update();
  }, []);

  return flags;
}
