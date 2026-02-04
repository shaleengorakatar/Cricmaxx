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
  
  // Refs for preventing stale closure issues
  const isMounted = useRef(true);
  const fetchIdRef = useRef(0);
  const lastFetchTimeRef = useRef(0);
  const userIdRef = useRef(userId);
  const loadingRef = useRef(true);
  const marketsRef = useRef<Market[]>([]);

  // Keep refs in sync
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  
  useEffect(() => {
    marketsRef.current = markets;
  }, [markets]);

  const fetchMarkets = useCallback(async () => {
    // Debounce rapid calls - but always ensure loading gets set to false
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 500) {
      // Still debouncing, but if we're stuck loading with data, force it off
      if (loadingRef.current && marketsRef.current.length > 0) {
        setLoading(false);
      }
      return;
    }
    lastFetchTimeRef.current = now;
    
    // Increment fetch ID to track stale responses
    const thisFetchId = ++fetchIdRef.current;
    
    setError(null);
    
    try {
      // Filter to show markets expiring within next 60 days, ordered by volume
      const nowDate = new Date();
      const sixtyDaysFromNow = new Date(nowDate.getTime() + 60 * 24 * 60 * 60 * 1000);
      
      const query = supabase
        .from('markets')
        .select('*')
        .in('status', ['approved', 'open'])
        .lte('expiry_time', sixtyDaysFromNow.toISOString())
        .gte('expiry_time', nowDate.toISOString())
        .order('volume', { ascending: false });
      
      const { data, error: fetchError } = await query;
      
      // Check if this response is stale
      if (thisFetchId !== fetchIdRef.current || !isMounted.current) {
        // Stale response - but ensure loading state is cleared if this was the only pending request
        return;
      }
      
      if (fetchError) {
        // Check for auth errors
        const isAuthError = fetchError.message?.toLowerCase().includes('jwt') ||
                           fetchError.message?.toLowerCase().includes('token') ||
                           fetchError.code === 'PGRST301';
        
        if (isAuthError) {
          console.warn('Auth error in markets fetch - will retry after session refresh');
          setError('Session issue. Refreshing...');
          // CRITICAL: Set loading to false to prevent infinite loading state
          setLoading(false);
          // Schedule retry after short delay
          setTimeout(() => {
            if (isMounted.current) {
              setLoading(true);
              fetchMarkets();
            }
          }, 3000);
        } else {
          throw fetchError;
        }
        return;
      }
      
      // Transform database format to Market type
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
      }));
      
      setMarkets(transformedMarkets);
      
      // Fetch user positions if userId is available
      const currentUserId = userIdRef.current;
      if (currentUserId && transformedMarkets.length > 0) {
        const marketIds = transformedMarkets.map(m => m.id);
        
        const { data: positionsData, error: positionsError } = await supabase
          .from('positions')
          .select('market_id, side, size, entry_price')
          .eq('user_id', currentUserId)
          .eq('status', 'open')
          .in('market_id', marketIds);
        
        // Check if still mounted and not stale
        if (thisFetchId !== fetchIdRef.current || !isMounted.current) {
          // Even if stale, we already set markets - just set loading false
          setLoading(false);
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
      } else {
        setUserPositions(new Map());
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching markets:', err);
      if (isMounted.current && fetchIdRef.current === thisFetchId) {
        setError(err.message || 'Failed to load markets');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchMarkets();
    
    // Set up periodic refresh (every 5 minutes)
    const intervalId = setInterval(fetchMarkets, 5 * 60 * 1000);
    
    return () => {
      isMounted.current = false;
      clearInterval(intervalId);
    };
  }, [fetchMarkets, userId]);

  return {
    markets,
    userPositions,
    loading,
    error,
    refetch: fetchMarkets
  };
}
