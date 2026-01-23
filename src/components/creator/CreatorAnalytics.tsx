import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  Trophy, 
  Target,
  Crown,
  Medal,
  Award,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";

interface CreatorAnalyticsData {
  total_volume: number;
  total_earnings: number;
  markets_created: number;
  markets_resolved: number;
  markets_pending: number;
  markets_open: number;
  avg_volume_per_market: number;
  top_market: { id: string; question: string; volume: number } | null;
  monthly_earnings: Array<{ month: string; earnings: number; volume: number; markets: number }>;
  category_breakdown: Array<{ category: string; count: number; volume: number }>;
}

interface CreatorProfile {
  creator_tier: string;
  creator_verified: boolean;
  total_creator_earnings: number;
  total_creator_volume: number;
  markets_created: number;
}

const TIER_CONFIG = {
  bronze: { 
    color: "from-amber-600 to-amber-800", 
    icon: Medal, 
    label: "Bronze",
    feeBonus: 0,
    nextTier: "silver",
    requirements: { volume: 10000, markets: 5 }
  },
  silver: { 
    color: "from-slate-400 to-slate-600", 
    icon: Award, 
    label: "Silver",
    feeBonus: 0.25,
    nextTier: "gold",
    requirements: { volume: 100000, markets: 20 }
  },
  gold: { 
    color: "from-yellow-400 to-yellow-600", 
    icon: Crown, 
    label: "Gold",
    feeBonus: 0.5,
    nextTier: "platinum",
    requirements: { volume: 1000000, markets: 50 }
  },
  platinum: { 
    color: "from-purple-400 to-purple-600", 
    icon: Sparkles, 
    label: "Platinum",
    feeBonus: 1.0,
    nextTier: null,
    requirements: null
  }
};

const CATEGORY_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

const CreatorAnalytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<CreatorAnalyticsData | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;

      try {
        // Fetch analytics from RPC
        const { data: analyticsData, error: analyticsError } = await supabase
          .rpc('get_creator_analytics', { _user_id: user.id });

        if (analyticsError) throw analyticsError;

        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('creator_tier, creator_verified, total_creator_earnings, total_creator_volume, markets_created')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        // Update tier
        await supabase.rpc('update_creator_tier', { _user_id: user.id });

        setAnalytics(analyticsData as unknown as CreatorAnalyticsData);
        setProfile(profileData as CreatorProfile);
      } catch (error) {
        console.error('Error fetching creator analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user]);

  if (loading) {
    return (
      <Card className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </Card>
    );
  }

  if (!analytics || !profile) {
    return null;
  }

  const tier = profile.creator_tier as keyof typeof TIER_CONFIG || 'bronze';
  const tierConfig = TIER_CONFIG[tier];
  const TierIcon = tierConfig.icon;

  // Calculate progress to next tier
  const getProgress = () => {
    if (!tierConfig.nextTier || !tierConfig.requirements) return 100;
    const nextTierConfig = TIER_CONFIG[tierConfig.nextTier as keyof typeof TIER_CONFIG];
    if (!nextTierConfig?.requirements) return 100;

    const volumeProgress = Math.min(100, (analytics.total_volume / nextTierConfig.requirements.volume) * 100);
    const marketsProgress = Math.min(100, (analytics.markets_created / nextTierConfig.requirements.markets) * 100);
    return Math.min(volumeProgress, marketsProgress);
  };

  const progress = getProgress();

  // Format monthly data for chart
  const monthlyChartData = analytics.monthly_earnings?.map(m => ({
    month: format(new Date(m.month), 'MMM'),
    earnings: m.earnings || 0,
    volume: m.volume || 0
  })).reverse() || [];

  const chartConfig = {
    earnings: { label: "Earnings", color: "hsl(var(--success))" },
    volume: { label: "Volume", color: "hsl(var(--primary))" }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-accent" />
          Creator Analytics
        </h2>
        
        {/* Tier Badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${tierConfig.color} text-white`}>
          <TierIcon className="h-5 w-5" />
          <span className="font-bold">{tierConfig.label}</span>
          {profile.creator_verified && (
            <Badge variant="secondary" className="bg-white/20 text-white text-xs">
              Verified
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs">Total Earnings</span>
          </div>
          <p className="text-2xl font-bold text-success">
            ${analytics.total_earnings.toFixed(2)}
          </p>
          {tierConfig.feeBonus > 0 && (
            <p className="text-xs text-success mt-1">
              +{tierConfig.feeBonus}% tier bonus
            </p>
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Total Volume</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            ${analytics.total_volume.toLocaleString()}
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Target className="h-4 w-4" />
            <span className="text-xs">Markets Created</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {analytics.markets_created}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {analytics.markets_resolved} resolved
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Trophy className="h-4 w-4" />
            <span className="text-xs">Avg Volume</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            ${Math.round(analytics.avg_volume_per_market).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tier Progress */}
      {tierConfig.nextTier && (
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress to {TIER_CONFIG[tierConfig.nextTier as keyof typeof TIER_CONFIG].label}</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>${analytics.total_volume.toLocaleString()} / ${TIER_CONFIG[tierConfig.nextTier as keyof typeof TIER_CONFIG].requirements?.volume.toLocaleString()}</span>
            <span>{analytics.markets_created} / {TIER_CONFIG[tierConfig.nextTier as keyof typeof TIER_CONFIG].requirements?.markets} markets</span>
          </div>
        </div>
      )}

      {/* Monthly Chart */}
      {monthlyChartData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Monthly Performance</h3>
          <ChartContainer config={chartConfig} className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData}>
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="earnings" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* Category Breakdown */}
      {analytics.category_breakdown && analytics.category_breakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Markets by Category</h3>
          <div className="flex flex-wrap gap-2">
            {analytics.category_breakdown.map((cat, i) => (
              <Badge key={cat.category} variant="secondary" className="text-xs">
                <span 
                  className="w-2 h-2 rounded-full mr-2" 
                  style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                />
                {cat.category}: {cat.count} (${cat.volume.toLocaleString()})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Top Market */}
      {analytics.top_market && (
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold">Top Performing Market</span>
          </div>
          <p className="text-sm text-foreground line-clamp-1">{analytics.top_market.question}</p>
          <p className="text-xs text-muted-foreground mt-1">
            ${analytics.top_market.volume.toLocaleString()} volume
          </p>
        </div>
      )}
    </Card>
  );
};

export default CreatorAnalytics;