import { Badge } from "@/components/ui/badge";
import { Market } from "@/types/market";
import { Clock, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import SocialShareButtons from "./SocialShareButtons";

interface MarketHeaderProps {
  market: Market;
  volume?: number;
  yesPrice?: number;
  noPrice?: number;
}

const MarketHeader = ({ market, volume, yesPrice, noPrice }: MarketHeaderProps) => {
  const expiryDate = new Date(market.expiryTime);
  const isExpired = expiryDate < new Date();

  const yes = yesPrice ?? market.yesPrice;
  const no = noPrice ?? market.noPrice;
  const yesCents = Math.round(yes * 100);
  const noCents = 100 - yesCents;
  const vol = volume ?? market.volume;

  return (
    <div className="relative bg-gradient-to-br from-primary via-primary to-primary/90 rounded-xl overflow-hidden">
      {/* Background blobs — same as hero */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-48 h-48 bg-accent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="relative z-10 p-4 sm:p-6">
        {/* Top row: category + status + share */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary-foreground/30 text-primary-foreground/80 text-xs font-medium bg-primary-foreground/10 backdrop-blur-sm"
            >
              {market.category}
            </Badge>
            <div className="flex items-center gap-1 text-primary-foreground/60 text-xs">
              <Clock className="h-3 w-3" />
              <span>Expires {format(expiryDate, "MMM dd, yyyy")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SocialShareButtons market={market} />
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                isExpired
                  ? "border-red-400/40 text-red-300 bg-red-500/10"
                  : "border-accent/40 text-accent bg-accent/10"
              }`}
            >
              {isExpired ? "Closed" : "● Live"}
            </span>
          </div>
        </div>

        {/* Question */}
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-foreground leading-tight mb-4">
          {market.question}
        </h1>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          {/* YES */}
          <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-lg px-3 py-2 border border-primary-foreground/15 backdrop-blur-sm">
            <TrendingUp className="h-3.5 w-3.5 text-accent shrink-0" />
            <div>
              <p className="text-[10px] text-primary-foreground/50 leading-none mb-0.5">YES</p>
              <p className="text-base font-bold text-accent leading-none">{yesCents}¢</p>
            </div>
          </div>

          {/* NO */}
          <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-lg px-3 py-2 border border-primary-foreground/15 backdrop-blur-sm">
            <TrendingDown className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <div>
              <p className="text-[10px] text-primary-foreground/50 leading-none mb-0.5">NO</p>
              <p className="text-base font-bold text-red-400 leading-none">{noCents}¢</p>
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-lg px-3 py-2 border border-primary-foreground/15 backdrop-blur-sm">
            <BarChart3 className="h-3.5 w-3.5 text-primary-foreground/60 shrink-0" />
            <div>
              <p className="text-[10px] text-primary-foreground/50 leading-none mb-0.5">Volume</p>
              <p className="text-base font-bold text-primary-foreground leading-none">{vol.toLocaleString()}</p>
            </div>
          </div>

          {/* Payout info */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-primary-foreground/50 ml-auto">
            <span className="text-primary-foreground/70 font-medium">Correct = 1 token payout</span>
          </div>
        </div>

        {/* Description */}
        {market.description && (
          <p className="mt-3 text-xs sm:text-sm text-primary-foreground/60 leading-relaxed border-t border-primary-foreground/10 pt-3">
            {market.description}
          </p>
        )}
      </div>
    </div>
  );
};

export default MarketHeader;
