import { Button } from "@/components/ui/button";
import { TrendingUp, Coins, BarChart3, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";

// Use public path for stable preload URL matching
const cricmaxxLogo = "/assets/cricmaxx-logo.png";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const buttonVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const Hero = () => {
  const navigate = useNavigate();

  const handleGoToPolls = () => navigate('/polls');
  const handleGoToMarkets = () => navigate('/markets');
  const handleGoToContests = () => navigate('/contests');

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-accent rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 py-24 sm:py-32 relative z-10">
        <motion.div 
          className="max-w-4xl mx-auto text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Logo with floating animation */}
          <motion.img 
            src={cricmaxxLogo} 
            alt="CricMaxx" 
            width={576}
            height={384}
            // @ts-expect-error fetchpriority is valid HTML but React types don't recognize it
            fetchpriority="high"
            className="h-64 sm:h-72 md:h-96 w-auto mx-auto mb-0 -mt-8 sm:-mt-10 md:-mt-16 drop-shadow-2xl"
            variants={itemVariants}
            animate={{ 
              y: [0, -12, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Mobile-optimized tagline */}
          <motion.p 
            className="text-2xl sm:text-3xl md:text-5xl font-semibold mb-6 sm:mb-8 -mt-8 sm:-mt-10 md:-mt-16"
            variants={itemVariants}
          >
            Fast. Live.{" "}
            <span className="text-accent inline-flex items-center gap-1">
              Fun.
            </span>
          </motion.p>
          
          {/* Mobile-optimized description */}
          <motion.p 
            className="text-base sm:text-lg md:text-xl mb-8 sm:mb-12 text-primary-foreground/90 max-w-3xl mx-auto leading-relaxed px-2"
            variants={itemVariants}
          >
            Welcome to CricMaxx, the ultimate cricket prediction playground. 
            Make <span className="font-semibold">fast, live predictions</span> on your favorite matches 
            with real-time order book trading. Feel the stadium energy from anywhere.
            <span className="block mt-2 text-accent font-medium">🚀 Closed Beta — World Cup 2026</span>
          </motion.p>

          {/* Start Predicting heading */}
          <motion.p
            className="text-lg sm:text-xl md:text-2xl font-bold mb-4 text-primary-foreground/90"
            variants={itemVariants}
          >
            <TrendingUp className="inline h-5 w-5 mr-2 text-accent" />
            Start Predicting
          </motion.p>

          {/* Two CTA buttons */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center max-w-lg mx-auto px-4"
            variants={itemVariants}
          >
            <motion.div variants={buttonVariants} className="w-full sm:w-auto">
              <Button 
                size="lg" 
                className="bg-accent text-accent-foreground hover:bg-accent/90 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                onClick={handleGoToPolls}
              >
                <Coins className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Token Based Polls
              </Button>
            </motion.div>
            <motion.div variants={buttonVariants} className="w-full sm:w-auto">
              <Button 
                size="lg" 
                variant="outline"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                onClick={handleGoToMarkets}
              >
                <BarChart3 className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Contract Markets
              </Button>
            </motion.div>
          </motion.div>

          {/* Prediction Contests CTA */}
          <motion.div variants={buttonVariants} className="flex justify-center mt-4 px-4">
            <Button 
              size="lg" 
              className="bg-primary-foreground text-primary border-0 hover:bg-primary-foreground/90 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-all w-full sm:w-auto max-w-lg"
              onClick={handleGoToContests}
            >
              <Trophy className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Prediction Contests
            </Button>
          </motion.div>

          <motion.p 
            className="text-sm sm:text-base text-primary-foreground/70 text-center max-w-md mx-auto mt-4"
            variants={itemVariants}
          >
            Trade with CricMaxx Tokens — <span className="font-semibold text-accent">1 Token = $1 USD</span>
          </motion.p>

          {/* How It Works mini-guide */}
          <motion.div
            className="mt-8 max-w-2xl mx-auto px-4"
            variants={itemVariants}
          >
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-primary-foreground/10">
              <h3 className="text-base sm:text-lg font-bold mb-4 text-center text-primary-foreground/90">How It Works</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="text-center space-y-1.5">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
                    <Coins className="h-4 w-4 text-accent" />
                  </div>
                  <p className="font-semibold text-primary-foreground/90">Polls</p>
                  <p className="text-primary-foreground/60 text-xs leading-relaxed">Stake tokens on your pick. Winners split the pool based on their share.</p>
                </div>
                <div className="text-center space-y-1.5">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
                    <BarChart3 className="h-4 w-4 text-accent" />
                  </div>
                  <p className="font-semibold text-primary-foreground/90">Markets</p>
                  <p className="text-primary-foreground/60 text-xs leading-relaxed">Buy Yes/No contracts (1¢–99¢). Correct pays $1, wrong pays $0.</p>
                </div>
                <div className="text-center space-y-1.5">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
                    <Trophy className="h-4 w-4 text-accent" />
                  </div>
                  <p className="font-semibold text-primary-foreground/90">Contests</p>
                  <p className="text-primary-foreground/60 text-xs leading-relaxed">Pay a buy-in, answer questions, and compete for the prize pot (50/30/20 split).</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
