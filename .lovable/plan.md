

# CricMaxx: Developer Roadmap to 10,000 Users

## Where You Are Today

**What's built:**
- Full prediction platform: markets, polls, contests, order book trading, RapidPred (swipe predictions)
- Mobile-optimized pages with dedicated `/mobile/*` routes, glass-styled bottom tab bar, haptics, XP system
- Admin dashboard with user management, market resolution, fraud monitoring
- Friends system with invite links
- Capacitor config exists (native app shell ready)
- PWA manifest exists but **no service worker** (not installable yet)
- Onboarding flow, splash screen, invite gate (closed beta)
- Stripe integration for token purchases
- 33 database tables covering the full feature set

**What's missing for 10K users:** PWA install support, push notifications, analytics, SEO, referral engine, performance hardening, app store presence.

---

## The Roadmap (4 Phases)

### Phase 1: Foundation for Growth (Weeks 1-2)
*Make the app installable and trackable*

1. **PWA Setup** — Install `vite-plugin-pwa`, configure service worker with offline caching and `navigateFallbackDenylist` for `/~oauth`. This makes CricMaxx installable from any browser with one tap.

2. **Analytics Integration** — Add event tracking (page views, predictions placed, polls voted, tokens bought). Without data, you're flying blind. Use a lightweight solution like Plausible or PostHog.

3. **SEO & Open Graph** — Dynamic meta tags per market/poll page so shared links show rich previews on WhatsApp, Instagram, Twitter. Critical for viral sharing.

4. **Performance Hardening** — Image optimization (WebP/AVIF), lazy loading, prefetching hot routes. Target sub-2s load on 4G. You already have code splitting — good.

---

### Phase 2: Viral Growth Engine (Weeks 3-5)
*Turn every user into a recruiter*

5. **Referral System with Rewards** — Give both referrer and invitee bonus tokens (e.g., 50 tokens each). Track referral chains in the database. Add a referral leaderboard. Your invite system exists but lacks incentive.

6. **Push Notifications** — Web push (via service worker) for: market resolution, friend activity, new markets, price alerts. This is the #1 re-engagement tool. Build a `notifications` edge function + store subscription endpoints in the database.

7. **Social Sharing Upgrades** — One-tap share to WhatsApp (dominant in cricket communities), with pre-filled messages like "I just predicted India vs Australia on CricMaxx. Think you can beat me?" Add share buttons on every market result and poll outcome.

8. **WhatsApp/Telegram Group Bot** — A simple bot that posts live market updates and results to group chats. Cricket fans live in group chats — meet them there.

---

### Phase 3: Mobile App & Retention (Weeks 6-8)
*Lock in daily usage*

9. **Native App via Capacitor** — You already have the config. Steps to ship:
   - Export to GitHub, run `npx cap add ios && npx cap add android`
   - Add native push notifications (`@capacitor/push-notifications`)
   - Add biometric auth (`@capacitor/biometrics`) — your hook already exists
   - Submit to App Store + Play Store (Apple requires $99/yr dev account, Google $25 one-time)
   - Use the Lovable preview URL for hot-reload during development

10. **Daily Engagement Loops** — Daily free prediction (no stake required), streak bonuses (you have `StreakDisplay` already), daily leaderboard resets, "prediction of the day" featured market.

11. **Live Match Experience** — Real-time price movement animations during live matches, ball-by-ball market updates via your cricket data proxy, in-app match scorecard so users never leave.

---

### Phase 4: Scale & Monetize (Weeks 9-12)
*Sustain growth and fund operations*

12. **Performance at Scale** — Connection pooling, database indexing on hot queries (markets by status, user positions, leaderboard), Redis-style caching via your `cache-manager` edge function. Your k6 tests show ~400 req/s capacity — target 1000+.

13. **Content & Community** — User-generated markets (your creator system exists), featured predictors, weekly recap emails, cricket commentary/analysis section to drive organic SEO traffic.

14. **Monetization** — Platform fee on token transactions (your `PlatformFeesPanel` exists), premium features (advanced analytics, priority market creation), sponsored markets with cricket brands.

---

## User Acquisition Strategy (How to Actually Get 10K)

```text
Channel                  Target Users    Cost
─────────────────────────────────────────────────
Referral program         3,000           Low (token incentives)
WhatsApp/cricket groups  2,500           Free (manual seeding)
Instagram/Twitter        1,500           $500-1K ads
Cricket forums/Reddit    1,000           Free (organic)
App Store organic        1,000           Free (ASO)
Influencer partnerships  1,000           $500-2K
                         ─────
Total                    10,000
```

**Key insight:** Cricket fans are community-driven. One power user in a WhatsApp group of 200 cricket fans can bring 20-50 users. Target group admins, cricket content creators, and fantasy cricket communities.

---

## Priority Order for Implementation

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 1 | PWA (installable app) | High | 1 day |
| 2 | Referral rewards system | High | 2-3 days |
| 3 | Push notifications | High | 3-4 days |
| 4 | WhatsApp share optimization | High | 1 day |
| 5 | Analytics | Medium | 1 day |
| 6 | Native app (Capacitor) | Medium | 1 week |
| 7 | Daily engagement loops | Medium | 2-3 days |
| 8 | SEO / Open Graph | Medium | 1-2 days |

Start with PWA + referral rewards. These two alone can take you from beta to 1,000 users. Push notifications + WhatsApp sharing get you to 5,000. The native app and engagement loops push you to 10,000.

