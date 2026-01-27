import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BottomTabBar } from "@/components/mobile/BottomTabBar";
import cricmaxxLogo from "@/assets/cricmaxx-logo.png";

interface MobileLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
}

export const MobileLayout = ({ children, showHeader = true }: MobileLayoutProps) => {
  return (
    <div className="min-h-screen bg-background pb-24">
      {showHeader && (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-2">
          <Link to="/mobile" className="flex items-center">
            <img 
              src={cricmaxxLogo} 
              alt="CricMaxx" 
              className="h-10 w-auto"
            />
          </Link>
        </header>
      )}
      {children}
      <BottomTabBar />
    </div>
  );
};
