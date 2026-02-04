import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IndicativePrice {
  yesPrice: number;
  noPrice: number;
  source: "last_trade" | "book_midpoint" | "default";
}

/**
 * Batch fetches indicative prices for multiple markets at once.
 * This is more efficient than calling useIndicativePrice for each market card.
 * 
 * Priority:
 * 1. Last traded price (if trades exist)
 * 2. Midpoint of best bid/ask from order book (if orders exist)
 * 3. Default stored price from markets table
 */
export function useBatchIndicativePrices(marketIds: string[]) {
  const [prices, setPrices] = useState<Map<string, IndicativePrice>>(new Map());
  const [loading, setLoading] = useState(true);
  
  // Stable string representation for dependency tracking
  const marketIdsKey = marketIds.join(",");
  
  // Use ref to access current marketIds in callback without stale closure
  const marketIdsRef = useRef(marketIds);
  marketIdsRef.current = marketIds;

  const fetchPrices = useCallback(async () => {
    const currentMarketIds = marketIdsRef.current;
    
    if (currentMarketIds.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch order book data using RPC function (bypasses RLS)
    // and trades (may fail for unauthenticated users due to RLS)
    const [tradesResult, orderBookResult] = await Promise.all([
      // Get most recent trade for each market - may fail for anonymous users
      supabase
        .from("trades")
        .select("market_id, price, buyer_side, created_at")
        .in("market_id", currentMarketIds)
        .order("created_at", { ascending: false }),
      
      // Use RPC function to get aggregated order book (security definer)
      supabase.rpc("get_order_book_aggregated", { market_ids: currentMarketIds }),
    ]);

    // Handle trades gracefully - may be empty due to RLS for anonymous users
    const trades = tradesResult.error ? [] : (tradesResult.data || []);
    const orderBook = orderBookResult.error ? [] : (orderBookResult.data || []);

    // Group last trade by market (first occurrence is most recent due to ordering)
    const lastTradeByMarket = new Map<string, { price: number; buyer_side: string }>();
    for (const trade of trades) {
      if (!lastTradeByMarket.has(trade.market_id)) {
        lastTradeByMarket.set(trade.market_id, {
          price: Number(trade.price),
          buyer_side: trade.buyer_side,
        });
      }
    }

    // Group order book by market
    const orderBookByMarket = new Map<string, { yesBids: number[]; noBids: number[] }>();
    for (const row of orderBook) {
      if (!orderBookByMarket.has(row.market_id)) {
        orderBookByMarket.set(row.market_id, { yesBids: [], noBids: [] });
      }
      const marketBook = orderBookByMarket.get(row.market_id)!;
      if (row.side === "yes") {
        marketBook.yesBids.push(Number(row.price));
      } else {
        marketBook.noBids.push(Number(row.price));
      }
    }

    // Calculate indicative price for each market
    const newPrices = new Map<string, IndicativePrice>();

    for (const marketId of currentMarketIds) {
      const lastTrade = lastTradeByMarket.get(marketId);
      const book = orderBookByMarket.get(marketId);

      // Priority 1: Last traded price
      if (lastTrade) {
        let yesPrice: number;
        if (lastTrade.buyer_side === "yes") {
          yesPrice = lastTrade.price;
        } else {
          yesPrice = 1 - lastTrade.price;
        }
        yesPrice = Math.max(0.01, Math.min(0.99, yesPrice));
        
        newPrices.set(marketId, {
          yesPrice,
          noPrice: 1 - yesPrice,
          source: "last_trade",
        });
        continue;
      }

      // Priority 2: Order book midpoint
      if (book && (book.yesBids.length > 0 || book.noBids.length > 0)) {
        const bestYesBid = book.yesBids.length > 0 ? Math.max(...book.yesBids) : null;
        const bestNoBid = book.noBids.length > 0 ? Math.max(...book.noBids) : null;
        
        // Implied YES ask = 1 - best NO bid
        const impliedYesAsk = bestNoBid !== null ? 1 - bestNoBid : null;
        
        let yesPrice: number;
        
        if (bestYesBid !== null && impliedYesAsk !== null) {
          // Midpoint between best YES bid and implied YES ask
          yesPrice = (bestYesBid + impliedYesAsk) / 2;
        } else if (impliedYesAsk !== null) {
          // Only NO bids exist - use implied ask
          yesPrice = impliedYesAsk;
        } else if (bestYesBid !== null) {
          // Only YES bids exist - use YES bid
          yesPrice = bestYesBid;
        } else {
          yesPrice = 0.5;
        }
        
        yesPrice = Math.max(0.01, Math.min(0.99, yesPrice));
        
        newPrices.set(marketId, {
          yesPrice,
          noPrice: 1 - yesPrice,
          source: "book_midpoint",
        });
        continue;
      }

      // Priority 3: Default (will use stored price from market)
      newPrices.set(marketId, {
        yesPrice: 0.5,
        noPrice: 0.5,
        source: "default",
      });
    }

    setPrices(newPrices);
    setLoading(false);
  }, [marketIdsKey]); // Use stable string key instead of join in array

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  return { prices, loading, refetch: fetchPrices };
}
