import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';

interface MarketPrices {
  id: string;
  yes_price: number;
  no_price: number;
  volume: number;
  pool_yes_shares: number;
  pool_no_shares: number;
  status: string;
  updated_at: string;
}

interface Trade {
  id: string;
  market_id: string;
  price: number;
  quantity: number;
  buyer_side: string;
  created_at: string;
}

interface OrderUpdate {
  id: string;
  market_id: string;
  side: string;
  price: number;
  quantity: number;
  filled_quantity: number;
  status: string;
}

// Hook for real-time market price updates
export function useRealtimeMarketPrices(marketId: string | undefined) {
  const [prices, setPrices] = useState<MarketPrices | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!marketId) return;

    // Fetch initial data
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('markets')
        .select('id, yes_price, no_price, volume, pool_yes_shares, pool_no_shares, status, updated_at')
        .eq('id', marketId)
        .single();
      
      if (data) {
        setPrices(data);
      }
    };

    fetchInitial();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`market-prices-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
          filter: `id=eq.${marketId}`,
        },
        (payload) => {
          const newData = payload.new as MarketPrices;
          setPrices(newData);
          
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: ['cached-market-prices', marketId] });
          queryClient.invalidateQueries({ queryKey: ['optimized-market-detail', marketId] });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [marketId, queryClient]);

  return { prices, isConnected };
}

// Hook for real-time trade feed
export function useRealtimeTrades(marketId: string | undefined, limit = 20) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!marketId) return;

    // Fetch initial trades
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('trades')
        .select('id, market_id, price, quantity, buyer_side, created_at')
        .eq('market_id', marketId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (data) {
        setTrades(data);
      }
    };

    fetchInitial();

    // Subscribe to new trades
    const channel = supabase
      .channel(`trades-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trades',
          filter: `market_id=eq.${marketId}`,
        },
        (payload) => {
          const newTrade = payload.new as Trade;
          setTrades((prev) => [newTrade, ...prev.slice(0, limit - 1)]);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [marketId, limit]);

  return { trades, isConnected };
}

// Hook for real-time order book updates
export function useRealtimeOrderBook(marketId: string | undefined) {
  const [orderUpdates, setOrderUpdates] = useState<OrderUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!marketId) return;

    // Subscribe to order changes
    const channel = supabase
      .channel(`orders-${marketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `market_id=eq.${marketId}`,
        },
        (payload) => {
          const order = (payload.new || payload.old) as OrderUpdate;
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setOrderUpdates((prev) => {
              const filtered = prev.filter((o) => o.id !== order.id);
              return [order, ...filtered].slice(0, 50);
            });
          }

          // Invalidate order-related queries
          queryClient.invalidateQueries({ queryKey: ['optimized-market-detail', marketId] });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [marketId, queryClient]);

  return { orderUpdates, isConnected };
}

// Hook for subscribing to multiple markets (for market list)
export function useRealtimeMarketsList(marketIds: string[]) {
  const [priceUpdates, setPriceUpdates] = useState<Map<string, MarketPrices>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (marketIds.length === 0) return;

    // Subscribe to all market updates
    const channel = supabase
      .channel('markets-list-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
        },
        (payload) => {
          const newData = payload.new as MarketPrices;
          
          if (marketIds.includes(newData.id)) {
            setPriceUpdates((prev) => {
              const updated = new Map(prev);
              updated.set(newData.id, newData);
              return updated;
            });

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['cached-market-prices', newData.id] });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [marketIds.join(','), queryClient]);

  const getPrice = useCallback((marketId: string) => {
    return priceUpdates.get(marketId);
  }, [priceUpdates]);

  return { priceUpdates, getPrice, isConnected };
}

// Hook for real-time user position updates
export function useRealtimeUserPositions(userId: string | undefined) {
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-positions-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'positions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Invalidate user-related queries
          queryClient.invalidateQueries({ queryKey: ['optimized-dashboard', userId] });
          queryClient.invalidateQueries({ queryKey: ['batch-positions'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['optimized-dashboard', userId] });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, queryClient]);

  return { isConnected };
}
