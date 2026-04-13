import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Market, MarketCategory } from "@/types/market";

interface UserPosition {
  side: "yes" | "no";
  size: number;
  entryPrice: number;
}

interface UseMarketsResult {
  markets: Market[];
  userPositions: Map<string, UserPosition>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMarkets(userId: string | null): UseMarketsResult {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [userPositions, setUserPositions] = useState<Map<string, UserPosition>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const lastFetchTimeRef = useRef(0);

  const fetchMarkets = useCallback(async () => {
    // Debounce rapid calls - but ensure loading state is correct
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 500) {
      // If we're debouncing but still in initial loading state, don't return
      // This ensures the first call always goes through
      if (fetchIdRef.current > 0) {
        return;
      }
    }
    lastFetchTimeRef.current = now;
    
    const thisFetchId = ++fetchIdRef.current;
    
    // Always start with loading true
    setLoading(true);
    setError(null);
    
    try {
      const nowDate = new Date();
      const sixtyDaysFromNow = new Date(nowDate.getTime() + 60 * 24 * 60 * 60 * 1000);
      
      const { data, error: fetchError } = await supabase
        .from('markets')
        .select('*')
        .in('status', ['approved', 'open', 'resolved'])
        .order('volume', { ascending: false });
      
      // Check if stale or unmounted
      if (thisFetchId !== fetchIdRef.current || !isMountedRef.current) {
        return;
      }
      
      if (fetchError) {
        console.error('Markets fetch error:', fetchError);
        setError(fetchError.message || 'Failed to load markets');
        setLoading(false);
        return;
      }
      
      const transformedMarkets: Market[] = (data || []).map(m => ({
        id: m.id,
        question: m.question,
        category: m.category as MarketCategory,
        type: m.type as "orderbook",
        yesPrice: Number(m.yes_price),
        noPrice: Number(m.no_price),
        volume: Number(m.volume),
        expiryTime: m.expiry_time,
        description: m.description || undefined,
        imageUrl: m.image_url || undefined,
        status: m.status,
        outcome: m.outcome,
      }));
      
      setMarkets(transformedMarkets);
      
      // Fetch user positions if we have a userId and markets
      if (userId && transformedMarkets.length > 0) {
        try {
          const marketIds = transformedMarkets.map(m => m.id);
          
          const { data: positionsData, error: positionsError } = await supabase
            .from('positions')
            .select('market_id, side, size, entry_price')
            .eq('user_id', userId)
            .eq('status', 'open')
            .in('market_id', marketIds);
          
          if (!isMountedRef.current || thisFetchId !== fetchIdRef.current) {
            return;
          }
          
          if (!positionsError && positionsData) {
            const positionsMap = new Map<string, UserPosition>();
            positionsData.forEach(p => {
              positionsMap.set(p.market_id, {
                side: p.side as "yes" | "no",
                size: Number(p.size),
                entryPrice: Number(p.entry_price),
              });
            });
            setUserPositions(positionsMap);
          }
        } catch (posErr) {
          // Positions fetch failed - not critical, continue without them
          console.warn('Positions fetch failed:', posErr);
        }
      } else {
        setUserPositions(new Map());
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching markets:', err);
      if (isMountedRef.current && fetchIdRef.current === thisFetchId) {
        setError(err.message || 'Failed to load markets');
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchMarkets();
    
    // Periodic refresh
    const intervalId = setInterval(fetchMarkets, 5 * 60 * 1000);
    
    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchMarkets]);

  return {
    markets,
    userPositions,
    loading,
    error,
    refetch: fetchMarkets
  };
}
