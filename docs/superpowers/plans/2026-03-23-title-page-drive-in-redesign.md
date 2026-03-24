# Title Page Drive-In Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the title page into an immersive drive-in theater experience with a screen structure, car silhouettes, marquee, themed content cards, and arcade action buttons.

**Architecture:** New presentational components for each drive-in element (screen, cars, marquee, poster case, section board, arcade buttons). A title-page-specific atmosphere component replaces `RetroOverlays` on this route. The page route file is restructured to compose these new components in the correct order. Existing components (Synopsis, CastList, TitleMetadata, TitleInfoBar) are modified to fit within the new themed wrappers.

**Tech Stack:** React, TailwindCSS v4 (with arbitrary values), TypeScript, TanStack Router

**Spec:** `docs/superpowers/specs/2026-03-23-title-page-drive-in-redesign.md`
**Mockup:** `.superpowers/brainstorm/42062-1774292079/final-v3.html`

**Conventions:**
- Import alias: `#/` (e.g., `import { Synopsis } from "#/components/title/synopsis"`)
- Tailwind color utilities: `text-neon-pink`, `border-neon-cyan`, `bg-neon-amber` (not raw CSS variables)
- Font utilities: `font-display` (Righteous), `font-mono-retro` (Space Mono), `font-logo` (Bungee Shade), `font-sans` (Manrope)
- Responsive: `flex-col md:flex-row` pattern for stacking, `md:` breakpoint for desktop
- Decorative elements should include `aria-hidden="true"`

**Build note:** Tasks 4-10 create/modify components independently. The title route (`title.$mediaType.$tmdbId.tsx`) will not compile during this period because old imports are removed before Task 11 rewires everything. Do NOT run `bun run build` to verify until Task 11. Individual component files can be checked with `bunx tsc --noEmit src/components/title/<file>.tsx` if needed.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/title/drive-in-screen.tsx` | Screen frame, poles, sprockets, projector beam, play button, YouTube embed |
| `src/components/title/car-silhouettes.tsx` | Five rear-view car silhouettes with tail lights |
| `src/components/title/now-showing-marquee.tsx` | Marquee border, chasing bulbs, title/year/runtime as `<h1>` |
| `src/components/title/poster-display-case.tsx` | Lit case with glass, screws, light bar, ambient glow |
| `src/components/title/section-board.tsx` | Reusable card wrapper with top-edge glow and inner light wash |
| `src/components/title/arcade-button.tsx` | Ring glow circular button with label |
| `src/components/title/title-page-atmosphere.tsx` | Night sky, ~70 stars, film grain, ground glow |

### Modified Files
| File | Changes |
|------|---------|
| `src/routes/app/title.$mediaType.$tmdbId.tsx` | Complete layout restructure — compose new components in order |
| `src/components/title/synopsis.tsx` | Accept tagline prop, render inside SectionBoard |
| `src/components/title/cast-list.tsx` | Add film strip perforations, wrap in SectionBoard, larger photos |
| `src/components/title/title-info-bar.tsx` | Neon sign styling per genre with cycling colors |
| `src/components/title/title-metadata.tsx` | Ticket stub layout with perforation and rating tear-off |
| `src/components/title/title-page-skeleton.tsx` | Update to match new page structure |
| `src/routes/app/route.tsx` | Conditionally hide RetroOverlays on title page |
| `src/styles.css` | Add `chase` animation keyframe |

### Removed Files
| File | Reason |
|------|--------|
| `src/components/title/hero-trailer.tsx` | Replaced by `drive-in-screen.tsx` |
| `src/components/title/section-divider.tsx` | No longer used — spacing between cards replaces dividers |

---

## Tasks

### Task 1: Add `chase` animation to global styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add the chase keyframe animation**

In `src/styles.css`, after the existing `bulb-chase` animation (around line 398-401), the `bulb-chase` keyframe already exists and does exactly what we need (opacity pulse). However the spec uses the name `chase` in components. Add a `chase` alias or just reference `bulb-chase` in components. Let's add `chase` to keep naming consistent with the spec:

```css
@keyframes chase {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}
```

Add this after the existing `bulb-chase` block. Also add it to the `prefers-reduced-motion` section to disable it for accessibility.

- [ ] **Step 2: Verify styles compile**

Run: `bun run build`
Expected: Builds successfully with no errors

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat(title): add chase animation keyframe for marquee bulbs"
```

---

### Task 2: Create `TitlePageAtmosphere` component

**Files:**
- Create: `src/components/title/title-page-atmosphere.tsx`

- [ ] **Step 1: Create the atmosphere component**

