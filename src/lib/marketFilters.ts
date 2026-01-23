/**
 * Centralized market filter configuration
 * All pages should use these utilities to stay in sync
 */

// How far into the future to show markets (in days)
export const MARKET_VISIBILITY_DAYS = 30;

// Valid market statuses for active markets
export const ACTIVE_MARKET_STATUSES = ["approved", "open"] as const;

/**
 * Get the date range for fetching active markets
 */
export function getMarketDateRange(): { now: Date; maxExpiry: Date } {
  const now = new Date();
  const maxExpiry = new Date(now.getTime() + MARKET_VISIBILITY_DAYS * 24 * 60 * 60 * 1000);
  return { now, maxExpiry };
}

/**
 * Check if a market's expiry falls within the visible window
 */
export function isMarketInVisibleWindow(expiryTime: string): boolean {
  const { now, maxExpiry } = getMarketDateRange();
  const expiry = new Date(expiryTime);
  return expiry >= now && expiry <= maxExpiry;
}

/**
 * Check if a market status is considered active
 */
export function isActiveMarketStatus(status: string): boolean {
  return ACTIVE_MARKET_STATUSES.includes(status as typeof ACTIVE_MARKET_STATUSES[number]);
}

/**
 * Filter predicate for checking if a market should be visible
 */
export function shouldShowMarket(status: string, expiryTime: string): boolean {
  return isActiveMarketStatus(status) && isMarketInVisibleWindow(expiryTime);
}
