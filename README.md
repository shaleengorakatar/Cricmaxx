# CricMaxx 🏏

**Fast. Live. Fun.** — Live cricket prediction markets at [cricmaxx.com](https://cricmaxx.com)

CricMaxx is a real-time cricket prediction platform where users trade on the outcomes of live matches. It features live prediction markets, rapid-fire predictions, polls, contests, friend leaderboards, and creator dashboards — all built on top of live cricket data.

## Features

- **Live prediction markets** — trade YES/NO positions on match outcomes with real-time pricing and volume
- **RapidPred** — fast-paced, ball-by-ball predictions during live matches
- **Prediction polls & contests** — community polls and bracket-style contests with leaderboards
- **Friends & invites** — add friends, compare records, and climb the leaderboard together
- **Payments** — Stripe-powered deposits, checkout, and creator payouts (Stripe Connect)
- **KYC verification** — identity verification flow for compliant trading
- **Admin & creator dashboards** — market management, debt/exposure tracking, and payout tools
- **PWA + mobile** — installable progressive web app with offline caching, plus iOS/Android builds via Capacitor

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui (Radix), Framer Motion |
| State/Data | TanStack Query, React Hook Form, Zod |
| Backend | Supabase (Postgres, Auth, Edge Functions) |
| Payments | Stripe & Stripe Connect |
| Cricket data | CricAPI |
| Analytics | PostHog |
| Mobile | Capacitor (iOS/Android) |

## Getting Started

Requires Node.js 18+.

```sh
# Install dependencies
npm install

# Start the dev server (http://localhost:8080)
npm run dev
```

### Environment

The app talks to a Supabase project for auth, data, and edge functions. Edge functions live in `supabase/functions/` and expect the following secrets to be configured in Supabase:

- `STRIPE_SECRET_KEY` — Stripe API key for checkout and Connect onboarding
- `CRICAPI_KEY` — live cricket match data

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

## Project Structure

```
src/
├── pages/          # Route-level pages (Markets, RapidPred, Dashboard, Admin, ...)
├── components/     # Shared UI components
├── contexts/       # React contexts (auth, etc.)
├── hooks/          # Custom hooks
├── integrations/   # Supabase client & generated types
├── layouts/        # App layouts
└── lib/            # Utilities
supabase/
└── functions/      # Edge functions (payments, payouts, market data)
```

## License

All rights reserved © CricMaxx.
