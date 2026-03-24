# Title Page Design Spec

## Overview

A detail page for individual movies and TV shows, accessible from search results. Features an immersive hero trailer, sidebar poster layout, and organized metadata sections — all styled in the existing drive-in theater retro aesthetic.

## Route

**File:** `src/routes/app/title.$mediaType.$tmdbId.tsx` (flat file convention, matching existing project style)

**URL:** `/app/title/:mediaType/:tmdbId`

- `mediaType`: `"movie" | "tv"` (validated via Zod)
- `tmdbId`: `number`
- Sits under the `/app` layout (inherits navbar + auth guard)
- `PosterCard` components in search results link here via `<Link>` wrapper

## Data Layer

### New tRPC Router: `title`

**Procedure:** `title.details` — `publicProcedure` (page is behind auth guard at the route level already)

**Input:** `{ mediaType: "movie" | "tv", tmdbId: number }`

Fetches four TMDB endpoints in parallel on the server:
- `/movie/{id}` or `/tv/{id}` — full details
- `/movie/{id}/credits` or `/tv/{id}/credits` — cast (capped to top 12 billed)
- `/movie/{id}/videos` or `/tv/{id}/videos` — trailers (filtered for YouTube)
- `/movie/{id}/release_dates` or `/tv/{id}/content_ratings` — content rating (US cert)

If credits or videos calls fail, return empty arrays / null fallbacks. Only fail the entire request if the main details call fails.

**TMDB image sizes:** Extend the `ImageSize` type in `src/lib/tmdb.ts` to include `w1280` for backdrop images.

**Return type:**

```typescript
interface TitleData {
  tmdbId: number
  mediaType: "movie" | "tv"
  title: string
  tagline: string | null
  overview: string
  year: string                    // e.g. "2008"
  runtime: string                 // "2h 32m" or "45m per episode"
  rating: number                  // vote_average
  contentRating: string           // "PG-13", "TV-MA", etc. — fallback to "NR" if unavailable
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

### Data Loading

Use TanStack Router's route `loader` to prefetch `title.details` via tRPC, so the page renders with data immediately (no loading flash on navigation).

## States

### Loading State
Use skeleton placeholders matching the page layout: a grey shimmer block for the hero, a skeleton rectangle for the poster, and animated lines for the text sections.

### Error State
- **404 (invalid tmdbId):** Show a "Title not found" message with a link back to search
- **Server error:** Show a generic error message with a retry button

### Missing Data Fallbacks
- **No trailer (`trailerKey` is null):** Hide the play button entirely; hero shows just the backdrop
- **No backdrop:** Fall back to a gradient matching the drive-in theme
- **No poster:** Show a gradient placeholder with a film icon
- **No cast photos:** Show gradient circle fallback per actor

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
- Full-width backdrop image (TMDB `w1280` — requires extending `ImageSize` type)
- Film strip borders (top and bottom) with sprocket holes
- Vignette overlay (radial gradient darkening edges)
- Centered play button (neon-pink, glowing) — hidden if `trailerKey` is null
- On click: swaps backdrop for YouTube iframe embed (use `youtube-nocookie.com` for privacy)
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

### 4. `TitleMetadata`
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
- Display up to 12 cast members

**Props:** `cast[]`

### 6. `SectionDivider`
- Simple styled `<hr>` element
- Gradient line fading from neon-pink to neon-cyan to transparent

**Props:** none

### Page Composition (in route file)

```tsx
<HeroTrailer backdropPath={data.backdropPath} trailerKey={data.trailerKey} />
<div className="sidebar-layout">
  <div className="poster-sidebar">
    <img />                    {/* poster image, not its own component */}
    <button>+ Add to Watchlist</button>  {/* TODO: implement watchlist on click */}
  </div>
  <div className="content">
    {/* Title heading — inline in the route file, not a separate component */}
    <div>
      <h1>{data.title}</h1>
      <span>{data.year} • {data.runtime} • ★ {data.rating}</span>
    </div>
    <TitleInfoBar />
    <SectionDivider />
    <Synopsis />
    <SectionDivider />
    <TitleMetadata />
    <SectionDivider />
    <CastList />
  </div>
</div>
```

The title heading is rendered inline in the route file — it's just an `<h1>` and a metadata line, not complex enough for its own component.

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

- Wrap `PosterCard` in search results with a `<Link to="/app/title/$mediaType/$tmdbId">` — the card itself stays as-is, just wrapped in a link
- Back navigation: browser back button (no custom back button needed since navbar is present)

## Mockup Reference

Visual mockup available at `.superpowers/brainstorm/32844-1774218362/full-design-retro.html`