This replaces `RetroOverlays` on the title page. It renders: night sky gradient background, ~70 twinkling stars, film grain, and ground glow. No scanlines or VHS scan.

Reference `src/components/retro-overlays.tsx` for the exact star generation pattern. It uses `Array.from({ length: 30 })` with index-based math for positioning. Copy this pattern but change to `length: 70` and adjust the position math to spread stars more densely across the viewport. Use the existing `twinkle` animation from `styles.css`. Stars need `--o1` and `--o2` CSS custom properties for the twinkle keyframe (same as RetroOverlays).

The component should include `aria-hidden="true"` and be a `fixed inset-0 pointer-events-none z-0` container with:
- Night sky div: `radial-gradient(ellipse at 50% 0%, #0a0a20 0%, #050508 60%)`
- Stars: individual absolutely-positioned divs with `rounded-full bg-white`
- Film grain: SVG noise texture (same pattern as retro-overlays.tsx grain)
- Ground glow: `fixed bottom-0` pink radial gradient

- [ ] **Step 2: Verify it renders**

Import into the title page temporarily to check it renders. Remove after verifying.

- [ ] **Step 3: Commit**

```bash
git add src/components/title/title-page-atmosphere.tsx
git commit -m "feat(title): add TitlePageAtmosphere component with stars and grain"
```

---

### Task 3: Conditionally hide `RetroOverlays` on title page

**Files:**
- Modify: `src/routes/app/route.tsx`

- [ ] **Step 1: Add route-based conditional rendering**

Use `useMatch` or `useMatches` from TanStack Router to detect if the current route is the title page. If it is, don't render `<RetroOverlays />` (because `TitlePageAtmosphere` replaces it).

@ `node_modules/@tanstack/router-core/skills/router-core/SKILL.md`

Check how the router exposes the current route match. The route ID for the title page is `/app/title/$mediaType/$tmdbId`.

```typescript
import { useMatches } from '@tanstack/react-router'

// Inside AppLayout component:
const matches = useMatches()
const isTitlePage = matches.some(m => m.routeId === '/app/title/$mediaType/$tmdbId')

// Then conditionally render:
{!isTitlePage && <RetroOverlays />}
```

- [ ] **Step 2: Verify RetroOverlays hides on title page but shows on other pages**

Navigate to `/app/search` — should see RetroOverlays (scanlines, etc.)
Navigate to a title page — should NOT see RetroOverlays

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/route.tsx
git commit -m "feat(title): hide RetroOverlays on title page route"
```

---

### Task 4: Create `DriveInScreen` component

**Files:**
- Create: `src/components/title/drive-in-screen.tsx`
- Remove: `src/components/title/hero-trailer.tsx`

- [ ] **Step 1: Create the drive-in screen component**

Props interface:
```typescript
interface DriveInScreenProps {
  backdropPath: string | null
  trailerKey: string | null
}
```

This component replaces `HeroTrailer`. It renders:
- Screen frame (dark `#111` container with padding, rounded corners, box-shadow for glow)
- Support poles via `::before`/`::after` (CSS-only, use Tailwind arbitrary values)
- Screen inner area with 16:9 aspect ratio, max-height 450px
- Film strip sprocket rows (top and bottom) — generate ~35 sprocket divs per row, use `justify-between` to fill width
- Projector beam trapezoid gradient above the screen
- Screen glow radial gradient around the frame
- Play button (80px pink neon circle) centered, with "Play Trailer" label below
- Bottom fade gradient on lower 40%
- YouTube iframe embed when playing (reuse the playing state logic from `hero-trailer.tsx`)

Reference the mockup CSS for exact values: `final-v3.html` lines for `.screen-frame`, `.screen-inner`, `.play-btn`, `.film-strip-edge`, `.sprocket`, `.projector-beam`, `.screen-glow`, `.screen-fade`.

- [ ] **Step 2: Delete hero-trailer.tsx**

Remove `src/components/title/hero-trailer.tsx` — it's fully replaced.

- [ ] **Step 3: Commit**

```bash
git add src/components/title/drive-in-screen.tsx
git rm src/components/title/hero-trailer.tsx
git commit -m "feat(title): add DriveInScreen component, remove HeroTrailer"
```

---

### Task 5: Create `CarSilhouettes` component

**Files:**
- Create: `src/components/title/car-silhouettes.tsx`

- [ ] **Step 1: Create the car silhouettes component**

