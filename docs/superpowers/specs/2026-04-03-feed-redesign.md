# Feed Page Redesign

## Goal

Bring the feed page up to the same drive-in theatre personality as the rest of the app (tracker detail, watchlists). The current feed is functional but visually flat — clean cards on a dark background with no atmosphere or decorative elements.

## Design Summary

Two categories of changes: **page-level atmosphere** and **card layout**.

---

## Page-Level Atmosphere

### Now Showing Header

Replace the plain "Feed" heading with the existing `NowShowingHeader` component (from `src/components/watchlist/now-showing-header.tsx`). Displays "Now Showing" label above the title "Feed" with amber border, chasing bulbs, and Righteous display font.

### Car Silhouettes

Add the existing `CarSilhouettes` component (from `src/components/title/car-silhouettes.tsx`) above the Now Showing header. Five CSS-drawn car silhouettes with red taillight glows, arranged in perspective depth.

### Amber Ground Glow

Add a bottom-of-page radial glow in amber (`rgba(255,184,0,0.12)`), matching the watchlist page's pink glow but using the feed's amber accent color. Height: 220px. Radial ellipse centered at bottom.

### Drifting Fog Layers

Three animated fog layers at the bottom of the page using the same `fog-drift-1/2/3` keyframes already defined in styles.css. White at very low opacity (0.02–0.03), alternating drift directions over 20–25s.

### Film Grain

The existing `RetroOverlays` component already provides film grain and starfield. Ensure it's active on the feed page (it may already be via the app layout).

### Film Strip Edges

Subtle film-strip perforation patterns running down the left and right edges of the viewport. Very low opacity (~0.06). Repeating-linear-gradient with small rectangular holes and a thin border line. Purely decorative, `pointer-events: none`.

### Scattered Light Orbs

2–3 fixed-position radial gradient circles in the app's accent colors (amber, cyan, pink) at very low opacity (0.03–0.04). Placed at different vertical positions on the left/right margins. Adds warmth without distraction.

### Film Perforation Dividers

Between feed cards, replace any existing gap/margin with a row of small dots alternating cyan and pink at 50% opacity. 7 dots, 4px each, centered. Subtle film-strip feel between entries.

### Date Section Headers

Group feed items by date with styled headers. Format: date text in Space Mono, uppercase, amber at 60% opacity with letter-spacing, followed by a fading amber gradient line extending to the right.

---

## Card Layout

### Structure

Remove poster/image areas. Cards are full-width text boxes with padding.

### Layout

- **Header row:** Avatar (28px circle) + "Username action" text + timestamp (right-aligned, Space Mono)
- **Main row:** Title (left, cyan, 16px bold) + episode subtitle (Space Mono) on the left. Stars (right-aligned, amber with glow) on the right.
- **Note row** (if present): Cyan left-border accent bar, slightly indented, italic text on subtle cyan-tinted background.

### Card Type Variants

Each card type gets a distinct border accent color:

- **Watch events:** `border-color: rgba(255,184,0,0.15)` (amber), avatar amber-tinted
- **Watchlist creations:** `border-color: rgba(255,45,120,0.15)` (pink), title in pink, avatar pink-tinted
- **Journal entries:** `border-color: rgba(0,229,255,0.15)` (cyan), avatar cyan-tinted

### Card Styling

- `border-radius: 10px`
- Background: `linear-gradient(145deg, rgba(10,10,30,0.95), rgba(15,15,35,0.8))`
- Box-shadow: `0 0 12px rgba(255,184,0,0.04), 0 4px 16px rgba(0,0,0,0.3)`
- Hover: border brightens, shadow intensifies, `translateY(-1px)`

### Filter Button

Restyle the existing filter dropdown with neon cyan treatment:
- Space Mono font, 12px
- Cyan text with text-shadow glow
- `rgba(0,229,255,0.06)` background, cyan border
- Hover: background and border intensify, box-shadow glow

---

## Files to Modify

- `src/routes/app/feed.tsx` — main feed page (layout, header, filter, card rendering)
- `src/components/watched/watch-event-card.tsx` — horizontal layout, remove poster references
- `src/components/tracker/feed-journal-card.tsx` — match new card style
- Inline watchlist card in feed.tsx — extract or restyle to match

## Components to Reuse

- `NowShowingHeader` from `src/components/watchlist/now-showing-header.tsx`
- `CarSilhouettes` from `src/components/title/car-silhouettes.tsx`
- `RetroOverlays` (starfield, grain) if not already active on feed
- Fog layer pattern from `src/components/watchlist/watchlist-atmosphere.tsx` (adapted with amber color)

## No Changes

- Feed data model, tRPC queries, pagination — all unchanged
- Edit/delete functionality on watch events — preserved
- Filter toggle (Everyone/Just Me) — preserved, only restyled
