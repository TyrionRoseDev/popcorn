# Popcorn Landing Page Design Spec

## Overview

A "pure vibes" landing page for Popcorn — a comprehensive film tracking app. The page establishes the brand identity with a strong 80s drive-in theatre aesthetic. No functional features yet; the goal is to set the visual foundation that the rest of the app UI will build on.

## Design Decisions

### Tone
Cinematic & immersive — dark, atmospheric, like walking into a drive-in theatre at night. Neon effects are prominent but not campy. No floating emojis or over-the-top kitsch.

### Color Palette
All colors use OKLCH in CSS where possible, with hex fallbacks.

| Token | Hex | Usage |
|-------|-----|-------|
| Neon Pink | `#FF2D78` | Primary accent, logo, CTA buttons |
| Neon Cyan | `#00E5FF` | Secondary accent, buttons, status text |
| Neon Amber | `#FFB800` | Marquee, light bulbs, warm highlights |
| Background | `#050508` | Near-black base |
| Card BG | `#0a0a1e` | Section/card backgrounds |
| Cream | `#fffff0` | Text — headings at 85% opacity, body at 55%, secondary at 35% |

### Typography
Fonts loaded via CSS `@import` in `src/styles.css` (adding to the existing Google Fonts import). All use `display=swap`.

| Font | Role | Weight |
|------|------|--------|
| Bungee Shade | POPCORN logo only | 400 |
| Righteous | Headings, buttons, UI labels | 400 |
| Space Mono | Body text, monospace elements | 400, 700 |

## Page Structure

### Header
- Minimal — small POPCORN text-logo (Bungee Shade) top-left
- Navigation links top-right (placeholder for now)

### Section 1: Hero
**Layout:** Full-viewport centered content, dark background

**Content (top to bottom):**
1. `✦ NOW SHOWING ✦` — amber marquee badge with pulsing border/glow (3s ease-in-out infinite)
2. `POPCORN` — 96px Bungee Shade with color-cycling neon glow animation:
   - Cycles: pink → cyan → amber (6s ease-in-out infinite)
   - 4-layer text-shadow at each stage (7px, 20px, 45px, 80px spread)
3. CTA buttons row:
   - "Log In" — pink outline, neon box-shadow → links to `/login` (better-auth is already integrated)
   - "Create an Account" — cyan outline, subtle glow on hover → links to `/signup`
4. Film strip divider at bottom (repeating-linear-gradient block pattern)

**Background layers (back to front):**
1. Solid `#050508`
2. Starfield — 25+ positioned stars with independent twinkle animations (varied size 1-2.5px, duration 2.5-4.5s, brightness 0.1-0.95)
3. Ambient glow — subtle radial gradient from bottom
4. Vignette — darkening at edges
5. Film grain — animated SVG fractalNoise overlay (0.06 opacity, 0.3s steps animation)
6. Scanlines — repeating horizontal lines (2px/4px spacing, 0.4-0.5 opacity)
7. VHS scan line — single horizontal line sweeping top to bottom (8s linear infinite)

### Section 2: Spotlight + Marquee Board
**Layout:** Centered marquee board with atmospheric spotlight background

**Spotlights:**
- Two SVG-based spotlight beams (same technique as css-for-js.dev)
- Each beam: 3 overlapping SVG triangle paths with layered Gaussian blur (stdDeviation 25, 55, 110)
- Orientation: ground-mounted upward-facing beams (like movie premiere spotlights shining into the sky)
- Fill: linear gradient white, bright at narrow bottom (light source), fading as beam spreads upward
- Left beam: 8s ease-in-out infinite alternate, sways -4deg to 6deg
- Right beam: 7s ease-in-out infinite alternate, -3s delay, sways 4deg to -6deg
- Transform origins set near the bottom of each beam
- Beams anchored to absolute bottom of section
- Film strip divider at bottom covers beam bases (z-index above beams)

**Marquee Board:**
- Dark card with border (`#1a1a2e`)
- Top & bottom rows of chasing amber light bulbs (7px circles, 2s alternating chase animation)
- Title: "Tonight's Programme" in Righteous, neon pink with glow
- Feature rows in Space Mono: Film Diary, Watchlist, Smart Picks, Stats & Wrapped, Social Reviews
- Each row shows "Coming Soon" in neon cyan
- Max-width: 550px, centered

### Section 3: Footer
- "best enjoyed with popcorn." in Righteous, neon pink with text-shadow glow
- Flickering neon animation (subtle opacity flicker at 92-97% of cycle)
- Minimal, dark background (`#0a0a12`)

