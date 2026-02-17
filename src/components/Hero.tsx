import { Button } from "@/components/ui/button";
import { Coins, BarChart3, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const cricmaxxLogo = "/assets/cricmaxx-logo.png";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground overflow-hidden relative">
      {/* Background blobs */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-5 left-5 w-40 h-40 bg-accent rounded-full blur-3xl" />
        <div className="absolute bottom-5 right-5 w-56 h-56 bg-accent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-5 sm:py-6 relative z-10">
        {/* Top line: Logo + Tagline + How It Works */}
        <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8">
          {/* Left: Logo + tagline + buttons */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Logo — cropped tight, no extra whitespace */}
            <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 overflow-hidden flex items-center justify-center">
              <img
                src={cricmaxxLogo}
                alt="CricMaxx"
                className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-xl"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight">
                Fast. Live. <span className="text-accent">Fun.</span>
              </h1>
              <p className="text-xs sm:text-sm text-primary-foreground/75 mt-1 line-clamp-2">
                The ultimate cricket prediction playground — make live predictions with real-time trading.
                <span className="text-accent font-medium ml-1">🚀 Closed Beta</span>
              </p>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-md h-8 text-xs px-3"
                  onClick={() => navigate("/polls")}
                >
                  <Coins className="mr-1 h-3.5 w-3.5" />
                  Polls
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold shadow-md h-8 text-xs px-3"
                  onClick={() => navigate("/markets")}
                >
                  <BarChart3 className="mr-1 h-3.5 w-3.5" />
                  Markets
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 hover:from-yellow-400 hover:to-amber-400 font-semibold shadow-md h-8 text-xs px-3"
                  onClick={() => navigate("/contests")}
                >
                  <Trophy className="mr-1 h-3.5 w-3.5" />
                  Contests
                </Button>
              </div>

              <p className="text-[10px] sm:text-xs text-primary-foreground/50 mt-2">
                CricMaxx Tokens — <span className="font-semibold text-accent">1 Token = $1 USD</span>
              </p>
            </div>
          </div>

          {/* Right: How It Works — compact */}
          <div className="shrink-0 w-full lg:w-64 bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-3 border border-primary-foreground/10">
            <h3 className="text-xs font-bold mb-2 text-center text-primary-foreground/80">How It Works</h3>
            <div className="space-y-2">
              {[
                { icon: Coins, title: "Polls", desc: "Stake tokens. Winners split the pool." },
                { icon: BarChart3, title: "Markets", desc: "Buy Yes/No (1¢–99¢). Correct = $1." },
                { icon: Trophy, title: "Contests", desc: "Buy-in, answer, win pot (50/30/20)." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <Icon className="h-3 w-3 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-primary-foreground/90 leading-none">{title}</p>
                    <p className="text-[10px] text-primary-foreground/55 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
