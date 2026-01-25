import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Coins, Shield, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const ONBOARDING_SCREENS = [
  {
    icon: TrendingUp,
    title: "Make Live Cricket Predictions",
    description: "Criccmax lets you stake tokens on the outcomes of real cricket matches. If your prediction is correct, tokens are returned at full value.",
    highlight: "Fast, live, and fun — like being in the stadium!",
  },
  {
    icon: Coins,
    title: "Tokens as Collateral",
    description: "Your tokens are locked as collateral when you take a position. They're released when the market resolves based on the actual outcome.",
    highlight: "1 token = $1 USD value",
  },
  {
    icon: Shield,
    title: "CFTC-Compliant Markets",
    description: "All markets follow strict regulatory guidelines. Resolution is automated through verified data sources for transparency.",
    highlight: "Federally regulated event contracts",
  },
];

export function OnboardingModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkOnboardingStatus();
    }
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("onboarding_status")
      .select("completed_at, skipped_at")
      .eq("user_id", user.id)
      .single();

    // Show onboarding if no record exists
    if (!data) {
      setIsOpen(true);
    }
    setLoading(false);
  };

  const completeOnboarding = async () => {
    if (!user) return;

    await supabase.from("onboarding_status").upsert({
      user_id: user.id,
      completed_at: new Date().toISOString(),
    });

    setIsOpen(false);
  };

  const skipOnboarding = async () => {
    if (!user) return;

    await supabase.from("onboarding_status").upsert({
      user_id: user.id,
      skipped_at: new Date().toISOString(),
    });

    setIsOpen(false);
  };

  const nextScreen = () => {
    if (currentScreen < ONBOARDING_SCREENS.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else {
      completeOnboarding();
    }
  };

  const prevScreen = () => {
    if (currentScreen > 0) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  if (loading || !user) return null;

  const screen = ONBOARDING_SCREENS[currentScreen];
  const Icon = screen.icon;
  const isLastScreen = currentScreen === ONBOARDING_SCREENS.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && skipOnboarding()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="relative">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent" />
          
          <div className="relative p-8 space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Icon className="h-10 w-10 text-primary" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold text-foreground">
                {screen.title}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {screen.description}
              </p>
              <p className="text-sm font-medium text-accent">
                {screen.highlight}
              </p>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2">
              {ONBOARDING_SCREENS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentScreen(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentScreen
                      ? "bg-primary w-6"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="ghost"
                onClick={prevScreen}
                disabled={currentScreen === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>

              <Button
                variant="ghost"
                onClick={skipOnboarding}
                className="text-muted-foreground"
              >
                Skip
              </Button>

              <Button
                onClick={nextScreen}
                className="gap-1 bg-primary text-primary-foreground"
              >
                {isLastScreen ? "Let's Go!" : "Next"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
