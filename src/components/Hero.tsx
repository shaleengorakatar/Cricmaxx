import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import cricmaxxLogo from "@/assets/cricmaxx-logo.png";

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
          {/* Logo */}
          <img 
            src={cricmaxxLogo} 
            alt="CricMaxx" 
            className="h-64 sm:h-72 md:h-96 w-auto mx-auto mb-0 drop-shadow-2xl"
          />
          
          {/* Mobile-optimized tagline */}
          <p className="text-2xl sm:text-3xl md:text-5xl font-semibold mb-6 sm:mb-8">
            Fast. Live.{" "}
            <span className="text-accent inline-flex items-center gap-1">
              Fun.
            </span>
          </p>
          
          {/* Mobile-optimized description */}
          <p className="text-base sm:text-lg md:text-xl mb-8 sm:mb-12 text-primary-foreground/90 max-w-3xl mx-auto leading-relaxed px-2">
            Welcome to CricMaxx, the ultimate cricket prediction playground. 
            Make <span className="font-semibold">fast, live predictions</span> on your favorite matches 
            with real-time order book trading. Feel the stadium energy from anywhere. 
            All contracts are CFTC-compliant.
          </p>

          {/* Mobile-optimized buttons - stack on mobile, side-by-side on larger screens */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto px-4">
            <Button 
              size="lg" 
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
              onClick={handleStartTrading}
            >
              <TrendingUp className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Start Predicting
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
