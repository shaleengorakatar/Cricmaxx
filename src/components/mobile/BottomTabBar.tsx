import { useLocation, useNavigate } from "react-router-dom";
import { Home, TrendingUp, FileText, Wallet, User } from "lucide-react";

const tabs = [
  { name: "Home", path: "/mobile", icon: Home },
  { name: "Markets", path: "/mobile/markets", icon: TrendingUp },
  { name: "Predictions", path: "/mobile/predictions", icon: FileText },
  { name: "Wallet", path: "/mobile/wallet", icon: Wallet },
  { name: "Profile", path: "/mobile/profile", icon: User },
];

export const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-bottom z-50">
      <div className="grid grid-cols-5 h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{tab.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
