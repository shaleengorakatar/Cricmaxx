/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import {
  computeNetBalances,
  computeSimplifiedDebts,
  formatCents,
  toCents,
  type UserBalance,
} from '../settlementAlgorithm';

describe('toCents', () => {
  it('converts dollars to cents', () => {
    expect(toCents(23.50)).toBe(2350);
    expect(toCents(0)).toBe(0);
    expect(toCents(100)).toBe(10000);
    expect(toCents(0.01)).toBe(1);
  });
});

describe('formatCents', () => {
  it('formats positive cents', () => {
    expect(formatCents(2350)).toBe('$23.50');
    expect(formatCents(100)).toBe('$1.00');
    expect(formatCents(0)).toBe('$0.00');
  });
  it('formats negative cents', () => {
    expect(formatCents(-500)).toBe('-$5.00');
  });
});

describe('computeNetBalances', () => {
  it('computes net correctly', () => {
    const users = [
      { userId: 'a', name: 'Alice', depositedCents: 5000, withdrawnCents: 0, pollPnlCents: 1000, contestPnlCents: 0, marketPnlCents: 0 },
      { userId: 'b', name: 'Bob', depositedCents: 3000, withdrawnCents: 1000, pollPnlCents: -500, contestPnlCents: 0, marketPnlCents: 0 },
    ];
    const result = computeNetBalances(users);
    expect(result[0].netBalanceCents).toBe(6000); // 5000 - 0 + 1000
    expect(result[1].netBalanceCents).toBe(1500); // 3000 - 1000 - 500
  });
});

describe('computeSimplifiedDebts', () => {
  it('returns all settled when balances are zero', () => {
    const balances: UserBalance[] = [
      { userId: 'a', name: 'Alice', depositedCents: 1000, withdrawnCents: 1000, pollPnlCents: 0, contestPnlCents: 0, marketPnlCents: 0, netBalanceCents: 0 },
      { userId: 'b', name: 'Bob', depositedCents: 2000, withdrawnCents: 2000, pollPnlCents: 0, contestPnlCents: 0, marketPnlCents: 0, netBalanceCents: 0 },
    ];
    const result = computeSimplifiedDebts(balances);
    expect(result.allSettled).toBe(true);
    expect(result.transfers).toHaveLength(0);
  });

  it('settles 3 users correctly', () => {
    // Alice is owed $30, Bob owes $20, Charlie owes $10
    const balances: UserBalance[] = [
      { userId: 'a', name: 'Alice', depositedCents: 5000, withdrawnCents: 0, pollPnlCents: -2000, contestPnlCents: 0, marketPnlCents: 0, netBalanceCents: 3000 },
      { userId: 'b', name: 'Bob', depositedCents: 1000, withdrawnCents: 0, pollPnlCents: -3000, contestPnlCents: 0, marketPnlCents: 0, netBalanceCents: -2000 },
      { userId: 'c', name: 'Charlie', depositedCents: 500, withdrawnCents: 0, pollPnlCents: -1500, contestPnlCents: 0, marketPnlCents: 0, netBalanceCents: -1000 },
    ];
    const result = computeSimplifiedDebts(balances);
    expect(result.allSettled).toBe(false);
    expect(result.transfers.length).toBeLessThanOrEqual(2);
    // Total transferred should equal 3000
    const totalTransferred = result.transfers.reduce((s, t) => s + t.amountCents, 0);
    expect(totalTransferred).toBe(3000);
  });

  it('settles 5 users with mixed balances', () => {
    const balances: UserBalance[] = [
      { userId: 'a', name: 'Alex', depositedCents: 10000, withdrawnCents: 2000, pollPnlCents: -1000, contestPnlCents: 500, marketPnlCents: 0, netBalanceCents: 7500 },
      { userId: 'b', name: 'Sam', depositedCents: 5000, withdrawnCents: 1000, pollPnlCents: 2000, contestPnlCents: 0, marketPnlCents: -500, netBalanceCents: 5500 },
      { userId: 'c', name: 'Jordan', depositedCents: 3000, withdrawnCents: 0, pollPnlCents: -5000, contestPnlCents: -1000, marketPnlCents: 0, netBalanceCents: -3000 },
      { userId: 'd', name: 'Priya', depositedCents: 2000, withdrawnCents: 500, pollPnlCents: -3000, contestPnlCents: -2000, marketPnlCents: 0, netBalanceCents: -3500 },
      { userId: 'e', name: 'Kim', depositedCents: 8000, withdrawnCents: 0, pollPnlCents: -2000, contestPnlCents: -1500, marketPnlCents: 0, netBalanceCents: -6500 }, // this doesn't sum to 0 with others
    ];

    // Recalculate to ensure sum = 0
    // a: 7500, b: 5500, c: -3000, d: -3500, e: -6500 => sum = 0 ✓
    const result = computeSimplifiedDebts(balances);
    const totalCredits = result.transfers.reduce((s, t) => s + t.amountCents, 0);
    expect(totalCredits).toBe(13000); // total owed = 7500 + 5500
    // All debts settled
    expect(result.transfers.length).toBeLessThanOrEqual(4); // min transfers
  });

  it('handles rounding adjustment', () => {
    const balances: UserBalance[] = [
      { userId: 'a', name: 'Alice', depositedCents: 1001, withdrawnCents: 0, pollPnlCents: 0, contestPnlCents: 0, marketPnlCents: 0, netBalanceCents: 1001 },
      { userId: 'b', name: 'Bob', depositedCents: 0, withdrawnCents: 0, pollPnlCents: -1000, contestPnlCents: 0, marketPnlCents: 0, netBalanceCents: -1000 },
    ];
    // Sum = 1, so rounding adjustment needed
    const result = computeSimplifiedDebts(balances);
    expect(result.roundingAdjustmentCents).toBe(1);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0].amountCents).toBe(1000);
  });
});
