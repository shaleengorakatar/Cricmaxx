import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import cricmaxxLogo from "@/assets/cricmaxx-logo.png";

interface SplashScreenProps {
  isVisible: boolean;
  onSkip?: () => void;
}

const SplashScreen = ({ isVisible, onSkip }: SplashScreenProps) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSkip?.();
    }
  }, [onSkip]);

  useEffect(() => {
    if (isVisible) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isVisible, handleKeyDown]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-primary via-primary to-primary/90"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          {/* Background glow effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/15 rounded-full blur-3xl" />
          </div>

          {/* Skip button */}
          <motion.div
            className="absolute top-6 right-6 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              Skip
            </Button>
          </motion.div>

          {/* Logo with animation - larger size to account for empty space in image */}
          <motion.img
            src={cricmaxxLogo}
            alt="CricMaxx"
            className="h-72 sm:h-96 md:h-[28rem] w-auto drop-shadow-2xl relative z-10 -my-8"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              y: [0, -8, 0],
            }}
            transition={{
              scale: { duration: 0.5, ease: "easeOut" },
              opacity: { duration: 0.5 },
              y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }}
          />

          {/* Tagline */}
          <motion.p
            className="text-primary-foreground text-xl sm:text-2xl font-semibold mt-4 relative z-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Fast. Live. Fun.
          </motion.p>

          {/* Loading indicator */}
          <motion.div
            className="mt-8 flex gap-1.5 relative z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-accent"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
