import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OrderBookLevel {
  price: number;
  quantity: number;
}

interface OrderBookState {
  yes: OrderBookLevel[];
  no: OrderBookLevel[];
}

interface UseRealtimeOrderBookOptions {
  marketId: string;
  userId?: string;
  debounceMs?: number;
}

/**
 * High-performance realtime order book hook with:
 * - Debounced updates to prevent UI thrashing
 * - Optimistic updates for user's own orders
 * - Efficient aggregation using the database view
 */
export function useRealtimeOrderBook({ 
  marketId, 
  userId,
  debounceMs = 100 
}: UseRealtimeOrderBookOptions) {
  const [orderBook, setOrderBook] = useState<OrderBookState>({ yes: [], no: [] });
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchOrderBook = useCallback(async (force = false) => {
    // Debounce rapid fetches (within debounceMs)
    const now = Date.now();
    if (!force && now - lastFetchRef.current < debounceMs) {
      // Schedule a fetch for later if not already scheduled
      if (!debounceRef.current) {
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          fetchOrderBook(true);
        }, debounceMs);
      }
      return;
    }
    
    lastFetchRef.current = now;

    // Use RPC function to get aggregated order book (bypasses RLS for all users)
    const { data: aggregatedData, error } = await supabase
      .rpc('get_order_book_aggregated', { market_ids: [marketId] });

    if (error) {
      console.error('Error fetching order book:', error);
      return;
    }

    const yesLevels: OrderBookLevel[] = [];
    const noLevels: OrderBookLevel[] = [];

    for (const row of aggregatedData || []) {
      if (row.total_quantity > 0 && row.price !== null) {
        const level = { 
          price: Number(row.price), 
          quantity: Number(row.total_quantity) 
        };
        if (row.side === 'yes') {
          yesLevels.push(level);
        } else {
          noLevels.push(level);
        }
      }
    }

    // Sort: highest price first
    yesLevels.sort((a, b) => b.price - a.price);
    noLevels.sort((a, b) => b.price - a.price);

    setOrderBook({
      yes: yesLevels.slice(0, 10),
      no: noLevels.slice(0, 10)
    });
    setLoading(false);
  }, [marketId, debounceMs]);

  /**
   * Optimistically add an order to the local order book
   * (Called immediately when user places an order, before server confirms)
   */
  const addOptimisticOrder = useCallback((side: 'yes' | 'no', price: number, quantity: number) => {
    setOrderBook(prev => {
      const targetSide = side === 'yes' ? 'yes' : 'no';
      const levels = [...prev[targetSide]];
      
      // Find existing level at this price
      const existingIndex = levels.findIndex(l => 
        Math.abs(l.price - price) < 0.001
      );
      
      if (existingIndex >= 0) {
        levels[existingIndex] = {
          ...levels[existingIndex],
          quantity: levels[existingIndex].quantity + quantity
        };
      } else {
        levels.push({ price, quantity });
        levels.sort((a, b) => b.price - a.price);
      }
      
      return {
        ...prev,
        [targetSide]: levels.slice(0, 10)
      };
    });
  }, []);

  /**
   * Remove an optimistic order (e.g., when cancelled)
   */
  const removeOptimisticOrder = useCallback((side: 'yes' | 'no', price: number, quantity: number) => {
    setOrderBook(prev => {
      const targetSide = side === 'yes' ? 'yes' : 'no';
      const levels = prev[targetSide].map(l => {
        if (Math.abs(l.price - price) < 0.001) {
          return { ...l, quantity: Math.max(0, l.quantity - quantity) };
        }
        return l;
      }).filter(l => l.quantity > 0);
      
      return {
        ...prev,
        [targetSide]: levels
      };
    });
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchOrderBook(true);

    // Subscribe to realtime updates with specific event handling
    const channel = supabase
      .channel(`realtime-orderbook-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `market_id=eq.${marketId}`
        },
        (payload) => {
          // For inserts from other users, fetch immediately
          if (payload.new && (payload.new as any).user_id !== userId) {
            fetchOrderBook();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `market_id=eq.${marketId}`
        },
        () => {
          // Updates (fills, cancellations) - always refresh
          fetchOrderBook();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'orders',
          filter: `market_id=eq.${marketId}`
        },
        () => {
          fetchOrderBook();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [marketId, userId, fetchOrderBook]);

  return {
    orderBook,
    loading,
    isConnected,
    refetch: () => fetchOrderBook(true),
    addOptimisticOrder,
    removeOptimisticOrder
  };
}
