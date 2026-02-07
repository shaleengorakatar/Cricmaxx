import { TrendingUp, Zap, Target, ArrowLeftRight, Trophy, HelpCircle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const quickSteps = [
  {
    icon: TrendingUp,
    title: "Pick a Market",
    description: "Choose YES or NO on event outcomes",
  },
  {
    icon: Zap,
    title: "Quick Predict",
    description: "Instant trade at current price",
  },
  {
    icon: Target,
    title: "Set Your Price",
    description: "Place limit orders at your price",
  },
  {
    icon: ArrowLeftRight,
    title: "Sell Anytime",
    description: "Exit positions before resolution",
  },
  {
    icon: Trophy,
    title: "Win 1 Token/Contract",
    description: "Correct predictions pay 1 token each",
  },
];

const detailedSections = [
  {
    emoji: "🎯",
    title: "What is CricMaxx?",
    content:
      "CricMaxx is a prediction market for cricket. You buy contracts that pay out if your prediction is correct. Think of it like placing a friendly bet with your mates — except the price tells you what everyone thinks the odds are.",
  },
  {
    emoji: "💰",
    title: "How Contracts Work",
    content:
      "Every market has YES and NO contracts. Each contract is priced between 1¢ and 99¢. If your prediction is correct, each contract you hold is worth exactly 1 token. If you're wrong, it's worth 0 tokens.",
    example: {
      heading: "Example",
      lines: [
        "You think India will reach the semi-finals.",
        "YES contracts are trading at 75¢ — meaning the crowd thinks there's a ~75% chance.",
        "You buy 10 YES contracts for 7.50 tokens (10 × 75¢).",
        "✅ If India does: you get 10 tokens back → 2.50 tokens profit!",
        "❌ If India doesn't: your contracts are worth 0 → you lose 7.50 tokens.",
      ],
    },
  },
  {
    emoji: "📊",
    title: "What Do the Prices Mean?",
    content:
      'The price of a YES contract roughly equals the crowd\'s estimated probability. If YES is at 30¢, the crowd thinks there\'s about a 30% chance it happens. If you think the real chance is higher, that\'s a buying opportunity! The YES and NO prices always add up to around 1 token.',
  },
  {
    emoji: "⚡",
    title: "Quick Predict (Market Order)",
    content:
      "Quick Predict buys contracts instantly at the best available prices in the order book. You choose how many tokens to spend, and the system fills your order by eating through available liquidity from cheapest to most expensive.",
    example: {
      heading: "Example — Simple Fill",
      lines: [
        "Market: \"Will India beat Pakistan?\"",
        "The order book has 20 YES contracts available at 60¢.",
        "You spend 6 tokens → you get 10 YES contracts (6 ÷ 0.60 = 10).",
        "✅ If India wins: 10 contracts × 1 token = 10 tokens back → 4 tokens profit!",
        "❌ If India loses: your contracts are worth 0 → you lose 6 tokens.",
      ],
    },
  },
  {
    emoji: "📉",
    title: "What Happens When Liquidity is Thin?",
    content:
      "If there aren't enough contracts at one price, your order walks up the book — buying at increasingly expensive prices. This is called slippage. CricMaxx protects you with a 10% slippage cap.",
    example: {
      heading: "Example — Partial Fill with Slippage",
      lines: [
        "You want to spend 10 tokens on YES.",
        "Order book: 5 contracts at 50¢, 5 contracts at 55¢, 10 contracts at 65¢.",
        "First: 5 contracts at 50¢ = 2.50 tokens spent.",
        "Next: 5 contracts at 55¢ = 2.75 tokens spent.",
        "Next: the system tries 65¢, but that's more than 10% above the starting price (50¢).",
        "⚠️ Slippage protection kicks in! Your order stops here.",
        "Result: You get 10 contracts for 5.25 tokens. The remaining 4.75 tokens are returned to your balance.",
        "Your effective price: 52.5¢ per contract (weighted average).",
      ],
    },
  },
  {
    emoji: "🚫",
    title: "What If There's No Liquidity?",
    content:
      "If nobody has placed orders on the other side, there's nothing to buy. CricMaxx won't let you trade into thin air — you'll see a \"No liquidity\" message. In that case, you can switch to Set Your Price (limit order) and place your own offer. Your order sits in the book until someone matches it.",
    example: {
      heading: "Example — No Liquidity",
      lines: [
        "Market: \"Will there be a Super Over?\"",
        "You tap Quick Predict YES, but no one has placed any NO orders.",
        "The button shows \"No liquidity\" — you can't buy.",
        "Instead, you switch to Set Your Price and offer to buy YES at 30¢.",
        "Your order waits in the book. When someone comes along and sells at 30¢, your order fills!",
      ],
    },
  },
  {
    emoji: "🎯",
    title: "Set Your Price (Limit Order)",
    content:
      "With a limit order, you name your own price. Your order only fills if someone is willing to trade at that price or better. It's like saying \"I'll buy, but only at my price.\" You might get a better deal than Quick Predict, but it's not guaranteed to fill.",
    example: {
      heading: "Example — Limit Order",
      lines: [
        "YES is currently at 70¢ but you think that's too expensive.",
        "You place a limit order: Buy 10 YES at 55¢.",
        "Your 5.50 tokens are held as collateral.",
        "If the price drops and someone sells at 55¢ → your order fills. Great deal!",
        "If the price never drops that low → your order stays open. You can cancel anytime to get your tokens back.",
      ],
    },
  },
  {
    emoji: "🔄",
    title: "Can I Sell Before the Event?",
    content:
      "Yes! You don't have to wait for the event to finish. If the price moves in your favour, you can sell your contracts to lock in a profit early. If it moves against you, you can sell to cut your losses. You're never locked in.",
    example: {
      heading: "Example",
      lines: [
        "You bought YES at 40¢. Good news comes out and the price jumps to 70¢.",
        "You sell your contracts at 70¢ → 30¢ profit per contract, no need to wait!",
      ],
    },
  },
  {
    emoji: "🏏",
    title: "How Do Markets Resolve?",
    content:
      'After the event happens, each market is resolved as YES or NO based on the exact outcome described. Important: the prediction must happen exactly as stated. If it doesn\'t occur precisely as described, the market resolves to NO.',
  },
  {
    emoji: "🤝",
    title: "Tokens & Settlement",
    content:
      "CricMaxx uses tokens (1 token = $1 USD). All balances are settled between participants after the World Cup 2026 under a gentleman's agreement. This is a friendly competition among mates!",
  },
];

export const HowItWorks = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="py-6 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            How it works
          </p>

          {/* Quick summary row */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 lg:gap-x-10">
            {quickSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <step.icon className="w-4 h-4 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground max-w-[130px]">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Expand / Collapse toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-1"
          >
            <HelpCircle className="h-4 w-4" />
            {expanded ? "Hide full guide" : "New here? Read the full guide"}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </button>

          {/* Detailed guide */}
          {expanded && (
            <div className="w-full max-w-2xl mt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {detailedSections.map((section, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/60 bg-card/80 p-4 sm:p-5 space-y-2.5"
                >
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <span className="text-lg">{section.emoji}</span>
                    {section.title}
                  </h3>

                  {section.content && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  )}


                  {section.example && (
                    <div className="bg-muted/60 rounded-lg p-3 sm:p-4 space-y-1.5 mt-2">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        {section.example.heading}
                      </p>
                      <ul className="space-y-1">
                        {section.example.lines.map((line, k) => (
                          <li key={k} className="text-sm text-muted-foreground leading-relaxed">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              <p className="text-center text-xs text-muted-foreground pt-2 pb-1">
                Still confused?{" "}
                <a href="/faq" className="text-primary hover:underline">
                  Check out the full FAQ →
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