No props — purely decorative. Renders 5 rear-view cars:
- Each car: roof, rear window (with screen reflection tint), body, bumper, license plate, two red tail lights
- Cars vary in scale and opacity: edges smaller/dimmer, center full size
- Use absolute positioning within each car container (80px wide, 52px tall)
- Tail lights: `rgba(255,30,30,0.7)` with `box-shadow: 0 0 8px, 0 0 20px` red glow
- Container: flex, centered, `gap-[30px]`, max-width 1100px

Scale/opacity per car (using inline styles or nth-child):
1. scale(0.8) translateY(6px) opacity 0.7
2. scale(0.9) translateY(2px) opacity 0.85
3. scale(1) opacity 1
4. scale(0.95) translateY(3px) opacity 0.9
5. scale(0.8) translateY(6px) opacity 0.7

- [ ] **Step 2: Commit**

```bash
git add src/components/title/car-silhouettes.tsx
git commit -m "feat(title): add CarSilhouettes component with rear-view cars"
```

---

### Task 6: Create `NowShowingMarquee` component

**Files:**
- Create: `src/components/title/now-showing-marquee.tsx`

- [ ] **Step 1: Create the marquee component**

Props interface:
```typescript
interface NowShowingMarqueeProps {
  title: string
  year: string
  runtime: string
  contentRating: string
}
```

Renders:
- Container: max-width 700px, centered, relative, padding 20px 40px
- Amber border (2px, rounded 8px) with `box-shadow: 0 0 20px` amber glow
- Two rows of ~20 chasing bulbs (top and bottom), 6px amber circles
  - Odd children: `animation: chase 1.2s infinite`
  - Even children: `animation: chase 1.2s infinite 0.6s`
- "NOW SHOWING": Space Mono, 10px, letter-spacing 4px, uppercase, amber
- **Title as `<h1>`**: Righteous, 36px, cream with text-shadow glow
- Meta line: Space Mono, 12px, `year · runtime · contentRating`. Hide contentRating if it equals `"NR"` (no rating available)

- [ ] **Step 2: Commit**

```bash
git add src/components/title/now-showing-marquee.tsx
git commit -m "feat(title): add NowShowingMarquee component with chasing bulbs"
```

---

### Task 7: Create `PosterDisplayCase` component

**Files:**
- Create: `src/components/title/poster-display-case.tsx`

- [ ] **Step 1: Create the poster display case component**

Props interface:
```typescript
interface PosterDisplayCaseProps {
  posterPath: string | null
  title: string
}
```

Use `getTmdbImageUrl` (from `#/lib/tmdb`) to resolve the poster URL from `posterPath`. Use `title` as the img `alt` text.

Renders:
- Outer container: 280px wide, relative (for ambient glow positioning)
- Ambient glow: blurred pink radial gradient behind the case, `z-[-1]`
- Case: `#0e0e14` background, 12px padding, border-radius 6px, border `rgba(255,255,240,0.08)`
  - Case light: thin bright line at top via pseudo-element or div
  - Light wash: faint gradient from top over 60% height
  - Corner screws: 4 x 6px circles at corners with inset shadow
  - Poster image: full width, 2:3 aspect ratio, border-radius 3px
  - Glass reflection: diagonal gradient overlay
  - "Feature Presentation" label: centered, Space Mono 9px

- [ ] **Step 2: Commit**

```bash
git add src/components/title/poster-display-case.tsx
git commit -m "feat(title): add PosterDisplayCase component with lit case effect"
```

---

### Task 8: Create `SectionBoard` component

**Files:**
- Create: `src/components/title/section-board.tsx`

- [ ] **Step 1: Create the reusable section board wrapper**

Props interface:
```typescript
interface SectionBoardProps {
  icon: string      // emoji
  title: string
  children: React.ReactNode
  className?: string
}
```

Renders a card with:
- Background: gradient `#0c0c20` to `#08081a`
- Border: `1px solid rgba(255,255,240,0.06)`, border-radius 8px
- Padding: 32px
- Top edge glow: `::before` pseudo — subtle white line (`rgba(255,255,240,0.12)`) centered 15%-85%
- Inner light wash: `::after` pseudo — faint gradient from top fading over 60px
- Header: icon (32px square, neutral cream background) + title (Righteous 15px, cream `rgba(255,255,240,0.8)`) separated by bottom border
- Children rendered below the header

- [ ] **Step 2: Commit**

```bash
git add src/components/title/section-board.tsx
git commit -m "feat(title): add SectionBoard reusable card wrapper component"
```

---

### Task 9: Create `ArcadeButton` component

**Files:**
- Create: `src/components/title/arcade-button.tsx`

- [ ] **Step 1: Create the arcade button component**

