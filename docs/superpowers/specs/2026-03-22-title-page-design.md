# Title Page Design Spec

## Overview

A detail page for individual movies and TV shows, accessible from search results. Features an immersive hero trailer, sidebar poster layout, and organized metadata sections — all styled in the existing drive-in theater retro aesthetic.

## Route

`/app/title/:mediaType/:tmdbId`

- `mediaType`: `"movie" | "tv"` (validated via Zod)
- `tmdbId`: `number`
- Sits under the `/app` layout (inherits navbar + auth guard)
- `PosterCard` components in search results link here

## Data Layer

### New tRPC Procedure: `title.details`

**Input:** `{ mediaType: "movie" | "tv", tmdbId: number }`

Fetches three TMDB endpoints in parallel on the server:
- `/movie/{id}` or `/tv/{id}` — full details
- `/movie/{id}/credits` or `/tv/{id}/credits` — cast
- `/movie/{id}/videos` or `/tv/{id}/videos` — trailers (filtered for YouTube)
- `/movie/{id}/release_dates` or `/tv/{id}/content_ratings` — content rating (US cert)

**Return type:**

```typescript
interface TitleDetails {
  tmdbId: number
  mediaType: "movie" | "tv"
  title: string
  tagline: string | null
  overview: string
  year: string                    // e.g. "2008"
  runtime: string                 // "2h 32m" or "45m per episode"
  rating: number                  // vote_average
  contentRating: string           // "PG-13", "TV-MA", etc.
  genres: string[]                // genre names, not IDs
  posterPath: string | null
  backdropPath: string | null
  director: string | null         // or "creator" for TV shows
  trailerKey: string | null       // YouTube video key
  cast: Array<{
    id: number
    name: string
    character: string
    profilePath: string | null
  }>
  // TV-specific fields
  seasons?: number
  episodes?: number
  status?: string                 // "Returning Series", "Ended", etc.
}
```

**Date formatting:** Only the year is displayed. If full dates are needed in the future, use UK format (DD/MM/YYYY).

## Page Layout

### Desktop (> 768px)

```
+--------------------------------------------------+
|  [=== FILM STRIP BORDER =====================]   |
|                                                   |
|              HERO BACKDROP IMAGE                  |
|                 [ ▶ PLAY TRAILER ]                |
|                                                   |
|  [=== FILM STRIP BORDER =====================]   |
+--------------------------------------------------+
|                                                   |
|  [POSTER]  |  Title (Righteous font, neon glow)   |
|            |  2008 • 2h 32m • ★ 9.0              |
|            |                                      |
|            |  [PG-13] [Action] [Crime] [Drama]    |
|            |  ─────────────────────────            |
|  [+ Add to |  SYNOPSIS                            |
|  Watchlist] |  Overview text...                    |
|            |  ─────────────────────────            |
|            |  DETAILS                              |
|            |  "Why so serious?"                    |
|            |  Director: Christopher Nolan          |
|            |  Rating: ★ 9.0 / 10                  |
|            |  ─────────────────────────            |
|            |  CAST                                 |
|            |  (●)(●)(●)(●)(●)(●) →                |
|            |                                      |
+--------------------------------------------------+
```

- Max width: 1400px, centered
- Poster sidebar: 220px wide, pinned left
- Content flows to the right of the poster

### Mobile (≤ 768px)

- Poster centers above the content, 160px wide
- Single column layout below
- Hero height reduces to 280px
- Title font shrinks to 24px

## Components

All in `src/components/title/`:

### 1. `HeroTrailer`
- Full-width backdrop image (TMDB `w1280`)
- Film strip borders (top and bottom) with sprocket holes
- Vignette overlay (radial gradient darkening edges)
- Centered play button (neon-pink, glowing)
- On click: swaps backdrop for YouTube iframe embed
- Bottom gradient fading to page background

**Props:** `backdropPath`, `trailerKey`

### 2. `TitleInfoBar`
- Content rating badge (amber, glowing)
- Genre pills (neon-pink border, glow on hover)
- Runtime badge

**Props:** `contentRating`, `genres`, `runtime`

### 3. `Synopsis`
- Section label "SYNOPSIS" in neon pink
- Overview text in Manrope
- Truncated with "Read more" toggle (cyan) if text is long

**Props:** `overview`

### 4. `TitleDetails`
- Section label "DETAILS" in neon pink
- Tagline in italics with pink left border
- Director/creator row
- Rating row with glowing amber star
- For TV: seasons, episode count, status rows

**Props:** `director`, `tagline`, `rating`, `seasons?`, `episodes?`, `status?`

### 5. `CastList`
- Section label "CAST" in neon pink
- Horizontal scroll container (hidden scrollbar)
- Circular avatars (68px) with neon-pink border ring, glow on hover
- Actor name (white, bold) + character name (muted gray) below each
- Right-edge fade effect to hint at scrollable content
- TMDB `w185` profile images, gradient fallback for missing photos

**Props:** `cast[]`

### Page Composition (in route file)

```tsx
<HeroTrailer />
<div className="sidebar-layout">
  <div className="poster-sidebar">
    <img />                    {/* poster, not its own component */}
    <WatchlistButton />        {/* TODO: implement watchlist on click */}
  </div>
  <div className="content">
    <TitleHeading />            {/* title + year/runtime/rating */}
    <TitleInfoBar />
    <SectionDivider />
    <Synopsis />
    <SectionDivider />
    <TitleDetails />
    <SectionDivider />
    <CastList />
  </div>
</div>
```

## Styling & Theme

Uses existing design tokens from `src/styles.css`:

- **Colors:** `--color-neon-pink` (#FF2D78), `--color-neon-cyan` (#00E5FF), `--color-neon-amber` (#FFB800), `--color-drive-in-bg` (#050508), `--color-cream` (#fffff0)
- **Fonts:** `font-display` (Righteous) for title, `font-sans` (Manrope) for body, `font-mono-retro` (Space Mono) for labels/badges
- **No new CSS variables or fonts** — everything reuses existing theme

### Retro Touches
- Film strip borders on hero (top + bottom) with sprocket holes
- Neon glow text-shadow on title (pink)
- Neon glow on star rating (amber)
- Section dividers: gradient lines fading from pink to cyan
- Genre pills: neon-pink border that glows on hover
- Cast avatar rings: pink border, glow on hover
- Vignette overlay on hero backdrop
- Section labels ("SYNOPSIS", "DETAILS", "CAST") in neon pink with glow
- Content rating badge: amber glow
- Poster: subtle pink glow border

## Watchlist Button

- Solid neon-pink button below the poster
- Text: "+ Add to Watchlist"
- `onClick`: `// TODO: implement watchlist functionality`
- The `userTitle` table already exists in the DB schema for this

## Navigation

- `PosterCard` components in search results will be updated to link to `/app/title/${mediaType}/${tmdbId}`
- Back navigation: browser back button (no custom back button needed since navbar is present)

## Mockup Reference

Visual mockup available at `.superpowers/brainstorm/32844-1774218362/full-design-retro.html`
