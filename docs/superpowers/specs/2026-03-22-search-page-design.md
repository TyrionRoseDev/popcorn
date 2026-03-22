# Search Page Design

## Overview

A search-first movie & TV show discovery page at `/app/search`. When no query is active, displays categorized landing content (Trending, Top Rated, New Releases). When a query is entered, switches to a sidebar + paginated grid layout with full filtering and sorting.

## Route & Search Params

Single route: `/app/search`

**Search params schema (validated via TanStack Router `validateSearch`):**

| Param    | Type                                                        | Default       |
|----------|-------------------------------------------------------------|---------------|
| q        | string                                                      | ""            |
| type     | "all" \| "movie" \| "tv"                                   | "all"         |
| genre    | string \| undefined                                         | undefined     |
| yearMin  | number \| undefined                                         | undefined     |
| yearMax  | number \| undefined                                         | undefined     |
| rating   | number \| undefined                                         | undefined     |
| sort     | "relevance" \| "popularity" \| "rating" \| "newest" \| "oldest" | "relevance" |
| page     | number                                                      | 1             |

Page resets to 1 whenever `q`, `type`, `genre`, `yearMin`, `yearMax`, `rating`, or `sort` change.

## Architecture

**Approach:** Single route, conditional render. `q` being empty determines landing vs results state.

### Page States

1. **Landing state** (`q` is empty) — search bar at top, three horizontal rows of 6 posters each:
   - Trending Now (neon-pink badge)
   - Top Rated (neon-amber badge)
   - New Releases (neon-cyan badge)

2. **Results state** (`q` has value) — search bar at top, results info bar (count + sort dropdown), then sidebar + grid layout:
   - Left: FilterSidebar (220px fixed width)
   - Right: PosterGrid (responsive 4/3/2/1 columns) + shadcn Pagination at bottom

## Data Layer (tRPC)

New `search` router with these procedures:

### `search.results`
- **Input:** All search params (`q`, `type`, `genre`, `yearMin`, `yearMax`, `rating`, `sort`, `page`)
- **Output:** `{ results: MediaItem[], totalPages: number, totalResults: number }`
- **Implementation:** Uses TMDB `searchMulti` when query present. Maps `type` filter to TMDB's `media_type`. Applies genre, year, and rating filters. Sort maps to TMDB's `sort_by` parameter. Returns 20 results per page (TMDB default).

### `search.trending`
- **Input:** None
- **Output:** `{ results: MediaItem[] }` (10 items)
- **Implementation:** Uses TMDB `fetchTrending` for movies + TV combined

### `search.topRated`
- **Input:** None
- **Output:** `{ results: MediaItem[] }` (10 items)
- **Implementation:** Uses TMDB `discoverMovies` + `discoverTv` sorted by vote_average, merges and takes top 10

### `search.newReleases`
- **Input:** None
- **Output:** `{ results: MediaItem[] }` (10 items)
- **Implementation:** Uses TMDB discover with recent release date filter, sorted by popularity

### MediaItem type
```ts
{
  id: number
  title: string
  mediaType: "movie" | "tv"
  posterPath: string | null
  releaseYear: number | null
  rating: number | null
  overview: string
  genreIds: number[]
}
```

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
- Each row: 6 posters in a responsive grid (6 cols desktop, 4 tablet, 2 mobile)
- Data: three parallel tRPC queries (`trending`, `topRated`, `newReleases`)

### FilterSidebar (220px, left side)
- **Type:** Vertical pills (All / Movies / TV Shows) — single select, neon-pink active state
- **Genre:** Scrollable list of genre items — single select, neon-cyan active state
- **Year:** Range display showing min–max, opens popover/inputs for editing
- **Rating:** Horizontal pills (5+ through 9+) — single select, neon-amber active state
- **Clear all filters:** Link at bottom, resets all filters to defaults
- Each filter change navigates with updated param + `page: 1`

### PosterGrid
- Responsive grid: 4 cols desktop / 3 tablet / 2 mobile / 1 small
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

## Loading & Empty States

- **Grid loading:** Skeleton placeholders matching poster card dimensions with `animate-pulse`
- **Landing loading:** Skeleton rows for each section
- **No results:** Empty state component with message "No results found" + suggestion to adjust filters or try a different search
- **Error:** Toast notification via Sonner

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
User clicks filter → navigate({ search: { ...current, genre: 'action', page: 1 } })
User clicks page 3 → navigate({ search: { ...current, page: 3 } })
User clears search → navigate({ search: { q: '' } }) → landing state
```
