import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface LeaderboardEntry {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rating_score: number;
  predictions_total: number;
  predictions_correct: number;
  win_rate: number;
  rank: number;
}

interface MarketStats {
  market_id: string;
  question: string;
  category: string;
  status: string;
  yes_price: number;
  no_price: number;
  volume: number;
  unique_traders: number;
  total_orders: number;
  filled_volume: number;
}

interface UserDashboard {
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    balance: number;
    rating_score: number;
    predictions_total: number;
    predictions_correct: number;
    version: number;
  };
  positions: Array<{
    market_id: string;
    market_question: string;
    side: string;
    size: number;
    entry_price: number;
    current_price: number;
    unrealized_pnl: number;
  }>;
  recent_trades: Array<{
    id: string;
    market_id: string;
    market_question: string;
    buyer_side: string;
    quantity: number;
    price: number;
    created_at: string;
  }>;
  active_orders: Array<{
    id: string;
    market_id: string;
    market_question: string;
    side: string;
    order_type: string;
    price: number;
    quantity: number;
    filled_quantity: number;
    status: string;
    created_at: string;
  }>;
  total_positions: number;
  total_active_orders: number;
}

interface MarketDetail {
  market: {
    id: string;
    question: string;
    description: string;
    category: string;
    status: string;
    yes_price: number;
    no_price: number;
    volume: number;
    pool_yes_shares: number;
    pool_no_shares: number;
    expiry_time: string;
    created_at: string;
    updated_at: string;
  };
  user_position: {
    yes_size?: number;
    no_size?: number;
    yes_entry_price?: number;
    no_entry_price?: number;
  };
  order_book: {
    bids: Array<{ price: number; total: number }>;
    asks: Array<{ price: number; total: number }>;
  };
  recent_trades: Array<{
    id: string;
    buyer_side: string;
    quantity: number;
    price: number;
    created_at: string;
  }>;
}

// Optimized leaderboard query using materialized view
export function useOptimizedLeaderboard(limit = 20) {
  return useQuery({
    queryKey: ['optimized-leaderboard', limit],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const { data, error } = await supabase
        .rpc('get_leaderboard_cached', { _limit: limit });

      if (error) throw error;
      return (data as unknown as LeaderboardEntry[]) ?? [];
    },
    staleTime: 60000, // 1 minute - matches materialized view refresh
    refetchInterval: 120000, // 2 minutes
  });
}

// Optimized market stats query using materialized view
export function useOptimizedMarketStats(
  category?: string,
  status?: string,
  limit = 50
) {
  return useQuery({
    queryKey: ['optimized-market-stats', category, status, limit],
    queryFn: async (): Promise<MarketStats[]> => {
      const { data, error } = await supabase
        .rpc('get_market_stats_cached', {
          _category: category ?? null,
          _status: status ?? null,
          _limit: limit
        });

      if (error) throw error;
      return (data as unknown as MarketStats[]) ?? [];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

// Optimized user dashboard - single round trip for all dashboard data
export function useOptimizedDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['optimized-dashboard', user?.id],
    queryFn: async (): Promise<UserDashboard | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .rpc('get_user_dashboard', { _user_id: user.id });

      if (error) throw error;
      return data as unknown as UserDashboard;
    },
    enabled: !!user?.id,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // 30 seconds
  });
}

// Optimized market detail - single round trip for all market data
export function useOptimizedMarketDetail(marketId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['optimized-market-detail', marketId, user?.id],
    queryFn: async (): Promise<MarketDetail | null> => {
      if (!marketId) return null;

      const { data, error } = await supabase
        .rpc('get_market_detail', {
          _market_id: marketId,
          _user_id: user?.id ?? null
        });

      if (error) throw error;
      return data as unknown as MarketDetail;
    },
    enabled: !!marketId,
    staleTime: 5000, // 5 seconds for real-time feel
    refetchInterval: 10000, // 10 seconds
  });
}

// Batch fetch multiple markets by IDs
export function useBatchMarkets(marketIds: string[]) {
  return useQuery({
    queryKey: ['batch-markets', marketIds],
    queryFn: async () => {
      if (marketIds.length === 0) return [];

      const { data, error } = await supabase
        .rpc('batch_get_markets', { _market_ids: marketIds });

      if (error) throw error;
      return data ?? [];
    },
    enabled: marketIds.length > 0,
    staleTime: 30000,
  });
}

// Batch fetch user positions across multiple markets
export function useBatchPositions(marketIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['batch-positions', user?.id, marketIds],
    queryFn: async () => {
      if (!user?.id || marketIds.length === 0) return [];

      const { data, error } = await supabase
        .rpc('batch_get_positions', {
          _user_id: user.id,
          _market_ids: marketIds
        });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && marketIds.length > 0,
    staleTime: 10000,
  });
}
