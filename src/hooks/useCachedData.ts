import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MarketPrices {
  id: string;
  yes_price: number;
  no_price: number;
  volume: number;
  pool_yes_shares: number;
  pool_no_shares: number;
  updated_at: string;
}

interface LeaderboardUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rating_score: number;
  predictions_total: number;
  predictions_correct: number;
  show_on_leaderboard: boolean;
}

// Hook for cached market prices with automatic refresh
export function useCachedMarketPrices(marketId: string | undefined) {
  return useQuery({
    queryKey: ['cached-market-prices', marketId],
    queryFn: async (): Promise<MarketPrices | null> => {
      if (!marketId) return null;
      
      const { data, error } = await supabase.functions.invoke('cache-manager', {
        body: {
          action: 'get_market_prices',
          marketId
        }
      });

      if (error) throw error;
      return data?.data ?? null;
    },
    enabled: !!marketId,
    staleTime: 5000, // 5 seconds - matches edge function cache TTL
    refetchInterval: 5000, // Poll every 5 seconds
    refetchOnWindowFocus: true,
  });
}

// Hook for cached leaderboard data
export function useCachedLeaderboard(limit = 20) {
  return useQuery({
    queryKey: ['cached-leaderboard', limit],
    queryFn: async (): Promise<LeaderboardUser[]> => {
      const { data, error } = await supabase.functions.invoke('cache-manager', {
        body: {
          action: 'get_leaderboard',
          limit
        }
      });

      if (error) throw error;
      return data?.data ?? [];
    },
    staleTime: 60000, // 1 minute - matches edge function cache TTL
    refetchInterval: 60000, // Poll every minute
    refetchOnWindowFocus: true,
  });
}

// Hook for invalidating cache
export function useInvalidateCache() {
  const invalidateMarketPrices = async (marketId: string) => {
    await supabase.functions.invoke('cache-manager', {
      body: {
        action: 'invalidate',
        key: `market_prices:${marketId}`
      }
    });
  };

  const invalidateLeaderboard = async () => {
    await supabase.functions.invoke('cache-manager', {
      body: {
        action: 'invalidate',
        key: 'leaderboard'
      }
    });
  };

  return {
    invalidateMarketPrices,
    invalidateLeaderboard
  };
}
