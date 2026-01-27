import { useLocation, useNavigate } from "react-router-dom";
import { Home, TrendingUp, FileText, User, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
const cricmaxxLogo = "/assets/cricmaxx-logo.png";

const tabs = [
  { name: "Home", path: "/mobile", icon: Home },
  { name: "Markets", path: "/mobile/markets", icon: TrendingUp },
  { name: "Predict", path: "/mobile/swipepreds", icon: Zap, isPrimary: true },
  { name: "My Bets", path: "/mobile/predictions", icon: FileText },
  { name: "Profile", path: "/mobile/profile", icon: User },
];

export const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-4 left-4 right-4 mx-auto max-w-md z-50">
      {/* Floating glass container */}
      <div className="relative">
        {/* Logo centered above nav */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10">
          <img 
            src={cricmaxxLogo} 
            alt="CricMaxx" 
            width={36}
            height={24}
            className="h-6 w-auto opacity-60"
          />
        </div>
        
        {/* Glow effect behind the nav */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-xl opacity-60" />
        
        {/* Main nav bar */}
        <div className="relative bg-card/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-custom-xl overflow-hidden">
          {/* Subtle top highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          
          <div className="grid grid-cols-5 h-16 px-2">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              const Icon = tab.icon;
              
              if (tab.isPrimary) {
                return (
                  <button
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    className="relative flex items-center justify-center -mt-5"
                  >
                    {/* Primary action button with glow */}
                    <div className={cn(
                      "relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                      isActive 
                        ? "bg-gradient-to-br from-accent to-accent-hover shadow-accent scale-110" 
                        : "bg-gradient-to-br from-primary to-primary-hover shadow-custom-lg hover:scale-105"
                    )}>
                      {/* Pulsing glow ring when active */}
                      {isActive && (
                        <div className="absolute inset-0 rounded-2xl bg-accent/30 animate-pulse" style={{ filter: 'blur(8px)' }} />
                      )}
                      <Icon className="h-6 w-6 text-white relative z-10" />
                    </div>
                    {/* Label below floating button */}
                    <span className={cn(
                      "absolute -bottom-1 text-[10px] font-semibold transition-colors",
                      isActive ? "text-accent" : "text-muted-foreground"
                    )}>
                      {tab.name}
                    </span>
                  </button>
                );
              }
              
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 transition-all duration-200 group",
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {/* Active indicator dot */}
                  {isActive && (
                    <div className="absolute top-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-bounce-subtle" />
                  )}
                  
                  {/* Icon with subtle animation */}
                  <div className={cn(
                    "relative p-2 rounded-xl transition-all duration-200",
                    isActive && "bg-primary/10"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      isActive && "scale-110",
                      "group-hover:scale-105"
                    )} />
                  </div>
                  
                  {/* Label */}
                  <span className={cn(
                    "text-[10px] font-medium transition-all duration-200",
                    isActive ? "font-semibold" : "opacity-80 group-hover:opacity-100"
                  )}>
                    {tab.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Safe area padding for iOS */}
      <div className="h-safe-area-bottom" />
    </nav>
  );
};