Props interface:
```typescript
interface ArcadeButtonProps {
  icon: string
  label: string
  color: 'pink' | 'cyan' | 'amber'
  onClick?: () => void
}
```

Renders:
- 72px circle with 3px border in the specified color
- Outer glow ring (`::before` at inset -6px, 1px border, opacity 0.3, expands to -10px on hover)
- Inner concave depth (`::after` at inset 3px, same background with brightness(0.6))
- 3D press: `box-shadow` with 5px offset, reduces on hover with `translateY(2px)`
- Icon centered (font-size 24px, z-index above pseudo-elements)
- Label below: 12px Manrope bold, cream white

Use Tailwind utilities for colors (not raw CSS variables):
- pink: `border-neon-pink`, `bg-neon-pink/20`, `text-neon-pink`, `shadow-[0_5px_0_rgba(255,45,120,0.35)]`
- cyan: `border-neon-cyan`, `bg-neon-cyan/12`, `text-neon-cyan`, `shadow-[0_5px_0_rgba(0,229,255,0.2)]`
- amber: `border-neon-amber`, `bg-neon-amber/12`, `text-neon-amber`, `shadow-[0_5px_0_rgba(255,184,0,0.2)]`

- [ ] **Step 2: Commit**

```bash
git add src/components/title/arcade-button.tsx
git commit -m "feat(title): add ArcadeButton component with ring glow effect"
```

---

### Task 10: Modify existing title components

**Files:**
- Modify: `src/components/title/synopsis.tsx`
- Modify: `src/components/title/title-info-bar.tsx`
- Modify: `src/components/title/title-metadata.tsx`
- Modify: `src/components/title/cast-list.tsx`
- Remove: `src/components/title/section-divider.tsx`

- [ ] **Step 1: Update Synopsis to accept tagline**

Add `tagline` prop (optional string). Render the tagline above the overview text with italic styling, 3px pink left border, and box-shadow glow. Keep the expand/collapse behavior. **Remove the internal "Synopsis" header label** (the `<p>` with `font-mono-retro text-[11px] text-neon-pink`) — `SectionBoard` will provide the header from the page layout instead. Don't wrap in `SectionBoard` here — the page layout will wrap it.

```typescript
interface SynopsisProps {
  overview: string
  tagline?: string | null
}
```

- [ ] **Step 2: Update TitleInfoBar for neon genre signs**

Change genre pills to cycle through pink/cyan/amber using index modulo 3. Each gets matching `text-shadow`, `box-shadow`, border color, and text color. Space Mono 11px. Content rating badge stays amber.

- [ ] **Step 3: Update TitleMetadata to ticket stub layout**

Restructure to render as a flex row: main body | perforation | rating tear-off.
- Main body: 2x2 grid of metadata with Space Mono labels and cream values. Use existing props for fields: Director, Status (for TV), Seasons/Episodes (for TV). For movies without TV-specific fields, show Director and Content Rating.
- Perforation: 32px column with dashed left border and 5 circular holes
- Rating tear-off: 110px column with `font-logo` (Bungee Shade) score (36px), "TMDB" label, star rating

Remove tagline rendering from this component (it moved to Synopsis).

Update props — remove `tagline`, add `contentRating: string` and `runtime: string` (these are already available in `TitleData` and will be passed from the route). Keep everything else.

```typescript
interface TitleMetadataProps {
  director: string | null
  rating: number
  contentRating: string
  runtime: string
  seasons?: number
  episodes?: number
  status?: string
}
```

The component wraps itself in the ticket stub card styling (gradient background, border, border-radius) — it does NOT use `SectionBoard` because the ticket layout is unique. Include its own header ("Details" with a film icon).

- [ ] **Step 4: Update CastList with film strip frame**

Add film strip perforation rows (top and bottom) around the scrolling cast area. Each row: 14px tall, dark background, full-width 12x8px rounded rectangles spaced with `justify-between`. Increase photo size to 76px. Change photo border color from `border-neon-pink/30` to `border-neon-cyan/20` with cyan glow on hover. **Remove the internal "Cast" header label** — `SectionBoard` provides the header. The page layout wraps this in a `SectionBoard`.

- [ ] **Step 5: Remove section-divider.tsx**

Delete `src/components/title/section-divider.tsx` — no longer used.

- [ ] **Step 6: Commit**

```bash
git add src/components/title/synopsis.tsx src/components/title/title-info-bar.tsx src/components/title/title-metadata.tsx src/components/title/cast-list.tsx
git rm src/components/title/section-divider.tsx
git commit -m "feat(title): retheme existing components for drive-in design"
```

---

### Task 11: Restructure the title page route

