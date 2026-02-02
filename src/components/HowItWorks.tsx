import { TrendingUp, DollarSign, Trophy, Zap, Target, ArrowLeftRight } from "lucide-react";

const steps = [
  {
    icon: TrendingUp,
    title: "Pick a Market",
    description: "Choose YES or NO on event outcomes",
  },
  {
    icon: Zap,
    title: "Quick Predict",
    description: "Instant trade at current price",
  },
  {
    icon: Target,
    title: "Set Your Price",
    description: "Place limit orders at your price",
  },
  {
    icon: ArrowLeftRight,
    title: "Sell Anytime",
    description: "Exit positions before resolution",
  },
  {
    icon: Trophy,
    title: "Win $1/Contract",
    description: "Correct predictions pay $1 each",
  },
];

export const HowItWorks = () => {
  return (
    <div className="py-6 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            How it works
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 lg:gap-x-10">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <step.icon className="w-4 h-4 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground max-w-[130px]">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
