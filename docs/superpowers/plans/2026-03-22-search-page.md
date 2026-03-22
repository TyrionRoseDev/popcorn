# Search Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a search-first movie & TV discovery page at `/app/search` with sidebar filters, sorting, pagination, and a categorized landing state.

**Architecture:** Single route with conditional render — empty query shows landing (trending/top rated/new releases rows), query present shows sidebar filters + paginated poster grid. URL search params drive all state via TanStack Router's `validateSearch`. tRPC search router handles TMDB API calls with server-side filtering.

**Tech Stack:** TanStack Router (search params), tRPC (data layer), TMDB API (content), shadcn Pagination + Sheet (UI), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-22-search-page-design.md`

---

## File Structure

```
src/
├── lib/
│   ├── tmdb.ts                          # Modify: add discoverWithParams, searchMovies, searchTv
│   └── search-filters.ts               # Create: server-side filter/sort logic for search results
├── integrations/trpc/
│   ├── router.ts                        # Modify: register search router
│   └── routers/
│       └── search.ts                    # Create: search tRPC router (results, trending, topRated, newReleases)
├── components/search/
│   ├── search-bar.tsx                   # Create: search bar with URL navigation
│   ├── search-landing.tsx               # Create: landing state with 3 content rows
│   ├── search-results.tsx               # Create: results layout (sidebar + grid + pagination)
│   ├── filter-sidebar.tsx               # Create: filter controls (desktop sidebar + mobile sheet)
│   ├── poster-card.tsx                  # Create: simplified card for search (no selection state)
│   ├── poster-grid.tsx                  # Create: responsive grid wrapper
│   └── search-pagination.tsx            # Create: pagination wrapper using shadcn
├── routes/app/
│   └── search.tsx                       # Create: route with validateSearch
└── integrations/trpc/__tests__/
    └── search.test.ts                   # Create: search router tests
src/lib/__tests__/
    └── search-filters.test.ts           # Create: filter/sort logic tests
```

---

## Task 1: Add parameterized TMDB discover and search functions

**Files:**
- Modify: `src/lib/tmdb.ts`
- Test: `src/lib/__tests__/tmdb.test.ts`

The existing `discoverMovies`/`discoverTv` hardcode `QUALITY_FILTERS` (popularity sort, vote_count >= 200). We need parameterized versions for top-rated and new-releases landing sections, plus standalone search functions for type-filtered search.

Note: The new `searchMovies`/`searchTvShows` functions replace the combined `searchMulti` for the search page. `searchMulti` remains for backward compatibility with the existing `tasteProfileRouter.search` procedure — a future cleanup can migrate it.

- [ ] **Step 1: Write failing tests for new TMDB functions**

Add to `src/lib/__tests__/tmdb.test.ts`:

```ts
describe("discoverMoviesWithParams", () => {
  it("passes custom params to TMDB discover endpoint", async () => {
    const result = await discoverMoviesWithParams(1, {
      sort_by: "vote_average.desc",
      "vote_count.gte": "500",
    });
    expect(result.results).toBeDefined();
  });
});

describe("discoverTvWithParams", () => {
  it("passes custom params to TMDB discover endpoint", async () => {
    const result = await discoverTvWithParams(1, {
      sort_by: "vote_average.desc",
      "vote_count.gte": "500",
    });
    expect(result.results).toBeDefined();
  });
});

describe("searchMovies", () => {
  it("calls /search/movie with query and page", async () => {
    const result = await searchMovies("batman", 1);
    expect(result.results).toBeDefined();
    expect(result.total_pages).toBeDefined();
  });
});

