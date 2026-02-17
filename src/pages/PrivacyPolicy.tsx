import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ScrollArea } from "@/components/ui/scroll-area";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-28 lg:pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Last Updated: November 12, 2025
          </p>

          <ScrollArea className="h-[500px] w-full border border-border rounded-lg p-6 bg-card">
            <div className="space-y-6 text-sm text-foreground">
              <section>
                <h2 className="text-lg font-semibold mb-3">1. Information We Collect</h2>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  CricMaxx collects the following information:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>Identity Information:</strong> Name, date of birth, address, government ID (for KYC verification)</li>
                  <li><strong>Account Information:</strong> Email, username, password (encrypted)</li>
                  <li><strong>Financial Information:</strong> Trading history, balances, transaction records</li>
                  <li><strong>Technical Information:</strong> IP address, device information, browser type, usage data</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">2. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  We use collected information to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Verify your identity and comply with KYC/AML regulations</li>
                  <li>Process trades and manage your account</li>
                  <li>Prevent fraud and ensure platform security</li>
                  <li>Improve our services and user experience</li>
                  <li>Communicate important updates and notifications</li>
                  <li>Comply with legal obligations and regulatory requirements</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">3. Information Sharing</h2>
                <p className="text-muted-foreground leading-relaxed">
                  CricMaxx does not sell your personal information. We may share information with:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                  <li>Regulatory authorities (CFTC, FinCEN) as required by law</li>
                  <li>KYC verification service providers</li>
                  <li>Payment processors for transaction handling</li>
                  <li>Legal authorities pursuant to valid legal process</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">4. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement industry-standard security measures including encryption, secure servers, and access controls. 
                  However, no system is completely secure. Users are responsible for maintaining the confidentiality of their 
                  account credentials.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">5. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We retain your information for as long as your account is active and for 7 years after closure as required 
                  by financial regulations. KYC documents are retained per regulatory requirements.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">6. Your Rights</h2>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  You have the right to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Access your personal information</li>
                  <li>Request corrections to inaccurate data</li>
                  <li>Request deletion (subject to legal retention requirements)</li>
                  <li>Opt-out of marketing communications</li>
                  <li>Export your trading data</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">7. Cookies and Tracking</h2>
                <p className="text-muted-foreground leading-relaxed">
                  CricMaxx uses cookies and similar technologies to maintain sessions, analyze usage patterns, and improve 
                  platform functionality. You can manage cookie preferences through your browser settings.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">8. Children's Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  CricMaxx does not knowingly collect information from individuals under 18. If we become aware of such data 
                  collection, we will promptly delete it.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">9. International Users</h2>
                <p className="text-muted-foreground leading-relaxed">
                  CricMaxx operates under U.S. jurisdiction. By using our services, international users consent to the transfer 
                  and processing of their data in the United States.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">10. Policy Changes</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this privacy policy periodically. Material changes will be communicated via email and platform 
                  notifications. Continued use constitutes acceptance of the updated policy.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">11. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  For privacy-related inquiries or to exercise your rights, contact us at privacy@cricmaxx.com or write to: 
                  CricMaxx Privacy Office, [Address].
                </p>
              </section>
            </div>
          </ScrollArea>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
