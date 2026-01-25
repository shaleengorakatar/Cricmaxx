# Criccmax Branding & Style Guide

## Brand Identity

**Criccmax - Fast. Live. Fun. 🏏**

The ultimate cricket prediction playground — a modern, energetic, and sporty platform that feels like being at the stadium.

---

## Color Palette

### Primary: Deep Navy Blue
**HSL: `220 80% 15%`** | **Hex: `#1A2E5C`**

- **Usage**: Headers, navigation bar, primary buttons, trust elements
- **Meaning**: Professionalism, trustworthiness, stability
- **Applications**: Main brand color for headers, primary CTAs, and professional elements

### Accent: Vibrant Orange
**HSL: `25 100% 60%`** | **Hex: `#F5A623`**

- **Usage**: Highlights, secondary buttons, important icons, calls-to-action
- **Meaning**: Energy, action, enthusiasm
- **Applications**: Use sparingly for emphasis on key actions and important data points

### Supporting Colors

| Color | HSL | Usage |
|-------|-----|-------|
| Success Green | `142 76% 36%` | Positive outcomes, wins, verified status |
| Warning Yellow | `38 92% 50%` | Alerts, pending actions, caution |
| Destructive Red | `0 84.2% 60.2%` | Errors, losses, critical actions |

### Neutral Colors

- **Background**: White `0 0% 100%`
- **Card**: White `0 0% 100%`
- **Border**: Light Grey `220 30% 88%`
- **Muted Text**: Grey `220 20% 45%`
- **Foreground Text**: Deep Navy `220 80% 15%`

---

## Typography

### Font Family
**Space Grotesk** - Modern, techy, and sporty sans-serif

```css
font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
```

### Typography Scale

| Element | Size | Weight | Use Case |
|---------|------|--------|----------|
| H1 | 2.25rem (36px) | Bold (700) | Page titles |
| H2 | 1.875rem (30px) | Semibold (600) | Section headers |
| H3 | 1.5rem (24px) | Semibold (600) | Subsection titles |
| H4 | 1.25rem (20px) | Semibold (600) | Card headers |
| H5 | 1.125rem (18px) | Medium (500) | Small headers |
| Body | 1rem (16px) | Regular (400) | Standard text |
| Small | 0.875rem (14px) | Regular (400) | Labels, captions |
| Tiny | 0.75rem (12px) | Regular (400) | Fine print |

### Font Weights
- **Regular (400)**: Body text, descriptions
- **Medium (500)**: Emphasized text
- **Semibold (600)**: Headings, important labels
- **Bold (700)**: Major headings, strong emphasis
- **Extrabold (800)**: Hero text, brand name

---

## Brand Voice

### Tagline
**"Fast. Live. Fun."**

### Sub-brands
- **Criccmax RapidPred** - Quick prediction feature
- **Criccmax Creator** - Market creation dashboard
- **Criccmax Wallet** - Token management

### Tone
- **Energetic**: Like a cricket stadium 📣
- **Sporty**: Cricket-focused, passionate
- **Fun**: Feels like fantasy gaming meets real-money skill
- **Trustworthy**: Regulated and transparent

### Example Copy
- ✅ "Make live predictions on your favorite matches"
- ✅ "Feel the stadium energy from anywhere"
- ✅ "CFTC-regulated fixed-payout contracts"
- ❌ "Gamble on outcomes" (implies gambling)
- ❌ "Get rich quick" (implies unrealistic returns)

---

## UI Components

### Buttons

#### Primary Button (Navy)
```tsx
className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform h-12 rounded-lg"
```
- **Use for**: Main actions like "Submit", "Predict", "Trade"
- **Colors**: Navy background, white text
- **Border radius**: 0.5rem (8px)

#### Accent Button (Orange)
```tsx
className="bg-accent text-accent-foreground hover:bg-accent/90 active:scale-95 transition-transform h-12 rounded-lg"
```
- **Use for**: Secondary important actions, CTAs
- **Colors**: Orange background, white text
- **Border radius**: 0.5rem (8px)

#### Outline Button
```tsx
className="border border-input bg-background hover:bg-accent hover:text-accent-foreground h-12 rounded-lg"
```
- **Use for**: Secondary actions, "Cancel"
- **Border radius**: 0.5rem (8px)

### Cards

```tsx
className="rounded-lg border bg-card text-card-foreground shadow-sm p-6"
```

#### Interactive Cards
```tsx
className="card-interactive" // Adds hover lift and scale
```

#### Hover Cards
```tsx
className="card-hover" // Adds smooth hover elevation
```

- **Border radius**: 0.5rem (8px)
- **Padding**: 1.5rem (24px)
- **Shadow**: Subtle elevation
- **Hover effect**: Slight lift on desktop

### Forms & Inputs

#### Input Fields
```tsx
className="h-12 text-base rounded-md border border-input"
```
- **Height**: 48px (h-12) for touch-friendly mobile
- **Border**: Light grey
- **Focus state**: Orange ring (`ring-accent`)
- **Border radius**: 0.375rem (6px)

#### Labels
```tsx
className="text-sm md:text-base font-medium"
```
- **Color**: Foreground text
- **Weight**: Medium (500)

---

## Design Tokens

### Spacing
Use 8px baseline grid:
- **4px** (`spacing-1`): Minimal spacing
- **8px** (`spacing-2`): Small spacing
- **16px** (`spacing-4`): Default spacing
- **24px** (`spacing-6`): Medium spacing
- **32px** (`spacing-8`): Large spacing
- **48px** (`spacing-12`): XL spacing

