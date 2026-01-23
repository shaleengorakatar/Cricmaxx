import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface GlobalActivity {
  id: string;
  type: 'trade' | 'order' | 'market_update';
  market_id: string;
  market_question?: string;
  user_display?: string;
  side?: string;
  price: number;
  quantity?: number;
  timestamp: string;
}

interface TradePayload {
  id: string;
  market_id: string;
  price: number;
  quantity: number;
  buyer_side: string;
  created_at: string;
}

interface OrderPayload {
  id: string;
  market_id: string;
  side: string;
  price: number;
  quantity: number;
  status: string;
  created_at: string;
}

interface MarketPayload {
  id: string;
  question: string;
  yes_price: number;
  no_price: number;
  volume: number;
  updated_at: string;
}

export function useGlobalActivityFeed(limit = 50) {
  const [activities, setActivities] = useState<GlobalActivity[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [marketNames, setMarketNames] = useState<Map<string, string>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch market names for context
  useEffect(() => {
    const fetchMarketNames = async () => {
      const { data } = await supabase
        .from('markets')
        .select('id, question')
        .in('status', ['open', 'approved']);
      
      if (data) {
        const names = new Map<string, string>();
        data.forEach(m => names.set(m.id, m.question));
        setMarketNames(names);
      }
    };

    fetchMarketNames();
  }, []);

  // Fetch initial recent activity
  useEffect(() => {
    const fetchInitial = async () => {
      const { data: trades } = await supabase
        .from('trades')
        .select('id, market_id, price, quantity, buyer_side, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (trades) {
        const initial: GlobalActivity[] = trades.map(t => ({
          id: t.id,
          type: 'trade',
          market_id: t.market_id,
          side: t.buyer_side,
          price: Number(t.price),
          quantity: Number(t.quantity),
          timestamp: t.created_at,
        }));
        setActivities(initial);
      }
    };

    fetchInitial();
  }, [limit]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('global-activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trades',
        },
        (payload) => {
          const trade = payload.new as TradePayload;
          const activity: GlobalActivity = {
            id: trade.id,
            type: 'trade',
            market_id: trade.market_id,
            market_question: marketNames.get(trade.market_id),
            side: trade.buyer_side,
            price: Number(trade.price),
            quantity: Number(trade.quantity),
            timestamp: trade.created_at,
          };
          setActivities(prev => [activity, ...prev.slice(0, limit - 1)]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const order = payload.new as OrderPayload;
          if (order.status === 'pending' || order.status === 'open') {
            const activity: GlobalActivity = {
              id: order.id,
              type: 'order',
              market_id: order.market_id,
              market_question: marketNames.get(order.market_id),
              side: order.side,
              price: Number(order.price || 0),
              quantity: Number(order.quantity),
              timestamp: order.created_at,
            };
            setActivities(prev => [activity, ...prev.slice(0, limit - 1)]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
        },
        (payload) => {
          const market = payload.new as MarketPayload;
          const activity: GlobalActivity = {
            id: `market-${market.id}-${Date.now()}`,
            type: 'market_update',
            market_id: market.id,
            market_question: market.question,
            price: Number(market.yes_price),
            timestamp: market.updated_at,
          };
          setActivities(prev => [activity, ...prev.slice(0, limit - 1)]);
          
          // Update market names cache
          setMarketNames(prev => {
            const updated = new Map(prev);
            updated.set(market.id, market.question);
            return updated;
          });
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
  }, [limit, marketNames]);

  const getMarketName = (marketId: string) => {
    return marketNames.get(marketId) || 'Unknown Market';
  };

  return { activities, isConnected, getMarketName };
}
