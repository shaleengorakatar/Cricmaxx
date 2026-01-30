import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Smartphone } from "lucide-react";
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
            fetchPriority="high"
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
            All contracts are CFTC-compliant.
          </motion.p>

          {/* Mobile-optimized buttons - stack on mobile, side-by-side on larger screens */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto px-4"
            variants={itemVariants}
          >
            <motion.div variants={buttonVariants}>
              <Button 
                size="lg" 
                className="bg-accent text-accent-foreground hover:bg-accent/90 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                onClick={handleStartTrading}
              >
                <TrendingUp className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Start Predicting
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
