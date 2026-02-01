import { ReactNode } from "react";
import { BottomTabBar } from "@/components/mobile/BottomTabBar";
const cricmaxxLogo = "/assets/cricmaxx-logo.png";

interface MobileLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
}

export const MobileLayout = ({ children, showHeader = true }: MobileLayoutProps) => {
  return (
    <div className="min-h-screen bg-background pb-24">
      {showHeader && (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-2">
          <button 
            onClick={() => window.location.reload()} 
            className="flex items-center"
            aria-label="Reload page"
          >
            <img 
              src={cricmaxxLogo} 
              alt="CricMaxx" 
              width={60}
              height={40}
              className="h-10 w-auto"
            />
          </button>
        </header>
      )}
      {children}
      <BottomTabBar />
    </div>
  );
};
