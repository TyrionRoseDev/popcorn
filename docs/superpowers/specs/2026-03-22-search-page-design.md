# Search Page Design

## Overview

A search-first movie & TV show discovery page at `/app/search`. When no query is active, displays categorized landing content (Trending, Top Rated, New Releases). When a query is entered, switches to a sidebar + paginated grid layout with full filtering and sorting.

Route inherits `/app` auth guard — requires authenticated user with completed onboarding.

## Route & Search Params

Single route: `/app/search`

**Search params schema (validated via TanStack Router `validateSearch`):**

| Param    | Type                                                        | Default       |
|----------|-------------------------------------------------------------|---------------|
| q        | string                                                      | ""            |
| type     | "all" \| "movie" \| "tv"                                   | "all"         |
| genre    | number \| undefined                                         | undefined     |
| yearMin  | number \| undefined                                         | undefined     |
| yearMax  | number \| undefined                                         | undefined     |
| rating   | number \| undefined                                         | undefined     |
| sort     | "relevance" \| "popularity" \| "rating" \| "newest" \| "oldest" | "relevance" |
| page     | number                                                      | 1             |

`genre` is a unified genre ID (number) from `UNIFIED_GENRES` in `src/lib/genre-map.ts`. TanStack Router parses numbers from URL params.

Page resets to 1 whenever `q`, `type`, `genre`, `yearMin`, `yearMax`, `rating`, or `sort` change.

## Architecture

**Approach:** Single route, conditional render. `q` being empty determines landing vs results state.

### Page States

1. **Landing state** (`q` is empty) — search bar at top, three horizontal rows of posters:
   - Trending Now (neon-pink badge)
   - Top Rated (neon-amber badge)
   - New Releases (neon-cyan badge)

2. **Results state** (`q` has value) — search bar at top, results info bar (count + sort dropdown), then sidebar + grid layout:
   - Left: FilterSidebar (220px fixed width, collapses to sheet on mobile)
   - Right: PosterGrid (responsive columns) + shadcn Pagination at bottom

## Data Layer (tRPC)

New `search` router with these procedures.

### TMDB API Strategy

TMDB's search endpoints (`/search/movie`, `/search/tv`) only support `query` and `page` — they do **not** support `sort_by`, `with_genres`, `vote_average.gte`, or year range params. Those are only available on `/discover` endpoints, which don't accept a text query.

**Strategy:** When `q` is present, fetch from TMDB search and apply genre, year, rating filters + sorting **server-side in the tRPC procedure** after fetching. To make filtering useful, the procedure fetches up to 3 pages (60 results) from TMDB, applies all filters and sorting, then paginates the filtered results into 20-per-page chunks. This is a pragmatic tradeoff — filters work across a larger result set without hammering the API.

When `q` is empty and filters are active, use TMDB Discover API which natively supports all filter/sort params.

### `search.results`
- **Input:** All search params (`q`, `type`, `genre`, `yearMin`, `yearMax`, `rating`, `sort`, `page`)
- **Output:** `{ results: FeedItem[], totalPages: number, totalResults: number }`
- **Implementation:**
  - **With `q`:** Fetch from TMDB search (up to 3 pages), apply filters/sort server-side, paginate
  - **Without `q` but with filters:** Use TMDB Discover API with native filter/sort params
  - **`type` routing:**
    - `"all"` → call both `/search/movie` and `/search/tv` (or both discover endpoints), merge
    - `"movie"` → call only `/search/movie` (or `/discover/movie`)
    - `"tv"` → call only `/search/tv` (or `/discover/tv`)
  - `totalPages`/`totalResults` computed from the filtered+merged result set
  - Returns 20 results per page

### `search.trending`
- **Input:** None
- **Output:** `{ results: FeedItem[] }` (6 items)
- **Implementation:** Uses TMDB `fetchTrending`, slices to 6

### `search.topRated`
- **Input:** None
- **Output:** `{ results: FeedItem[] }` (6 items)
- **Implementation:** New TMDB calls to `/discover/movie` and `/discover/tv` with `sort_by: "vote_average.desc"` and `vote_count.gte: 200`. Merges, sorts by rating, takes top 6. (Existing `discoverMovies`/`discoverTv` hardcode `popularity.desc`, so new parameterized calls are needed.)

### `search.newReleases`
- **Input:** None
- **Output:** `{ results: FeedItem[] }` (6 items)
- **Implementation:** New TMDB calls to discover endpoints with `primary_release_date.gte` set to 30 days ago, `sort_by: "popularity.desc"`. Merges and takes top 6.

