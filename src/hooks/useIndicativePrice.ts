import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IndicativePriceResult {
  yesPrice: number;
  noPrice: number;
  source: "last_trade" | "book_midpoint" | "default";
  hasLiquidity: { yes: boolean; no: boolean };
  loading: boolean;
}

/**
 * Calculates indicative prices following Kalshi-style logic:
 * 1. Last traded price (if trades exist)
 * 2. Midpoint of best bid/ask from order book (if orders exist)
 * 3. Default 50¢ anchor (if market is completely empty)
 */
export function useIndicativePrice(marketId: string): IndicativePriceResult {
  const [result, setResult] = useState<IndicativePriceResult>({
    yesPrice: 0.5,
    noPrice: 0.5,
    source: "default",
    hasLiquidity: { yes: false, no: false },
    loading: true,
  });

  const fetchPrices = useCallback(async () => {
    // Fetch in parallel: last trade, market stored price, and order book
    const [tradesResult, marketResult, orderBookResult] = await Promise.all([
      // Get most recent trade for this market
      supabase
        .from("trades")
        .select("price, buyer_side, created_at")
        .eq("market_id", marketId)
        .order("created_at", { ascending: false })
        .limit(1),
      
      // Get stored market prices (fallback)
      supabase
        .from("markets")
        .select("yes_price, no_price")
        .eq("id", marketId)
        .single(),
      
      // Get order book for midpoint calculation
      supabase
        .from("order_book_aggregated")
        .select("side, price, total_quantity")
        .eq("market_id", marketId),
    ]);

    const lastTrade = tradesResult.data?.[0];
    const marketData = marketResult.data;
    const orderBook = orderBookResult.data || [];

    // Process order book to find best bids
    let bestYesBid: number | null = null;
    let bestNoBid: number | null = null;

    for (const row of orderBook) {
      const price = Number(row.price);
      if (row.side === "yes") {
        if (bestYesBid === null || price > bestYesBid) {
          bestYesBid = price;
        }
      } else {
        if (bestNoBid === null || price > bestNoBid) {
          bestNoBid = price;
        }
      }
    }

    const hasYesLiquidity = bestNoBid !== null; // Can buy YES if NO bids exist
    const hasNoLiquidity = bestYesBid !== null;  // Can buy NO if YES bids exist

    // Priority 1: Last traded price
    if (lastTrade) {
      // Last trade price is the YES price if buyer bought YES, otherwise derive
      let yesPrice: number;
      if (lastTrade.buyer_side === "yes") {
        yesPrice = Number(lastTrade.price);
      } else {
        // Buyer bought NO at price X, so YES price is 1 - X
        yesPrice = 1 - Number(lastTrade.price);
      }
      
      setResult({
        yesPrice: Math.max(0.01, Math.min(0.99, yesPrice)),
        noPrice: Math.max(0.01, Math.min(0.99, 1 - yesPrice)),
        source: "last_trade",
        hasLiquidity: { yes: hasYesLiquidity, no: hasNoLiquidity },
        loading: false,
      });
      return;
    }

    // Priority 2: Order book midpoint
    if (bestYesBid !== null || bestNoBid !== null) {
      // Calculate implied YES ask (from NO bids) and YES bid
      const impliedYesAsk = bestNoBid !== null ? 1 - bestNoBid : null;
      
      let yesPrice: number;
      
      if (bestYesBid !== null && impliedYesAsk !== null) {
        // Midpoint between best YES bid and implied YES ask
        yesPrice = (bestYesBid + impliedYesAsk) / 2;
      } else if (impliedYesAsk !== null) {
        // Only NO bids exist - use implied ask as reference
        yesPrice = impliedYesAsk;
      } else if (bestYesBid !== null) {
        // Only YES bids exist - use YES bid as reference
        yesPrice = bestYesBid;
      } else {
        yesPrice = 0.5; // Fallback
      }

      setResult({
        yesPrice: Math.max(0.01, Math.min(0.99, yesPrice)),
        noPrice: Math.max(0.01, Math.min(0.99, 1 - yesPrice)),
        source: "book_midpoint",
        hasLiquidity: { yes: hasYesLiquidity, no: hasNoLiquidity },
        loading: false,
      });
      return;
    }

    // Priority 3: Default anchor OR stored market price
    const storedYes = marketData?.yes_price ? Number(marketData.yes_price) : 0.5;
    
    setResult({
      yesPrice: storedYes,
      noPrice: 1 - storedYes,
      source: "default",
      hasLiquidity: { yes: false, no: false },
      loading: false,
    });
  }, [marketId]);

  useEffect(() => {
    fetchPrices();

    // Subscribe to order and trade changes
    const channel = supabase
      .channel(`indicative-price-${marketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `market_id=eq.${marketId}`,
        },
        () => fetchPrices()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trades",
          filter: `market_id=eq.${marketId}`,
        },
        () => fetchPrices()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, fetchPrices]);

  return result;
}
