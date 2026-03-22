# Taste Profile Onboarding — Design Spec

## Overview

Add a "taste profile" step (step 3) to the onboarding flow where users select 3-5 genres and 3-10 movies/TV shows. This data drives future recommendations. The page is a single continuous view: search bar at top, genre pills below, then an infinite-scrolling grid of title cards assembled server-side from TMDB.

## API: TMDB

TMDB is the data source for genres, title discovery, trending content, and search. Key reasons: comprehensive movie + TV coverage, excellent poster CDN (7 sizes), genre-based discovery endpoint, adult content filtering, generous rate limits (~50 req/s), and free with attribution.

### Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /genre/movie/list` | Movie genre list |
| `GET /genre/tv/list` | TV genre list |
| `GET /discover/movie` | Popular movies filtered by genre |
| `GET /discover/tv` | Popular TV shows filtered by genre |
| `GET /trending/all/week` | Weekly trending content |
| `GET /search/multi` | Unified movie + TV search |

### Quality Filters (applied to discover calls)

- `sort_by=popularity.desc`
- `vote_count.gte=200`
- `vote_average.gte=6.0`
- `include_adult=false`

### Genre Mapping

TMDB movie and TV genres use different IDs and names (e.g., movies: "Action" id:28, TV: "Action & Adventure" id:10759). A static mapping table unifies these under a single user-facing label, storing both the movie and TV genre IDs for each.

### Image URLs

Base URL: `https://image.tmdb.org/t/p/{size}/{poster_path}`
Primary size: `w500` for grid cards.

## Onboarding Integration

The existing onboarding flow (steps 1-2) uses a compact `AuthLayout > AuthCard` wrapper. The taste profile step is a full-page experience (infinite scroll grid, floating footer, search) that does not fit inside `AuthCard`. This step must **break out of the `AuthCard` container** and render as a full-width layout within `AuthLayout` (keeping the overall auth chrome like logo and background). Since `AuthLayout`'s content wrapper (`flex flex-col items-center`) doesn't constrain width for non-`AuthCard` children, the `TasteProfileStep` component must set its own width (e.g. `w-full max-w-6xl mx-auto px-4`).

The existing avatar step (step 2) currently calls `authClient.updateUser({ onboardingCompleted: true })` via `finalizeOnboarding`. This must be **removed from step 2** — `onboardingCompleted` is now set server-side by `saveTasteProfile` in step 3. Step 2 should only save the avatar and call `onNext()`.

## Page Layout

Step 3 of onboarding (after username + avatar). Single full-width page, top to bottom:

1. **Step indicator** — existing `StepIndicator` component, now 3 of 3
2. **Heading** — e.g. "What do you love watching?"
3. **Search bar** — full-width, debounced (300ms), min 2 chars to trigger
4. **Genre pills** — horizontal wrapping row of pill/chip buttons. All unified genres shown. User toggles 3-5. Selected pills get neon fill color, unselected are outlined. At 5 selected, remaining pills visually disable.
5. **Title grid** — responsive columns (4xl / 3lg / 2md / 1sm). Infinite scroll via intersection observer. Empty state before 3 genres selected.
6. **Floating footer** — fixed bottom, slides up on first selection. Contains: small poster thumbnails of picks (overlapping past 5, clickable to deselect), count "N / 3-10", continue button (disabled until 3 selected).

### Card Design

