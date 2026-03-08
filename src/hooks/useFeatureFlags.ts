// Feature flag keys — kept for reference
export const FEATURE_FLAGS = {
  ORDER_BOOK_TRADING: "enable-order-book-trading",
  PREDICTION_CONTESTS: "enable-prediction-contests",
  ORACLE_MARKETS: "enable-oracle-markets",
  POLLS: "enable-polls",
} as const;

type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * All features are enabled. PostHog feature flags disabled.
 */
export function useFeatureFlag(_flag: FeatureFlagKey): boolean {
  return true;
}

/**
 * All features are enabled. PostHog feature flags disabled.
 */
export function useFeatureFlags() {
  return {
    [FEATURE_FLAGS.ORDER_BOOK_TRADING]: true,
    [FEATURE_FLAGS.PREDICTION_CONTESTS]: true,
    [FEATURE_FLAGS.ORACLE_MARKETS]: true,
    [FEATURE_FLAGS.POLLS]: true,
  } as Record<FeatureFlagKey, boolean>;
}