## Retro Overlay System
A reusable component that applies the full retro treatment. These overlays are fixed/absolute positioned with `pointer-events: none` and layered via z-index.

| Layer | Effect | z-index |
|-------|--------|---------|
| Starfield | Twinkling dots | 0 |
| Page content | Hero, sections, footer | 1-9 |
| Vignette | Edge darkening | 10 |
| Film grain | Animated SVG noise | 49 |
| Scanlines | Horizontal lines | 50 |
| VHS scan | Moving bright line | 51 |

Overlays (grain, scanlines, VHS) must render **above** page content so the retro effect applies to text and UI elements. Content elements that need to be interactive (buttons, links) use `z-index: 10` with overlays having `pointer-events: none`.

## Responsive Behavior
- Hero title: `clamp()` for font-size scaling on mobile
- Marquee board: full-width on mobile with padding
- Starfield: fewer stars on mobile (performance)
- Film strip dividers: scale naturally
- Spotlight SVGs: `vw`-based widths, scale down on small screens

## Accessibility
- `@media (prefers-reduced-motion: reduce)`: disable all animations (starfield twinkle, neon cycle, VHS scan, film grain, spotlight sway, bulb chase, footer flicker). Show static versions instead (e.g., pink neon logo without cycling, stars at fixed opacity).

## Technical Notes

### Stack
- TanStack Start (React, file-based routing)
- Tailwind CSS v4 with `@theme` design tokens
- Google Fonts via CSS `@import` (add Bungee Shade, Righteous, Space Mono to existing import in `src/styles.css`)
- Shadcn UI components available but likely unused on this page

### Layout Strategy
The current `__root.tsx` renders `<Header />` and `<Footer />` on every route. The landing page needs its own header/footer. Approach (verified against TanStack Router docs — pathless layout routes with `_` prefix):

```
src/routes/
├── __root.tsx          # Modified: remove Header/Footer, keep providers + Outlet
├── index.tsx           # Landing page (outside _app → own custom layout)
├── _app.tsx            # New: pathless layout with Header/Footer + Outlet
├── _app/
│   ├── about.tsx       # Moved: inherits Header/Footer from _app
│   └── ...
├── api/                # Unchanged: no UI layout needed
```

- `__root.tsx`: Remove `<Header />` and `<Footer />` — keep `TanStackQueryProvider`, `TooltipProvider`, devtools
- `_app.tsx`: New pathless layout that renders `<Header />`, `<Outlet />`, `<Footer />` — all non-landing UI routes become children
- `index.tsx`: Stays at root level, renders its own full-screen layout with retro effects
- `api/` routes: Stay at root level (no UI rendering)

### Global Styles
The current `src/styles.css` has a lagoon/teal theme with body gradients. Strategy:
- Keep the existing global styles intact (they'll apply to app pages under `_app`)
- The landing page component wraps its content in a full-screen container with `position: fixed; inset: 0` or equivalent, setting its own `background: #050508` which overrides the body background visually
- Add the neon color tokens (pink, cyan, amber) as new CSS custom properties alongside the existing theme tokens

### File locations
- Landing page route: `src/routes/index.tsx`
- Global styles / theme tokens: `src/styles.css`
- Retro overlays component: `src/components/retro-overlays.tsx` (new)
- Spotlight component: `src/components/spotlight.tsx` (new, SVG-based)
- App layout route: `src/routes/_app.tsx` (new pathless layout — wraps non-landing routes with Header/Footer + Outlet)
- About page: `src/routes/_app/about.tsx` (moved from `src/routes/about.tsx`)
- Root layout: `src/routes/__root.tsx` (modified — remove Header/Footer, keep providers)

### Performance
- SVG spotlights are GPU-composited via transform animations
- Film grain uses CSS animation with `steps()` to reduce repaints
- Scanlines are static repeating gradients (no animation cost)
- Stars use CSS custom properties for varied animation without JS

## Verification
1. Run `bun dev` and open localhost:3000
2. Verify hero renders with all effects (starfield, grain, scanlines, neon cycling)
3. Verify marquee board with chasing lights below hero
4. Verify spotlight beams animate independently with correct direction
5. Verify footer shows flickering tagline
6. Check responsive behavior at 375px, 768px, 1440px widths
7. Verify no horizontal overflow or layout shifts
8. Test `prefers-reduced-motion` — enable in browser devtools, verify all animations stop and static fallbacks display
