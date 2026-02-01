import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openItem, setOpenItem] = useState<string | undefined>(undefined);
  
  const faqSections = [
    {
      id: "getting-started",
      title: "Getting Started",
      questions: [
        {
          id: "what-is-cricmaxx",
          q: "What is CricMaxx?",
          a: "CricMaxx is a federally-regulated prediction market platform where you can trade on the outcomes of cricket events. You buy shares that pay $1.00 if your prediction is correct and $0.00 if incorrect. It's regulated by the U.S. Commodity Futures Trading Commission (CFTC) as event contracts, not gambling."
        },
        {
          id: "create-account",
          q: "How do I create an account?",
          a: "Click 'Sign Up' in the top navigation, enter your email and create a password. You'll receive a verification email to confirm your account. Once verified, you can start exploring markets and add tokens to begin trading."
        },
        {
          id: "what-are-tokens",
          q: "What are CricMaxx Tokens?",
          a: "CricMaxx Tokens are the currency used on our platform. Each token equals $1.00 USD. You use tokens as collateral to take positions in prediction markets. When markets resolve, your tokens are returned based on the outcome—either your original stake plus profit, or $0.00 if your prediction was incorrect."
        },
      ]
    },
    {
      id: "how-trading-works",
      title: "How Trading Works",
      questions: [
        {
          id: "prediction-markets",
          q: "How do prediction markets work?",
          a: "Prediction markets let you trade on the probability of future events. Each market asks a yes/no question (e.g., 'Will India score 300+ runs?'). You buy YES or NO shares at a price between $0.01 and $0.99. If you're right, each share pays $1.00. If wrong, it pays $0.00. The market price reflects the crowd's estimated probability of the event happening."
        },
        {
          id: "price-meaning",
          q: "What does the price mean?",
          a: "The price represents both the cost per share and the implied probability. A YES price of $0.65 means: (1) you pay $0.65 per share, (2) if correct, you receive $1.00 (profit of $0.35), (3) the market estimates a 65% chance the event happens. Lower prices mean higher potential returns but lower probability."
        },
        {
          id: "quick-predict",
          q: "What is Quick Predict?",
          a: "Quick Predict is our fastest way to trade. Simply choose your stake amount ($5, $10, $25, or $50), tap YES or NO, and your order executes instantly at the current market price. It's designed for speed—perfect for live cricket markets where prices move quickly."
        },
        {
          id: "quick-predict-how",
          q: "How does Quick Predict work?",
          a: "When you use Quick Predict: (1) Select your investment amount, (2) The system shows you exactly how many shares you'll get and your potential payout, (3) Tap YES or NO to execute immediately, (4) Your order matches against existing orders in the order book at the best available prices. If there's enough liquidity, your order fills instantly."
        },
        {
          id: "set-your-price",
          q: "What is 'Set Your Price' mode?",
          a: "'Set Your Price' lets you place a limit order—you choose the exact price you're willing to pay. Your order sits in the order book until someone agrees to trade at your price. This is useful when you want a better price than what's currently available, or when you want to provide liquidity to the market."
        },
        {
          id: "limit-order",
          q: "What is a limit order?",
          a: "A limit order is an instruction to buy or sell at a specific price or better. Unlike Quick Predict (market orders) which execute immediately at available prices, limit orders wait in the order book until the market reaches your price. You can cancel unfilled limit orders anytime and get your tokens back."
        },
        {
          id: "order-book",
          q: "What is the order book?",
          a: "The order book is a list of all pending buy and sell orders for a market. It shows the available prices and quantities on both sides. When you place an order, the system checks the order book to find matching orders. The order book determines liquidity—more orders mean easier and faster trades with less price impact."
        },
        {
          id: "low-liquidity",
          q: "What happens if there aren't enough orders in the order book?",
          a: "If there's insufficient liquidity for your market order, you'll see a notification and be offered a shortcut to 'Set Your Price' mode. This lets you place a limit order at your desired price, which will sit in the order book waiting for a match. You become a liquidity provider, and when someone takes the other side, your order fills."
        },
        {
          id: "liquidity-check",
          q: "How do I know if there's enough liquidity?",
          a: "Before confirming a trade, we show you an 'Estimated Fill Price' that previews your execution price based on current order book depth. If liquidity is thin, you'll see a warning indicator and the estimated price may differ from the displayed market price. This transparency helps you decide whether to proceed or set a limit order instead."
        },
        {
          id: "cancel-prediction",
          q: "Can I cancel my prediction?",
          a: "You can cancel unfilled limit orders anytime. Go to the market page, find your pending order in the 'Your Position' section, and tap 'Cancel Order'. Your tokens are immediately returned to your available balance. Note: You cannot cancel orders that have already been filled—those become open positions."
        },
        {
          id: "sell-position",
          q: "Can I sell my position before the market ends?",
          a: "Yes! You don't have to wait for the market to resolve. Go to the market page, find your position, and tap 'Sell'. You can sell at the current market price (instant) or set your own price (limit order). Selling locks in your profit or loss immediately instead of waiting for the final outcome."
        },
        {
          id: "sell-vs-cancel",
          q: "What's the difference between selling and canceling?",
          a: "Canceling applies to unfilled limit orders—you get your original tokens back with no trade occurring. Selling applies to open positions (shares you already own)—you're trading those shares to another user at the current market price, which may result in a profit or loss compared to your entry price."
        },
        {
          id: "partial-fills",
          q: "What happens if my order only partially fills?",
          a: "If the order book doesn't have enough liquidity for your full order, you'll get a partial fill. We'll show you a dialog explaining how much was filled and offer a quick shortcut to place a limit order for the remaining amount. Partial fills are common in less liquid markets."
        },
        {
          id: "slippage",
          q: "What is slippage?",
          a: "Slippage is the difference between the expected price and the actual execution price. It happens when the market moves while your order is being processed, or when your order is large enough to consume multiple price levels in the order book. We apply a 10% slippage protection to market orders to prevent unexpectedly bad fills."
        },
        {
          id: "price-impact",
          q: "What does 'price impact' mean?",
          a: "Price impact shows how much your order will move the market price. Large orders relative to available liquidity will 'eat through' multiple price levels, resulting in an average fill price worse than the top-of-book price. We display estimated price impact before you confirm so you can adjust your order size if needed."
        },
      ]
    },
    {
      id: "positions-payouts",
      title: "Positions & Payouts",
      questions: [
        {
          id: "view-positions",
          q: "How do I view my positions?",
          a: "Your open positions appear on each market's page in the 'Your Position' card. For a full portfolio view, go to your Dashboard where you'll see all active positions, pending orders, P&L calculations, and trading history across all markets."
        },
        {
          id: "market-resolves",
          q: "What happens when a market resolves?",
          a: "When the event outcome is determined, we resolve the market using official data sources. If you held YES shares and the event happened, each share pays $1.00. If it didn't happen, YES shares pay $0.00 (and NO shares pay $1.00). Payouts are automatically credited to your token balance."
        },
        {
          id: "payout-calculation",
          q: "How is my payout calculated?",
          a: "Payout = Number of Shares × $1.00 (if correct) or $0.00 (if incorrect). Your profit is the payout minus what you paid. Example: You buy 10 YES shares at $0.40 each (cost: $4.00). If YES wins, you receive $10.00 (profit: $6.00). If NO wins, you receive $0.00 (loss: $4.00)."
        },
        {
          id: "wrong-prediction",
          q: "What if I predicted wrong?",
          a: "If your prediction is incorrect, your shares expire worthless ($0.00 payout). This is the risk of prediction markets—you can lose your entire stake on a position. We recommend only trading with amounts you can afford to lose and diversifying across multiple markets."
        },
        {
          id: "exact-outcome",
          q: "What if the prediction doesn't happen exactly as stated?",
          a: "Predictions must happen exactly as stated for YES to win. If the event doesn't occur precisely as described in the market question, the market resolves to NO. For example, if a market asks 'Will Player X score 50+ runs?' and they score 49, the outcome is NO. There's no partial credit—it's binary. Always read the full market question and resolution rules carefully before trading."
        },
      ]
    },
    {
      id: "tokens-wallet",
      title: "Tokens & Wallet",
      questions: [
        {
          id: "buy-tokens",
          q: "How do I buy tokens?",
          a: "Go to your Wallet and tap 'Buy Tokens'. Select a preset amount ($10, $25, $50, $100) or enter a custom amount. Complete payment via credit card or linked bank account. Tokens are credited instantly after successful payment."
        },
        {
          id: "redeem-tokens",
          q: "How do I redeem tokens?",
          a: "Go to your Wallet and tap 'Request Redemption'. Enter the amount you wish to redeem (minimum $10). Tokens must be available (not committed to open positions). Redemptions are processed within 2-5 business days and transferred to your linked bank account, subject to verification."
        },
        {
          id: "in-play",
          q: "What does 'In Play' mean?",
          a: "'In Play' shows tokens currently committed to open positions and pending orders. These tokens are locked as collateral until the positions close (market resolves or you sell) or orders are canceled. Only your 'Available' balance can be used for new trades or redemptions."
        },
        {
          id: "cant-use-tokens",
          q: "Why can't I use all my tokens?",
          a: "Your tradeable balance is your Available tokens, not your total balance. Tokens 'In Play' are locked in active positions or pending orders. To free up tokens: sell existing positions, cancel pending limit orders, or wait for markets to resolve."
        },
      ]
    },
    {
      id: "fees-compliance",
      title: "Fees & Compliance",
      questions: [
        {
          id: "fees",
          q: "What fees does CricMaxx charge?",
          a: "CricMaxx charges a 3% platform fee on trades, deducted at the time of the trade. Market creators earn a 2% commission on volume in their markets. There are no deposit fees. Redemption fees may apply for expedited processing. All fees are transparently displayed before you confirm any transaction."
        },
        {
          id: "gambling",
          q: "Is this gambling?",
          a: "No. CricMaxx operates as a CFTC-regulated prediction market offering event contracts. These are federally-approved financial instruments, not gambling. Event contracts are classified as commodity swaps and operate under strict regulatory oversight. The key difference: prediction markets aggregate information and reflect real probabilities, serving an economic purpose beyond entertainment."
        },
      ]
    },
  ];

  // Build a map of question ID to accordion value
  const idToValueMap = useMemo(() => {
    const map: Record<string, string> = {};
    faqSections.forEach((section, sectionIndex) => {
      section.questions.forEach((item, itemIndex) => {
        map[item.id] = `${sectionIndex}-${itemIndex}`;
      });
    });
    return map;
  }, []);

  // Handle hash navigation - expand the relevant accordion and scroll to it
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && idToValueMap[hash]) {
      setOpenItem(idToValueMap[hash]);
      // Small delay to allow accordion to expand before scrolling
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.hash, idToValueMap]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-foreground mb-2">Frequently Asked Questions</h1>
            <p className="text-muted-foreground">
              Everything you need to know about trading on CricMaxx
            </p>
          </div>

          <div className="space-y-8">
{faqSections.map((section, sectionIndex) => (
              <div key={sectionIndex} id={section.id}>
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="h-1 w-6 bg-accent rounded-full" />
                  {section.title}
                </h2>
                <Accordion 
                  type="single" 
                  collapsible 
                  className="space-y-2"
                  value={openItem}
                  onValueChange={setOpenItem}
                >
                  {section.questions.map((item, itemIndex) => (
                    <AccordionItem 
                      key={itemIndex} 
                      value={`${sectionIndex}-${itemIndex}`}
                      id={item.id}
                      className="bg-card border border-border rounded-lg px-4 scroll-mt-24"
                    >
                      <AccordionTrigger className="text-left text-sm sm:text-base hover:no-underline">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FAQ;
