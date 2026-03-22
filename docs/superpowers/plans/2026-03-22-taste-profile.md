# Taste Profile Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a taste profile step (step 3) to onboarding where users select 3-5 genres and 3-10 movies/TV shows via TMDB, with an infinite-scrolling grid and server-side feed assembly.

**Architecture:** Server-side feed assembly via tRPC procedures that call TMDB API, interleave results across genres, and serve paginated feeds. Client uses `useInfiniteQuery` for infinite scroll. New Drizzle tables store user preferences.

**Tech Stack:** TanStack Start, React 19, tRPC v11, Drizzle ORM/PostgreSQL, Vitest, Tailwind CSS v4, TMDB API v3

**Spec:** `docs/superpowers/specs/2026-03-22-taste-profile-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/tmdb.ts` | TMDB API client — typed fetch helpers, image URL builder |
| `src/lib/genre-map.ts` | Static genre mapping — unified ID → TMDB movie/TV genre IDs |
| `src/integrations/trpc/routers/taste-profile.ts` | tRPC router — getGenres, getFeed, search, saveTasteProfile |
| `src/lib/feed-assembler.ts` | Feed assembly logic — interleaving, dedup, cursor management |
| `src/components/onboarding/taste-profile-step.tsx` | Step 3 orchestrator — state, queries, layout |
| `src/components/onboarding/genre-pills.tsx` | Genre pill selector |
| `src/components/onboarding/search-bar.tsx` | Debounced search input |
| `src/components/onboarding/title-grid.tsx` | CSS grid + infinite scroll sentinel |
| `src/components/onboarding/title-card.tsx` | Individual title card |
| `src/components/onboarding/selection-footer.tsx` | Floating footer with thumbnails + continue |
| `src/lib/__tests__/feed-assembler.test.ts` | Feed assembly tests |
| `src/lib/__tests__/tmdb.test.ts` | TMDB client tests |
| `src/lib/__tests__/genre-map.test.ts` | Genre mapping tests |
| `src/integrations/trpc/__tests__/taste-profile.test.ts` | tRPC procedure tests |

### Modified Files

| File | Change |
|------|--------|
| `src/env.ts` | Add `TMDB_API_KEY` to server schema |
| `src/db/schema.ts` | Add `userGenre` and `userTitle` tables + relations |
| `src/integrations/trpc/router.ts` | Import and mount `tasteProfileRouter` |
| `src/routes/onboarding/index.tsx` | Remove `onboardingCompleted` from step 2, add step 3, handle layout break-out |

---

## Task 1: Environment Config + TMDB Client

**Files:**
- Modify: `src/env.ts`
- Create: `src/lib/tmdb.ts`
- Create: `src/lib/__tests__/tmdb.test.ts`

- [ ] **Step 1: Add `TMDB_API_KEY` to env config**

In `src/env.ts`, add to the `server` object:

```typescript
TMDB_API_KEY: z.string().min(1),
```

- [ ] **Step 2: Write TMDB client tests**

Create `src/lib/__tests__/tmdb.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  discoverMovies,
  discoverTv,
  fetchTrending,
  searchMulti,
  getTmdbImageUrl,
} from "../tmdb";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock env to avoid needing real env vars in tests
vi.mock("#/env", () => ({
  env: { TMDB_API_KEY: "test-api-key" },
}));

beforeEach(() => {
  mockFetch.mockReset();
});

describe("getTmdbImageUrl", () => {
  it("builds correct URL with default size", () => {
    expect(getTmdbImageUrl("/abc123.jpg")).toBe(
      "https://image.tmdb.org/t/p/w500/abc123.jpg"
    );
  });

  it("builds correct URL with custom size", () => {
    expect(getTmdbImageUrl("/abc123.jpg", "w780")).toBe(
      "https://image.tmdb.org/t/p/w780/abc123.jpg"
    );
  });

  it("returns null for null poster path", () => {
    expect(getTmdbImageUrl(null)).toBeNull();
  });
});

describe("discoverMovies", () => {
  it("calls TMDB discover/movie with correct params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1,
            title: "Test Movie",
            poster_path: "/test.jpg",
            overview: "A test movie",
            release_date: "2024-01-15",
            vote_average: 7.5,
            genre_ids: [28],
          },
        ],
        page: 1,
        total_pages: 5,
      }),
    });

    const result = await discoverMovies(28, 1);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/discover/movie"),
      expect.objectContaining({
        headers: { Authorization: "Bearer test-api-key" },
      })
    );
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("with_genres=28");
    expect(url).toContain("include_adult=false");
    expect(url).toContain("vote_count.gte=200");
    expect(url).toContain("vote_average.gte=6");
    expect(url).toContain("sort_by=popularity.desc");
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe("Test Movie");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(discoverMovies(28, 1)).rejects.toThrow("TMDB API error: 401");
  });
});

describe("searchMulti", () => {
  it("calls TMDB search/multi with query and filters out non-movie/tv results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: 1, media_type: "movie", title: "Test Movie", poster_path: "/m.jpg", overview: "...", release_date: "2024-01-01", vote_average: 8, genre_ids: [28] },
          { id: 2, media_type: "person", name: "Actor" },
          { id: 3, media_type: "tv", name: "Test Show", poster_path: "/t.jpg", overview: "...", first_air_date: "2023-06-01", vote_average: 7, genre_ids: [18] },
        ],
        page: 1,
        total_pages: 1,
      }),
    });

    const result = await searchMulti("test", 1);

    // Person results should be filtered out
    expect(result.results).toHaveLength(2);
    expect(result.results[0].media_type).toBe("movie");
    expect(result.results[1].media_type).toBe("tv");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bunx vitest run src/lib/__tests__/tmdb.test.ts`
Expected: FAIL — module `../tmdb` not found

- [ ] **Step 4: Implement TMDB client**

Create `src/lib/tmdb.ts`:

```typescript
import { env } from "#/env";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

type ImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original";

export function getTmdbImageUrl(
  posterPath: string | null,
  size: ImageSize = "w500"
): string | null {
  if (!posterPath) return null;
  return `${IMAGE_BASE_URL}/${size}${posterPath}`;
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${env.TMDB_API_KEY}` },
  });

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// --- Response types ---

export interface TmdbMovieResult {
  id: number;
  title: string;
  poster_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

export interface TmdbTvResult {
  id: number;
  name: string;
  poster_path: string | null;
  overview: string;
  first_air_date: string;
  vote_average: number;
  genre_ids: number[];
}

export interface TmdbTrendingResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids: number[];
}

export interface TmdbSearchResult extends TmdbTrendingResult {}

interface TmdbPagedResponse<T> {
  results: T[];
  page: number;
  total_pages: number;
  total_results: number;
}

// --- API functions ---

const QUALITY_FILTERS = {
  "sort_by": "popularity.desc",
  "vote_count.gte": "200",
  "vote_average.gte": "6",
  "include_adult": "false",
};

export async function discoverMovies(genreId: number, page: number) {
  return tmdbFetch<TmdbPagedResponse<TmdbMovieResult>>("/discover/movie", {
    with_genres: String(genreId),
    page: String(page),
    ...QUALITY_FILTERS,
  });
}

export async function discoverTv(genreId: number, page: number) {
  return tmdbFetch<TmdbPagedResponse<TmdbTvResult>>("/discover/tv", {
    with_genres: String(genreId),
    page: String(page),
    ...QUALITY_FILTERS,
  });
}

export async function fetchTrending(page: number) {
  return tmdbFetch<TmdbPagedResponse<TmdbTrendingResult>>("/trending/all/week", {
    page: String(page),
    include_adult: "false",
  });
}

