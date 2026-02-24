/**
 * Simplified Debts Settlement Algorithm (Splitwise-style)
 * All amounts in cents (integers) for precision.
 */

export interface UserBalance {
  userId: string;
  name: string;
  depositedCents: number;
  withdrawnCents: number;
  pollPnlCents: number;     // poll wins - poll stakes
  contestPnlCents: number;  // contest payouts - buy-ins
  marketPnlCents: number;   // market position P&L
  netBalanceCents: number;   // computed
}

export interface Transfer {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amountCents: number;
}

export interface SettlementResult {
  transfers: Transfer[];
  totalPoolDepositedCents: number;
  totalPoolWithdrawnCents: number;
  totalPoolPnlCents: number;
  totalOwedCents: number;
  roundingAdjustmentCents: number;
  allSettled: boolean;
}

/**
 * Compute net balance for each user.
 * netBalance = deposited - withdrawn + pollPnl + contestPnl + marketPnl
 * Positive = owed money (creditor), Negative = owes money (debtor)
 */
export function computeNetBalances(users: Omit<UserBalance, 'netBalanceCents'>[]): UserBalance[] {
  return users.map(u => ({
    ...u,
    netBalanceCents: u.depositedCents - u.withdrawnCents + u.pollPnlCents + u.contestPnlCents + u.marketPnlCents,
  }));
}

/**
 * Given a list of user balances, compute the minimum set of transfers
 * to settle all debts using a greedy two-pointer approach.
 */
export function computeSimplifiedDebts(balances: UserBalance[]): SettlementResult {
  const totalPoolDepositedCents = balances.reduce((s, b) => s + b.depositedCents, 0);
  const totalPoolWithdrawnCents = balances.reduce((s, b) => s + b.withdrawnCents, 0);
  const totalPoolPnlCents = balances.reduce((s, b) => s + b.pollPnlCents + b.contestPnlCents + b.marketPnlCents, 0);

  // Clone balances for mutation
  const nets = balances.map(b => ({ userId: b.userId, name: b.name, amountCents: b.netBalanceCents }));

  // Fix rounding: sum should be 0
  const totalNet = nets.reduce((s, n) => s + n.amountCents, 0);
  let roundingAdjustmentCents = 0;

  if (totalNet !== 0) {
    roundingAdjustmentCents = totalNet;
    // Adjust the largest creditor (or debtor) to absorb the difference
    if (totalNet > 0) {
      // Too much credit — reduce largest creditor
      const sorted = [...nets].sort((a, b) => b.amountCents - a.amountCents);
      const target = nets.find(n => n.userId === sorted[0].userId);
      if (target) target.amountCents -= totalNet;
    } else {
      // Too much debt — reduce largest debtor
      const sorted = [...nets].sort((a, b) => a.amountCents - b.amountCents);
      const target = nets.find(n => n.userId === sorted[0].userId);
      if (target) target.amountCents -= totalNet; // subtracting negative = adding
    }
  }

  // Split into creditors and debtors
  const creditors = nets
    .filter(n => n.amountCents > 0)
    .map(n => ({ ...n }))
    .sort((a, b) => b.amountCents - a.amountCents);

  const debtors = nets
    .filter(n => n.amountCents < 0)
    .map(n => ({ ...n, amountCents: -n.amountCents })) // make positive
    .sort((a, b) => b.amountCents - a.amountCents);

  const totalOwedCents = creditors.reduce((s, c) => s + c.amountCents, 0);

  if (creditors.length === 0 && debtors.length === 0) {
    return {
      transfers: [],
      totalPoolDepositedCents,
      totalPoolWithdrawnCents,
      totalPoolPnlCents,
      totalOwedCents: 0,
      roundingAdjustmentCents,
      allSettled: true,
    };
  }

  // Two-pointer settlement
  const transfers: Transfer[] = [];
  let i = 0; // debtors pointer
  let j = 0; // creditors pointer

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amountCents, creditors[j].amountCents);
    if (pay > 0) {
      transfers.push({
        fromUserId: debtors[i].userId,
        fromName: debtors[i].name,
        toUserId: creditors[j].userId,
        toName: creditors[j].name,
        amountCents: pay,
      });
    }
    debtors[i].amountCents -= pay;
    creditors[j].amountCents -= pay;
    if (debtors[i].amountCents === 0) i++;
    if (creditors[j].amountCents === 0) j++;
  }

  return {
    transfers,
    totalPoolDepositedCents,
    totalPoolWithdrawnCents,
    totalPoolPnlCents,
    totalOwedCents,
    roundingAdjustmentCents,
    allSettled: transfers.length === 0,
  };
}

/**
 * Format cents as currency string (e.g. 2350 -> "$23.50")
 */
export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toFixed(2);
  // Remove trailing zeros for whole numbers
  const formatted = parseFloat(dollars).toFixed(2);
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Convert a dollar amount to cents (integer)
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}
