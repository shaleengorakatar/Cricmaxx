import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import CricketScoresWidget from "@/components/CricketScoresWidget";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1">
        <Hero />
        <section className="py-12 bg-background">
          <div className="container mx-auto px-4">
            <CricketScoresWidget />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
