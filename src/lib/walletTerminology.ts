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
  TOKEN_DESCRIPTION: "CricMaxx Tokens are used as collateral to take positions in information markets and are returned when markets resolve.",
  
  // Wallet sections
  AVAILABLE: "Available Tokens",
  IN_PLAY: "In Play",
  
  // Actions
  BUY_TOKENS: "Buy Tokens",
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
  COLLATERAL_DESC: "Tokens are used as collateral to take positions in CricMaxx prediction markets.",
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
      return `+${formatted} Tokens added`;
    case "tokens_committed":
      return `–${formatted} Tokens committed${marketName ? ` (${marketName})` : ''}`;
    case "tokens_settled":
      return `+${formatted} Tokens settled${marketName ? ` (${marketName})` : ''}`;
    case "redemption_requested":
      return `–${formatted} Tokens redemption requested`;
    case "redemption_completed":
      return `–${formatted} Tokens redeemed`;
    default:
      return `${formatted} Tokens`;
  }
}

// Token amount presets for buy flow
export const TOKEN_PRESETS = [
  { amount: 50, display: "$50 → 50 tokens" },
  { amount: 75, display: "$75 → 75 tokens" },
  { amount: 100, display: "$100 → 100 tokens" },
] as const;

export const MIN_TOKEN_PURCHASE = 30;
