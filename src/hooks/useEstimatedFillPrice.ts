import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OrderLevel {
  price: number;
  quantity: number;
}

interface EstimatedFill {
  avgPrice: number;
  totalCost: number;
  filledQuantity: number;
  isPartialFill: boolean;
  priceImpact: number; // percentage difference from indicative
}

export function useEstimatedFillPrice(marketId: string) {
  const [yesOrders, setYesOrders] = useState<OrderLevel[]>([]);
  const [noOrders, setNoOrders] = useState<OrderLevel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    const { data: aggregatedData } = await supabase
      .from('order_book_aggregated')
      .select('side, price, total_quantity')
      .eq('market_id', marketId);

    // Convert to buy opportunities (same logic as OrderBook.tsx)
    const yesLevelsBuy: OrderLevel[] = [];
    const noLevelsBuy: OrderLevel[] = [];

    for (const row of aggregatedData || []) {
      const price = Number(row.price);
      const quantity = Number(row.total_quantity);
      
      if (row.side === 'yes') {
        // YES order at price X = you can BUY NO at (1-X)
        noLevelsBuy.push({ price: 1 - price, quantity });
      } else {
        // NO order at price Y = you can BUY YES at (1-Y)
        yesLevelsBuy.push({ price: 1 - price, quantity });
      }
    }

    // Aggregate same price levels
    const aggregateByPrice = (levels: OrderLevel[]): OrderLevel[] => {
      const priceMap = new Map<number, number>();
      for (const level of levels) {
        const roundedPrice = Math.round(level.price * 100) / 100;
        priceMap.set(roundedPrice, (priceMap.get(roundedPrice) || 0) + level.quantity);
      }
      return Array.from(priceMap.entries()).map(([price, quantity]) => ({ price, quantity }));
    };

    // Sort: lowest price first (best prices for buying)
    const sortedYes = aggregateByPrice(yesLevelsBuy).sort((a, b) => a.price - b.price);
    const sortedNo = aggregateByPrice(noLevelsBuy).sort((a, b) => a.price - b.price);

    setYesOrders(sortedYes);
    setNoOrders(sortedNo);
    setLoading(false);
  }, [marketId]);

  useEffect(() => {
    fetchOrders();

    // Subscribe to order book changes
    const channel = supabase
      .channel(`estimated-fill-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `market_id=eq.${marketId}`
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, fetchOrders]);

  /**
   * Calculate estimated fill price by walking through order book levels
   * @param side - "yes" or "no"
   * @param stakeAmount - dollar amount user wants to spend
   * @param indicativePrice - current displayed price
   */
  const calculateEstimatedFill = useCallback((
    side: "yes" | "no",
    stakeAmount: number,
    indicativePrice: number
  ): EstimatedFill | null => {
    const orders = side === "yes" ? yesOrders : noOrders;
    
    if (orders.length === 0) {
      return null; // No liquidity
    }

    let remainingBudget = stakeAmount;
    let totalSharesBought = 0;
    let weightedPriceSum = 0;

    for (const level of orders) {
      if (remainingBudget <= 0) break;

      const pricePerShare = level.price;
      const availableShares = level.quantity;
      const maxAffordableShares = remainingBudget / pricePerShare;
      const sharesToBuy = Math.min(availableShares, maxAffordableShares);
      const cost = sharesToBuy * pricePerShare;

      totalSharesBought += sharesToBuy;
      weightedPriceSum += sharesToBuy * pricePerShare;
      remainingBudget -= cost;
    }

    if (totalSharesBought === 0) {
      return null;
    }

    const avgPrice = weightedPriceSum / totalSharesBought;
    const totalCost = stakeAmount - remainingBudget;
    const priceImpact = ((avgPrice - indicativePrice) / indicativePrice) * 100;

    return {
      avgPrice,
      totalCost,
      filledQuantity: totalSharesBought,
      isPartialFill: remainingBudget > 0.01, // More than 1 cent remaining
      priceImpact,
    };
  }, [yesOrders, noOrders]);

  return {
    calculateEstimatedFill,
    hasLiquidity: {
      yes: yesOrders.length > 0,
      no: noOrders.length > 0,
    },
    loading,
  };
}
