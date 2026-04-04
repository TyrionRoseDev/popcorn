# Hidden Titles UI + Global Atmosphere

## Problem

1. The hidden titles page grid is too narrow (max-w-2xl, 3 columns) with wasted space on desktop.
2. Four separate atmosphere components (`RetroOverlays`, `ShuffleAtmosphere`, `TitlePageAtmosphere`, `WatchlistAtmosphere`) all duplicate the same base effects (stars, film grain, scanlines) with copy-pasted code.
3. Star positions use `(i * N + M) % 97` which creates visible linear patterns instead of scattered randomness.
4. `ShuffleAtmosphere` has swaying spotlights that should be removed.
5. Title pages opt out of `RetroOverlays`, meaning they miss VHS scan and scanline effects.

## Design

### 1. Hidden Titles Grid

Remove the `max-w-2xl` container constraint. Use a responsive grid that fills available width:

- Base: 3 columns
- `sm`: 4 columns
- `md`: 5 columns
- `lg`+: 6 columns

Use `max-w-7xl` with horizontal padding for edge margins. Remove `ShuffleAtmosphere` from the hidden titles page entirely — the global layer handles the background.

### 2. RetroOverlays → Global Atmosphere

`RetroOverlays` becomes the single source of truth for base atmospheric effects on all pages. Changes:

**Star randomness fix:** Replace the modular arithmetic formula with a simple seeded PRNG (mulberry32 or similar) that produces visually scattered positions. Each star gets independent random x, y, size, duration, delay, and opacity values.

**Star count:** Increase from 30 to 100.

**Night sky gradient:** Add the radial gradient background (`radial-gradient(ellipse at 50% 0%, #0a0a20 0%, #050508 60%)`) that's currently only in the page-specific atmospheres. This ensures a consistent deep dark base everywhere.

**Always render:** Remove the `!isTitlePage` conditional in `src/routes/app/route.tsx` so RetroOverlays renders on every app page.

**Effects included:**
- Night sky gradient
- 100 scattered twinkling stars
- Film grain overlay (SVG turbulence, animated)
- Scanlines (repeating linear gradient)
- VHS scan line (horizontal sweep, 8s loop)

### 3. ShuffleAtmosphere → Additive Drive-In Layer

Strip all base effects that are now in RetroOverlays. Remove the swaying spotlights entirely.

**Remove:** Stars, night sky gradient, film grain, scanlines, VHS scan line, swaying spotlights (left + right).

**Keep:** Projector beam cone, dust particles, projector source glow, drive-in screen frame (posts + crossbar), vignette overlay, amber ground glow, fog layers (3 layers), car dashboard silhouette, steering wheel, speaker box.

### 4. TitlePageAtmosphere → Additive Only

Strip base effects now handled by RetroOverlays.

**Remove:** Night sky gradient, stars, film grain.

**Keep:** Pink ground glow.

### 5. WatchlistAtmosphere → Additive Only

Strip base effects now handled by RetroOverlays.

**Remove:** Night sky gradient, stars, film grain.

**Keep:** Pink ground glow, fog layers (3 layers).

## Files Changed

| File | Change |
|------|--------|
| `src/components/retro-overlays.tsx` | Add night sky gradient, fix star PRNG, bump to 100 stars |
| `src/routes/app/route.tsx` | Remove `isTitlePage` conditional, always render RetroOverlays |
| `src/routes/app/shuffle/hidden.tsx` | Remove ShuffleAtmosphere, widen grid to 6-col responsive |
| `src/components/shuffle/shuffle-atmosphere.tsx` | Remove stars, sky, grain, scanlines, VHS scan, spotlights |
| `src/components/title/title-page-atmosphere.tsx` | Remove sky, stars, film grain |
| `src/components/watchlist/watchlist-atmosphere.tsx` | Remove sky, stars, film grain |
