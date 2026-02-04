import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IndicativePrice {
  yesPrice: number;
  noPrice: number;
  source: "last_trade" | "book_midpoint" | "default";
}

/**
 * Batch fetches indicative prices for multiple markets at once.
 */
export function useBatchIndicativePrices(marketIds: string[]) {
  const [prices, setPrices] = useState<Map<string, IndicativePrice>>(new Map());
  const [loading, setLoading] = useState(true);
  
  const isMountedRef = useRef(true);
  const marketIdsKeyRef = useRef(marketIds.join(","));
  
  // Update ref when marketIds change
  useEffect(() => {
    marketIdsKeyRef.current = marketIds.join(",");
  }, [marketIds]);

  const fetchPrices = useCallback(async () => {
    const currentMarketIds = marketIdsKeyRef.current.split(",").filter(Boolean);
    
    if (currentMarketIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const [tradesResult, orderBookResult] = await Promise.all([
        supabase
          .from("trades")
          .select("market_id, price, buyer_side, created_at")
          .in("market_id", currentMarketIds)
          .order("created_at", { ascending: false }),
        
        supabase.rpc("get_order_book_aggregated", { market_ids: currentMarketIds }),
      ]);

      if (!isMountedRef.current) return;

      const trades = tradesResult.error ? [] : (tradesResult.data || []);
      const orderBook = orderBookResult.error ? [] : (orderBookResult.data || []);

      // Group last trade by market
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

        if (lastTrade) {
          let yesPrice = lastTrade.buyer_side === "yes" 
            ? lastTrade.price 
            : 1 - lastTrade.price;
          yesPrice = Math.max(0.01, Math.min(0.99, yesPrice));
          
          newPrices.set(marketId, {
            yesPrice,
            noPrice: 1 - yesPrice,
            source: "last_trade",
          });
          continue;
        }

        if (book && (book.yesBids.length > 0 || book.noBids.length > 0)) {
          const bestYesBid = book.yesBids.length > 0 ? Math.max(...book.yesBids) : null;
          const bestNoBid = book.noBids.length > 0 ? Math.max(...book.noBids) : null;
          const impliedYesAsk = bestNoBid !== null ? 1 - bestNoBid : null;
          
          let yesPrice: number;
          
          if (bestYesBid !== null && impliedYesAsk !== null) {
            yesPrice = (bestYesBid + impliedYesAsk) / 2;
          } else if (impliedYesAsk !== null) {
            yesPrice = impliedYesAsk;
          } else if (bestYesBid !== null) {
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

        newPrices.set(marketId, {
          yesPrice: 0.5,
          noPrice: 0.5,
          source: "default",
        });
      }

      setPrices(newPrices);
    } catch (err) {
      console.error('Error fetching indicative prices:', err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Memoize the market IDs key to prevent infinite loops
  const marketIdsKey = marketIds.join(",");
  
  useEffect(() => {
    isMountedRef.current = true;
    fetchPrices();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPrices, marketIdsKey]);

  return { prices, loading, refetch: fetchPrices };
}
