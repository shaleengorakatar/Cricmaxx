import { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, RefreshCw, BookOpen, ChevronDown, Coins, Trophy, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Market } from "@/types/market";
import { useNavigate } from "react-router-dom";
import { Sparkline } from "@/components/ui/sparkline";
import { getMarketDateRange, ACTIVE_MARKET_STATUSES } from "@/lib/marketFilters";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface MiniOrderLevel {
  price: number;
  quantity: number;
}

const MiniOrderBook = ({ marketId }: { marketId: string }) => {
  const [yesOrders, setYesOrders] = useState<MiniOrderLevel[]>([]);
  const [noOrders, setNoOrders] = useState<MiniOrderLevel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.rpc('get_order_book_aggregated', { market_ids: [marketId] });

    const yesLevels: MiniOrderLevel[] = [];
    const noLevels: MiniOrderLevel[] = [];

    for (const row of data || []) {
      if (row.price === null) continue; // skip market orders (no limit price)
      const price = Number(row.price);
      const quantity = Number(row.total_quantity);
      if (quantity <= 0) continue;
      const derived = Math.min(0.99, Math.max(0.01, 1 - price));
      if (row.side === 'yes') {
        noLevels.push({ price: derived, quantity });
      } else {
        yesLevels.push({ price: derived, quantity });
      }
    }

    const agg = (levels: MiniOrderLevel[]) => {
      const map = new Map<number, number>();
      for (const l of levels) {
        const p = Math.round(l.price * 100) / 100;
        map.set(p, (map.get(p) || 0) + l.quantity);
      }
      return Array.from(map.entries())
        .map(([price, quantity]) => ({ price, quantity }))
        .sort((a, b) => b.price - a.price)
        .slice(0, 3);
    };

    setYesOrders(agg(yesLevels));
    setNoOrders(agg(noLevels));
    setLoading(false);
  }, [marketId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  if (loading) {
    return <div className="py-3 text-center text-[10px] text-muted-foreground animate-pulse">Loading order book...</div>;
  }

  const totalYes = yesOrders.reduce((s, o) => s + o.quantity, 0);
  const totalNo = noOrders.reduce((s, o) => s + o.quantity, 0);
  const total = totalYes + totalNo;
  const bestYes = yesOrders[0];
  const bestNo = noOrders[0];

  if (total === 0) {
    return <div className="py-3 text-center text-[10px] text-muted-foreground">No orders yet</div>;
  }

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-center gap-3 py-1.5 px-2 bg-muted/40 rounded-md text-[10px]">
        <span className="text-muted-foreground">Liquidity: <span className="font-semibold text-foreground">{total}</span></span>
        <span className="h-2.5 w-px bg-border" />
        <span className="text-success font-medium">YES: {totalYes}</span>
        <span className="text-destructive font-medium">NO: {totalNo}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-success/5 border border-success/20 rounded-md p-2">
          <p className="text-[9px] text-muted-foreground mb-0.5">Best YES Price</p>
          {bestYes ? (
            <>
              <p className="text-sm font-bold text-success">{(bestYes.price * 100).toFixed(0)}¢</p>
              <p className="text-[9px] text-muted-foreground">{bestYes.quantity} shares</p>
            </>
          ) : <p className="text-[10px] text-muted-foreground">—</p>}
        </div>
        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-2">
          <p className="text-[9px] text-muted-foreground mb-0.5">Best NO Price</p>
          {bestNo ? (
            <>
              <p className="text-sm font-bold text-destructive">{(bestNo.price * 100).toFixed(0)}¢</p>
              <p className="text-[9px] text-muted-foreground">{bestNo.quantity} shares</p>
            </>
          ) : <p className="text-[10px] text-muted-foreground">—</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold text-foreground mb-1">YES Orders</p>
          {yesOrders.length > 0 ? yesOrders.map((o, i) => (
            <div key={i} className="flex justify-between text-[10px] py-0.5">
              <span className="text-success font-medium">{(o.price * 100).toFixed(0)}¢</span>
              <span className="text-muted-foreground">{o.quantity} shares</span>
            </div>
          )) : <p className="text-[10px] text-muted-foreground">—</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold text-foreground mb-1">NO Orders</p>
          {noOrders.length > 0 ? noOrders.map((o, i) => (
            <div key={i} className="flex justify-between text-[10px] py-0.5">
              <span className="text-destructive font-medium">{(o.price * 100).toFixed(0)}¢</span>
              <span className="text-muted-foreground">{o.quantity} shares</span>
            </div>
          )) : <p className="text-[10px] text-muted-foreground">—</p>}
        </div>
      </div>
    </div>
  );
};

interface FeaturedData extends Market {
  slideKind: "market";
  prediction_count?: number;
  price_history?: any[];
  volume: number;
}

interface FeaturedPoll {
  slideKind: "poll";
  id: string;
  question: string;
  closes_at: string;
  total_pool: number;
  options: { id: string; option_text: string; vote_count: number }[];
}

interface FeaturedContest {
  slideKind: "contest";
  id: string;
  title: string;
  description?: string | null;
  closes_at: string;
  buy_in_amount: number;
  match_name?: string | null;
  entry_count: number;
}

type FeaturedSlide = FeaturedData | FeaturedPoll | FeaturedContest;

// ── Poll Slide ────────────────────────────────────────────────────────────────
const PollSlide = ({ poll, navigate }: { poll: FeaturedPoll; navigate: ReturnType<typeof useNavigate> }) => {
  const totalVotes = poll.options.reduce((s, o) => s + o.vote_count, 0);
  const timeLeft = formatDistanceToNow(new Date(poll.closes_at), { addSuffix: true });
  return (
    <div onClick={() => navigate(`/polls?highlight=${poll.id}`)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge className="shrink-0 bg-accent/10 text-accent border-accent/20 text-xs">Poll</Badge>
          <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug line-clamp-2">{poll.question}</h2>
        </div>
      </div>
      <div className="space-y-2.5">
        {poll.options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round(opt.vote_count / totalVotes * 100) : 0;
          return (
            <div key={opt.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">{opt.option_text}</span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                <div className="h-full bg-accent/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/20 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{totalVotes} votes</span>
        <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" />{poll.total_pool} pool</span>
        <span className="flex items-center gap-1 ml-auto"><Clock className="h-3.5 w-3.5" />Closes {timeLeft}</span>
      </div>
    </div>
  );
};

// ── Contest Slide ─────────────────────────────────────────────────────────────
const ContestSlide = ({ contest, navigate }: { contest: FeaturedContest; navigate: ReturnType<typeof useNavigate> }) => {
  const timeLeft = formatDistanceToNow(new Date(contest.closes_at), { addSuffix: true });
  const prizePool = contest.entry_count * contest.buy_in_amount;
  return (
    <div onClick={() => navigate(`/contests`)}>
      <div className="flex items-start gap-3 mb-4">
        <Badge className="shrink-0 bg-primary/10 text-primary border-primary/20 text-xs">Contest</Badge>
        <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug line-clamp-2">{contest.title}</h2>
      </div>
      {contest.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{contest.description}</p>
      )}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-muted/40 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-foreground">{contest.buy_in_amount}</p>
          <p className="text-[11px] text-muted-foreground">Buy-in</p>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-primary">{prizePool > 0 ? prizePool : "—"}</p>
          <p className="text-[11px] text-muted-foreground">Prize pool</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-foreground">{contest.entry_count}</p>
          <p className="text-[11px] text-muted-foreground">Entries</p>
        </div>
      </div>
      <div className="flex items-center gap-4 pt-3 border-t border-border/20 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5" />{contest.match_name || "Prediction Contest"}</span>
        <span className="flex items-center gap-1 ml-auto"><Clock className="h-3.5 w-3.5" />Closes {timeLeft}</span>
      </div>
    </div>
  );
};

// ── Market Slide ──────────────────────────────────────────────────────────────
const MarketSlide = ({
  market, showBook, setShowBook
}: { market: FeaturedData; showBook: boolean; setShowBook: (v: boolean) => void }) => {
  const navigate = useNavigate();
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = 100 - yesPercent;
  const priceData = market.price_history?.map((p: any) => p.y) || [];

  return (
    <div
      className="flex flex-col sm:flex-row gap-4 cursor-pointer"
      onClick={() => navigate(`/market/${market.id}`)}
    >
      {/* Left: Outcomes table */}
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground font-medium pb-1.5 border-b border-border/40">
          <span>Market</span>
          <span className="text-center">Pays out</span>
          <span className="text-center">Odds</span>
        </div>
        <div className="grid grid-cols-3 gap-3 items-center py-2 border-b border-border/20">
          <span className="text-sm font-medium text-foreground">Yes</span>
          <span className="text-sm text-muted-foreground text-center">{(1 / market.yesPrice).toFixed(2)}x</span>
          <div className="flex justify-center">
            <span className="text-xs font-bold px-3 py-0.5 rounded-full border border-accent/40 text-accent">{yesPercent}%</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 items-center py-2 border-b border-border/20">
          <span className="text-sm font-medium text-foreground">No</span>
          <span className="text-sm text-muted-foreground text-center">{(1 / market.noPrice).toFixed(2)}x</span>
          <div className="flex justify-center">
            <span className="text-xs font-bold px-3 py-0.5 rounded-full border border-muted-foreground/30 text-muted-foreground">{noPercent}%</span>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span className="font-medium">${market.volume.toLocaleString()} vol</span>
          <span>{market.category}</span>
        </div>
        {market.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-2 pt-2 border-t border-border/20">{market.description}</p>
        )}
        {/* Collapsible Order Book */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowBook(!showBook); }}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full mt-3 pt-2 border-t border-border/20"
        >
          <BookOpen className="h-3 w-3" />
          <span className="font-medium">Order Book</span>
          <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", showBook && "rotate-180")} />
        </button>
        {showBook && <div className="mt-2"><MiniOrderBook marketId={market.id} /></div>}
      </div>

      {/* Right: Chart */}
      {priceData.length > 2 && (
        <div className="sm:w-[40%] shrink-0 flex items-center">
          <Sparkline data={priceData} width={240} height={100} strokeColor="hsl(var(--accent))" className="w-full" />
        </div>
      )}
    </div>
  );
};

export function FeaturedMarketHero() {
  const [slides, setSlides] = useState<FeaturedSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showBook, setShowBook] = useState(false);
  const navigate = useNavigate();
  const hasFetchedRef = useRef(false);

  const fetchAll = useCallback(async (isRetry = false) => {
    if (isRetry) { setLoading(true); setError(false); }
    const { now, maxExpiry } = getMarketDateRange();
    try {
      // Fetch top active markets
      const { data: mData, error: mErr } = await supabase
        .from("markets")
        .select("*")
        .in("status", [...ACTIVE_MARKET_STATUSES])
        .lte("expiry_time", maxExpiry.toISOString())
        .gte("expiry_time", now.toISOString())
        .order("volume", { ascending: false })
        .limit(5);

      if (mErr) throw mErr;

      // Fallback: if no active markets, show recently resolved ones
      let marketsToUse = mData || [];
      if (marketsToUse.length === 0) {
        const { data: resolvedData } = await supabase
          .from("markets")
          .select("*")
          .in("status", ["resolved", "settled"])
          .order("resolved_at", { ascending: false })
          .limit(5);
        marketsToUse = resolvedData || [];
      }

      // Fetch one open poll
      const { data: pData } = await supabase
        .from("prediction_polls")
        .select("id, question, closes_at, total_pool, poll_options(id, option_text)")
        .eq("status", "open")
        .gte("closes_at", now.toISOString())
        .order("total_pool", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch one open contest
      const { data: cData } = await supabase
        .from("prediction_contests")
        .select("id, title, description, closes_at, buy_in_amount, match_name")
        .eq("status", "open")
        .gte("closes_at", now.toISOString())
        .order("closes_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const marketSlides: FeaturedSlide[] = marketsToUse.map((m) => ({
        slideKind: "market" as const,
        id: m.id,
        question: m.question,
        category: m.category as Market["category"],
        type: m.type as Market["type"],
        yesPrice: Number(m.yes_price),
        noPrice: Number(m.no_price),
        volume: Number(m.volume),
        expiryTime: m.expiry_time,
        description: m.description || "",
        imageUrl: m.image_url || "",
        prediction_count: m.prediction_count || 0,
        price_history: Array.isArray(m.price_history) ? m.price_history : [],
      } as FeaturedData));

      const allSlides: FeaturedSlide[] = [...marketSlides];

      if (pData) {
        const { data: votes } = await supabase
          .from("poll_votes")
          .select("option_id")
          .eq("poll_id", pData.id);
        const voteCounts = new Map<string, number>();
        for (const v of votes || []) voteCounts.set(v.option_id, (voteCounts.get(v.option_id) || 0) + 1);

        const pollSlide: FeaturedPoll = {
          slideKind: "poll",
          id: pData.id,
          question: pData.question,
          closes_at: pData.closes_at,
          total_pool: pData.total_pool,
          options: (pData.poll_options as any[]).map((o: any) => ({ ...o, vote_count: voteCounts.get(o.id) || 0 })),
        };
        allSlides.splice(2, 0, pollSlide);
      }

      if (cData) {
        const { count: entryCount } = await supabase
          .from("contest_entries")
          .select("id", { count: "exact", head: true })
          .eq("contest_id", cData.id);

        const contestSlide: FeaturedContest = {
          slideKind: "contest",
          id: cData.id,
          title: cData.title,
          description: cData.description,
          closes_at: cData.closes_at,
          buy_in_amount: cData.buy_in_amount,
          match_name: cData.match_name,
          entry_count: entryCount || 0,
        };
        allSlides.splice(Math.min(4, allSlides.length), 0, contestSlide);
      }

      setSlides(allSlides);
      setLoading(false);
      hasFetchedRef.current = true;
    } catch {
      setLoading(false);
      if (!isRetry) setTimeout(() => fetchAll(true), 3000);
      else setError(true);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const goNext = () => { setCurrentIndex((i) => (i + 1) % slides.length); setShowBook(false); };
  const goPrev = () => { setCurrentIndex((i) => (i - 1 + slides.length) % slides.length); setShowBook(false); };

  if (loading) {
    return <Card className="p-4 animate-pulse"><div className="h-32 bg-muted rounded" /></Card>;
  }

  if (error) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Unable to load featured content</p>
        <Button variant="outline" size="sm" onClick={() => fetchAll(true)} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
      </Card>
    );
  }

  if (!slides.length) return null;

  const slide = slides[currentIndex];

  return (
    <Card className="border-border/40 overflow-hidden hover:border-primary/30 transition-colors">
      <div className="p-4 sm:p-5">
        {/* Header with nav dots */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            {slide.slideKind === "market" && (
              <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate(`/market/${(slide as FeaturedData).id}`)}>
                {(slide as FeaturedData).question}
              </h2>
            )}
          </div>
          {slides.length > 1 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={goPrev}
                className="p-1 rounded-full border border-border hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <span className="text-xs text-muted-foreground font-medium">{currentIndex + 1} of {slides.length}</span>
              <button
                onClick={goNext}
                className="p-1 rounded-full border border-border hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Slide content */}
        {slide.slideKind === "market" && (
          <MarketSlide
            market={slide as FeaturedData}
            showBook={showBook}
            setShowBook={setShowBook}
          />
        )}
        {slide.slideKind === "poll" && (
          <PollSlide poll={slide as FeaturedPoll} navigate={navigate} />
        )}
        {slide.slideKind === "contest" && (
          <ContestSlide contest={slide as FeaturedContest} navigate={navigate} />
        )}

        {/* Dot indicators */}
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-border/20">
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => { setCurrentIndex(i); setShowBook(false); }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === currentIndex
                    ? "w-4 bg-primary"
                    : s.slideKind === "poll"
                    ? "w-1.5 bg-accent/40 hover:bg-accent/70"
                    : s.slideKind === "contest"
                    ? "w-1.5 bg-primary/40 hover:bg-primary/70"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

