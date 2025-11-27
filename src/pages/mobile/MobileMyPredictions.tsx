import { useState, useEffect } from "react";
import { MobileLayout } from "@/layouts/MobileLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Position {
  id: string;
  market_id: string;
  side: string;
  size: number;
  entry_price: number;
  status: string;
  opened_at: string;
  pnl: number;
}

const MobileMyPredictions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPositions();
    }
  }, [user]);

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user?.id)
        .order('opened_at', { ascending: false });

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setLoading(false);
    }
  };

  const activePositions = positions.filter((p) => p.status === 'open');
  const closedPositions = positions.filter((p) => p.status === 'closed');

  const PositionCard = ({ position }: { position: Position }) => {
    const isPositive = position.pnl >= 0;
    
    return (
      <Card
        className="p-4 active:scale-[0.98] transition-transform cursor-pointer"
        onClick={() => navigate(`/market/${position.market_id}`)}
      >
        <div className="flex justify-between items-start mb-3">
          <Badge
            className={
              position.side === 'yes'
                ? 'bg-green-600'
                : 'bg-red-600'
            }
          >
            {position.side.toUpperCase()}
          </Badge>
          <Badge variant={position.status === 'open' ? 'default' : 'secondary'}>
            {position.status}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shares:</span>
            <span className="font-semibold text-foreground">{position.size}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Entry Price:</span>
            <span className="font-semibold text-foreground">
              ${position.entry_price.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">P&L:</span>
            <span
              className={`font-bold ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isPositive ? '+' : ''}${position.pnl.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Opened:</span>
            <span className="text-muted-foreground">
              {new Date(position.opened_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </Card>
    );
  };

  if (!user) {
    return (
      <MobileLayout>
        <div className="px-4 pt-6 flex flex-col items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground text-center">
            Please sign in to view your predictions
          </p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground mb-6">
          My Predictions
        </h1>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="active" className="text-base">
              <Clock className="h-4 w-4 mr-2" />
              Active ({activePositions.length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-base">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Closed ({closedPositions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : activePositions.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No active predictions</p>
                <p className="text-sm text-muted-foreground">
                  Browse markets to make your first prediction
                </p>
              </div>
            ) : (
              activePositions.map((position) => (
                <PositionCard key={position.id} position={position} />
              ))
            )}
          </TabsContent>

          <TabsContent value="closed" className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : closedPositions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No closed predictions yet</p>
              </div>
            ) : (
              closedPositions.map((position) => (
                <PositionCard key={position.id} position={position} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
};

export default MobileMyPredictions;