### Reuse of `FeedItem` type

Reuse the existing `FeedItem` type from `src/lib/feed-assembler.ts` rather than introducing a new `MediaItem` type. `FeedItem` already has `tmdbId`, `title`, `mediaType`, `posterPath`, `year`, `rating`, `overview`, `genreIds`. Set `isTrending: false` for search results (or `true` for trending landing results). This keeps the `TitleCard` component compatible without changes.

## Components

### SearchPage (route component)
- Reads search params via `useSearch()`
- Conditionally renders `SearchLanding` or `SearchResults` based on `q`
- Manages all search param navigation

### SearchBar
- Reuses debounced input pattern from onboarding (300ms debounce)
- On change: navigates with `{ q: value, page: 1 }` preserving other params
- Clear button resets `q` to empty (returns to landing state)
- Focus state: cyan border glow

### SearchLanding
- Three sections, each with a heading + neon badge + horizontal poster row
- Each row: 6 posters in a responsive grid
- Breakpoints: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6`
- Data: three parallel tRPC queries (`trending`, `topRated`, `newReleases`)
- Genre list source: `UNIFIED_GENRES` from `src/lib/genre-map.ts` (same as onboarding)

### FilterSidebar (220px, left side)
- **Type:** Vertical pills (All / Movies / TV Shows) — single select, neon-pink active state
- **Genre:** Scrollable list from `UNIFIED_GENRES` — single select, neon-cyan active state
- **Year:** Range display showing min–max, opens popover/inputs for editing
- **Rating:** Horizontal pills (5+ through 9+) — single select, neon-amber active state
- **Clear all filters:** Link at bottom, resets all filters to defaults
- Each filter change navigates with updated param + `page: 1`
- **Mobile (below `md` breakpoint):** Sidebar collapses behind a "Filters" button that opens a slide-over sheet (shadcn `Sheet` component). Active filter count shown on the button.

### PosterGrid
- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Reuses poster card pattern from onboarding `TitleCard`
- Each card: poster image (aspect 2/3), type badge (top-right), title, rating + year
- Hover: pink border glow, slight translateY(-2px)
- No click action for now (detail pages come later)

### Pagination
- Uses shadcn `Pagination` component
- Driven by `page` search param and `totalPages` from API
- Shows: Prev, page numbers with ellipsis, Next
- Active page: neon-pink background
- Clicking navigates with updated `page` param, scrolls to top

## Loading, Empty & Error States

- **Grid loading:** Skeleton placeholders matching poster card dimensions with `animate-pulse`
- **Landing loading:** Skeleton rows for each section
- **No results:** Empty state component with message "No results found" + suggestion to adjust filters or try a different search
- **Error:** Toast notification via Sonner. Previous data remains visible if available. Each landing section loads independently — if one fails, others still render. Search results show a retry button below the grid on failure.

## Accessibility

- **Keyboard navigation:** Filter pills and genre list navigable via Tab. Arrow keys to move within pill groups.
- **Focus management:** On page change, focus moves to top of results grid. On filter change, focus remains on the filter control.
- **ARIA:** Search input has `role="searchbox"` and `aria-label`. Results count is an `aria-live="polite"` region. Filter groups use `role="radiogroup"` with `aria-label`. Pagination already has ARIA support from shadcn component.
- **Screen reader:** Loading states announced via `aria-busy`. Empty state has descriptive text.

## Visual Design

Matches the existing retro drive-in aesthetic from onboarding:

- **Background:** `drive-in-bg` (#050508) with starfield, ambient glow, vignette overlays
- **Colors:** neon-pink (#FF2D78) for primary actions/selected, neon-cyan (#00E5FF) for focus/secondary, neon-amber (#FFB800) for ratings/accents
- **Typography:** Righteous for headings, Manrope for body, Space Mono for labels/badges
- **Cards:** `bg-cream/[0.03]`, `border-cream/8`, hover glow with neon-pink
- **Inputs:** `bg-cream/6`, `border-cream/12`, cyan focus glow
- **Transitions:** 200ms on cards, 300ms on filter interactions

## URL State Flow

```
User types query → 300ms debounce → navigate({ search: { q, page: 1 } })
User clicks filter → navigate({ search: { ...current, genre: 5, page: 1 } })
User clicks page 3 → navigate({ search: { ...current, page: 3 } })
User clears search → navigate({ search: { q: '' } }) → landing state
```
