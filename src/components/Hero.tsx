import { Button } from "@/components/ui/button";
import { TrendingUp, Users } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-accent rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 py-32 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Shariz
          </h1>
          <p className="text-3xl md:text-5xl font-semibold mb-8">
            Predict. Profit.{" "}
            <span className="text-accent">Participate.</span>
          </p>
          
          <p className="text-lg md:text-xl mb-12 text-primary-foreground/90 max-w-3xl mx-auto leading-relaxed">
            Welcome to Shariz, a web-based prediction market platform offering two distinct trading models. 
            Choose <span className="font-semibold">peer-to-peer order book markets</span> for exchange-style trading, 
            or explore <span className="font-semibold">creator-led automated markets</span> powered by LMSR/AMM models 
            with fixed-payout event contracts. All trades are federally compliant under CFTC regulations, 
            ensuring trust and legality.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              <TrendingUp className="mr-2 h-5 w-5" />
              Start Trading
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="bg-transparent border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary text-lg px-8 py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              <Users className="mr-2 h-5 w-5" />
              Create a Market
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
