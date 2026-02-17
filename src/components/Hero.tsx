import { Button } from "@/components/ui/button";
import { TrendingUp, Coins, BarChart3, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const cricmaxxLogo = "/assets/cricmaxx-logo.png";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-48 h-48 bg-accent rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-accent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-8 sm:py-10 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
          {/* Logo - compact */}
          <img
            src={cricmaxxLogo}
            alt="CricMaxx"
            width={576}
            height={384}
            className="h-28 sm:h-36 lg:h-44 w-auto drop-shadow-2xl shrink-0"
          />

          {/* Content */}
          <div className="flex-1 text-center lg:text-left max-w-2xl">
            <p className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-2">
              Fast. Live.{" "}
              <span className="text-accent">Fun.</span>
            </p>
            <p className="text-sm sm:text-base text-primary-foreground/80 mb-4 leading-relaxed">
              The ultimate cricket prediction playground. Make fast, live predictions on your favorite matches
              with real-time order book trading.
              <span className="inline-block ml-2 text-accent font-medium">🚀 Closed Beta — World Cup 2026</span>
            </p>

            {/* CTA buttons — horizontal row */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              <Button
                size="sm"
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-md"
                onClick={() => navigate("/polls")}
              >
                <Coins className="mr-1.5 h-4 w-4" />
                Polls
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold shadow-md"
                onClick={() => navigate("/markets")}
              >
                <BarChart3 className="mr-1.5 h-4 w-4" />
                Markets
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 hover:from-yellow-400 hover:to-amber-400 font-semibold shadow-md"
                onClick={() => navigate("/contests")}
              >
                <Trophy className="mr-1.5 h-4 w-4" />
                Contests
              </Button>
            </div>

            <p className="text-xs text-primary-foreground/60 mt-3">
              Trade with CricMaxx Tokens — <span className="font-semibold text-accent">1 Token = $1 USD</span>
            </p>
          </div>

          {/* How It Works — compact sidebar card */}
          <div className="shrink-0 w-full lg:w-72 bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-4 border border-primary-foreground/10">
            <h3 className="text-sm font-bold mb-3 text-center text-primary-foreground/90">How It Works</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Coins className="h-3.5 w-3.5 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary-foreground/90">Polls</p>
                  <p className="text-[11px] text-primary-foreground/60 leading-relaxed">Stake tokens on your pick. Winners split the pool.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 className="h-3.5 w-3.5 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary-foreground/90">Markets</p>
                  <p className="text-[11px] text-primary-foreground/60 leading-relaxed">Buy Yes/No contracts (1¢–99¢). Correct pays $1.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Trophy className="h-3.5 w-3.5 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary-foreground/90">Contests</p>
                  <p className="text-[11px] text-primary-foreground/60 leading-relaxed">Pay buy-in, answer questions, compete for the pot (50/30/20).</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
