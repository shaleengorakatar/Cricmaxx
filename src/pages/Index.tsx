import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import CricketScoresWidget from "@/components/CricketScoresWidget";
import SeriesSearchWidget from "@/components/SeriesSearchWidget";
import LiveMarketsWidget from "@/components/LiveMarketsWidget";
import { FeaturedMarket } from "@/components/markets/FeaturedMarket";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { HowItWorks } from "@/components/HowItWorks";
import { RecentMarketsSection } from "@/components/RecentMarketsSection";
import { RecentPollsSection } from "@/components/RecentPollsSection";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <OnboardingModal />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        
        {/* Featured Market - Prediction of the Day */}
        <section className="py-8 bg-gradient-to-b from-secondary/30 to-background">
          <div className="container mx-auto px-4">
            <FeaturedMarket />
          </div>
        </section>
        
        <RecentMarketsSection />
        <RecentPollsSection />
        <LiveMarketsWidget />
        {/* SeriesSearchWidget hidden for now */}
      </main>
      <Footer />
    </div>
  );
};

export default Index;
