import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Market } from "@/types/market";
import { getMarketDateRange, ACTIVE_MARKET_STATUSES, shouldShowMarket } from "@/lib/marketFilters";

export interface UserPosition {
  side: string;
  size: number;
  entryPrice: number;
}

interface UseMarketsResult {
  markets: Market[];
  userPositions: Map<string, UserPosition>;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

export function useMarkets(userId: string | null): UseMarketsResult {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [userPositions, setUserPositions] = useState<Map<string, UserPosition>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const isMountedRef = useRef(true);
  const fetchCountRef = useRef(0);

  const fetchMarkets = useCallback(async () => {
    const currentFetch = ++fetchCountRef.current;
    
    // Don't reset loading on refetch to avoid flickering
    if (fetchCountRef.current === 1) {
      setLoading(true);
    }
    setError(false);

    const { now, maxExpiry } = getMarketDateRange();

    try {
      const { data, error: fetchError } = await supabase
        .from("markets")
        .select("*")
        .in("status", [...ACTIVE_MARKET_STATUSES])
        .lte("expiry_time", maxExpiry.toISOString())
        .gte("expiry_time", now.toISOString())
        .order("created_at", { ascending: false });

      // Ignore stale responses
      if (!isMountedRef.current || currentFetch !== fetchCountRef.current) {
        return;
      }

      if (fetchError) {
        console.error("Error fetching markets:", fetchError);
        setError(true);
        setLoading(false);
        return;
      }

      const formattedMarkets: Market[] = (data || []).map((m: any) => ({
        id: m.id,
        question: m.question,
        category: m.category as Market["category"],
        type: m.type as Market["type"],
        yesPrice: Number(m.yes_price),
        noPrice: Number(m.no_price),
        volume: Number(m.volume),
        expiryTime: m.expiry_time,
        description: m.description || "",
        imageUrl: m.image_url || "",
      }));

      setMarkets(formattedMarkets);
      setError(false);
      setLoading(false);
    } catch (err) {
      if (isMountedRef.current && currentFetch === fetchCountRef.current) {
        console.error("Fetch error:", err);
        setError(true);
        setLoading(false);
      }
    }
  }, []);

  const fetchUserPositions = useCallback(async () => {
    if (!userId) {
      setUserPositions(new Map());
      return;
    }

    try {
      const { data: positions } = await supabase
        .from("positions")
        .select("market_id, side, size, entry_price")
        .eq("user_id", userId)
        .eq("status", "open");

      if (!isMountedRef.current) return;

      if (positions && positions.length > 0) {
        const positionsMap = new Map<string, UserPosition>();
        positions.forEach((p) => {
          positionsMap.set(p.market_id, {
            side: p.side,
            size: Number(p.size),
            entryPrice: Number(p.entry_price),
          });
        });
        setUserPositions(positionsMap);
      } else {
        setUserPositions(new Map());
      }
    } catch (err) {
      console.error("Error fetching positions:", err);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchMarkets();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchMarkets]);

  // Fetch positions when userId changes
  useEffect(() => {
    fetchUserPositions();
  }, [fetchUserPositions]);

  // Real-time subscription for market updates
  useEffect(() => {
    const channel = supabase
      .channel("markets-list-hook")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "markets",
        },
        (payload) => {
          if (!isMountedRef.current) return;

          if (payload.eventType === "INSERT") {
            const data = payload.new as any;
            if (shouldShowMarket(data.status, data.expiry_time)) {
              const newMarket: Market = {
                id: data.id,
                question: data.question,
                category: data.category as Market["category"],
                type: data.type as Market["type"],
                yesPrice: Number(data.yes_price),
                noPrice: Number(data.no_price),
                volume: Number(data.volume),
                expiryTime: data.expiry_time,
                description: data.description || "",
                imageUrl: data.image_url || "",
              };
              setMarkets((prev) => [newMarket, ...prev]);
            }
          } else if (payload.eventType === "UPDATE") {
            const data = payload.new as any;
            setMarkets((prev) =>
              prev.map((m) =>
                m.id === data.id
                  ? {
                      ...m,
                      yesPrice: Number(data.yes_price),
                      noPrice: Number(data.no_price),
                      volume: Number(data.volume),
                      question: data.question,
                      category: data.category as Market["category"],
                    }
                  : m
              )
            );
          } else if (payload.eventType === "DELETE") {
            setMarkets((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    markets,
    userPositions,
    loading,
    error,
    refetch: fetchMarkets,
  };
}
