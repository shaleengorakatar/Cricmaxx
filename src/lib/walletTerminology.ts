/**
 * Prediction Market-Safe Wallet Terminology
 * 
 * CricMaxx Tokens are used as collateral to take positions in information 
 * markets and are returned when markets resolve.
 * 
 * ✅ Use: position, stake, commit, settle, resolve, tokens returned
 * ❌ Never: bet, win/lose, odds, cashout, gambling, earnings
 */

export const WALLET_TERMS = {
  // Core token language
  TOKEN_NAME: "tokens",
  TOKEN_DESCRIPTION: "CricMaxx Tokens are used as collateral to take positions in prediction markets and are returned when markets resolve. 1 Token = $1 USD.",
  
  // Wallet sections
  AVAILABLE: "Available Tokens",
  IN_PLAY: "In Play",
  
  // Actions
  BUY_TOKENS: "Add Tokens",
  ADD_TOKENS: "Add Tokens",
  REQUEST_REDEMPTION: "Request Redemption",
  CONFIRM_POSITION: "Confirm Position",
  
  // Transaction types
  TOKENS_ADDED: "Tokens added",
  TOKENS_COMMITTED: "Tokens committed",
  TOKENS_SETTLED: "Tokens settled",
  TOKENS_RETURNED: "Tokens returned",
  REDEMPTION_REQUESTED: "Redemption requested",
  
  // Status labels
  ACTIVE_POSITIONS: "Active",
  SETTLED_POSITIONS: "Settled",
  
  // Descriptions
  COLLATERAL_DESC: "CricMaxx Tokens are used as collateral to take positions in prediction markets. 1 Token = $1 USD.",
  LOCK_DESC: "Tokens will be locked until market resolves",
  MAX_OUTCOME_DESC: "Max outcome defined by market rules",
  REDEMPTION_DESC: "Tokens must not be committed to open markets.",
  REDEMPTION_DELAY: "Processed in 2–5 business days",
  VERIFICATION_NOTE: "Subject to verification",
  MIN_REDEMPTION: 10,
} as const;

// Transaction type mapping for audit-friendly display
export type WalletActivityType = 
  | "tokens_added" 
  | "tokens_committed" 
  | "tokens_settled" 
  | "redemption_requested"
  | "redemption_completed";

// Format amount to avoid floating point display issues
function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
}

export function getActivityLabel(type: WalletActivityType, amount: number, marketName?: string): string {
  const formatted = formatAmount(amount);
  switch (type) {
    case "tokens_added":
      return `+${formatted} tokens added`;
    case "tokens_committed":
      return `–${formatted} tokens committed${marketName ? ` (${marketName})` : ''}`;
    case "tokens_settled":
      return `+${formatted} tokens settled${marketName ? ` (${marketName})` : ''}`;
    case "redemption_requested":
      return `–${formatted} tokens redemption requested`;
    case "redemption_completed":
      return `–${formatted} tokens redeemed`;
    default:
      return `${formatted} tokens`;
  }
}

// Token amount presets for buy flow
export const TOKEN_PRESETS = [
  { amount: 50, display: "$50" },
  { amount: 75, display: "$75" },
  { amount: 100, display: "$100" },
] as const;

export const MIN_TOKEN_PURCHASE = 30;
