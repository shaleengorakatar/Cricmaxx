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

      <div className="container mx-auto px-4 pt-20 pb-5 sm:pt-20 sm:pb-6 relative z-10">
        {/* Mobile: stacked, Desktop: side by side */}
        <div className="flex flex-col lg:flex-row items-start gap-4 lg:gap-8">

          {/* Main content area */}
          <div className="flex-1 min-w-0 w-full">
            {/* Mobile: logo small + inline with title. Desktop: logo + text side by side */}
            <div className="flex items-center gap-3 sm:gap-4 mb-3">
              <img
                src={cricmaxxLogo}
                alt="CricMaxx"
                className="w-14 h-14 sm:w-20 sm:h-20 lg:w-28 lg:h-28 object-contain drop-shadow-xl shrink-0 -ml-1"
              />
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                Fast. Live. <span className="text-accent">Fun.</span>
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-primary-foreground/75 leading-relaxed mb-3">
              The ultimate cricket prediction playground. Make fast, live predictions on your favorite matches
              with real-time order book trading.
              <span className="inline sm:block text-accent font-medium sm:mt-1 ml-1 sm:ml-0">🚀 Closed Beta — World Cup 2026</span>
            </p>

            {/* CTA buttons — always fit in one row */}
            <div className="flex gap-2 mb-2">
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

            <p className="text-[10px] sm:text-xs text-primary-foreground/50">
              CricMaxx Tokens — <span className="font-semibold text-accent">1 Token = $1 USD</span>
            </p>
          </div>

          {/* How It Works — full width on mobile, sidebar on desktop */}
          <div className="shrink-0 w-full lg:w-72 bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-primary-foreground/10">
            <h3 className="text-xs font-bold mb-2 text-primary-foreground/80 lg:text-center">How It Works</h3>
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 lg:gap-2.5">
              {[
                { icon: Coins, title: "Polls", desc: "Stake tokens. Winners split the pool." },
                { icon: BarChart3, title: "Markets", desc: "Buy Yes/No (1¢–99¢). Correct = $1." },
                { icon: Trophy, title: "Contests", desc: "Buy-in, answer, win pot (50/30/20)." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex flex-col lg:flex-row items-center lg:items-center gap-1 lg:gap-2 text-center lg:text-left">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <Icon className="h-3 w-3 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-primary-foreground/90 leading-none">{title}</p>
                    <p className="text-[10px] text-primary-foreground/55 leading-snug hidden lg:block">{desc}</p>
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