### Border Radius
- **Small**: 0.25rem (4px)
- **Medium**: 0.375rem (6px)
- **Default**: 0.5rem (8px)
- **Large**: 0.75rem (12px)

### Shadows

```css
/* Light mode */
--shadow-sm: 0 1px 2px 0 rgba(26, 46, 92, 0.05);
--shadow-md: 0 4px 6px -1px rgba(26, 46, 92, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(26, 46, 92, 0.1);
--shadow-accent: 0 10px 30px -10px rgba(245, 166, 35, 0.3);
```

### Transitions
- **Fast**: `0.15s cubic-bezier(0.4, 0, 0.2, 1)`
- **Smooth**: `0.3s cubic-bezier(0.4, 0, 0.2, 1)`

---

## Iconography

### Icon Library
Use **Lucide React** icons for consistency

### Icon Sizes
- **Small**: 16px (`h-4 w-4`)
- **Default**: 20px (`h-5 w-5`)
- **Large**: 24px (`h-6 w-6`)
- **XL**: 32px (`h-8 w-8`)

### Icon Colors
- **Default**: Navy blue (`text-primary`)
- **Accent**: Orange (`text-accent`)
- **Muted**: Grey (`text-muted-foreground`)

### Common Icons
| Purpose | Icon | Color |
|---------|------|-------|
| Wallet/Balance | Wallet | Primary |
| Verified/Success | CheckCircle, ShieldCheck | Success Green |
| Trading/Markets | TrendingUp, BarChart3 | Accent Orange |
| Time/Expiry | Clock, Calendar | Muted |
| Settings | Settings, Cog | Primary |
| Alert/Warning | AlertTriangle | Warning Yellow |
| Cricket | 🏏 emoji | - |

---

## Animations

### Available Animations
```tsx
animate-fade-in      // Fade in with slide up
animate-scale-in     // Scale in
animate-slide-up     // Slide up from bottom
animate-pulse        // Pulse effect for loading
```

### Component Classes
```tsx
card-hover          // Card hover lift effect
card-interactive    // Interactive card with scale
accent-underline    // Animated underline on hover
transition-smooth   // Smooth transitions
```

---

## Accessibility

### Color Contrast
- ✅ Navy blue on white: **13.4:1** (AAA)
- ✅ Orange on white: **4.5:1** (AA)
- ⚠️ Use orange sparingly for text; prefer for backgrounds
- ✅ Dark text on light backgrounds for readability

### Touch Targets
- **Minimum height**: 44px (iOS) / 48px (Android)
- **All buttons**: 48px height (`h-12`)
- **Spacing between targets**: At least 8px

### Focus States
- All interactive elements have visible focus rings
- Focus ring color: Orange (`ring-accent`)
- Never remove focus indicators

---

## Responsive Design

### Breakpoints
```css
sm:  640px   /* Tablets */
md:  768px   /* Small laptops */
lg:  1024px  /* Desktop */
xl:  1280px  /* Large desktop */
2xl: 1536px  /* Extra large */
```

### Mobile-First Approach
- Base styles for mobile
- Use `md:` prefix for tablet+
- Use `lg:` prefix for desktop+

### Typography Responsiveness
```tsx
className="text-2xl md:text-3xl"  // Smaller on mobile
className="text-sm md:text-base"  // Body text scaling
```

---

## Dark Mode

Criccmax supports dark mode with adjusted colors:
- **Background**: Dark navy `220 80% 8%`
- **Cards**: Lighter navy `220 70% 12%`
- **Text**: Light grey `0 0% 98%`
- **Accent**: Same vibrant orange `25 100% 60%`

Toggle dark mode with `class="dark"` on root element.

---

## Usage Examples

### Hero Section
```tsx
<section className="gradient-hero text-white py-20 px-4">
  <h1 className="text-4xl md:text-5xl font-bold mb-4">
    Fast. Live. Fun. 🏏
  </h1>
  <p className="text-lg md:text-xl text-white/90 mb-8">
    The ultimate cricket prediction playground
  </p>
  <button className="bg-accent text-accent-foreground hover:bg-accent/90 h-12 px-8 rounded-lg">
    Start Predicting
  </button>
</section>
```

### Market Card
```tsx
<div className="card-hover rounded-lg border bg-card p-6">
  <h3 className="text-lg font-semibold text-foreground mb-2">
    Will India win vs Australia?
  </h3>
  <div className="flex items-center gap-4 text-sm text-muted-foreground">
    <span>Yes: <span className="text-accent font-semibold">$0.65</span></span>
    <span>No: $0.35</span>
  </div>
</div>
```

---

## Don'ts

❌ **Don't** use colors outside the defined palette
❌ **Don't** use orange for large text blocks (readability)
❌ **Don't** mix different icon styles
❌ **Don't** use multiple font families
❌ **Don't** create inconsistent spacing
❌ **Don't** skip hover/active states on interactive elements
❌ **Don't** use low contrast color combinations
❌ **Don't** make buttons smaller than 44px height on mobile

---

## Contact & Support

For questions about Criccmax branding:
- Design System: See `src/index.css` and `tailwind.config.ts`
- Components: See `src/components/ui/`
- Updates: Keep this guide updated with any brand changes

---

**Version 2.0** | Last updated: 2026-01-25