describe("searchTvShows", () => {
  it("calls /search/tv with query and page", async () => {
    const result = await searchTvShows("batman", 1);
    expect(result.results).toBeDefined();
    expect(result.total_pages).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/__tests__/tmdb.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement the new TMDB functions**

Add to `src/lib/tmdb.ts`:

```ts
export async function discoverMoviesWithParams(
  page: number,
  params: Record<string, string> = {},
) {
  return tmdbFetch<TmdbPagedResponse<TmdbMovieResult>>("/discover/movie", {
    page: String(page),
    include_adult: "false",
    ...params,
  });
}

export async function discoverTvWithParams(
  page: number,
  params: Record<string, string> = {},
) {
  return tmdbFetch<TmdbPagedResponse<TmdbTvResult>>("/discover/tv", {
    page: String(page),
    include_adult: "false",
    ...params,
  });
}

export async function searchMovies(query: string, page: number) {
  return tmdbFetch<TmdbPagedResponse<TmdbMovieResult>>("/search/movie", {
    query,
    page: String(page),
    include_adult: "false",
  });
}

export async function searchTvShows(query: string, page: number) {
  return tmdbFetch<TmdbPagedResponse<TmdbTvResult>>("/search/tv", {
    query,
    page: String(page),
    include_adult: "false",
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/__tests__/tmdb.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tmdb.ts src/lib/__tests__/tmdb.test.ts
git commit -m "feat: add parameterized TMDB discover and search functions"
```

---

## Task 2: Create search filter/sort utilities

**Files:**
- Create: `src/lib/search-filters.ts`
- Create: `src/lib/__tests__/search-filters.test.ts`

Pure functions that filter and sort `FeedItem[]` server-side. Used by the search tRPC router when `q` is present (TMDB search doesn't support these natively).

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/search-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FeedItem } from "#/lib/feed-assembler";
import { filterResults, sortResults } from "#/lib/search-filters";

const mockItems: FeedItem[] = [
  {
    tmdbId: 1, mediaType: "movie", title: "Batman Begins",
    posterPath: "/a.jpg", overview: "Origin story", year: "2005",
    rating: 8.2, genreIds: [28, 80], isTrending: false,
  },
  {
    tmdbId: 2, mediaType: "tv", title: "Batman: Caped Crusader",
    posterPath: "/b.jpg", overview: "Animated series", year: "2024",
    rating: 8.1, genreIds: [16, 28], isTrending: false,
  },
  {
    tmdbId: 3, mediaType: "movie", title: "The Dark Knight",
    posterPath: "/c.jpg", overview: "Joker chaos", year: "2008",
    rating: 9.0, genreIds: [28, 18], isTrending: false,
  },
];

describe("filterResults", () => {
  it("filters by media type 'movie'", () => {
    const result = filterResults(mockItems, { type: "movie" });
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.mediaType === "movie")).toBe(true);
  });

  it("filters by media type 'tv'", () => {
    const result = filterResults(mockItems, { type: "tv" });
    expect(result).toHaveLength(1);
    expect(result[0].tmdbId).toBe(2);
  });

  it("returns all when type is 'all'", () => {
    const result = filterResults(mockItems, { type: "all" });
    expect(result).toHaveLength(3);
  });

  it("filters by genre (unified genre ID mapped to TMDB IDs)", () => {
    // Unified genre 5 = Crime, movieGenreId = 80
    const result = filterResults(mockItems, { type: "all", genre: 5 });
    expect(result).toHaveLength(1);
    expect(result[0].tmdbId).toBe(1);
  });

  it("filters by year range", () => {
    const result = filterResults(mockItems, { type: "all", yearMin: 2008 });
    expect(result).toHaveLength(2);
  });

  it("filters by minimum rating", () => {
    const result = filterResults(mockItems, { type: "all", rating: 8.5 });
    expect(result).toHaveLength(1);
    expect(result[0].tmdbId).toBe(3);
  });

  it("combines multiple filters", () => {
    const result = filterResults(mockItems, {
      type: "movie", yearMin: 2006, rating: 8.5,
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("The Dark Knight");
  });
});

describe("sortResults", () => {
  it("sorts by rating descending", () => {
    const result = sortResults(mockItems, "rating");
    expect(result[0].tmdbId).toBe(3); // 9.0
    expect(result[2].tmdbId).toBe(2); // 8.1
  });

  it("sorts by newest first", () => {
    const result = sortResults(mockItems, "newest");
    expect(result[0].year).toBe("2024");
    expect(result[2].year).toBe("2005");
  });

  it("sorts by oldest first", () => {
    const result = sortResults(mockItems, "oldest");
    expect(result[0].year).toBe("2005");
    expect(result[2].year).toBe("2024");
  });

  it("returns original order for 'relevance'", () => {
    const result = sortResults(mockItems, "relevance");
    expect(result[0].tmdbId).toBe(1);
    expect(result[2].tmdbId).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/__tests__/search-filters.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement filter/sort utilities**

Create `src/lib/search-filters.ts`:

```ts
import type { FeedItem } from "#/lib/feed-assembler";
import { getMovieGenreId, getTvGenreId } from "#/lib/genre-map";

interface FilterOptions {
  type?: "all" | "movie" | "tv";
  genre?: number;       // unified genre ID
  yearMin?: number;
  yearMax?: number;
  rating?: number;       // minimum rating
}

export function filterResults(
  items: FeedItem[],
  options: FilterOptions,
): FeedItem[] {
  return items.filter((item) => {
    if (options.type && options.type !== "all" && item.mediaType !== options.type) {
      return false;
    }

    if (options.genre !== undefined) {
      const movieGenreId = getMovieGenreId(options.genre);
      const tvGenreId = getTvGenreId(options.genre);
      const matchesGenre = item.genreIds.some(
        (gid) => gid === movieGenreId || gid === tvGenreId,
      );
      if (!matchesGenre) return false;
    }

    const year = item.year ? Number.parseInt(item.year, 10) : null;
    if (options.yearMin !== undefined && (year === null || year < options.yearMin)) {
      return false;
    }
    if (options.yearMax !== undefined && (year === null || year > options.yearMax)) {
      return false;
    }

    if (options.rating !== undefined && item.rating < options.rating) {
      return false;
    }

    return true;
  });
}

type SortOption = "relevance" | "popularity" | "rating" | "newest" | "oldest";

export function sortResults(
  items: FeedItem[],
  sort: SortOption,
): FeedItem[] {
  const sorted = [...items];
  switch (sort) {
    case "rating":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "newest":
      return sorted.sort((a, b) => (b.year || "").localeCompare(a.year || ""));
    case "oldest":
      return sorted.sort((a, b) => (a.year || "").localeCompare(b.year || ""));
    case "popularity":
    case "relevance":
    default:
      return sorted; // TMDB already returns by relevance/popularity
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/__tests__/search-filters.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/search-filters.ts src/lib/__tests__/search-filters.test.ts
git commit -m "feat: add search filter and sort utilities"
```

---

## Task 3: Create search tRPC router

**Files:**
- Create: `src/integrations/trpc/routers/search.ts`
- Modify: `src/integrations/trpc/router.ts` (register the new router)
- Create: `src/integrations/trpc/__tests__/search.test.ts`

Four procedures: `results`, `trending`, `topRated`, `newReleases`. Uses existing `FeedItem` type and mapper functions from `taste-profile.ts`.

**API call budget:** When `type` is `"all"`, fetch 2 pages per endpoint (4 calls total, ~80 raw results). When `type` is `"movie"` or `"tv"`, fetch 3 pages from that endpoint only (3 calls, ~60 raw results). This balances result quality with TMDB rate limits.

- [ ] **Step 1: Write failing tests for the search router**

Create `src/integrations/trpc/__tests__/search.test.ts`. Follow the existing test pattern from `taste-profile.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "#/lib/feed-assembler";
import type { TmdbMovieResult, TmdbTvResult } from "#/lib/tmdb";

vi.mock("#/env", () => ({
  env: { TMDB_READ_ACCESS_TOKEN: "test-api-key" },
}));

vi.mock("#/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#/lib/tmdb")>();
  return {
    ...actual,
    searchMovies: vi.fn(),
    searchTvShows: vi.fn(),
    fetchTrending: vi.fn(),
    discoverMoviesWithParams: vi.fn(),
    discoverTvWithParams: vi.fn(),
  };
});

import {
  searchMovies,
  searchTvShows,
  fetchTrending,
  discoverMoviesWithParams,
  discoverTvWithParams,
} from "#/lib/tmdb";
import { fetchSearchResults, fetchTrendingLanding, fetchTopRated, fetchNewReleases } from "../routers/search";

const mockSearchMovies = vi.mocked(searchMovies);
const mockSearchTvShows = vi.mocked(searchTvShows);
const mockFetchTrending = vi.mocked(fetchTrending);
const mockDiscoverMoviesWithParams = vi.mocked(discoverMoviesWithParams);
const mockDiscoverTvWithParams = vi.mocked(discoverTvWithParams);

beforeEach(() => {
  vi.clearAllMocks();
});

const movieResult: TmdbMovieResult = {
  id: 1, title: "Batman Begins", poster_path: "/a.jpg",
  overview: "Origin", release_date: "2005-06-15",
  vote_average: 8.2, genre_ids: [28, 80],
};

const tvResult: TmdbTvResult = {
  id: 2, name: "Batman: TAS", poster_path: "/b.jpg",
  overview: "Animated", first_air_date: "1992-09-05",
  vote_average: 9.0, genre_ids: [16, 10759],
};

describe("fetchSearchResults", () => {
  it("searches both movies and TV when type is 'all'", async () => {
    mockSearchMovies.mockResolvedValue({
      results: [movieResult], page: 1, total_pages: 3, total_results: 50,
    });
    mockSearchTvShows.mockResolvedValue({
      results: [tvResult], page: 1, total_pages: 2, total_results: 30,
    });

    const result = await fetchSearchResults({
      q: "batman", type: "all", page: 1, sort: "relevance",
    });

    expect(mockSearchMovies).toHaveBeenCalled();
    expect(mockSearchTvShows).toHaveBeenCalled();
    expect(result.results).toHaveLength(2);
    expect(result.totalResults).toBeGreaterThan(0);
  });

  it("searches only movies when type is 'movie'", async () => {
    mockSearchMovies.mockResolvedValue({
      results: [movieResult], page: 1, total_pages: 1, total_results: 1,
    });

    const result = await fetchSearchResults({
      q: "batman", type: "movie", page: 1, sort: "relevance",
    });

    expect(mockSearchMovies).toHaveBeenCalled();
    expect(mockSearchTvShows).not.toHaveBeenCalled();
    expect(result.results.every((r) => r.mediaType === "movie")).toBe(true);
  });

  it("applies genre filter server-side", async () => {
    mockSearchMovies.mockResolvedValue({
      results: [movieResult], page: 1, total_pages: 1, total_results: 1,
    });
    mockSearchTvShows.mockResolvedValue({
      results: [tvResult], page: 1, total_pages: 1, total_results: 1,
    });

    // Filter by genre 3 = Animation (TMDB ID 16)
    const result = await fetchSearchResults({
      q: "batman", type: "all", page: 1, sort: "relevance", genre: 3,
    });

    // Only TV result has genre 16 (Animation)
    expect(result.results).toHaveLength(1);
    expect(result.results[0].tmdbId).toBe(2);
  });
});

describe("fetchTrendingLanding", () => {
  it("returns 6 trending items", async () => {
    const trendingResults = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1, media_type: "movie" as const, title: `Movie ${i}`,
      poster_path: `/${i}.jpg`, overview: `Overview ${i}`,
      release_date: "2026-01-01", vote_average: 7.0, genre_ids: [28],
    }));

    mockFetchTrending.mockResolvedValue({
      results: trendingResults, page: 1, total_pages: 10, total_results: 200,
    });

    const result = await fetchTrendingLanding();
    expect(result).toHaveLength(6);
  });
});

describe("fetchTopRated", () => {
  it("returns items sorted by rating", async () => {
    mockDiscoverMoviesWithParams.mockResolvedValue({
      results: [{ ...movieResult, vote_average: 9.3 }],
      page: 1, total_pages: 1, total_results: 1,
    });
    mockDiscoverTvWithParams.mockResolvedValue({
      results: [{ ...tvResult, vote_average: 9.5 }],
      page: 1, total_pages: 1, total_results: 1,
    });

    const result = await fetchTopRated();
    expect(result.length).toBeLessThanOrEqual(6);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].rating).toBeGreaterThanOrEqual(result[i].rating);
    }
  });
});

describe("fetchNewReleases", () => {
  it("returns recent items", async () => {
    mockDiscoverMoviesWithParams.mockResolvedValue({
      results: [movieResult], page: 1, total_pages: 1, total_results: 1,
    });
    mockDiscoverTvWithParams.mockResolvedValue({
      results: [tvResult], page: 1, total_pages: 1, total_results: 1,
    });

    const result = await fetchNewReleases();
    expect(result.length).toBeLessThanOrEqual(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/integrations/trpc/__tests__/search.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the search router**

Create `src/integrations/trpc/routers/search.ts`:

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "#/integrations/trpc/init";
import { deduplicateFeed, type FeedItem } from "#/lib/feed-assembler";
import { filterResults, sortResults } from "#/lib/search-filters";
import {
  discoverMoviesWithParams,
  discoverTvWithParams,
  fetchTrending,
  searchMovies,
  searchTvShows,
} from "#/lib/tmdb";
import {
  mapMovieToFeedItem,
  mapSearchResultToFeedItem,
  mapTvToFeedItem,
} from "./taste-profile";

const PAGE_SIZE = 20;

const searchParamsSchema = z.object({
  q: z.string(),
  type: z.enum(["all", "movie", "tv"]).default("all"),
  genre: z.number().optional(),
  yearMin: z.number().optional(),
  yearMax: z.number().optional(),
  rating: z.number().optional(),
  sort: z.enum(["relevance", "popularity", "rating", "newest", "oldest"]).default("relevance"),
  page: z.number().default(1),
});

type SearchParams = z.infer<typeof searchParamsSchema>;

export async function fetchSearchResults(params: SearchParams) {
  const { q, type, genre, yearMin, yearMax, rating, sort, page } = params;

  // Determine how many pages to fetch per endpoint.
  // "all" = 2 pages each (4 calls), single type = 3 pages (3 calls).
  const pagesPerEndpoint = type === "all" ? 2 : 3;
  const pageNumbers = Array.from({ length: pagesPerEndpoint }, (_, i) => i + 1);

  let allItems: FeedItem[] = [];

  if (type === "all" || type === "movie") {
    const moviePages = await Promise.all(
      pageNumbers.map((p) => searchMovies(q, p).catch(() => null)),
    );
    for (const res of moviePages) {
      if (res) {
        allItems.push(...res.results.map((r) => mapMovieToFeedItem(r)));
      }
    }
  }

  if (type === "all" || type === "tv") {
    const tvPages = await Promise.all(
      pageNumbers.map((p) => searchTvShows(q, p).catch(() => null)),
    );
    for (const res of tvPages) {
      if (res) {
        allItems.push(...res.results.map((r) => mapTvToFeedItem(r)));
      }
    }
  }

  allItems = deduplicateFeed(allItems);

  // Apply server-side filters (genre, year, rating).
  // Type is already handled at fetch level — pass "all" to avoid double-filtering.
  const filtered = filterResults(allItems, { type: "all", genre, yearMin, yearMax, rating });

  const sorted = sortResults(filtered, sort);

  // Paginate
  const totalResults = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const results = sorted.slice(start, start + PAGE_SIZE);

  return { results, totalPages, totalResults };
}

export async function fetchTrendingLanding(): Promise<FeedItem[]> {
  const res = await fetchTrending(1);
  const items = res.results
    .filter((t) => t.media_type !== "person")
    .map((t) =>
      mapSearchResultToFeedItem({ ...t, media_type: t.media_type as "movie" | "tv" }),
    );
  return items.slice(0, 6);
}

export async function fetchTopRated(): Promise<FeedItem[]> {
  const [movies, tv] = await Promise.all([
    discoverMoviesWithParams(1, {
      sort_by: "vote_average.desc",
      "vote_count.gte": "500",
    }),
    discoverTvWithParams(1, {
      sort_by: "vote_average.desc",
      "vote_count.gte": "500",
    }),
  ]);

  const items: FeedItem[] = [
    ...movies.results.map((m) => mapMovieToFeedItem(m)),
    ...tv.results.map((s) => mapTvToFeedItem(s)),
  ];

  return items.sort((a, b) => b.rating - a.rating).slice(0, 6);
}

export async function fetchNewReleases(): Promise<FeedItem[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const [movies, tv] = await Promise.all([
    discoverMoviesWithParams(1, {
      sort_by: "popularity.desc",
      "primary_release_date.gte": dateStr,
    }),
    discoverTvWithParams(1, {
      sort_by: "popularity.desc",
      "first_air_date.gte": dateStr,
    }),
  ]);

  const items: FeedItem[] = [
    ...movies.results.map((m) => mapMovieToFeedItem(m)),
    ...tv.results.map((s) => mapTvToFeedItem(s)),
  ];

  return items.sort((a, b) => b.rating - a.rating).slice(0, 6);
}

export const searchRouter = {
  results: publicProcedure
    .input(searchParamsSchema)
    .query(async ({ input }) => fetchSearchResults(input)),

  trending: publicProcedure
    .query(async () => ({ results: await fetchTrendingLanding() })),

  topRated: publicProcedure
    .query(async () => ({ results: await fetchTopRated() })),

  newReleases: publicProcedure
    .query(async () => ({ results: await fetchNewReleases() })),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 4: Register the search router**

In `src/integrations/trpc/router.ts`, add:

```ts
import { searchRouter } from "./routers/search";

// In the createTRPCRouter call:
export const trpcRouter = createTRPCRouter({
  todos: todosRouter,
  tasteProfile: tasteProfileRouter,
  search: searchRouter,
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/integrations/trpc/__tests__/search.test.ts`
Expected: PASS

- [ ] **Step 6: Run all tests to check for regressions**

Run: `bun test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/integrations/trpc/routers/search.ts src/integrations/trpc/router.ts src/integrations/trpc/__tests__/search.test.ts
git commit -m "feat: add search tRPC router with results, trending, topRated, newReleases"
```

---

## Task 4: Create the search route with validated search params

**Files:**
- Create: `src/routes/app/search.tsx`

This is the TanStack Router route file. Defines the search params schema and renders a placeholder.

- [ ] **Step 1: Create the route file**

Create `src/routes/app/search.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchParamsSchema = z.object({
  q: z.string().default(""),
  type: z.enum(["all", "movie", "tv"]).default("all"),
  genre: z.number().optional(),
  yearMin: z.number().optional(),
  yearMax: z.number().optional(),
  rating: z.number().optional(),
  sort: z.enum(["relevance", "popularity", "rating", "newest", "oldest"]).default("relevance"),
  page: z.number().default(1),
});

export const Route = createFileRoute("/app/search")({
  validateSearch: (search) => searchParamsSchema.parse(search),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();

  return (
    <div className="min-h-screen bg-drive-in-bg">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-2xl text-cream mb-8">Search</h1>
        <p className="text-cream/50">Search page — components coming next.</p>
        <pre className="text-cream/30 text-xs mt-4">{JSON.stringify(search, null, 2)}</pre>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the route generates correctly**

Run: `bun run dev` (briefly, to trigger route generation)

Check that `src/routeTree.gen.ts` includes the new `/app/search` route. Visit `http://localhost:3000/app/search?q=test&type=movie&page=2` and verify params are parsed.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/search.tsx
git commit -m "feat: add /app/search route with validated search params"
```

---

## Task 5: Build the search bar component

**Files:**
- Create: `src/components/search/search-bar.tsx`

Debounced input that navigates via URL search params. Modeled after the onboarding search bar at `src/components/onboarding/search-bar.tsx` but uses `useNavigate()` instead of a callback.

- [ ] **Step 1: Create the search bar component**

Create `src/components/search/search-bar.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  initialValue: string;
}

export function SearchBar({ initialValue }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Sync with URL when navigating back/forward
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  function handleChange(newValue: string) {
    setValue(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      navigate({
        to: "/app/search",
        search: (prev) => ({ ...prev, q: newValue, page: 1 }),
      });
    }, 300);
  }

  function handleClear() {
    setValue("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    navigate({
      to: "/app/search",
      search: { q: "", type: "all", sort: "relevance", page: 1 },
    });
  }

  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/30" />
      <input
        type="text"
        role="searchbox"
        aria-label="Search movies and TV shows"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search movies & TV shows..."
        className="w-full rounded-xl border border-cream/12 bg-cream/6 py-3 pl-10 pr-10 text-[15px] text-cream placeholder:text-cream/30 outline-none transition-all duration-200 focus:border-neon-cyan/40 focus:shadow-[0_0_20px_rgba(0,229,255,0.1)]"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-cream/40 hover:text-cream/70 transition-colors"
          aria-label="Clear search"
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
git add src/components/search/search-bar.tsx
git commit -m "feat: add search bar component with debounced URL navigation"
```

---

## Task 6: Build the poster card and grid components

**Files:**
- Create: `src/components/search/poster-card.tsx`
- Create: `src/components/search/poster-grid.tsx`

Simplified version of the onboarding `TitleCard` — no selection state, just display. The grid is a responsive wrapper.

- [ ] **Step 1: Create the poster card**

Create `src/components/search/poster-card.tsx`:

```tsx
import type { FeedItem } from "#/lib/feed-assembler";
import { getGenreNameByTmdbId } from "#/lib/genre-map";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface PosterCardProps {
  item: FeedItem;
}

export function PosterCard({ item }: PosterCardProps) {
  const posterUrl = getTmdbImageUrl(item.posterPath);

  return (
    <div className="group overflow-hidden rounded-xl border border-cream/8 bg-cream/[0.03] transition-all duration-200 hover:border-[#FF2D78]/30 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      <div className="relative aspect-[2/3] overflow-hidden">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-cream/5 text-cream/20 text-xs">
            No Image
          </div>
        )}
        <div className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono-retro text-[9px] font-semibold uppercase tracking-wider text-cream/60">
          {item.mediaType === "tv" ? "TV" : "Film"}
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-bold text-cream">{item.title}</h3>
          <span className="shrink-0 text-xs text-cream/40">{item.year}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-xs font-medium text-neon-amber">
            ★ {item.rating.toFixed(1)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {item.genreIds.slice(0, 2).map((genreId) => (
            <span
              key={genreId}
              className="rounded-full bg-cream/[0.06] px-2 py-0.5 text-[10px] font-medium text-cream/40"
            >
              {getGenreNameByTmdbId(genreId)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the poster grid**

Create `src/components/search/poster-grid.tsx`:

```tsx
import type { FeedItem } from "#/lib/feed-assembler";
import { PosterCard } from "./poster-card";

interface PosterGridProps {
  items: FeedItem[];
}

export function PosterGrid({ items }: PosterGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <PosterCard key={`${item.tmdbId}-${item.mediaType}`} item={item} />
      ))}
    </div>
  );
}

export function PosterGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-cream/8 bg-cream/[0.03]">
          <div className="aspect-[2/3] animate-pulse bg-cream/5" />
          <div className="p-3 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-cream/5" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-cream/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/search/poster-card.tsx src/components/search/poster-grid.tsx
git commit -m "feat: add poster card and grid components for search results"
```

---

## Task 7: Build the filter sidebar component

**Files:**
- Create: `src/components/search/filter-sidebar.tsx`

Two exports: `FilterSidebarDesktop` (always-visible sidebar for md+) and `FilterSidebarMobile` (Sheet behind a "Filters" button for < md). Both render the same `FilterControls` internals. Year inputs use `onBlur` to avoid navigating on every keystroke.

- [ ] **Step 1: Create the filter sidebar**

Create `src/components/search/filter-sidebar.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "#/components/ui/sheet";
import { UNIFIED_GENRES } from "#/lib/genre-map";

interface FilterProps {
  type: "all" | "movie" | "tv";
  genre?: number;
  yearMin?: number;
  yearMax?: number;
  rating?: number;
}

const TYPE_OPTIONS = [
  { value: "all" as const, label: "All" },
  { value: "movie" as const, label: "Movies" },
  { value: "tv" as const, label: "TV Shows" },
];

const RATING_OPTIONS = [5, 6, 7, 8, 9];

function getActiveCount(props: FilterProps) {
  return [
    props.type !== "all",
    props.genre !== undefined,
    props.yearMin !== undefined || props.yearMax !== undefined,
    props.rating !== undefined,
  ].filter(Boolean).length;
}

function FilterControls({ type, genre, yearMin, yearMax, rating }: FilterProps) {
  const navigate = useNavigate();
  const [localYearMin, setLocalYearMin] = useState(yearMin?.toString() ?? "");
  const [localYearMax, setLocalYearMax] = useState(yearMax?.toString() ?? "");

  function updateFilter(updates: Record<string, unknown>) {
    navigate({
      to: "/app/search",
      search: (prev) => ({ ...prev, ...updates, page: 1 }),
    });
  }

  function clearFilters() {
    navigate({
      to: "/app/search",
      search: (prev) => ({
        q: prev.q,
        type: "all",
        sort: prev.sort,
        page: 1,
      }),
    });
    setLocalYearMin("");
    setLocalYearMax("");
  }

  function commitYearMin() {
    const val = localYearMin ? Number(localYearMin) : undefined;
    updateFilter({ yearMin: val });
  }

  function commitYearMax() {
    const val = localYearMax ? Number(localYearMax) : undefined;
    updateFilter({ yearMax: val });
  }

  return (
    <div className="space-y-6">
      {/* Type */}
      <div role="radiogroup" aria-label="Media type filter">
        <div className="mb-2.5 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-pink">
          Type
        </div>
        <div className="flex flex-col gap-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={type === opt.value}
              onClick={() => updateFilter({ type: opt.value })}
              className={`rounded-lg px-3 py-1.5 text-left text-sm transition-all ${
                type === opt.value
                  ? "bg-neon-pink/12 text-neon-pink border border-neon-pink/25"
                  : "text-cream/50 hover:text-cream/80 hover:bg-cream/4 border border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Genre */}
      <div role="radiogroup" aria-label="Genre filter">
        <div className="mb-2.5 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-pink">
          Genre
        </div>
        <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
          {UNIFIED_GENRES.map((g) => (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={genre === g.id}
              onClick={() => updateFilter({ genre: genre === g.id ? undefined : g.id })}
              className={`rounded-md px-3 py-1.5 text-left text-xs transition-all ${
                genre === g.id
                  ? "text-neon-cyan bg-neon-cyan/8"
                  : "text-cream/45 hover:text-cream/80 hover:bg-cream/4"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Year Range */}
      <div>
        <div className="mb-2.5 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-pink">
          Year
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="From"
            value={localYearMin}
            onChange={(e) => setLocalYearMin(e.target.value)}
            onBlur={commitYearMin}
            onKeyDown={(e) => e.key === "Enter" && commitYearMin()}
            className="w-full rounded-lg border border-cream/10 bg-cream/6 px-3 py-1.5 text-xs text-cream placeholder:text-cream/30 outline-none focus:border-neon-cyan/40"
          />
          <span className="text-cream/30 text-xs">–</span>
          <input
            type="number"
            placeholder="To"
            value={localYearMax}
            onChange={(e) => setLocalYearMax(e.target.value)}
            onBlur={commitYearMax}
            onKeyDown={(e) => e.key === "Enter" && commitYearMax()}
            className="w-full rounded-lg border border-cream/10 bg-cream/6 px-3 py-1.5 text-xs text-cream placeholder:text-cream/30 outline-none focus:border-neon-cyan/40"
          />
        </div>
      </div>

      {/* Rating */}
      <div role="radiogroup" aria-label="Minimum rating filter">
        <div className="mb-2.5 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-pink">
          Min Rating
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RATING_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={rating === r}
              onClick={() => updateFilter({ rating: rating === r ? undefined : r })}
              className={`rounded-md border px-2.5 py-1 text-xs transition-all ${
                rating === r
                  ? "border-neon-amber text-neon-amber bg-neon-amber/10"
                  : "border-cream/10 text-cream/40 hover:border-neon-amber/30 hover:text-cream/70"
              }`}
            >
              {r}+
            </button>
          ))}
        </div>
      </div>

      {/* Clear */}
      {getActiveCount({ type, genre, yearMin, yearMax, rating }) > 0 && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-xs text-cream/30 hover:text-neon-pink transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

export function FilterSidebarDesktop(props: FilterProps) {
  return (
    <div className="hidden md:block w-[220px] shrink-0">
      <FilterControls {...props} />
    </div>
  );
}

export function FilterSidebarMobile(props: FilterProps) {
  const [open, setOpen] = useState(false);
  const activeCount = getActiveCount(props);

  return (
    <div className="md:hidden mb-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-cream/12 bg-cream/6 text-cream/70 hover:text-cream"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-drive-in-bg border-cream/10 w-[280px]">
          <SheetHeader>
            <SheetTitle className="text-cream font-display">Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <FilterControls {...props} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/filter-sidebar.tsx
git commit -m "feat: add filter sidebar with desktop and mobile sheet variants"
```

---

## Task 8: Build the pagination component

**Files:**
- Create: `src/components/search/search-pagination.tsx`

Wraps shadcn `Pagination` component. Driven by `page` and `totalPages`. Uses `useNavigate()` to update the URL. Generates `href` values for proper link semantics.

- [ ] **Step 1: Create the pagination component**

Create `src/components/search/search-pagination.tsx`:

```tsx
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "#/components/ui/pagination";

interface SearchPaginationProps {
  currentPage: number;
  totalPages: number;
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  pages.push(total);

  return pages;
}

function buildPageHref(search: Record<string, unknown>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  params.set("page", String(page));
  return `/app/search?${params.toString()}`;
}

export function SearchPagination({ currentPage, totalPages }: SearchPaginationProps) {
  const navigate = useNavigate();
  const search = useSearch({ from: "/app/search" });

  if (totalPages <= 1) return null;

  function goToPage(e: React.MouseEvent, page: number) {
    e.preventDefault();
    navigate({
      to: "/app/search",
      search: (prev) => ({ ...prev, page }),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={currentPage > 1 ? buildPageHref(search, currentPage - 1) : undefined}
            onClick={(e) => currentPage > 1 && goToPage(e, currentPage - 1)}
            className={currentPage <= 1 ? "pointer-events-none opacity-30" : "cursor-pointer text-cream/50 hover:text-cream"}
          />
        </PaginationItem>

        {pages.map((page, i) =>
          page === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis className="text-cream/30" />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                href={buildPageHref(search, page)}
                isActive={page === currentPage}
                onClick={(e) => goToPage(e, page)}
                className={`cursor-pointer ${
                  page === currentPage
                    ? "bg-neon-pink/15 text-neon-pink border-neon-pink/30"
                    : "text-cream/50 hover:text-cream hover:bg-cream/6"
                }`}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            href={currentPage < totalPages ? buildPageHref(search, currentPage + 1) : undefined}
            onClick={(e) => currentPage < totalPages && goToPage(e, currentPage + 1)}
            className={currentPage >= totalPages ? "pointer-events-none opacity-30" : "cursor-pointer text-cream/50 hover:text-cream"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/search-pagination.tsx
git commit -m "feat: add search pagination component wrapping shadcn Pagination"
```

---

## Task 9: Build the search landing component

**Files:**
- Create: `src/components/search/search-landing.tsx`

Three horizontal rows: Trending, Top Rated, New Releases. Each fetches data via tRPC in parallel.

- [ ] **Step 1: Create the search landing component**

Create `src/components/search/search-landing.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";
import { PosterCard } from "./poster-card";

function LandingRow({
  title,
  badge,
  badgeClass,
  items,
  isLoading,
}: {
  title: string;
  badge: string;
  badgeClass: string;
  items: Array<import("#/lib/feed-assembler").FeedItem>;
  isLoading: boolean;
}) {
  return (
    <section className="mb-10" aria-busy={isLoading}>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-display text-lg text-cream">{title}</h2>
        <span
          className={`font-mono-retro text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${badgeClass}`}
        >
          {badge}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-cream/8 bg-cream/[0.03]">
              <div className="aspect-[2/3] animate-pulse bg-cream/5" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-cream/5" />
                <div className="h-2 w-1/4 animate-pulse rounded bg-cream/5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <PosterCard key={`${item.tmdbId}-${item.mediaType}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export function SearchLanding() {
  const trpc = useTRPC();

  const trending = useQuery(trpc.search.trending.queryOptions());
  const topRated = useQuery(trpc.search.topRated.queryOptions());
  const newReleases = useQuery(trpc.search.newReleases.queryOptions());

  return (
    <div>
      <LandingRow
        title="Trending Now"
        badge="Hot"
        badgeClass="bg-neon-pink/15 text-neon-pink"
        items={trending.data?.results ?? []}
        isLoading={trending.isLoading}
      />
      <LandingRow
        title="Top Rated"
        badge="★"
        badgeClass="bg-neon-amber/15 text-neon-amber"
        items={topRated.data?.results ?? []}
        isLoading={topRated.isLoading}
      />
      <LandingRow
        title="New Releases"
        badge="New"
        badgeClass="bg-neon-cyan/15 text-neon-cyan"
        items={newReleases.data?.results ?? []}
        isLoading={newReleases.isLoading}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/search-landing.tsx
git commit -m "feat: add search landing component with trending, top rated, new releases"
```

---

## Task 10: Build the search results component

**Files:**
- Create: `src/components/search/search-results.tsx`

Combines FilterSidebarDesktop + FilterSidebarMobile + PosterGrid + Pagination. Shows results count and sort dropdown. Uses `placeholderData: keepPreviousData` to keep stale results visible during loading. Shows Sonner toast on error.

- [ ] **Step 1: Create the search results component**

Create `src/components/search/search-results.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { useTRPC } from "#/integrations/trpc/react";
import { FilterSidebarDesktop, FilterSidebarMobile } from "./filter-sidebar";
import { PosterGrid, PosterGridSkeleton } from "./poster-grid";
import { SearchPagination } from "./search-pagination";

interface SearchResultsProps {
  q: string;
  type: "all" | "movie" | "tv";
  genre?: number;
  yearMin?: number;
  yearMax?: number;
  rating?: number;
  sort: "relevance" | "popularity" | "rating" | "newest" | "oldest";
  page: number;
}

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "popularity", label: "Popularity" },
  { value: "rating", label: "Rating" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
] as const;

export function SearchResults(props: SearchResultsProps) {
  const { q, type, genre, yearMin, yearMax, rating, sort, page } = props;
  const navigate = useNavigate();
  const trpc = useTRPC();

  const filterProps = { type, genre, yearMin, yearMax, rating };

  const { data, isLoading, isError, error } = useQuery({
    ...trpc.search.results.queryOptions({
      q, type, genre, yearMin, yearMax, rating, sort, page,
    }),
    placeholderData: keepPreviousData,
  });

  // Show toast on error
  useEffect(() => {
    if (isError) {
      toast.error("Failed to load search results. Please try again.");
    }
  }, [isError]);

  return (
    <div>
      {/* Results info bar */}
      <div className="mb-5 flex items-center justify-between border-b border-cream/6 pb-3">
        <div className="text-sm text-cream/50" aria-live="polite">
          {isLoading && !data ? (
            <span className="animate-pulse">Searching...</span>
          ) : data ? (
            <>
              Found <strong className="text-cream font-semibold">{data.totalResults} results</strong>{" "}
              for &ldquo;{q}&rdquo;
            </>
          ) : null}
        </div>
        <select
          value={sort}
          onChange={(e) =>
            navigate({
              to: "/app/search",
              search: (prev) => ({ ...prev, sort: e.target.value as typeof sort, page: 1 }),
            })
          }
          className="rounded-lg border border-cream/12 bg-cream/6 px-3 py-1.5 text-xs text-cream outline-none cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile filter trigger */}
      <FilterSidebarMobile {...filterProps} />

      {/* Desktop sidebar + Grid */}
      <div className="flex gap-7">
        <FilterSidebarDesktop {...filterProps} />

        <div className="flex-1 min-w-0" aria-busy={isLoading && !data}>
          {isLoading && !data ? (
            <PosterGridSkeleton />
          ) : isError && !data ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-cream/50 mb-4">Something went wrong. Please try again.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border border-neon-pink/30 bg-neon-pink/10 px-4 py-2 text-sm text-neon-pink hover:bg-neon-pink/20 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : data && data.results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-cream/50 text-lg mb-2">No results found</p>
              <p className="text-cream/30 text-sm">
                Try adjusting your filters or search for something else
              </p>
            </div>
          ) : data ? (
            <>
              <PosterGrid items={data.results} />
              <SearchPagination currentPage={page} totalPages={data.totalPages} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/search-results.tsx
git commit -m "feat: add search results component with sidebar, grid, and pagination"
```

---

## Task 11: Wire up the search route with all components

**Files:**
- Modify: `src/routes/app/search.tsx`

Replace the placeholder with the real SearchPage that conditionally renders landing vs results. Includes retro overlays.

- [ ] **Step 1: Update the route component**

Replace the content of `src/routes/app/search.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { RetroOverlays } from "#/components/retro-overlays";
import { SearchBar } from "#/components/search/search-bar";
import { SearchLanding } from "#/components/search/search-landing";
import { SearchResults } from "#/components/search/search-results";

const searchParamsSchema = z.object({
  q: z.string().default(""),
  type: z.enum(["all", "movie", "tv"]).default("all"),
  genre: z.number().optional(),
  yearMin: z.number().optional(),
  yearMax: z.number().optional(),
  rating: z.number().optional(),
  sort: z.enum(["relevance", "popularity", "rating", "newest", "oldest"]).default("relevance"),
  page: z.number().default(1),
});

export const Route = createFileRoute("/app/search")({
  validateSearch: (search) => searchParamsSchema.parse(search),
  component: SearchPage,
});

function SearchPage() {
  const { q, type, genre, yearMin, yearMax, rating, sort, page } = Route.useSearch();
  const hasQuery = q.trim().length > 0;

  return (
    <div className="relative min-h-screen bg-drive-in-bg">
      <RetroOverlays />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-2xl text-cream mb-8">Search</h1>

        <div className="mb-8">
          <SearchBar initialValue={q} />
        </div>

        {hasQuery ? (
          <SearchResults
            q={q}
            type={type}
            genre={genre}
            yearMin={yearMin}
            yearMax={yearMax}
            rating={rating}
            sort={sort}
            page={page}
          />
        ) : (
          <SearchLanding />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the dev server and test manually**

Run: `bun run dev`

Test the following:
1. Visit `/app/search` — should show landing with trending/top rated/new releases
2. Type "batman" in search — should show results with sidebar filters
3. Click a genre filter — URL updates, results filter
4. Change sort — URL updates, results re-sort
5. Click page 2 — URL updates, new results, scrolls to top
6. Click clear (X) on search bar — returns to landing state
7. Resize to mobile — sidebar should become a sheet behind a "Filters" button
8. Right-click a pagination link — should show a proper URL

- [ ] **Step 3: Run biome check**

Run: `bunx biome check --write src/components/search/ src/routes/app/search.tsx src/lib/search-filters.ts src/integrations/trpc/routers/search.ts`

Fix any lint/format issues.

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/app/search.tsx
git commit -m "feat: wire up search page with landing and results states"
```

---

## Task 12: Final verification and cleanup

**Files:**
- All search-related files

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: All PASS

- [ ] **Step 2: Run biome check on entire project**

Run: `bunx biome check --write .`
Fix any issues.

- [ ] **Step 3: Test the complete flow manually**

1. Landing state renders with 3 sections
2. Search navigates correctly with debounce
3. All 4 filters work (type, genre, year, rating)
4. Sort dropdown works
5. Pagination works with correct page numbers
6. Clear search returns to landing
7. URL is shareable — copy URL, paste in new tab, same state
8. Mobile responsive: sidebar becomes sheet
9. Loading skeletons show during fetch
10. Empty state shows when no results
11. Back/forward browser buttons preserve state
12. Previous results remain visible while loading new results (keepPreviousData)

- [ ] **Step 4: Commit any cleanup**

```bash
git add -A
git commit -m "chore: final cleanup for search page"
```