**Files:**
- Modify: `src/routes/app/title.$mediaType.$tmdbId.tsx`

- [ ] **Step 1: Rewrite TitlePage component layout**

Replace the entire TitlePage component body. New structure (top to bottom):

```
TitlePageAtmosphere (fixed background)
DriveInScreen (trailer)
CarSilhouettes
NowShowingMarquee (title, year, runtime, contentRating)
Content area (max-w-[1060px], flex, gap-12):
  Left column (w-[280px]):
    PosterDisplayCase
    TitleInfoBar (genre neon signs)
    Arcade buttons row (3x ArcadeButton: watchlist/watched/invite)
  Right column (flex-1):
    SectionBoard "Synopsis":
      Synopsis (with tagline)
    TitleMetadata (ticket stub — renders its own container)
    SectionBoard "Cast":
      CastList (with film strip)
```

Remove:
- Old `<h1>` title heading (replaced by marquee)
- All `<SectionDivider />` instances
- Old HeroTrailer import
- Old poster/button sidebar
- Old year/runtime/rating subtitle line

Update imports to use all new components (use `#/` import alias). Wire up props from the existing `data` object (type `TitleData`):

- `DriveInScreen`: `backdropPath={data.backdropPath}` `trailerKey={data.trailerKey}`
- `NowShowingMarquee`: `title={data.title}` `year={data.year}` `runtime={data.runtime}` `contentRating={data.contentRating}`
- `PosterDisplayCase`: `posterPath={data.posterPath}` `title={data.title}`
- `TitleInfoBar`: `contentRating={data.contentRating}` `genres={data.genres}`
- `Synopsis`: `overview={data.overview}` `tagline={data.tagline}`
- `TitleMetadata`: `director={data.director}` `rating={data.rating}` `contentRating={data.contentRating}` `runtime={data.runtime}` plus optional TV fields
- `CastList`: `cast={data.cast}`

Arcade buttons get no-op `onClick` handlers for now.

Use responsive classes: `flex-col md:flex-row` for the content area columns, `w-full md:w-[280px]` for the poster column.

- [ ] **Step 2: Verify the page builds and renders**

Run: `bun run build`
Expected: Clean build with no errors.

Run: `bun run dev` and navigate to a title page (e.g. `/app/title/movie/155` for The Dark Knight)
Expected: Full drive-in themed page renders correctly.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/title.\$mediaType.\$tmdbId.tsx
git commit -m "feat(title): restructure title page with drive-in layout"
```

---

### Task 12: Update skeleton loading state

**Files:**
- Modify: `src/components/title/title-page-skeleton.tsx`

- [ ] **Step 1: Update skeleton to match new layout**

The skeleton should hint at the new structure:
- Screen-shaped placeholder (16:9 aspect ratio, max-height 450px)
- Marquee-shaped placeholder (centered, max-width 700px)
- Two-column content area with poster-sized placeholder on left, card-shaped placeholders on right

Keep using `animate-pulse` with `bg-cream/5` — just update the shapes to match the new layout.

- [ ] **Step 2: Verify skeleton renders on slow load**

Navigate to a title page and check the loading state appears correctly.

- [ ] **Step 3: Commit**

```bash
git add src/components/title/title-page-skeleton.tsx
git commit -m "feat(title): update skeleton to match drive-in layout"
```

---

### Task 13: Visual QA and polish

**Files:**
- Possibly any component created above

- [ ] **Step 1: Compare against mockup**

Open the mockup (`final-v3.html`) and the live page side by side. Check:
- Screen frame proportions and glow
- Car silhouette positioning and tail light glow
- Marquee bulb animation timing
- Poster case light bar visibility
- Genre neon sign colors cycling correctly
- Arcade button press depth and glow ring expansion
- Section board top-edge glow visibility
- Ticket stub perforation alignment
- Cast film strip sprockets filling full width
- Star density and distribution
- Overall spacing between sections

- [ ] **Step 2: Fix any visual discrepancies**

Adjust Tailwind classes, shadows, opacities, or sizes as needed to match the mockup.

- [ ] **Step 3: Test responsive behavior**

Resize browser to mobile widths. Verify:
- Content stacks vertically (poster above details)
- Screen maintains aspect ratio at smaller widths
- Marquee text scales reasonably
- Arcade buttons remain usable
- No horizontal overflow

- [ ] **Step 4: Check accessibility**

- Verify `<h1>` exists (in the marquee)
- Verify `prefers-reduced-motion` disables star twinkle and bulb chase animations
- Verify arcade buttons are focusable and have accessible labels

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(title): visual QA polish for drive-in redesign"
```
