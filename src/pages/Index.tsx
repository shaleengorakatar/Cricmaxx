import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { FeaturedMarketHero } from "@/components/home/FeaturedMarketHero";
import { TrendingSidebar } from "@/components/home/TrendingSidebar";
import { TopMarketsSection } from "@/components/home/TopMarketsSection";
import { RecentPollsSection } from "@/components/RecentPollsSection";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <OnboardingModal />
      <main className="flex-1 pt-24">
        {/* Hero: Featured Market + Trending Sidebar (Kalshi-style) */}
        <section className="container mx-auto px-4 pb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main featured market carousel */}
            <div className="flex-1 min-w-0">
              <FeaturedMarketHero />
            </div>
            {/* Sidebar: Trending + Top Movers */}
            <div className="lg:w-80 shrink-0">
              <TrendingSidebar />
            </div>
          </div>
        </section>

        {/* Top Markets Grid */}
        <TopMarketsSection />

        {/* Recent Polls */}
        <RecentPollsSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
