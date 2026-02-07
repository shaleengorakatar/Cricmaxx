import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Rounds a YES/NO price pair so they always sum to 100¢.
 * Rounds YES first, then derives NO = 100 - YES.
 */
export function roundedPricePair(yesPrice: number, noPrice?: number): { yesCents: number; noCents: number } {
  const yesCents = Math.round((Number(yesPrice) || 0.5) * 100);
  return { yesCents, noCents: 100 - yesCents };
}
