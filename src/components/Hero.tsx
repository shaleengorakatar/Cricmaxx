import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Hero = () => {
  const navigate = useNavigate();

  const handleStartTrading = () => {
    navigate('/markets');
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-accent rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 py-24 sm:py-32 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Mobile-optimized title */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
            Shariz
          </h1>
          
          {/* Mobile-optimized tagline */}
          <p className="text-2xl sm:text-3xl md:text-5xl font-semibold mb-6 sm:mb-8">
            Predict. Profit.{" "}
            <span className="text-accent inline-flex items-center gap-1">
              Participate.
            </span>
          </p>
          
          {/* Mobile-optimized description */}
          <p className="text-base sm:text-lg md:text-xl mb-8 sm:mb-12 text-primary-foreground/90 max-w-3xl mx-auto leading-relaxed px-2">
            Welcome to Shariz, a web-based prediction market platform offering two distinct trading models. 
            Choose <span className="font-semibold">peer-to-peer order book markets</span> for exchange-style trading, 
            or explore <span className="font-semibold">creator-led automated markets</span> powered by LMSR/AMM models 
            with fixed-payout event contracts. All trades are federally compliant under CFTC regulations, 
            ensuring trust and legality.
          </p>

          {/* Mobile-optimized buttons - stack on mobile, side-by-side on larger screens */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto px-4">
            <Button 
              size="lg" 
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
              onClick={handleStartTrading}
            >
              <TrendingUp className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Start Trading
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="bg-transparent border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
              onClick={() => navigate('/creator')}
            >
              <Users className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Create a Market
            </Button>
          </div>

          {/* Mobile App Link */}
          <div className="mt-8">
            <Button
              variant="ghost"
              className="text-primary-foreground/80 hover:text-primary-foreground text-base"
              onClick={() => navigate('/mobile')}
            >
              <Smartphone className="mr-2 h-5 w-5" />
              Try Mobile App Preview
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
