import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import CricketScoresWidget from "@/components/CricketScoresWidget";
import SeriesSearchWidget from "@/components/SeriesSearchWidget";
import LiveMarketsWidget from "@/components/LiveMarketsWidget";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1">
        <Hero />
        <LiveMarketsWidget />
        <section className="py-12 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <CricketScoresWidget />
              <SeriesSearchWidget />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
