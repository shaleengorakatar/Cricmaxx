export type MarketType = "orderbook" | "amm";
export type MarketCategory = "Cricket" | "Politics" | "Finance" | "Technology" | "Sports" | "Entertainment";

export interface Market {
  id: string;
  question: string;
  category: MarketCategory;
  type: MarketType;
  yesPrice: number;
  noPrice: number;
  volume: number;
  expiryTime: string;
  description?: string;
  imageUrl?: string;
  // Liquidity pool fields for AMM markets
  liquidityPool?: number;
  poolYesShares?: number;
  poolNoShares?: number;
}
