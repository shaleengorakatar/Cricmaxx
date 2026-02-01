const Footer = () => {
  return (
    <footer className="bg-secondary border-t border-border">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Compliance Notice */}
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              <strong className="text-foreground">Regulatory Compliance:</strong> CricMaxx is a federally-regulated prediction market platform. 
              All event contracts are regulated by the U.S. Commodity Futures Trading Commission (CFTC) under federal commodity law. 
              These are fixed-payout contracts, not gambling. Users must be 18+ and complete KYC verification.
            </p>
          </div>

          {/* Legal Disclaimer */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              All trades on CricMaxx are federally regulated fixed-payout contracts under CFTC rules. 
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
              © {new Date().getFullYear()} CricMaxx. All rights reserved. Licensed and regulated by the CFTC.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