Each card shows:
- Poster image (aspect ratio ~4:5, shorter than TMDB's native 2:3 — achieved via `object-fit: cover` with overflow hidden on the image container)
- Title + year (right-aligned)
- Rating (stars)
- Description (2 lines, truncated)
- Genre tags (colored pills)

Text should be comfortably readable — not tiny.

### Selection Interaction

- Click a card to select: neon checkmark overlay appears centered on poster, card gets a glowing pink border (`#FF2D78`) with box-shadow
- Click again to deselect
- Can also deselect via footer thumbnails

### Search Mode

When search input has text (2+ chars after debounce):
- Genre pills dim/disable
- Grid replaces with TMDB multi-search results
- Clearing input restores genre-filtered discover feed
- Already-selected items show as selected in search results

## Server Architecture

### TMDB Client

New `src/lib/tmdb.ts`:
- Typed helper functions wrapping TMDB endpoints
- Image URL builder utility
- API key from environment variable `TMDB_API_KEY`
- Authentication via bearer token (`Authorization: Bearer <token>` header)

### tRPC Router

New `tasteProfile` router added to the app router.

#### Procedures

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `getGenres` | query | none | `{id: number, name: string, movieGenreId: number \| null, tvGenreId: number \| null}[]` |
| `getFeed` | query | `{genreIds: number[], cursor?: string}` | `{items: FeedItem[], nextCursor: string \| null}` | `genreIds` are **unified IDs** from `getGenres`; the server resolves these to the corresponding TMDB movie/TV genre IDs via the mapping table before making discover calls. |
| `search` | query | `{query: string, cursor?: string}` | `{items: FeedItem[], nextCursor: string \| null}` |
| `saveTasteProfile` | mutation | `{genreIds: number[], titles: {tmdbId: number, mediaType: 'movie' \| 'tv'}[]}` | `{success: boolean}` |

#### FeedItem Shape

```typescript
{
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  overview: string
  year: string
  rating: number
  genreIds: number[]
  isTrending: boolean
}
```

Note: `runtime` is omitted — TMDB's discover and search endpoints don't return it, and fetching it would require an extra detail call per item. Not worth the cost for an onboarding picker.

### Feed Assembly Logic

The `getFeed` procedure handles all content curation:

1. **Cursor encoding** — cursor is a JSON-stringified object tracking per-genre page numbers for both movie and TV discover calls, plus trending page number
2. **Per-genre fetching** — for each selected genre, calls `/discover/movie` and `/discover/tv` with quality filters
3. **Trending fetch** — calls `/trending/all/week`, filters results to only those matching selected genres
4. **Interleaving** — round-robin across genres for equal representation, ~80% discover / ~20% trending ratio
5. **Deduplication** — by `tmdbId + mediaType` composite key
6. **Page size** — ~20 items per page
7. **Returns** items + next cursor (null when all sources exhausted)

## Database Changes

Two new tables in Drizzle schema:

### `user_genre`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text (nanoid) | PK |
| `userId` | text | FK → user.id, NOT NULL |
| `genreId` | integer | NOT NULL |
| `createdAt` | timestamp | NOT NULL, default now |

Unique constraint on `(userId, genreId)`.

### `user_title`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text (nanoid) | PK |
| `userId` | text | FK → user.id, NOT NULL |
| `tmdbId` | integer | NOT NULL |
| `mediaType` | text ('movie' \| 'tv') | NOT NULL |
| `createdAt` | timestamp | NOT NULL, default now |

Unique constraint on `(userId, tmdbId, mediaType)`.

### Save Flow

`saveTasteProfile` mutation:
1. Validates genre count (3-5) and title count (3-10) via Zod
2. Inserts into `user_genre` and `user_title`
3. Sets `onboardingCompleted = true` on user record
4. All within a transaction

## Client Implementation

### State

All local React state:
- `selectedGenres: Set<number>` — 3-5 genre IDs
- `selectedTitles: Map<string, FeedItem>` — keyed by `${tmdbId}-${mediaType}`
- `searchQuery: string` — debounced

### Data Fetching

- `trpc.tasteProfile.getGenres.useQuery()` — on mount
- `trpc.tasteProfile.getFeed.useInfiniteQuery()` — enabled when 3+ genres selected, cursor-based with `getNextPageParam` reading `nextCursor`
- `trpc.tasteProfile.search.useInfiniteQuery()` — enabled when search query is 2+ chars
- Feed query invalidates/refetches when selected genres change

### Infinite Scroll

Intersection observer on a sentinel `<div>` at the grid bottom. When visible, calls `fetchNextPage()`. Loading spinner row shown while fetching.

### Components

| Component | Responsibility |
|-----------|---------------|
| `TasteProfileStep` | Top-level orchestrator — state, queries, layout |
| `GenrePills` | Renders genre list, handles toggle, enforces 3-5 limit |
| `SearchBar` | Debounced input (300ms) |
| `TitleGrid` | CSS grid of cards, intersection observer for infinite scroll |
| `TitleCard` | Individual card with selected/unselected states |
| `SelectionFooter` | Floating footer — thumbnails, count, continue button |

### Responsive Grid

| Breakpoint | Columns |
|------------|---------|
| xl (≥1280px) | 4 |
| lg (≥1024px) | 3 |
| md (≥768px) | 2 |
| sm (<768px) | 1 |

## Edge Cases

### Validation
- Genre selection clamped 3-5 — at 5, remaining pills disable
- Title selection clamped 3-10 — at 10, cards stop being selectable, toast notification
- Server-side Zod validation on `saveTasteProfile`

### Loading States
- Genre pills: skeleton shimmer row
- Grid: skeleton card placeholders (4 per row)
- Infinite scroll: spinner row at bottom
- Search: skeleton then "No results for X" empty state

### Error Handling
- TMDB failure: inline error in grid area with retry button
- Save failure: toast error, button re-enables
- Network loss: stop fetching, "Connection lost" inline

### Genre Change Behavior
- Feed refetches with new genre set
- Previously selected titles persist in `selectedTitles` and footer regardless of genre changes

### Deselection
- Click selected card in grid
- Click thumbnail in footer
- Both update same `selectedTitles` state

### Navigation
- Back to step 2 and return: selections preserved in component state
- Hard refresh: step 3 starts fresh (acceptable)

## Testing

Tests use Vitest. Focus on logic that matters — no testing of trivial wiring or UI snapshot tests.

### Server Tests

| Test | What it verifies |
|------|-----------------|
| Feed interleaving | Given mock TMDB responses for N genres, verify output is round-robin interleaved with ~80/20 discover/trending ratio |
| Feed deduplication | Items appearing in multiple genres are not duplicated in the feed |
| Feed cursor pagination | Cursor correctly advances per-genre page counters, subsequent pages return new items |
| Genre ID resolution | Unified genre IDs correctly resolve to the right TMDB movie and TV genre IDs |
| `saveTasteProfile` validation | Rejects <3 or >5 genres, <3 or >10 titles. Accepts valid counts. |
| `saveTasteProfile` persistence | Genres and titles are written to DB, `onboardingCompleted` set to true |
| Search result mapping | TMDB multi-search response is correctly mapped to `FeedItem` shape, filtering out non-movie/tv results (e.g. person results) |

### Client Tests

| Test | What it verifies |
|------|-----------------|
| Genre pill selection limits | Cannot select more than 5, cannot deselect below 0 |
| Title selection limits | Cannot select more than 10, can deselect |
| Footer state | Continue button disabled when <3 titles, enabled when >=3 |
| Search mode toggle | Entering search text disables genre pills, clearing restores them |

Mock tRPC responses for client tests — don't hit real TMDB.

## Environment

New env var required: `TMDB_API_KEY` — added to `src/env.ts` validation schema.
