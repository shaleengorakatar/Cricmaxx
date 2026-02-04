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

// Direct REST API fetch that bypasses auth headers for public data
async function fetchMarketsDirectly(): Promise<any[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const { now, maxExpiry } = getMarketDateRange();
  
  // Build the query URL with filters
  const params = new URLSearchParams({
    select: '*',
    status: `in.(${ACTIVE_MARKET_STATUSES.join(',')})`,
    expiry_time: `gte.${now.toISOString()}`,
    order: 'created_at.desc'
  });
  
  // Add expiry_time lte filter separately  
  const url = `${supabaseUrl}/rest/v1/markets?${params.toString()}&expiry_time=lte.${maxExpiry.toISOString()}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json',
      // No Authorization header - use anon key only for public data
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.status}`);
  }
  
  return response.json();
}

export function useMarkets(userId: string | null): UseMarketsResult {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [userPositions, setUserPositions] = useState<Map<string, UserPosition>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const isMountedRef = useRef(true);
  const fetchCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMarkets = useCallback(async (isRetry = false) => {
    const currentFetch = ++fetchCountRef.current;
    
    // Don't reset loading on refetch to avoid flickering
    if (fetchCountRef.current === 1) {
      setLoading(true);
    }
    setError(false);

    try {
      // Try direct REST API first (bypasses auth issues)
      const data = await fetchMarketsDirectly();

      // Ignore stale responses
      if (!isMountedRef.current || currentFetch !== fetchCountRef.current) {
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
      
      // Clear any pending retry
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    } catch (err) {
      if (isMountedRef.current && currentFetch === fetchCountRef.current) {
        console.error("Fetch error:", err);
        
        // Auto-retry once after 2 seconds if not already a retry
        if (!isRetry) {
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              fetchMarkets(true);
            }
          }, 2000);
        } else {
          setError(true);
          setLoading(false);
        }
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
    
    // Periodic refresh every 5 minutes to keep data fresh
    const refreshInterval = setInterval(() => {
      if (isMountedRef.current && document.visibilityState === 'visible') {
        fetchMarkets();
      }
    }, 5 * 60 * 1000);
    
    return () => {
      isMountedRef.current = false;
      clearInterval(refreshInterval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
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
