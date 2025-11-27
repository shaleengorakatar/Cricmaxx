import { ReactNode } from "react";
import { BottomTabBar } from "@/components/mobile/BottomTabBar";

interface MobileLayoutProps {
  children: ReactNode;
}

export const MobileLayout = ({ children }: MobileLayoutProps) => {
  return (
    <div className="min-h-screen bg-background pb-16">
      {children}
      <BottomTabBar />
    </div>
  );
};
