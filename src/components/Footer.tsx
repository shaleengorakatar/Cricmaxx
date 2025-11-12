const Footer = () => {
  return (
    <footer className="bg-secondary border-t border-border">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            All trades on Shariz are federally regulated fixed-payout contracts under CFTC rules. 
            Shariz provides a secure, compliant platform for prediction market participation.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <a 
              href="#" 
              className="text-foreground hover:text-accent transition-colors font-medium"
            >
              Terms of Use
            </a>
            <a 
              href="#" 
              className="text-foreground hover:text-accent transition-colors font-medium"
            >
              Privacy Policy
            </a>
            <a 
              href="#" 
              className="text-foreground hover:text-accent transition-colors font-medium"
            >
              Risk Disclosure
            </a>
          </div>
          
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Shariz. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
