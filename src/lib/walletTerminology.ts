/**
 * Prediction Market-Safe Wallet Terminology
 * 
 * Criccmax Tokens are used as collateral to take positions in information 
 * markets and are returned when markets resolve.
 * 
 * ✅ Use: position, stake, commit, settle, resolve, tokens returned
 * ❌ Never: bet, win/lose, odds, cashout, gambling, earnings
 */

export const WALLET_TERMS = {
  // Core token language
  TOKEN_NAME: "tokens",
  TOKEN_DESCRIPTION: "Criccmax Tokens are used as collateral to take positions in information markets and are returned when markets resolve.",
  
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
  COLLATERAL_DESC: "Tokens are used as collateral to take positions in Criccmax prediction markets.",
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

export function getActivityLabel(type: WalletActivityType, amount: number, marketName?: string): string {
  switch (type) {
    case "tokens_added":
      return `+${amount} Tokens added`;
    case "tokens_committed":
      return `–${amount} Tokens committed${marketName ? ` (${marketName})` : ''}`;
    case "tokens_settled":
      return `+${amount} Tokens settled${marketName ? ` (${marketName})` : ''}`;
    case "redemption_requested":
      return `–${amount} Tokens redemption requested`;
    case "redemption_completed":
      return `–${amount} Tokens redeemed`;
    default:
      return `${amount} Tokens`;
  }
}

// Token amount presets for buy flow
export const TOKEN_PRESETS = [
  { amount: 10, display: "$10 → 10 tokens" },
  { amount: 25, display: "$25 → 25 tokens" },
  { amount: 50, display: "$50 → 50 tokens" },
  { amount: 100, display: "$100 → 100 tokens" },
] as const;
