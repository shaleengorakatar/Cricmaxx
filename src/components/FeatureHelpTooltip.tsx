import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface FeatureHelpTooltipProps {
  title: string;
  description: string;
  faqId?: string; // ID to link to specific FAQ section
}

const FeatureHelpTooltip = ({ title, description, faqId }: FeatureHelpTooltipProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  // Mobile: Use bottom sheet drawer
  if (isMobile) {
    return (
      <>
        <button 
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center focus:outline-none"
        >
          <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help" />
        </button>
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription className="leading-relaxed">
                {description}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="pt-2">
              {faqId && (
                <Link to={`/faq#${faqId}`} onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Learn more in FAQ →
                  </Button>
                </Link>
              )}
              <DrawerClose asChild>
                <Button variant="ghost">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: Use hover card
  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button className="inline-flex items-center justify-center focus:outline-none">
          <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 max-w-[calc(100vw-2rem)] z-50" align="start" sideOffset={5}>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          {faqId && (
            <Link to={`/faq#${faqId}`}>
              <Button variant="link" size="sm" className="h-auto p-0 text-primary">
                Learn more in FAQ →
              </Button>
            </Link>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default FeatureHelpTooltip;
