import { TrendingUp, DollarSign, Trophy } from "lucide-react";

const steps = [
  {
    icon: TrendingUp,
    title: "Pick a Market",
    description: "Choose YES or NO on event outcomes",
  },
  {
    icon: DollarSign,
    title: "Buy Shares",
    description: "Prices reflect probability (e.g., 65¢ = 65%)",
  },
  {
    icon: Trophy,
    title: "Win $1/Share",
    description: "Correct predictions pay out $1 per share",
  },
];

export const HowItWorks = () => {
  return (
    <div className="py-6 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 lg:gap-12">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            How it works
          </p>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                  <step.icon className="w-4 h-4 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground max-w-[140px]">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
