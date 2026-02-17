import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { FeaturedMarketHero } from "@/components/home/FeaturedMarketHero";
import { TrendingSidebar } from "@/components/home/TrendingSidebar";
import { TopMarketsSection } from "@/components/home/TopMarketsSection";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <OnboardingModal />
      <main className="flex-1 pt-28 lg:pt-20">
        {/* Hero: Featured Market + Trending/Polls/Contests Sidebar */}
        <section className="container mx-auto px-4 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex-1 min-w-0 space-y-4">
              <FeaturedMarketHero />
              <TopMarketsSection />
            </div>
            <div className="lg:w-72 shrink-0 lg:sticky lg:top-20 lg:self-start">
              <TrendingSidebar />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
