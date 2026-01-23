import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Clock, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';

interface HotMarket {
  id: string;
  question: string;
  category: string;
  yes_price: number;
  volume: number;
  prediction_count: number;
  expiry_time: string;
  price_history: { timestamp: string; yes_price: number; no_price: number }[] | null;
}

export function HotMarketsWidget() {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<HotMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHotMarkets();
  }, []);

  const fetchHotMarkets = async () => {
    const { data, error } = await supabase
      .from('markets')
      .select('id, question, category, yes_price, volume, prediction_count, expiry_time, price_history')
      .in('status', ['active', 'open'])
      .gte('expiry_time', new Date().toISOString())
      .order('volume', { ascending: false })
      .limit(5);

    if (!error && data) {
      setMarkets(data as HotMarket[]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp className="h-5 w-5 text-accent" />
          <h3 className="font-bold text-foreground">Hot Markets</h3>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (markets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <TrendingUp className="h-5 w-5 text-accent" />
        <h3 className="font-bold text-foreground">Hot Markets</h3>
        <Badge variant="secondary" className="ml-auto text-xs">Live</Badge>
      </div>

      {markets.map((market) => {
        const priceData = Array.isArray(market.price_history) 
          ? market.price_history.map((p) => p.yes_price * 100)
          : [];

        return (
          <Card
            key={market.id}
            onClick={() => navigate(`/market/${market.id}`)}
            className="p-4 cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.98] border-border/50"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-2 text-foreground mb-2">
                  {market.question}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {market.prediction_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDistanceToNow(new Date(market.expiry_time), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge 
                  variant={market.yes_price > 0.5 ? 'default' : 'secondary'}
                  className="text-xs font-bold"
                >
                  {Math.round(market.yes_price * 100)}% Yes
                </Badge>
                {priceData.length > 1 && (
                  <Sparkline 
                    data={priceData} 
                    width={50} 
                    height={20}
                    strokeColor="hsl(var(--accent))"
                  />
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
