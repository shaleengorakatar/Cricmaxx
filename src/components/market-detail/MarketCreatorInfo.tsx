import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import CreatorTierBadge from "@/components/creator/CreatorTierBadge";
import { supabase } from "@/integrations/supabase/client";
import { User, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MarketCreatorInfoProps {
  marketId: string;
  compact?: boolean;
}

interface CreatorInfo {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  creator_tier: string;
  creator_verified: boolean;
  markets_created: number;
  total_volume: number;
}

const MarketCreatorInfo = ({ marketId, compact = false }: MarketCreatorInfoProps) => {
  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCreator = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_market_creator_info', { _market_id: marketId });

        if (error) throw error;
        setCreator(data as unknown as CreatorInfo);
      } catch (error) {
        console.error('Error fetching creator info:', error);
      } finally {
        setLoading(false);
      }
    };

    if (marketId) {
      fetchCreator();
    }
  }, [marketId]);

  if (loading) {
    return compact ? (
      <Skeleton className="h-6 w-24" />
    ) : (
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }

  if (!creator) return null;

  const displayName = creator.display_name || creator.username || 'Creator';
  const initials = displayName.slice(0, 2).toUpperCase();

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <Avatar className="h-5 w-5">
                <AvatarImage src={creator.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                @{creator.username || 'creator'}
              </span>
              <CreatorTierBadge 
                tier={creator.creator_tier} 
                verified={creator.creator_verified}
                size="sm"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-semibold">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {creator.markets_created} markets • ${creator.total_volume?.toLocaleString()} volume
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
      <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">Created By</p>
      
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border-2 border-border">
          <AvatarImage src={creator.avatar_url || undefined} />
          <AvatarFallback className="text-lg bg-gradient-to-br from-primary/20 to-accent/20">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">
              {displayName}
            </span>
            <CreatorTierBadge 
              tier={creator.creator_tier} 
              verified={creator.creator_verified}
              showLabel
            />
          </div>
          
          <p className="text-sm text-muted-foreground">
            @{creator.username || 'creator'}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span>{creator.markets_created} markets</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          <span>${creator.total_volume?.toLocaleString() || 0} volume</span>
        </div>
      </div>
    </div>
  );
};

export default MarketCreatorInfo;