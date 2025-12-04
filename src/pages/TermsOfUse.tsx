import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TermsOfUseProps {
  requireAcceptance?: boolean;
}

const TermsOfUse = ({ requireAcceptance = false }: TermsOfUseProps) => {
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAccept = async () => {
    if (!accepted) {
      toast({
        title: "Please accept the terms",
        description: "You must agree to the terms to continue",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Save acceptance to database with proper authentication
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to accept the terms",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving terms acceptance:', error);
        throw error;
      }

      // Also save to localStorage for quick client-side checks
      localStorage.setItem("termsAccepted", "true");
      
      toast({
        title: "Terms accepted",
        description: "You can now use all features of Shariz",
      });

      if (requireAcceptance) {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error('Terms acceptance error:', error);
      toast({
        title: "Error",
        description: "Failed to save terms acceptance. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Use</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Last Updated: November 12, 2025
          </p>

          <ScrollArea className="h-[500px] w-full border border-border rounded-lg p-6 bg-card">
            <div className="space-y-6 text-sm text-foreground">
              <section>
                <h2 className="text-lg font-semibold mb-3">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing or using Shariz, you agree to be bound by these Terms of Use and all applicable laws and regulations. 
                  If you do not agree with any of these terms, you are prohibited from using or accessing this platform.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">2. Platform Description</h2>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  Shariz is a federally-compliant prediction market platform offering peer-to-peer order book trading
                  with exchange-style order matching and fixed-payout event contracts.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">3. CFTC Regulation</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Shariz operates event contracts under U.S. Commodity Futures Trading Commission (CFTC) guidelines. 
                  All contracts are regulated as commodities, not gambling or betting. Event contracts are binary options that 
                  pay a fixed amount ($1.00) if the predicted event occurs and nothing ($0.00) if it does not. These are 
                  fixed-payout contracts regulated under federal law.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">4. Eligibility Requirements</h2>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  To use Shariz, you must:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Be at least 18 years of age or older</li>
                  <li>Be a legal resident of a jurisdiction where prediction markets are permitted</li>
                  <li>Complete identity verification (KYC) as required by federal law</li>
                  <li>Not be a prohibited person under applicable laws and regulations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">5. Know Your Customer (KYC)</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Federal regulations require Shariz to verify the identity of all users. You must provide accurate personal 
                  information and may be required to submit government-issued identification documents. Trading is restricted 
                  until KYC verification is complete. Failure to complete KYC may result in account suspension.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">6. Risk Disclosure</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Trading on prediction markets involves substantial risk of loss. The value of event contracts can fluctuate 
                  significantly based on market conditions and event outcomes. You may lose all funds invested in a position. 
                  Past performance is not indicative of future results. Only trade with funds you can afford to lose. 
                  Shariz is not responsible for trading losses.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">7. Market Rules</h2>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  All markets on Shariz are subject to specific rules including:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Clear question definitions and resolution criteria</li>
                  <li>Defined expiration dates and settlement procedures</li>
                  <li>Transparent order book pricing mechanisms</li>
                  <li>Verified resolution sources for determining outcomes</li>
                  <li>Platform and creator fees as disclosed per market</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">8. Fees and Costs</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Shariz charges a platform fee of up to 5% on winning positions. Creator markets may include additional 
                  creator fees (typically 2%). All fees are disclosed prior to trading. Fees are deducted automatically 
                  upon market settlement.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">9. Prohibited Conduct</h2>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  Users are prohibited from:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Market manipulation, wash trading, or spoofing</li>
                  <li>Using multiple accounts to circumvent limits</li>
                  <li>Sharing accounts or credentials</li>
                  <li>Engaging in money laundering or fraud</li>
                  <li>Circumventing platform security measures</li>
                  <li>Creating markets on illegal or unethical events</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">10. Account Suspension and Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Shariz reserves the right to suspend or terminate accounts for violations of these terms, suspected fraud, 
                  or failure to comply with KYC requirements. Suspended accounts may have trading restricted and withdrawals 
                  delayed pending investigation.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">11. Dispute Resolution</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Market outcomes are determined by designated resolution sources. Shariz administrators have final authority 
                  on market settlements. Disputes must be submitted within 7 days of market resolution. Users agree to binding 
                  arbitration for any disputes with Shariz.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">12. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Shariz is not liable for trading losses, market volatility, technical failures, or force majeure events. 
                  The platform is provided "as is" without warranties. Maximum liability is limited to fees paid by the user 
                  in the 12 months preceding any claim.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">13. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Shariz reserves the right to modify these terms at any time. Users will be notified of material changes. 
                  Continued use of the platform after changes constitutes acceptance of the new terms.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">14. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  For questions about these terms, contact us at legal@shariz.com or visit our support page.
                </p>
              </section>
            </div>
          </ScrollArea>

          {requireAcceptance && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="accept" 
                  checked={accepted}
                  onCheckedChange={(checked) => setAccepted(checked === true)}
                />
                <label
                  htmlFor="accept"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I have read and agree to the Terms of Use, and I acknowledge the risks involved in prediction market trading
                </label>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={handleAccept}
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  Accept and Continue
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="flex-1"
                >
                  Decline
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfUse;