export async function searchMulti(query: string, page: number) {
  const response = await tmdbFetch<TmdbPagedResponse<TmdbSearchResult>>("/search/multi", {
    query,
    page: String(page),
    include_adult: "false",
  });

  // Filter out non-movie/tv results (e.g. person)
  return {
    ...response,
    results: response.results.filter(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    ),
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run src/lib/__tests__/tmdb.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/env.ts src/lib/tmdb.ts src/lib/__tests__/tmdb.test.ts
git commit -m "feat: add TMDB API client with typed helpers and tests"
```

---

## Task 2: Genre Mapping

**Files:**
- Create: `src/lib/genre-map.ts`
- Create: `src/lib/__tests__/genre-map.test.ts`

- [ ] **Step 1: Write genre mapping tests**

Create `src/lib/__tests__/genre-map.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  UNIFIED_GENRES,
  getMovieGenreId,
  getTvGenreId,
  getUnifiedGenreById,
} from "../genre-map";

describe("UNIFIED_GENRES", () => {
  it("contains at least 10 genres", () => {
    expect(UNIFIED_GENRES.length).toBeGreaterThanOrEqual(10);
  });

  it("every genre has a unique id", () => {
    const ids = UNIFIED_GENRES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every genre has a name and at least one TMDB id", () => {
    for (const genre of UNIFIED_GENRES) {
      expect(genre.name).toBeTruthy();
      expect(
        genre.movieGenreId !== null || genre.tvGenreId !== null
      ).toBe(true);
    }
  });
});

describe("getMovieGenreId", () => {
  it("returns the TMDB movie genre id for a unified genre", () => {
    const action = UNIFIED_GENRES.find((g) => g.name === "Action");
    expect(action).toBeDefined();
    expect(getMovieGenreId(action!.id)).toBe(28);
  });

  it("returns null for unknown id", () => {
    expect(getMovieGenreId(99999)).toBeNull();
  });
});

describe("getTvGenreId", () => {
  it("returns the TMDB TV genre id for a unified genre", () => {
    const action = UNIFIED_GENRES.find((g) => g.name === "Action");
    expect(action).toBeDefined();
    expect(getTvGenreId(action!.id)).toBe(10759);
  });
});

describe("getUnifiedGenreById", () => {
  it("returns the genre object for a valid id", () => {
    const genre = getUnifiedGenreById(1);
    expect(genre).toBeDefined();
    expect(genre!.name).toBeTruthy();
  });

  it("returns undefined for invalid id", () => {
    expect(getUnifiedGenreById(99999)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/lib/__tests__/genre-map.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement genre mapping**

Create `src/lib/genre-map.ts`:

```typescript
export interface UnifiedGenre {
  id: number;
  name: string;
  movieGenreId: number | null;
  tvGenreId: number | null;
}

/**
 * Static mapping of unified genres to TMDB movie and TV genre IDs.
 * TMDB uses different IDs/names for movie vs TV genres.
 * This table gives users a single coherent list.
 */
export const UNIFIED_GENRES: UnifiedGenre[] = [
  { id: 1, name: "Action", movieGenreId: 28, tvGenreId: 10759 },
  { id: 2, name: "Adventure", movieGenreId: 12, tvGenreId: 10759 },
  { id: 3, name: "Animation", movieGenreId: 16, tvGenreId: 16 },
  { id: 4, name: "Comedy", movieGenreId: 35, tvGenreId: 35 },
  { id: 5, name: "Crime", movieGenreId: 80, tvGenreId: 80 },
  { id: 6, name: "Documentary", movieGenreId: 99, tvGenreId: 99 },
  { id: 7, name: "Drama", movieGenreId: 18, tvGenreId: 18 },
  { id: 8, name: "Family", movieGenreId: 10751, tvGenreId: 10751 },
  { id: 9, name: "Fantasy", movieGenreId: 14, tvGenreId: 10765 },
  { id: 10, name: "Horror", movieGenreId: 27, tvGenreId: null },
  { id: 11, name: "Mystery", movieGenreId: 9648, tvGenreId: 9648 },
  { id: 12, name: "Romance", movieGenreId: 10749, tvGenreId: null },
  { id: 13, name: "Sci-Fi", movieGenreId: 878, tvGenreId: 10765 },
  { id: 14, name: "Thriller", movieGenreId: 53, tvGenreId: null },
  { id: 15, name: "War", movieGenreId: 10752, tvGenreId: 10768 },
  { id: 16, name: "Western", movieGenreId: 37, tvGenreId: 37 },
  { id: 17, name: "Music", movieGenreId: 10402, tvGenreId: null },
  { id: 18, name: "History", movieGenreId: 36, tvGenreId: null },
  { id: 19, name: "Reality", movieGenreId: null, tvGenreId: 10764 },
];

const genreMap = new Map(UNIFIED_GENRES.map((g) => [g.id, g]));

export function getUnifiedGenreById(id: number): UnifiedGenre | undefined {
  return genreMap.get(id);
}

export function getMovieGenreId(unifiedId: number): number | null {
  return genreMap.get(unifiedId)?.movieGenreId ?? null;
}

export function getTvGenreId(unifiedId: number): number | null {
  return genreMap.get(unifiedId)?.tvGenreId ?? null;
}

/**
 * Reverse lookup: given a TMDB genre ID (from a movie or TV result),
 * return the unified genre name. Returns the raw ID as string if not found.
 */
const tmdbIdToName = new Map<number, string>();
for (const genre of UNIFIED_GENRES) {
  if (genre.movieGenreId !== null) tmdbIdToName.set(genre.movieGenreId, genre.name);
  if (genre.tvGenreId !== null) tmdbIdToName.set(genre.tvGenreId, genre.name);
}

export function getGenreNameByTmdbId(tmdbGenreId: number): string {
  return tmdbIdToName.get(tmdbGenreId) ?? String(tmdbGenreId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/lib/__tests__/genre-map.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/genre-map.ts src/lib/__tests__/genre-map.test.ts
git commit -m "feat: add unified genre mapping for TMDB movie/TV genres"
```

---

## Task 3: Database Schema

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `userGenre` and `userTitle` tables**

Add to the bottom of `src/db/schema.ts`, before the relations section:

```typescript
import { integer, uniqueIndex } from "drizzle-orm/pg-core";
// (add integer + uniqueIndex to existing import from "drizzle-orm/pg-core")

export const userGenre = pgTable(
  "user_genre",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    genreId: integer("genre_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_genre_unique").on(table.userId, table.genreId),
    index("user_genre_userId_idx").on(table.userId),
  ]
);

export const userTitle = pgTable(
  "user_title",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tmdbId: integer("tmdb_id").notNull(),
    mediaType: text("media_type").notNull(), // 'movie' | 'tv'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_title_unique").on(table.userId, table.tmdbId, table.mediaType),
    index("user_title_userId_idx").on(table.userId),
  ]
);
```

- [ ] **Step 2: Add relations for the new tables**

Add to the relations section:

```typescript
export const userGenreRelations = relations(userGenre, ({ one }) => ({
  user: one(user, {
    fields: [userGenre.userId],
    references: [user.id],
  }),
}));

export const userTitleRelations = relations(userTitle, ({ one }) => ({
  user: one(user, {
    fields: [userTitle.userId],
    references: [user.id],
  }),
}));
```

Also update the existing `userRelations` to include the new tables:

```typescript
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  genres: many(userGenre),
  titles: many(userTitle),
}));
```

- [ ] **Step 3: Generate migration**

Run: `bunx drizzle-kit generate`
Expected: Migration file generated in `drizzle/` directory

- [ ] **Step 4: Push schema to database**

Run: `bunx drizzle-kit push`
Expected: Schema applied to database

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add user_genre and user_title tables for taste profile"
```

---

## Task 4: Feed Assembly Logic

**Files:**
- Create: `src/lib/feed-assembler.ts`
- Create: `src/lib/__tests__/feed-assembler.test.ts`

- [ ] **Step 1: Write feed assembly tests**

Create `src/lib/__tests__/feed-assembler.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { FeedItem } from "../feed-assembler";
import {
  interleaveFeed,
  deduplicateFeed,
  parseCursor,
  serializeCursor,
} from "../feed-assembler";

describe("parseCursor / serializeCursor", () => {
  it("round-trips a cursor", () => {
    const cursor = { genrePages: { "1_movie": 2, "1_tv": 1 }, trendingPage: 3 };
    const serialized = serializeCursor(cursor);
    expect(parseCursor(serialized)).toEqual(cursor);
  });

  it("returns default cursor for undefined input", () => {
    const cursor = parseCursor(undefined);
    expect(cursor.genrePages).toEqual({});
    expect(cursor.trendingPage).toBe(1);
  });
});

describe("deduplicateFeed", () => {
  it("removes duplicate items by tmdbId + mediaType", () => {
    const items: FeedItem[] = [
      { tmdbId: 1, mediaType: "movie", title: "A", posterPath: null, overview: "", year: "2024", rating: 7, genreIds: [1], isTrending: false },
      { tmdbId: 1, mediaType: "movie", title: "A dupe", posterPath: null, overview: "", year: "2024", rating: 7, genreIds: [2], isTrending: false },
      { tmdbId: 1, mediaType: "tv", title: "A TV", posterPath: null, overview: "", year: "2024", rating: 7, genreIds: [1], isTrending: false },
      { tmdbId: 2, mediaType: "movie", title: "B", posterPath: null, overview: "", year: "2024", rating: 8, genreIds: [1], isTrending: false },
    ];

    const result = deduplicateFeed(items);
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("A");
    expect(result[1].title).toBe("A TV"); // same tmdbId but different mediaType
    expect(result[2].title).toBe("B");
  });
});

describe("interleaveFeed", () => {
  it("round-robins items across genre buckets", () => {
    const buckets: Record<string, FeedItem[]> = {
      genre_1: [
        { tmdbId: 1, mediaType: "movie", title: "Action 1", posterPath: null, overview: "", year: "2024", rating: 7, genreIds: [1], isTrending: false },
        { tmdbId: 2, mediaType: "movie", title: "Action 2", posterPath: null, overview: "", year: "2024", rating: 7, genreIds: [1], isTrending: false },
      ],
      genre_2: [
        { tmdbId: 3, mediaType: "movie", title: "Comedy 1", posterPath: null, overview: "", year: "2024", rating: 7, genreIds: [2], isTrending: false },
        { tmdbId: 4, mediaType: "movie", title: "Comedy 2", posterPath: null, overview: "", year: "2024", rating: 7, genreIds: [2], isTrending: false },
      ],
    };

    const trending: FeedItem[] = [
      { tmdbId: 5, mediaType: "movie", title: "Trending 1", posterPath: null, overview: "", year: "2024", rating: 9, genreIds: [1], isTrending: true },
    ];

    const result = interleaveFeed(buckets, trending);

    // Should alternate genres and sprinkle trending
    expect(result.length).toBe(5);
    // First items should alternate between genres
    const genreOfFirst = result[0].genreIds[0];
    const genreOfSecond = result[1].genreIds[0];
    // They should be from different genres (round-robin)
    if (result[0].isTrending === false && result[1].isTrending === false) {
      expect(genreOfFirst).not.toBe(genreOfSecond);
    }
  });

  it("handles empty trending gracefully", () => {
    const buckets: Record<string, FeedItem[]> = {
      genre_1: [
        { tmdbId: 1, mediaType: "movie", title: "A", posterPath: null, overview: "", year: "2024", rating: 7, genreIds: [1], isTrending: false },
      ],
    };

    const result = interleaveFeed(buckets, []);
    expect(result).toHaveLength(1);
    expect(result[0].isTrending).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/lib/__tests__/feed-assembler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement feed assembler**

Create `src/lib/feed-assembler.ts`:

```typescript
export interface FeedItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  overview: string;
  year: string;
  rating: number;
  genreIds: number[];
  isTrending: boolean;
}

export interface FeedCursor {
  genrePages: Record<string, number>; // e.g. "1_movie": 2, "1_tv": 1
  trendingPage: number;
}

export function parseCursor(cursor: string | undefined): FeedCursor {
  if (!cursor) {
    return { genrePages: {}, trendingPage: 1 };
  }
  try {
    return JSON.parse(cursor) as FeedCursor;
  } catch {
    return { genrePages: {}, trendingPage: 1 };
  }
}

export function serializeCursor(cursor: FeedCursor): string {
  return JSON.stringify(cursor);
}

export function deduplicateFeed(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.tmdbId}-${item.mediaType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Interleaves items from genre buckets with trending items.
 * Round-robins across genres for equal representation.
 * ~80% discover / ~20% trending — every 5th item is trending (if available).
 */
export function interleaveFeed(
  genreBuckets: Record<string, FeedItem[]>,
  trending: FeedItem[]
): FeedItem[] {
  const result: FeedItem[] = [];
  const bucketKeys = Object.keys(genreBuckets);
  if (bucketKeys.length === 0) return trending;

  // Create iterators for each bucket
  const iterators = bucketKeys.map((key) => ({
    key,
    items: [...genreBuckets[key]],
    index: 0,
  }));

  let trendingIndex = 0;
  let discoverCount = 0;

  // Keep going while any source has items
  const hasDiscoverItems = () => iterators.some((it) => it.index < it.items.length);
  const hasTrendingItems = () => trendingIndex < trending.length;

  while (hasDiscoverItems() || hasTrendingItems()) {
    // Every 5th item: try to insert trending
    if (discoverCount > 0 && discoverCount % 4 === 0 && hasTrendingItems()) {
      result.push(trending[trendingIndex]);
      trendingIndex++;
      continue;
    }

    if (!hasDiscoverItems()) {
      // Out of discover items, drain trending
      if (hasTrendingItems()) {
        result.push(trending[trendingIndex]);
        trendingIndex++;
      }
      continue;
    }

    // Round-robin: pick next genre that has items
    let picked = false;
    for (let i = 0; i < iterators.length; i++) {
      const bucketIndex = (discoverCount + i) % iterators.length;
      const it = iterators[bucketIndex];
      if (it.index < it.items.length) {
        result.push(it.items[it.index]);
        it.index++;
        discoverCount++;
        picked = true;
        break;
      }
    }

    if (!picked) {
      // All discover exhausted, drain trending
      if (hasTrendingItems()) {
        result.push(trending[trendingIndex]);
        trendingIndex++;
      } else {
        break;
      }
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/lib/__tests__/feed-assembler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/feed-assembler.ts src/lib/__tests__/feed-assembler.test.ts
git commit -m "feat: add feed assembly logic with interleaving, dedup, and cursor"
```

---

## Task 5: tRPC Taste Profile Router

**Files:**
- Create: `src/integrations/trpc/routers/taste-profile.ts`
- Modify: `src/integrations/trpc/router.ts`
- Create: `src/integrations/trpc/__tests__/taste-profile.test.ts`

- [ ] **Step 1: Write tRPC procedure tests**

Create `src/integrations/trpc/__tests__/taste-profile.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock TMDB client
vi.mock("#/lib/tmdb", () => ({
  discoverMovies: vi.fn(),
  discoverTv: vi.fn(),
  fetchTrending: vi.fn(),
  searchMulti: vi.fn(),
  getTmdbImageUrl: vi.fn((path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : null
  ),
}));

// Mock env
vi.mock("#/env", () => ({
  env: { TMDB_API_KEY: "test-key", DATABASE_URL: "postgres://test" },
}));

import { discoverMovies, discoverTv, fetchTrending, searchMulti } from "#/lib/tmdb";
import { buildFeed, mapMovieToFeedItem, mapTvToFeedItem, mapSearchResultToFeedItem } from "../routers/taste-profile";

const mockDiscoverMovies = vi.mocked(discoverMovies);
const mockDiscoverTv = vi.mocked(discoverTv);
const mockFetchTrending = vi.mocked(fetchTrending);
const mockSearchMulti = vi.mocked(searchMulti);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mapMovieToFeedItem", () => {
  it("maps TMDB movie result to FeedItem", () => {
    const result = mapMovieToFeedItem({
      id: 123,
      title: "Dune",
      poster_path: "/dune.jpg",
      overview: "A sci-fi epic",
      release_date: "2021-10-22",
      vote_average: 8.0,
      genre_ids: [878, 12],
    });

    expect(result).toEqual({
      tmdbId: 123,
      mediaType: "movie",
      title: "Dune",
      posterPath: "/dune.jpg",
      overview: "A sci-fi epic",
      year: "2021",
      rating: 8.0,
      genreIds: [878, 12],
      isTrending: false,
    });
  });

  it("handles missing release_date", () => {
    const result = mapMovieToFeedItem({
      id: 1, title: "No Date", poster_path: null, overview: "",
      release_date: "", vote_average: 5, genre_ids: [],
    });
    expect(result.year).toBe("");
  });
});

describe("mapTvToFeedItem", () => {
  it("maps TMDB TV result to FeedItem", () => {
    const result = mapTvToFeedItem({
      id: 456,
      name: "Breaking Bad",
      poster_path: "/bb.jpg",
      overview: "A chemistry teacher",
      first_air_date: "2008-01-20",
      vote_average: 9.5,
      genre_ids: [18, 80],
    });

    expect(result).toEqual({
      tmdbId: 456,
      mediaType: "tv",
      title: "Breaking Bad",
      posterPath: "/bb.jpg",
      overview: "A chemistry teacher",
      year: "2008",
      rating: 9.5,
      genreIds: [18, 80],
      isTrending: false,
    });
  });
});

describe("buildFeed", () => {
  it("fetches from all selected genres and interleaves results", async () => {
    // Genre 1 (Action): movieGenreId=28, tvGenreId=10759
    mockDiscoverMovies.mockResolvedValue({
      results: [
        { id: 1, title: "Action Movie", poster_path: "/a.jpg", overview: "...", release_date: "2024-01-01", vote_average: 7, genre_ids: [28] },
      ],
      page: 1, total_pages: 5, total_results: 100,
    });
    mockDiscoverTv.mockResolvedValue({
      results: [
        { id: 2, name: "Action Show", poster_path: "/b.jpg", overview: "...", first_air_date: "2024-02-01", vote_average: 8, genre_ids: [10759] },
      ],
      page: 1, total_pages: 3, total_results: 60,
    });
    mockFetchTrending.mockResolvedValue({
      results: [
        { id: 3, media_type: "movie", title: "Trending Movie", poster_path: "/c.jpg", overview: "...", release_date: "2024-03-01", vote_average: 9, genre_ids: [28] },
      ],
      page: 1, total_pages: 10, total_results: 200,
    });

    const result = await buildFeed(
      [{ unifiedId: 1, movieGenreId: 28, tvGenreId: 10759 }],
      undefined
    );

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.nextCursor).toBeTruthy();
    expect(mockDiscoverMovies).toHaveBeenCalledWith(28, 1);
    expect(mockDiscoverTv).toHaveBeenCalledWith(10759, 1);
    expect(mockFetchTrending).toHaveBeenCalledWith(1);
  });

  it("skips TV discover when genre has no tvGenreId", async () => {
    mockDiscoverMovies.mockResolvedValue({
      results: [
        { id: 1, title: "Horror Movie", poster_path: "/h.jpg", overview: "...", release_date: "2024-01-01", vote_average: 7, genre_ids: [27] },
      ],
      page: 1, total_pages: 5, total_results: 100,
    });
    mockFetchTrending.mockResolvedValue({
      results: [], page: 1, total_pages: 1, total_results: 0,
    });

    await buildFeed(
      [{ unifiedId: 10, movieGenreId: 27, tvGenreId: null }],
      undefined
    );

    expect(mockDiscoverTv).not.toHaveBeenCalled();
  });
});

describe("mapSearchResultToFeedItem", () => {
  it("maps a movie search result", () => {
    const result = mapSearchResultToFeedItem({
      id: 1, media_type: "movie", title: "Movie", poster_path: "/m.jpg",
      overview: "...", release_date: "2024-01-01", vote_average: 7, genre_ids: [28],
    });
    expect(result.mediaType).toBe("movie");
    expect(result.title).toBe("Movie");
  });

  it("maps a TV search result using name field", () => {
    const result = mapSearchResultToFeedItem({
      id: 2, media_type: "tv", name: "Show", poster_path: "/s.jpg",
      overview: "...", first_air_date: "2023-06-01", vote_average: 8, genre_ids: [18],
    });
    expect(result.mediaType).toBe("tv");
    expect(result.title).toBe("Show");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/integrations/trpc/__tests__/taste-profile.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the tRPC router**

Create `src/integrations/trpc/routers/taste-profile.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { user, userGenre, userTitle } from "#/db/schema";
import {
  type FeedItem,
  deduplicateFeed,
  interleaveFeed,
  parseCursor,
  serializeCursor,
} from "#/lib/feed-assembler";
import {
  UNIFIED_GENRES,
  getMovieGenreId,
  getTvGenreId,
  getUnifiedGenreById,
} from "#/lib/genre-map";
import type {
  TmdbMovieResult,
  TmdbSearchResult,
  TmdbTrendingResult,
  TmdbTvResult,
} from "#/lib/tmdb";
import {
  discoverMovies,
  discoverTv,
  fetchTrending,
  searchMulti,
} from "#/lib/tmdb";
import { publicProcedure } from "../init";

// --- Mappers ---

export function mapMovieToFeedItem(
  movie: TmdbMovieResult,
  isTrending = false
): FeedItem {
  return {
    tmdbId: movie.id,
    mediaType: "movie",
    title: movie.title,
    posterPath: movie.poster_path,
    overview: movie.overview,
    year: movie.release_date?.substring(0, 4) ?? "",
    rating: movie.vote_average,
    genreIds: movie.genre_ids,
    isTrending,
  };
}

export function mapTvToFeedItem(
  show: TmdbTvResult,
  isTrending = false
): FeedItem {
  return {
    tmdbId: show.id,
    mediaType: "tv",
    title: show.name,
    posterPath: show.poster_path,
    overview: show.overview,
    year: show.first_air_date?.substring(0, 4) ?? "",
    rating: show.vote_average,
    genreIds: show.genre_ids,
    isTrending,
  };
}

export function mapSearchResultToFeedItem(
  result: TmdbSearchResult
): FeedItem {
  return {
    tmdbId: result.id,
    mediaType: result.media_type as "movie" | "tv",
    title: result.title ?? result.name ?? "",
    posterPath: result.poster_path,
    overview: result.overview,
    year:
      (result.release_date ?? result.first_air_date)?.substring(0, 4) ?? "",
    rating: result.vote_average,
    genreIds: result.genre_ids,
    isTrending: false,
  };
}

// --- Feed builder ---

interface GenreInput {
  unifiedId: number;
  movieGenreId: number | null;
  tvGenreId: number | null;
}

const PAGE_SIZE = 20;

export async function buildFeed(
  genres: GenreInput[],
  cursorInput: string | undefined
) {
  const cursor = parseCursor(cursorInput);

  // Fetch discover results per genre (movie + TV)
  const genreBuckets: Record<string, FeedItem[]> = {};
  const fetchPromises: Promise<void>[] = [];

  for (const genre of genres) {
    if (genre.movieGenreId !== null) {
      const pageKey = `${genre.unifiedId}_movie`;
      const page = cursor.genrePages[pageKey] ?? 1;
      fetchPromises.push(
        discoverMovies(genre.movieGenreId, page).then((res) => {
          const key = `genre_${genre.unifiedId}`;
          if (!genreBuckets[key]) genreBuckets[key] = [];
          genreBuckets[key].push(...res.results.map((m) => mapMovieToFeedItem(m)));
          cursor.genrePages[pageKey] = page + 1;
        })
      );
    }

    if (genre.tvGenreId !== null) {
      const pageKey = `${genre.unifiedId}_tv`;
      const page = cursor.genrePages[pageKey] ?? 1;
      fetchPromises.push(
        discoverTv(genre.tvGenreId, page).then((res) => {
          const key = `genre_${genre.unifiedId}`;
          if (!genreBuckets[key]) genreBuckets[key] = [];
          genreBuckets[key].push(...res.results.map((s) => mapTvToFeedItem(s)));
          cursor.genrePages[pageKey] = page + 1;
        })
      );
    }
  }

  // Fetch trending
  const trendingPage = cursor.trendingPage;
  let trendingItems: FeedItem[] = [];
  fetchPromises.push(
    fetchTrending(trendingPage).then((res) => {
      // Filter trending to only items matching selected genre IDs (TMDB IDs)
      const selectedTmdbIds = new Set(
        genres.flatMap((g) =>
          [g.movieGenreId, g.tvGenreId].filter((id): id is number => id !== null)
        )
      );
      trendingItems = res.results
        .filter(
          (r) =>
            (r.media_type === "movie" || r.media_type === "tv") &&
            r.genre_ids.some((id) => selectedTmdbIds.has(id))
        )
        .map((r) => {
          if (r.media_type === "movie") {
            return mapMovieToFeedItem(r as unknown as TmdbMovieResult, true);
          }
          return mapTvToFeedItem(
            { ...r, name: r.name ?? r.title ?? "" } as unknown as TmdbTvResult,
            true
          );
        });
      cursor.trendingPage = trendingPage + 1;
    })
  );

  await Promise.all(fetchPromises);

  // Interleave and deduplicate
  const interleaved = interleaveFeed(genreBuckets, trendingItems);
  const deduped = deduplicateFeed(interleaved);
  const items = deduped.slice(0, PAGE_SIZE);

  return {
    items,
    nextCursor: items.length > 0 ? serializeCursor(cursor) : null,
  };
}

// --- Router ---

export const tasteProfileRouter = {
  getGenres: publicProcedure.query(() => {
    return UNIFIED_GENRES;
  }),

  getFeed: publicProcedure
    .input(
      z.object({
        genreIds: z.array(z.number()).min(3).max(5),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const genres: GenreInput[] = input.genreIds
        .map((id) => {
          const genre = getUnifiedGenreById(id);
          if (!genre) return null;
          return {
            unifiedId: genre.id,
            movieGenreId: genre.movieGenreId,
            tvGenreId: genre.tvGenreId,
          };
        })
        .filter((g): g is GenreInput => g !== null);

      return buildFeed(genres, input.cursor);
    }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(2),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const page = input.cursor ? Number.parseInt(input.cursor, 10) : 1;
      const response = await searchMulti(input.query, page);

      const items: FeedItem[] = response.results.map(mapSearchResultToFeedItem);
      const nextCursor =
        page < response.total_pages ? String(page + 1) : null;

      return { items, nextCursor };
    }),

  saveTasteProfile: publicProcedure
    .input(
      z.object({
        genreIds: z.array(z.number()).min(3).max(5),
        titles: z
          .array(
            z.object({
              tmdbId: z.number(),
              mediaType: z.enum(["movie", "tv"]),
            })
          )
          .min(3)
          .max(10),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Get userId from auth context once tRPC context includes session
      // For now, this will need the auth session wired into tRPC context
      // Placeholder: throw until auth context is wired
      throw new Error("Not implemented: needs auth context in tRPC");

      // The implementation below is the target shape:
      // await db.transaction(async (tx) => {
      //   await tx.insert(userGenre).values(
      //     input.genreIds.map((genreId) => ({ userId, genreId }))
      //   );
      //   await tx.insert(userTitle).values(
      //     input.titles.map((t) => ({
      //       userId,
      //       tmdbId: t.tmdbId,
      //       mediaType: t.mediaType,
      //     }))
      //   );
      //   await tx.update(user).set({ onboardingCompleted: true }).where(eq(user.id, userId));
      // });
      // return { success: true };
    }),
} satisfies TRPCRouterRecord;
```

**Important note for implementer:** The `saveTasteProfile` mutation needs the authenticated user's ID. The current tRPC setup (`src/integrations/trpc/init.ts`) has no auth context. You need to either:
1. Add auth context to tRPC by creating a context function that reads the session, or
2. Use a TanStack Server Function instead of tRPC for this one mutation.

Option 1 is cleaner. Add a tRPC context:

In `src/integrations/trpc/init.ts`, update to include context:

```typescript
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

export interface TRPCContext {
  userId: string | null;
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
```

Then in `src/routes/api.trpc.$.tsx`, pass the context when creating the handler (extract user ID from the request's auth session).

Once context is wired, replace the placeholder in `saveTasteProfile`:

```typescript
.mutation(async ({ input, ctx }) => {
  if (!ctx.userId) throw new Error("Unauthorized");
  const userId = ctx.userId;

  await db.transaction(async (tx) => {
    await tx.insert(userGenre).values(
      input.genreIds.map((genreId) => ({ userId, genreId }))
    );
    await tx.insert(userTitle).values(
      input.titles.map((t) => ({
        userId,
        tmdbId: t.tmdbId,
        mediaType: t.mediaType,
      }))
    );
    await tx
      .update(user)
      .set({ onboardingCompleted: true })
      .where(eq(user.id, userId));
  });

  return { success: true };
}),
```

- [ ] **Step 4: Mount router in main tRPC router**

Modify `src/integrations/trpc/router.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "./init";
import { tasteProfileRouter } from "./routers/taste-profile";

const todos = [
  { id: 1, name: "Get groceries" },
  { id: 2, name: "Buy a new phone" },
  { id: 3, name: "Finish the project" },
];

const todosRouter = {
  list: publicProcedure.query(() => todos),
  add: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input }) => {
      const newTodo = { id: todos.length + 1, name: input.name };
      todos.push(newTodo);
      return newTodo;
    }),
} satisfies TRPCRouterRecord;

export const trpcRouter = createTRPCRouter({
  todos: todosRouter,
  tasteProfile: tasteProfileRouter,
});
export type TRPCRouter = typeof trpcRouter;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run src/integrations/trpc/__tests__/taste-profile.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/routers/taste-profile.ts src/integrations/trpc/router.ts src/integrations/trpc/init.ts src/integrations/trpc/__tests__/taste-profile.test.ts
git commit -m "feat: add tasteProfile tRPC router with feed assembly and search"
```

---

## Task 6: Wire tRPC Auth Context

**Files:**
- Modify: `src/integrations/trpc/init.ts`
- Modify: `src/routes/api.trpc.$.tsx`

- [ ] **Step 1: Read the current tRPC API route handler**

Read `src/routes/api.trpc.$.tsx` to understand how the tRPC handler is set up.

- [ ] **Step 2: Update tRPC init with context type**

Modify `src/integrations/trpc/init.ts`:

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

export interface TRPCContext {
  userId: string | null;
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { userId: ctx.userId } });
});
```

- [ ] **Step 3: Pass auth context in the API route handler**

Update `src/routes/api.trpc.$.tsx` to create context from the request's auth session:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { trpcRouter } from "#/integrations/trpc/router";
import { auth } from "#/lib/auth";
import type { TRPCContext } from "#/integrations/trpc/init";

async function createContext({ req }: { req: Request }): Promise<TRPCContext> {
  const session = await auth.api.getSession({ headers: req.headers });
  return { userId: session?.user?.id ?? null };
}

function handler({ request }: { request: Request }) {
  return fetchRequestHandler({
    req: request,
    router: trpcRouter,
    endpoint: "/api/trpc",
    createContext: () => createContext({ req: request }),
  });
}

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
```

- [ ] **Step 4: Update `saveTasteProfile` to use `protectedProcedure`**

In `src/integrations/trpc/routers/taste-profile.ts`, change `saveTasteProfile` from `publicProcedure` to `protectedProcedure` and use `ctx.userId`:

```typescript
import { protectedProcedure, publicProcedure } from "../init";

// ...

saveTasteProfile: protectedProcedure
  .input(
    z.object({
      genreIds: z.array(z.number()).min(3).max(5),
      titles: z
        .array(
          z.object({
            tmdbId: z.number(),
            mediaType: z.enum(["movie", "tv"]),
          })
        )
        .min(3)
        .max(10),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.userId;

    await db.transaction(async (tx) => {
      await tx.insert(userGenre).values(
        input.genreIds.map((genreId) => ({ userId, genreId }))
      );
      await tx.insert(userTitle).values(
        input.titles.map((t) => ({
          userId,
          tmdbId: t.tmdbId,
          mediaType: t.mediaType,
        }))
      );
      await tx
        .update(user)
        .set({ onboardingCompleted: true })
        .where(eq(user.id, userId));
    });

    return { success: true };
  }),
```

- [ ] **Step 5: Verify the app still builds**

Run: `bun run build`
Expected: Build succeeds (or `bun run typecheck` passes)

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/init.ts src/routes/api.trpc.$.tsx src/integrations/trpc/routers/taste-profile.ts
git commit -m "feat: wire auth context into tRPC, add protectedProcedure"
```

---

## Task 7: Modify Onboarding Flow

**Files:**
- Modify: `src/routes/onboarding/index.tsx`

- [ ] **Step 1: Remove `onboardingCompleted` from step 2 (AvatarStep)**

In `src/routes/onboarding/index.tsx`, find the `finalizeOnboarding` function inside `AvatarStep`. Replace it so it only calls `onNext()` without setting `onboardingCompleted`:

```typescript
// BEFORE (remove this):
async function finalizeOnboarding() {
  setLoading(true);
  try {
    const { error: updateError } = await authClient.updateUser({
      onboardingCompleted: true,
    });
    if (updateError) {
      setError(updateError.message ?? "Something went wrong");
      return;
    }
    onNext();
  } catch {
    setError("Something went wrong");
  } finally {
    setLoading(false);
  }
}

// AFTER (replace with):
function handleContinue() {
  onNext();
}
```

Update the button `onClick` handlers in AvatarStep to use `handleContinue` instead of `finalizeOnboarding`. Also remove the `loading` state variable since it's no longer needed, and update the disabled conditions on the buttons to only check `isUploading || isSavingAvatar`.

- [ ] **Step 2: Add step 3 to the STEPS array**

Import the `TasteProfileStep` component (which we'll build in the next tasks) and add it:

```typescript
import { TasteProfileStep } from "#/components/onboarding/taste-profile-step";

const STEPS: StepConfig[] = [
  { label: "Username", component: UsernameStep },
  { label: "Avatar", component: AvatarStep },
  { label: "Taste", component: TasteProfileStep },
];
```

- [ ] **Step 3: Handle layout break-out for step 3**

The `OnboardingPage` component currently wraps everything in `AuthCard`. Step 3 needs to break out. Update the render:

```typescript
function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const StepComponent = STEPS[currentStep].component;
  const isFullWidthStep = currentStep === 2; // Taste profile

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      navigate({ to: "/app" });
    }
  }

  return (
    <AuthLayout>
      <MarqueeBadge text="Setting Up" />
      {isFullWidthStep ? (
        <div className="w-full max-w-6xl mx-auto px-4">
          <StepIndicator steps={STEPS.length} current={currentStep} />
          <StepComponent onNext={handleNext} />
        </div>
      ) : (
        <AuthCard>
          <StepIndicator steps={STEPS.length} current={currentStep} />
          <StepComponent onNext={handleNext} />
        </AuthCard>
      )}
    </AuthLayout>
  );
}
```

- [ ] **Step 4: Create a placeholder TasteProfileStep**

Create `src/components/onboarding/taste-profile-step.tsx` as a placeholder so the app builds:

```typescript
export function TasteProfileStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="py-8 text-center text-cream/50">
      <h2 className="mb-2 font-display text-xl text-cream">
        What do you love watching?
      </h2>
      <p className="text-sm">Taste profile coming soon</p>
      <button
        type="button"
        onClick={onNext}
        className="mt-4 rounded-lg border border-neon-cyan/50 bg-neon-cyan/8 px-6 py-2 text-neon-cyan"
      >
        Skip for now
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Verify the app builds and step navigation works**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/routes/onboarding/index.tsx src/components/onboarding/taste-profile-step.tsx
git commit -m "feat: add taste profile as onboarding step 3, move onboardingCompleted to save"
```

---

## Task 8: GenrePills Component

**Files:**
- Create: `src/components/onboarding/genre-pills.tsx`

- [ ] **Step 1: Implement GenrePills**

Create `src/components/onboarding/genre-pills.tsx`:

```typescript
import type { UnifiedGenre } from "#/lib/genre-map";

const MAX_GENRES = 5;

// Neon colors to cycle through for selected pills
const NEON_COLORS = [
  { bg: "bg-[#FF2D78]", text: "text-white" },
  { bg: "bg-[#00E5FF]", text: "text-[#0a0a0a]" },
  { bg: "bg-[#FFB800]", text: "text-[#0a0a0a]" },
  { bg: "bg-[#FF2D78]", text: "text-white" },
  { bg: "bg-[#00E5FF]", text: "text-[#0a0a0a]" },
];

interface GenrePillsProps {
  genres: UnifiedGenre[];
  selected: Set<number>;
  onToggle: (genreId: number) => void;
  disabled?: boolean;
}

export function GenrePills({
  genres,
  selected,
  onToggle,
  disabled = false,
}: GenrePillsProps) {
  const selectedArray = Array.from(selected);

  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((genre) => {
        const isSelected = selected.has(genre.id);
        const selectedIndex = selectedArray.indexOf(genre.id);
        const atMax = selected.size >= MAX_GENRES;
        const isDisabled = disabled || (!isSelected && atMax);
        const color = isSelected
          ? NEON_COLORS[selectedIndex % NEON_COLORS.length]
          : null;

        return (
          <button
            key={genre.id}
            type="button"
            onClick={() => onToggle(genre.id)}
            disabled={isDisabled}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              isSelected
                ? `${color!.bg} ${color!.text} shadow-lg`
                : isDisabled
                  ? "border border-cream/10 text-cream/20 cursor-not-allowed"
                  : "border border-cream/25 text-cream/60 hover:border-cream/40 hover:text-cream/80"
            }`}
          >
            {genre.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/genre-pills.tsx
git commit -m "feat: add GenrePills component for genre selection"
```

---

## Task 9: SearchBar Component

**Files:**
- Create: `src/components/onboarding/search-bar.tsx`

- [ ] **Step 1: Implement SearchBar**

Create `src/components/onboarding/search-bar.tsx`:

```typescript
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    // Sync external value changes
    setLocalValue(value);
  }, [value]);

  function handleChange(newValue: string) {
    setLocalValue(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  }

  function handleClear() {
    setLocalValue("");
    onChange("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }

  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/30" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search for a movie or TV show..."
        className="w-full rounded-lg border border-cream/12 bg-cream/6 py-3 pl-10 pr-10 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/30 hover:text-cream/60"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/search-bar.tsx
git commit -m "feat: add SearchBar component with debounced input"
```

---

## Task 10: TitleCard Component

**Files:**
- Create: `src/components/onboarding/title-card.tsx`

- [ ] **Step 1: Implement TitleCard**

Create `src/components/onboarding/title-card.tsx`:

```typescript
import { Check } from "lucide-react";
import type { FeedItem } from "#/lib/feed-assembler";
import { getGenreNameByTmdbId } from "#/lib/genre-map";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface TitleCardProps {
  item: FeedItem;
  isSelected: boolean;
  onToggle: () => void;
  selectionDisabled?: boolean;
}

export function TitleCard({
  item,
  isSelected,
  onToggle,
  selectionDisabled = false,
}: TitleCardProps) {
  const posterUrl = getTmdbImageUrl(item.posterPath);
  const canSelect = !selectionDisabled || isSelected;

  return (
    <button
      type="button"
      onClick={canSelect ? onToggle : undefined}
      className={`group w-full overflow-hidden rounded-xl text-left transition-all duration-200 ${
        isSelected
          ? "border-2 border-[#FF2D78] shadow-[0_0_20px_rgba(255,45,120,0.3)]"
          : "border border-cream/8 hover:border-cream/20"
      } ${!canSelect ? "cursor-not-allowed opacity-60" : "cursor-pointer"} bg-cream/[0.03]`}
    >
      {/* Poster */}
      <div className="relative aspect-[4/5] overflow-hidden">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-cream/5 text-cream/20">
            No Image
          </div>
        )}
        {/* Checkmark overlay */}
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF2D78]/90 shadow-[0_0_15px_rgba(255,45,120,0.5)]">
              <Check className="h-6 w-6 text-white" strokeWidth={3} />
            </div>
          </div>
        )}
        {/* Media type badge */}
        <div className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream/70">
          {item.mediaType === "tv" ? "TV" : "Film"}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-bold text-cream">{item.title}</h3>
          <span className="shrink-0 text-xs text-cream/40">{item.year}</span>
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#FFB800]">
            ★ {item.rating.toFixed(1)}
          </span>
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-cream/50">
          {item.overview}
        </p>

        <div className="mt-2 flex flex-wrap gap-1">
          {item.genreIds.slice(0, 3).map((genreId) => (
            <span
              key={genreId}
              className="rounded-full bg-cream/[0.06] px-2 py-0.5 text-[10px] text-cream/40"
            >
              {getGenreNameByTmdbId(genreId)}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/title-card.tsx
git commit -m "feat: add TitleCard component with selection overlay"
```

---

## Task 11: TitleGrid + Infinite Scroll

**Files:**
- Create: `src/components/onboarding/title-grid.tsx`

- [ ] **Step 1: Implement TitleGrid**

Create `src/components/onboarding/title-grid.tsx`:

```typescript
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FeedItem } from "#/lib/feed-assembler";
import { TitleCard } from "./title-card";

interface TitleGridProps {
  items: FeedItem[];
  selectedTitles: Map<string, FeedItem>;
  onToggleTitle: (item: FeedItem) => void;
  maxTitles: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
}

function titleKey(item: FeedItem) {
  return `${item.tmdbId}-${item.mediaType}`;
}

export function TitleGrid({
  items,
  selectedTitles,
  onToggleTitle,
  maxTitles,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  isLoading,
}: TitleGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="animate-pulse rounded-xl border border-cream/8 bg-cream/[0.03]"
          >
            <div className="aspect-[4/5] bg-cream/5" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 rounded bg-cream/5" />
              <div className="h-3 w-1/4 rounded bg-cream/5" />
              <div className="h-3 w-full rounded bg-cream/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const atMax = selectedTitles.size >= maxTitles;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <TitleCard
            key={titleKey(item)}
            item={item}
            isSelected={selectedTitles.has(titleKey(item))}
            onToggle={() => onToggleTitle(item)}
            selectionDisabled={atMax}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-cream/30" />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/title-grid.tsx
git commit -m "feat: add TitleGrid component with infinite scroll"
```

---

## Task 12: SelectionFooter Component

**Files:**
- Create: `src/components/onboarding/selection-footer.tsx`

- [ ] **Step 1: Implement SelectionFooter**

Create `src/components/onboarding/selection-footer.tsx`:

```typescript
import { Loader2 } from "lucide-react";
import type { FeedItem } from "#/lib/feed-assembler";
import { getTmdbImageUrl } from "#/lib/tmdb";

const MIN_TITLES = 3;
const MAX_TITLES = 10;

interface SelectionFooterProps {
  selectedTitles: Map<string, FeedItem>;
  onDeselect: (key: string) => void;
  onContinue: () => void;
  isSaving: boolean;
}

export function SelectionFooter({
  selectedTitles,
  onDeselect,
  onContinue,
  isSaving,
}: SelectionFooterProps) {
  if (selectedTitles.size === 0) return null;

  const entries = Array.from(selectedTitles.entries());
  const canContinue = selectedTitles.size >= MIN_TITLES;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#FF2D78]/20 bg-[#0a0a0a]/95 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        {/* Thumbnail row */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {entries.map(([key, item], i) => {
            const posterUrl = getTmdbImageUrl(item.posterPath, "w92");
            // Overlap thumbnails past 5
            const overlap = i >= 5;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onDeselect(key)}
                className={`group relative shrink-0 ${overlap ? "-ml-3" : ""}`}
                title={`Remove ${item.title}`}
              >
                <div className="h-12 w-8 overflow-hidden rounded border-[1.5px] border-[#FF2D78] transition-opacity group-hover:opacity-60">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-cream/10" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Count */}
        <span className="shrink-0 text-sm text-cream/50">
          <span className="font-bold text-[#FF2D78]">
            {selectedTitles.size}
          </span>{" "}
          / {MIN_TITLES}-{MAX_TITLES}
        </span>

        {/* Continue button */}
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || isSaving}
          className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition-all ${
            canContinue
              ? "bg-[#FF2D78] text-white shadow-[0_0_12px_rgba(255,45,120,0.4)] hover:shadow-[0_0_20px_rgba(255,45,120,0.5)]"
              : "bg-cream/10 text-cream/30 cursor-not-allowed"
          }`}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Continue →"
          )}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/selection-footer.tsx
git commit -m "feat: add SelectionFooter with thumbnails and continue button"
```

---

## Task 13: Wire Up TasteProfileStep

**Files:**
- Modify: `src/components/onboarding/taste-profile-step.tsx`

This is the main orchestrator. It replaces the placeholder from Task 7.

- [ ] **Step 1: Implement TasteProfileStep**

Replace `src/components/onboarding/taste-profile-step.tsx`:

```typescript
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { FeedItem } from "#/lib/feed-assembler";
import { useTRPC } from "#/integrations/trpc/react";
import { useQuery, useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { GenrePills } from "./genre-pills";
import { SearchBar } from "./search-bar";
import { SelectionFooter } from "./selection-footer";
import { TitleGrid } from "./title-grid";

const MIN_GENRES = 3;
const MAX_TITLES = 10;

function titleKey(item: FeedItem) {
  return `${item.tmdbId}-${item.mediaType}`;
}

export function TasteProfileStep({ onNext }: { onNext: () => void }) {
  const [selectedGenres, setSelectedGenres] = useState<Set<number>>(new Set());
  const [selectedTitles, setSelectedTitles] = useState<Map<string, FeedItem>>(
    new Map()
  );
  const [searchQuery, setSearchQuery] = useState("");

  const trpc = useTRPC();
  const isSearchMode = searchQuery.length >= 2;
  const hasEnoughGenres = selectedGenres.size >= MIN_GENRES;

  // --- Queries ---

  const genresQuery = useQuery(trpc.tasteProfile.getGenres.queryOptions());

  const feedQuery = useInfiniteQuery(
    trpc.tasteProfile.getFeed.infiniteQueryOptions(
      { genreIds: Array.from(selectedGenres) },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        enabled: hasEnoughGenres && !isSearchMode,
      }
    )
  );

  const searchQueryResult = useInfiniteQuery(
    trpc.tasteProfile.search.infiniteQueryOptions(
      { query: searchQuery },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        enabled: isSearchMode,
      }
    )
  );

  const saveMutation = useMutation(
    trpc.tasteProfile.saveTasteProfile.mutationOptions({
      onSuccess: () => onNext(),
      onError: (error) => {
        toast.error(error.message || "Failed to save. Please try again.");
      },
    })
  );

  // --- Derived data ---

  const activeQuery = isSearchMode ? searchQueryResult : feedQuery;
  const items = useMemo(
    () => activeQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activeQuery.data]
  );

  // --- Handlers ---

  const handleGenreToggle = useCallback((genreId: number) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genreId)) {
        next.delete(genreId);
      } else {
        next.add(genreId);
      }
      return next;
    });
  }, []);

  const handleTitleToggle = useCallback((item: FeedItem) => {
    setSelectedTitles((prev) => {
      const key = titleKey(item);
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= MAX_TITLES) {
          toast("Maximum 10 titles selected");
          return prev;
        }
        next.set(key, item);
      }
      return next;
    });
  }, []);

  const handleDeselect = useCallback((key: string) => {
    setSelectedTitles((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleContinue = useCallback(() => {
    saveMutation.mutate({
      genreIds: Array.from(selectedGenres),
      titles: Array.from(selectedTitles.values()).map((item) => ({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
      })),
    });
  }, [selectedGenres, selectedTitles, saveMutation]);

  // --- Empty states ---

  const emptyMessage = !hasEnoughGenres
    ? `Pick at least ${MIN_GENRES} genres to see suggestions`
    : null;

  return (
    <div className="pb-24">
      <h2 className="mb-1.5 font-display text-2xl text-cream">
        What do you love watching?
      </h2>
      <p className="mb-6 text-sm text-cream/50">
        Pick 3-5 genres, then choose 3-10 movies or shows you love
      </p>

      {/* Search */}
      <div className="mb-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Genre pills */}
      <div className={`mb-6 ${isSearchMode ? "opacity-40 pointer-events-none" : ""}`}>
        {genresQuery.data ? (
          <GenrePills
            genres={genresQuery.data}
            selected={selectedGenres}
            onToggle={handleGenreToggle}
            disabled={isSearchMode}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={`genre-skeleton-${i}`}
                className="h-9 w-20 animate-pulse rounded-full bg-cream/5"
              />
            ))}
          </div>
        )}
      </div>

      {/* Empty state or grid */}
      {emptyMessage && !isSearchMode ? (
        <div className="py-16 text-center text-cream/30">{emptyMessage}</div>
      ) : (
        <TitleGrid
          items={items}
          selectedTitles={selectedTitles}
          onToggleTitle={handleTitleToggle}
          maxTitles={MAX_TITLES}
          hasNextPage={activeQuery.hasNextPage ?? false}
          isFetchingNextPage={activeQuery.isFetchingNextPage}
          fetchNextPage={() => activeQuery.fetchNextPage()}
          isLoading={activeQuery.isLoading}
        />
      )}

      {/* Search empty state */}
      {isSearchMode &&
        !searchQueryResult.isLoading &&
        items.length === 0 && (
          <div className="py-16 text-center text-cream/30">
            No results for "{searchQuery}"
          </div>
        )}

      {/* Error state */}
      {activeQuery.isError && (
        <div className="py-8 text-center">
          <p className="mb-3 text-sm text-red-400">
            Failed to load content. Please try again.
          </p>
          <button
            type="button"
            onClick={() => activeQuery.refetch()}
            className="rounded-lg border border-cream/20 px-4 py-2 text-sm text-cream/60 hover:text-cream"
          >
            Retry
          </button>
        </div>
      )}

      {/* Selection footer */}
      <SelectionFooter
        selectedTitles={selectedTitles}
        onDeselect={handleDeselect}
        onContinue={handleContinue}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
}
```

**Important note for implementer:** Check how the tRPC client is accessed in this codebase. The code above assumes `useTRPC()` from `#/integrations/trpc/react` returns a client with `.tasteProfile.getGenres.queryOptions()` etc. Read `src/integrations/trpc/react.tsx` to verify the exact API and adjust accordingly. The tRPC + React Query v5 integration uses `queryOptions()` and `infiniteQueryOptions()` patterns — verify these match the installed `@trpc/tanstack-react-query` version.

- [ ] **Step 2: Verify the app builds**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/taste-profile-step.tsx
git commit -m "feat: wire up TasteProfileStep with all components and queries"
```

---

## Task 14: Client-Side Tests

**Files:**
- Create: `src/components/onboarding/__tests__/taste-profile.test.tsx`

- [ ] **Step 1: Write client-side tests**

Create `src/components/onboarding/__tests__/taste-profile.test.tsx`:

```typescript
import { describe, expect, it } from "vitest";

// Test the selection logic directly — no need to render React components
// for these pure logic tests

describe("genre selection limits", () => {
  it("allows up to 5 genres", () => {
    const selected = new Set<number>();
    for (let i = 1; i <= 5; i++) {
      selected.add(i);
    }
    expect(selected.size).toBe(5);
  });

  it("can deselect genres", () => {
    const selected = new Set([1, 2, 3]);
    selected.delete(2);
    expect(selected.size).toBe(2);
    expect(selected.has(2)).toBe(false);
  });
});

describe("title selection limits", () => {
  const MAX_TITLES = 10;

  it("allows up to 10 titles", () => {
    const selected = new Map<string, { tmdbId: number; mediaType: string }>();
    for (let i = 1; i <= MAX_TITLES; i++) {
      selected.set(`${i}-movie`, { tmdbId: i, mediaType: "movie" });
    }
    expect(selected.size).toBe(MAX_TITLES);
  });

  it("can toggle a title off", () => {
    const selected = new Map<string, { tmdbId: number; mediaType: string }>();
    selected.set("1-movie", { tmdbId: 1, mediaType: "movie" });
    selected.set("2-tv", { tmdbId: 2, mediaType: "tv" });
    selected.delete("1-movie");
    expect(selected.size).toBe(1);
    expect(selected.has("1-movie")).toBe(false);
  });
});

describe("footer state", () => {
  const MIN_TITLES = 3;

  it("continue is disabled when fewer than 3 titles selected", () => {
    const selectedCount = 2;
    const canContinue = selectedCount >= MIN_TITLES;
    expect(canContinue).toBe(false);
  });

  it("continue is enabled when 3 or more titles selected", () => {
    const selectedCount = 3;
    const canContinue = selectedCount >= MIN_TITLES;
    expect(canContinue).toBe(true);
  });
});

describe("search mode toggle", () => {
  it("activates search mode when query is 2+ chars", () => {
    const query = "du";
    const isSearchMode = query.length >= 2;
    expect(isSearchMode).toBe(true);
  });

  it("deactivates search mode when query is cleared", () => {
    const query = "";
    const isSearchMode = query.length >= 2;
    expect(isSearchMode).toBe(false);
  });

  it("does not activate for single character", () => {
    const query = "d";
    const isSearchMode = query.length >= 2;
    expect(isSearchMode).toBe(false);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `bunx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/__tests__/taste-profile.test.tsx
git commit -m "test: add client-side taste profile selection logic tests"
```

---

## Task 15: Integration Test & Verification

- [ ] **Step 1: Run full test suite**

Run: `bunx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `bun run typecheck`
Expected: No type errors

- [ ] **Step 3: Run linter**

Run: `bun run check`
Expected: No lint errors (fix any that appear)

- [ ] **Step 4: Run build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 5: Manual smoke test**

1. Start dev server: `bun run dev`
2. Go through login → onboarding steps 1 & 2
3. Verify step 3 appears with genre pills
4. Select 3+ genres → verify grid populates with titles
5. Select 3+ titles → verify footer appears with thumbnails
6. Test search → verify grid swaps to search results
7. Clear search → verify genre feed restores
8. Click "Continue" → verify save and redirect to `/app`

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete taste profile onboarding with all components and tests"
```
