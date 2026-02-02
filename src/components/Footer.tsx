const Footer = () => {
  return (
    <footer className="bg-secondary border-t border-border">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Beta Notice */}
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 text-center">
            <p className="text-sm text-accent font-medium mb-1">🚀 Beta Release</p>
            <p className="text-sm text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              CricMaxx is currently in beta. We are in the process of obtaining CFTC regulatory approval. 
              These are fixed-payout event contracts, not gambling. Users must be 18+ and complete KYC verification.
            </p>
          </div>

          {/* Legal Disclaimer */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              CricMaxx is working toward CFTC compliance for all event contracts. 
              Event contracts pay $1.00 if correct, $0.00 if incorrect. Trading involves substantial risk. 
              Only trade with funds you can afford to lose.
            </p>
          </div>
          
          {/* Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <a 
              href="/terms" 
              className="text-foreground hover:text-accent transition-colors font-medium"
            >
              Terms of Use
            </a>
            <a 
              href="/privacy" 
              className="text-foreground hover:text-accent transition-colors font-medium"
            >
              Privacy Policy
            </a>
            <a 
              href="/faq" 
              className="text-foreground hover:text-accent transition-colors font-medium"
            >
              FAQ
            </a>
            <a 
              href="#" 
              className="text-foreground hover:text-accent transition-colors font-medium"
            >
              Contact Support
            </a>
          </div>
          
          {/* Copyright */}
          <div className="pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} CricMaxx. All rights reserved. CFTC compliance in progress.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
