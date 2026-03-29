# Showtime Shuffle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tinder-style swipe interface for discovering movies/shows, with solo and group modes, unanimous group matching, and a red curtain match celebration.

**Architecture:** New `shuffleSwipe` DB table + `shuffle-feed.ts` feed assembler + `shuffle.ts` tRPC router + `/app/shuffle` route with Framer Motion card stack. Builds on top of the watchlist branch's schema (watchlist, watchlistItem, watchlistMember tables).

**Tech Stack:** TanStack Start, tRPC, Drizzle ORM, PostgreSQL, motion (v12), Lucide React, Vitest, TMDB API

**Prerequisite:** The `watchlist` branch must be merged into `showtime-shuffle` before starting. Run `git merge watchlist` on the `showtime-shuffle` branch.

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/lib/shuffle-feed.ts` | Three-source feed assembly (taste/trending/discovery) with configurable ratios, cursor pagination, deduplication |
| `src/lib/__tests__/shuffle-feed.test.ts` | Unit tests for feed interleaving, dedup, cursor, ratio logic |
| `src/integrations/trpc/routers/shuffle.ts` | tRPC procedures: getFeed, recordSwipe (with inline match detection), undoSwipe, getOrCreateShuffleWatchlist, getWatchlistOptions, getHiddenTitles, unhideTitle |
| `src/integrations/trpc/__tests__/shuffle.test.ts` | Unit tests for shuffle router procedures |
| `src/routes/app/shuffle.tsx` | Route component with search param for watchlistId |
| `src/components/shuffle/swipe-card.tsx` | Single card with motion drag gestures, stamp overlay, poster/title/genre/synopsis |
| `src/components/shuffle/card-stack.tsx` | Stack of 3 visible cards, manages prefetch, AnimatePresence transitions |
| `src/components/shuffle/action-buttons.tsx` | Arc layout: No, Undo, Hide, Yes buttons with Lucide icons |
| `src/components/shuffle/match-celebration.tsx` | Red curtain modal with motion animation, auto-dismiss |
| `src/components/shuffle/mode-switcher.tsx` | Solo/group watchlist dropdown |
| `src/components/shuffle/clapperboard-stamp.tsx` | Clapperboard SVG with random text pool |

| `src/components/shuffle/card-detail-modal.tsx` | Expanded title detail view (poster, rating, full synopsis, genres) |

### Modified files
| File | Changes |
|------|---------|
| `src/db/schema.ts` | Add `shuffleSwipe` table, add `type` column to `watchlist`, update relations |
| `src/integrations/trpc/router.ts` | Register `shuffleRouter` |
| `src/routes/app/route.tsx` | Add "Shuffle" nav link |
| `src/components/watchlist/watchlist-detail-header.tsx` | Add "Showtime Shuffle" button |

---

### Task 1: Merge watchlist branch and add shuffleSwipe schema

**Files:**
- Modify: `src/db/schema.ts`
- Run: Drizzle migration

- [ ] **Step 1: Merge watchlist branch**

```bash
git merge watchlist
```

Resolve any conflicts. The watchlist branch adds `watchlist`, `watchlistItem`, `watchlistMember` tables to schema.ts.

- [ ] **Step 2: Add `type` column to watchlist table**

In `src/db/schema.ts`, find the `watchlist` table definition and add a `type` column. Remove `isDefault`:

```typescript
// Replace isDefault with type
type: text("type").notNull().default("custom"), // 'default' | 'shuffle' | 'custom'
```

After merging, search for `isDefault` across the codebase (`grep -r isDefault src/`). Replace all references with `type === 'default'` checks. Key locations will be in `src/integrations/trpc/routers/watchlist.ts` (the delete guard and default watchlist creation) and `src/routes/app/` watchlist pages.

- [ ] **Step 3: Add `shuffleSwipe` table**

In `src/db/schema.ts`, add after the watchlist tables:

```typescript
export const shuffleSwipe = pgTable(
  "shuffle_swipe",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    watchlistId: text("watchlist_id")
      .notNull()
      .references(() => watchlist.id, { onDelete: "cascade" }),
    tmdbId: integer("tmdb_id").notNull(),
    mediaType: text("media_type").notNull(), // 'movie' | 'tv'
    action: text("action").notNull(), // 'yes' | 'no' | 'hide'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shuffle_swipe_unique").on(
      table.userId,
      table.tmdbId,
      table.mediaType,
      table.watchlistId,
    ),
    index("shuffle_swipe_userId_idx").on(table.userId),
    index("shuffle_swipe_watchlistId_idx").on(table.watchlistId),
  ],
);
```

- [ ] **Step 4: Add relations for shuffleSwipe**

```typescript
export const shuffleSwipeRelations = relations(shuffleSwipe, ({ one }) => ({
  user: one(user, {
    fields: [shuffleSwipe.userId],
    references: [user.id],
  }),
  watchlist: one(watchlist, {
    fields: [shuffleSwipe.watchlistId],
    references: [watchlist.id],
  }),
}));
```

Also add `swipes: many(shuffleSwipe)` to the existing `userRelations` and `watchlistRelations`.

- [ ] **Step 5: Generate and run migration**

```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add shuffleSwipe schema and watchlist type column"
```

---

### Task 2: Shuffle feed assembler

**Files:**
- Create: `src/lib/shuffle-feed.ts`
- Create: `src/lib/__tests__/shuffle-feed.test.ts`

- [ ] **Step 1: Write failing tests for `interleaveShuffleFeed`**

In `src/lib/__tests__/shuffle-feed.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { FeedItem } from "../feed-assembler";
import { interleaveShuffleFeed } from "../shuffle-feed";

function makeFeedItem(overrides: Partial<FeedItem> & { tmdbId: number }): FeedItem {
  return {
    mediaType: "movie",
    title: `Title ${overrides.tmdbId}`,
    posterPath: null,
    overview: "Synopsis",
    year: "2024",
    rating: 7,
    genreIds: [1],
    isTrending: false,
    ...overrides,
  };
}

describe("interleaveShuffleFeed", () => {
  it("interleaves three sources at 50/30/20 ratio", () => {
    const taste = Array.from({ length: 10 }, (_, i) => makeFeedItem({ tmdbId: i + 1 }));
    const trending = Array.from({ length: 6 }, (_, i) => makeFeedItem({ tmdbId: i + 100, isTrending: true }));
    const discovery = Array.from({ length: 4 }, (_, i) => makeFeedItem({ tmdbId: i + 200 }));

    const result = interleaveShuffleFeed(taste, trending, discovery);
    expect(result.length).toBe(20);

    // Check approximate ratio over 20 items
    const tasteCount = result.filter((item) => item.tmdbId < 100).length;
    const trendingCount = result.filter((item) => item.tmdbId >= 100 && item.tmdbId < 200).length;
    const discoveryCount = result.filter((item) => item.tmdbId >= 200).length;

    expect(tasteCount).toBe(10);
    expect(trendingCount).toBe(6);
    expect(discoveryCount).toBe(4);
  });

  it("handles empty sources gracefully", () => {
    const taste = Array.from({ length: 5 }, (_, i) => makeFeedItem({ tmdbId: i + 1 }));
    const result = interleaveShuffleFeed(taste, [], []);
    expect(result.length).toBe(5);
  });

  it("deduplicates across sources", () => {
    const taste = [makeFeedItem({ tmdbId: 1 })];
    const trending = [makeFeedItem({ tmdbId: 1, isTrending: true })];
    const discovery = [makeFeedItem({ tmdbId: 2 })];

    const result = interleaveShuffleFeed(taste, trending, discovery);
    const ids = result.map((r) => r.tmdbId);
    expect(ids.filter((id) => id === 1).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/lib/__tests__/shuffle-feed.test.ts
```

Expected: FAIL — `interleaveShuffleFeed` not found.

- [ ] **Step 3: Implement `shuffle-feed.ts`**

Create `src/lib/shuffle-feed.ts`:

```typescript
import { type FeedItem, deduplicateFeed } from "./feed-assembler";

export interface ShuffleFeedCursor {
  tastePage: number;
  trendingPage: number;
  discoveryPage: number;
}

export function parseShuffleCursor(cursor: string | undefined): ShuffleFeedCursor {
  if (!cursor) return { tastePage: 1, trendingPage: 1, discoveryPage: 1 };
  try {
    return JSON.parse(cursor) as ShuffleFeedCursor;
  } catch {
    return { tastePage: 1, trendingPage: 1, discoveryPage: 1 };
  }
}

export function serializeShuffleCursor(cursor: ShuffleFeedCursor): string {
  return JSON.stringify(cursor);
}

export interface ShuffleFeedRatio {
  taste: number;   // e.g. 5 for 50%
  trending: number; // e.g. 3 for 30%
  discovery: number; // e.g. 2 for 20%
}

export const SOLO_RATIO: ShuffleFeedRatio = { taste: 5, trending: 3, discovery: 2 };
export const GROUP_RATIO: ShuffleFeedRatio = { taste: 3, trending: 4, discovery: 3 };

/**
 * Interleaves three sources in a repeating cycle based on configurable ratios.
 *
 * Solo ratio: 50/30/20 → pattern of 10: T T T T T Tr Tr Tr D D
 * Group ratio: 30/40/30 → pattern of 10: T T T Tr Tr Tr Tr D D D
 */
export function interleaveShuffleFeed(
  taste: FeedItem[],
  trending: FeedItem[],
  discovery: FeedItem[],
  ratio: ShuffleFeedRatio = SOLO_RATIO,
): FeedItem[] {
  const result: FeedItem[] = [];
  let ti = 0, tri = 0, di = 0;

  // Build pattern from ratio
  const pattern: ("taste" | "trending" | "discovery")[] = [
    ...Array(ratio.taste).fill("taste" as const),
    ...Array(ratio.trending).fill("trending" as const),
    ...Array(ratio.discovery).fill("discovery" as const),
  ];

  let patternIdx = 0;

  while (ti < taste.length || tri < trending.length || di < discovery.length) {
    const source = pattern[patternIdx % pattern.length];
    patternIdx++;

    if (source === "taste" && ti < taste.length) {
      result.push(taste[ti++]);
    } else if (source === "trending" && tri < trending.length) {
      result.push(trending[tri++]);
    } else if (source === "discovery" && di < discovery.length) {
      result.push(discovery[di++]);
    } else {
      // Source exhausted — try others in priority order
      if (ti < taste.length) result.push(taste[ti++]);
      else if (tri < trending.length) result.push(trending[tri++]);
      else if (di < discovery.length) result.push(discovery[di++]);
    }
  }

  return deduplicateFeed(result);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test src/lib/__tests__/shuffle-feed.test.ts
```

Expected: PASS

- [ ] **Step 5: Add tests for cursor serialization**

Add to the test file:

```typescript
describe("parseShuffleCursor / serializeShuffleCursor", () => {
  it("round-trips a cursor", () => {
    const cursor = { tastePage: 2, trendingPage: 3, discoveryPage: 1 };
    expect(parseShuffleCursor(serializeShuffleCursor(cursor))).toEqual(cursor);
  });

  it("returns default for undefined", () => {
    expect(parseShuffleCursor(undefined)).toEqual({
      tastePage: 1, trendingPage: 1, discoveryPage: 1,
    });
  });
});
```

- [ ] **Step 6: Run all tests**

```bash
bun run test src/lib/__tests__/shuffle-feed.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/shuffle-feed.ts src/lib/__tests__/shuffle-feed.test.ts
git commit -m "feat: add shuffle feed assembler with three-source interleaving"
```

---

### Task 3: Shuffle tRPC router

**Files:**
- Create: `src/integrations/trpc/routers/shuffle.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Create shuffle router with `getOrCreateShuffleWatchlist` procedure**

Create `src/integrations/trpc/routers/shuffle.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { and, eq, sql, count, inArray, lt, not } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { shuffleSwipe, watchlist, watchlistItem, watchlistMember, userGenre } from "#/db/schema";
import { protectedProcedure } from "../init";
import { discoverMovies, discoverTv, fetchTrending } from "#/lib/tmdb";
import { UNIFIED_GENRES } from "#/lib/genre-map";
import {
  interleaveShuffleFeed,
  parseShuffleCursor,
  serializeShuffleCursor,
  SOLO_RATIO,
  GROUP_RATIO,
} from "#/lib/shuffle-feed";
import type { FeedItem } from "#/lib/feed-assembler";

// Mappers (same as taste-profile.ts)
function mapMovieToFeedItem(m: { id: number; title: string; poster_path: string | null; overview: string; release_date: string; vote_average: number; genre_ids: number[] }): FeedItem {
  return {
    tmdbId: m.id,
    mediaType: "movie",
    title: m.title,
    posterPath: m.poster_path,
    overview: m.overview,
    year: m.release_date?.slice(0, 4) ?? "",
    rating: m.vote_average,
    genreIds: m.genre_ids,
    isTrending: false,
  };
}

function mapTvToFeedItem(t: { id: number; name: string; poster_path: string | null; overview: string; first_air_date: string; vote_average: number; genre_ids: number[] }): FeedItem {
  return {
    tmdbId: t.id,
    mediaType: "tv",
    title: t.name,
    posterPath: t.poster_path,
    overview: t.overview,
    year: t.first_air_date?.slice(0, 4) ?? "",
    rating: t.vote_average,
    genreIds: t.genre_ids,
    isTrending: false,
  };
}

export const shuffleRouter = {
  getOrCreateShuffleWatchlist: protectedProcedure.query(async ({ ctx }) => {
    // Find existing shuffle watchlist
    const existing = await db.query.watchlist.findFirst({
      where: and(eq(watchlist.ownerId, ctx.userId), eq(watchlist.type, "shuffle")),
    });

    if (existing) return existing;

    // Create one
    const [created] = await db
      .insert(watchlist)
      .values({
        name: "Showtime Shuffle",
        ownerId: ctx.userId,
        type: "shuffle",
      })
      .returning();

    // Add owner as member
    await db.insert(watchlistMember).values({
      watchlistId: created.id,
      userId: ctx.userId,
      role: "owner",
    });

    return created;
  }),

  getFeed: protectedProcedure
    .input(z.object({
      watchlistId: z.string(),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const parsedCursor = parseShuffleCursor(input.cursor);
      const BATCH_SIZE = 20;

      // Get user's genre preferences
      const userGenres = await db.query.userGenre.findMany({
        where: eq(userGenre.userId, ctx.userId),
      });
      const userGenreIds = userGenres.map((g) => g.genreId);

      // For group mode, get all members' genres
      const members = await db.query.watchlistMember.findMany({
        where: eq(watchlistMember.watchlistId, input.watchlistId),
      });
      const isGroup = members.length > 1;

      let allGenreIds = userGenreIds;
      if (isGroup) {
        const memberIds = members.map((m) => m.userId);
        const allMemberGenres = await db.query.userGenre.findMany({
          where: inArray(userGenre.userId, memberIds),
        });
        allGenreIds = [...new Set(allMemberGenres.map((g) => g.genreId))];
      }

      // Determine discovery genres (genres NOT in the user/group set)
      const allUnifiedIds = UNIFIED_GENRES.map((g) => g.id);
      const discoveryGenreIds = allUnifiedIds.filter((id) => !allGenreIds.includes(id));

      // Pick taste and discovery genres via round-robin based on cursor page
      const tasteGenres = allGenreIds
        .map((id) => UNIFIED_GENRES.find((g) => g.id === id))
        .filter(Boolean);
      const discoveryGenresList = discoveryGenreIds
        .map((id) => UNIFIED_GENRES.find((g) => g.id === id))
        .filter(Boolean);

      // Round-robin: use cursor page to rotate through genres
      const tasteGenre = tasteGenres[(parsedCursor.tastePage - 1) % tasteGenres.length];
      const discoveryGenre = discoveryGenresList.length > 0
        ? discoveryGenresList[(parsedCursor.discoveryPage - 1) % discoveryGenresList.length]
        : null;

      // Fetch from TMDB in parallel
      const emptyPage = Promise.resolve({ results: [], page: 1, total_pages: 0, total_results: 0 });

      const [tasteMovies, tasteTv, trendingRes, discoveryMovies, discoveryTv] = await Promise.all([
        tasteGenre?.movieGenreId ? discoverMovies(tasteGenre.movieGenreId, parsedCursor.tastePage) : emptyPage,
        tasteGenre?.tvGenreId ? discoverTv(tasteGenre.tvGenreId, parsedCursor.tastePage) : emptyPage,
        fetchTrending(parsedCursor.trendingPage),
        discoveryGenre?.movieGenreId ? discoverMovies(discoveryGenre.movieGenreId, parsedCursor.discoveryPage) : emptyPage,
        discoveryGenre?.tvGenreId ? discoverTv(discoveryGenre.tvGenreId, parsedCursor.discoveryPage) : emptyPage,
      ]);

      const tasteItems: FeedItem[] = [
        ...tasteMovies.results.map(mapMovieToFeedItem),
        ...tasteTv.results.map(mapTvToFeedItem),
      ];
      const trendingItems: FeedItem[] = trendingRes.results
        .filter((r) => r.media_type !== "person")
        .map((r) => ({
          tmdbId: r.id,
          mediaType: r.media_type as "movie" | "tv",
          title: r.title ?? r.name ?? "",
          posterPath: r.poster_path,
          overview: r.overview,
          year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
          rating: r.vote_average,
          genreIds: r.genre_ids,
          isTrending: true,
        }));
      const discoveryItems: FeedItem[] = [
        ...discoveryMovies.results.map(mapMovieToFeedItem),
        ...discoveryTv.results.map(mapTvToFeedItem),
      ];

      // Use different ratio for solo vs group
      const ratio = isGroup ? GROUP_RATIO : SOLO_RATIO;

      // Get user's existing swipes for this watchlist to filter
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const existingSwipes = await db.query.shuffleSwipe.findMany({
        where: and(
          eq(shuffleSwipe.userId, ctx.userId),
          eq(shuffleSwipe.watchlistId, input.watchlistId),
        ),
      });
      // Also get global hides
      const globalHides = await db.query.shuffleSwipe.findMany({
        where: and(
          eq(shuffleSwipe.userId, ctx.userId),
          eq(shuffleSwipe.action, "hide"),
        ),
      });

      const swipedKeys = new Set<string>();
      for (const s of existingSwipes) {
        if (s.action === "yes") swipedKeys.add(`${s.tmdbId}-${s.mediaType}`);
        if (s.action === "no" && new Date(s.createdAt) > twoWeeksAgo) swipedKeys.add(`${s.tmdbId}-${s.mediaType}`);
      }
      for (const s of globalHides) {
        swipedKeys.add(`${s.tmdbId}-${s.mediaType}`);
      }

      const filterSwiped = (items: FeedItem[]) =>
        items.filter((item) => !swipedKeys.has(`${item.tmdbId}-${item.mediaType}`));

      const interleaved = interleaveShuffleFeed(
        filterSwiped(tasteItems),
        filterSwiped(trendingItems),
        filterSwiped(discoveryItems),
        ratio,
      );

      const nextCursor = serializeShuffleCursor({
        tastePage: parsedCursor.tastePage + 1,
        trendingPage: parsedCursor.trendingPage + 1,
        discoveryPage: parsedCursor.discoveryPage + 1,
      });

      return {
        items: interleaved.slice(0, BATCH_SIZE),
        nextCursor: interleaved.length > 0 ? nextCursor : null,
      };
    }),

  recordSwipe: protectedProcedure
    .input(z.object({
      watchlistId: z.string(),
      tmdbId: z.number(),
      mediaType: z.enum(["movie", "tv"]),
      action: z.enum(["yes", "no", "hide"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Upsert the swipe
      await db
        .insert(shuffleSwipe)
        .values({
          userId: ctx.userId,
          watchlistId: input.watchlistId,
          tmdbId: input.tmdbId,
          mediaType: input.mediaType,
          action: input.action,
        })
        .onConflictDoUpdate({
          target: [shuffleSwipe.userId, shuffleSwipe.tmdbId, shuffleSwipe.mediaType, shuffleSwipe.watchlistId],
          set: { action: input.action, createdAt: new Date() },
        });

      // Check watchlist type for solo vs group logic
      const wl = await db.query.watchlist.findFirst({
        where: eq(watchlist.id, input.watchlistId),
      });

      if (!wl) return { match: false };

      if (input.action === "yes") {
        if (wl.type === "shuffle") {
          // Solo mode — add to watchlist directly
          await db
            .insert(watchlistItem)
            .values({
              watchlistId: input.watchlistId,
              tmdbId: input.tmdbId,
              mediaType: input.mediaType,
              addedBy: ctx.userId,
            })
            .onConflictDoNothing();

          return { match: false };
        }

        // Group mode — check for unanimous match
        const members = await db.query.watchlistMember.findMany({
          where: eq(watchlistMember.watchlistId, input.watchlistId),
        });
        const memberCount = members.length;

        const yesSwipes = await db.query.shuffleSwipe.findMany({
          where: and(
            eq(shuffleSwipe.watchlistId, input.watchlistId),
            eq(shuffleSwipe.tmdbId, input.tmdbId),
            eq(shuffleSwipe.mediaType, input.mediaType),
            eq(shuffleSwipe.action, "yes"),
          ),
        });

        if (yesSwipes.length >= memberCount) {
          // Match! Add to group watchlist
          await db
            .insert(watchlistItem)
            .values({
              watchlistId: input.watchlistId,
              tmdbId: input.tmdbId,
              mediaType: input.mediaType,
              addedBy: ctx.userId,
            })
            .onConflictDoNothing();

          return {
            match: true,
            watchlistName: wl.name,
            tmdbId: input.tmdbId,
            mediaType: input.mediaType,
          };
        }
      }

      return { match: false };
    }),

  undoSwipe: protectedProcedure
    .input(z.object({
      watchlistId: z.string(),
      tmdbId: z.number(),
      mediaType: z.enum(["movie", "tv"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Delete the swipe record
      await db.delete(shuffleSwipe).where(
        and(
          eq(shuffleSwipe.userId, ctx.userId),
          eq(shuffleSwipe.watchlistId, input.watchlistId),
          eq(shuffleSwipe.tmdbId, input.tmdbId),
          eq(shuffleSwipe.mediaType, input.mediaType),
        ),
      );

      // Also remove from watchlist if it was a solo "yes"
      const wl = await db.query.watchlist.findFirst({
        where: eq(watchlist.id, input.watchlistId),
      });

      if (wl?.type === "shuffle") {
        await db.delete(watchlistItem).where(
          and(
            eq(watchlistItem.watchlistId, input.watchlistId),
            eq(watchlistItem.tmdbId, input.tmdbId),
            eq(watchlistItem.mediaType, input.mediaType),
          ),
        );
      }
    }),

  getWatchlistOptions: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await db.query.watchlistMember.findMany({
      where: eq(watchlistMember.userId, ctx.userId),
      with: { watchlist: true },
    });

    return memberships
      .filter((m) => m.watchlist.type !== "shuffle")
      .map((m) => ({
        id: m.watchlist.id,
        name: m.watchlist.name,
        type: m.watchlist.type,
      }));
  }),

  getHiddenTitles: protectedProcedure.query(async ({ ctx }) => {
    return db.query.shuffleSwipe.findMany({
      where: and(
        eq(shuffleSwipe.userId, ctx.userId),
        eq(shuffleSwipe.action, "hide"),
      ),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
  }),

  unhideTitle: protectedProcedure
    .input(z.object({
      tmdbId: z.number(),
      mediaType: z.enum(["movie", "tv"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(shuffleSwipe).where(
        and(
          eq(shuffleSwipe.userId, ctx.userId),
          eq(shuffleSwipe.tmdbId, input.tmdbId),
          eq(shuffleSwipe.mediaType, input.mediaType),
          eq(shuffleSwipe.action, "hide"),
        ),
      );
    }),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register in main router**

In `src/integrations/trpc/router.ts`, add:

```typescript
import { shuffleRouter } from "./routers/shuffle";
```

And add `shuffle: shuffleRouter` to the `createTRPCRouter` call.

- [ ] **Step 3: Type-check**

```bash
bun run typecheck
```

Expected: PASS (or only pre-existing errors)

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/shuffle.ts src/integrations/trpc/router.ts
git commit -m "feat: add shuffle tRPC router with feed, swipe, match, and hide procedures"
```

---

### Task 4: Clapperboard stamp component

**Files:**
- Create: `src/components/shuffle/clapperboard-stamp.tsx`

- [ ] **Step 1: Create clapperboard stamp component**

```typescript
const YES_STAMPS = [
  { main: "YES!", sub: "TAKE 1" },
  { main: "LET'S GO!", sub: "ACTION!" },
  { main: "OH YEAH!", sub: "ROLLING" },
  { main: "HECK YES!", sub: "SCENE 1" },
];

const NO_STAMPS = [
  { main: "NOPE", sub: "CUT!" },
  { main: "SKIP", sub: "NEXT" },
  { main: "NAH", sub: "WRAP" },
  { main: "PASS", sub: "MOVING ON" },
];

function getRandomStamp(type: "yes" | "no") {
  const pool = type === "yes" ? YES_STAMPS : NO_STAMPS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Use this hook in SwipeCard to get a stable stamp per drag gesture */
export function useStableStamp(type: "yes" | "no") {
  const ref = useRef(getRandomStamp(type));
  return ref.current;
}

interface ClapperboardStampProps {
  type: "yes" | "no";
  opacity: number; // 0-1, tied to drag distance
  stamp: { main: string; sub: string }; // Pass stable stamp from parent
}

export function ClapperboardStamp({ type, opacity, stamp }: ClapperboardStampProps) {
  const color = type === "yes" ? "#22c55e" : "#ef4444";
  const rotation = type === "yes" ? "-10deg" : "10deg";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      style={{ opacity }}
    >
      <div style={{ transform: `rotate(${rotation})`, width: 120 }}>
        {/* Chevron stripes */}
        <div
          className="h-4 rounded-t"
          style={{
            background: "repeating-linear-gradient(135deg, #fff 0px, #fff 8px, #1a1a2e 8px, #1a1a2e 16px)",
          }}
        />
        {/* Board body */}
        <div className="rounded-b border-2 border-t-0 border-white/25 bg-[#1a1a2e] px-3 py-2 text-center">
          <div className="font-mono text-[10px] tracking-widest text-white/40">SCENE</div>
          <div className="text-2xl font-black leading-none" style={{ color }}>
            {stamp.main}
          </div>
          <div className="font-mono text-[10px] tracking-widest text-white/40">{stamp.sub}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shuffle/clapperboard-stamp.tsx
git commit -m "feat: add clapperboard stamp component with random text pool"
```

---

### Task 5: Swipe card component

**Files:**
- Create: `src/components/shuffle/swipe-card.tsx`

- [ ] **Step 1: Create swipe card component**

Uses `motion` (v12) for drag gestures. Renders poster, title, genre tags, synopsis, and stamp overlay.

```typescript
import { useRef } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import type { FeedItem } from "#/lib/feed-assembler";
import { getTmdbImageUrl } from "#/lib/tmdb";
import { getGenreNameByTmdbId } from "#/lib/genre-map";
import { ClapperboardStamp, getRandomStamp } from "./clapperboard-stamp";

const SWIPE_THRESHOLD = 120;

interface SwipeCardProps {
  item: FeedItem;
  onSwipe: (direction: "left" | "right") => void;
  onTap: () => void;
  isTop: boolean;
  stackIndex: number; // 0 = front, 1 = behind, 2 = back
}

export function SwipeCard({ item, onSwipe, onTap, isTop, stackIndex }: SwipeCardProps) {
  const yesStamp = useRef(getRandomStamp("yes")).current;
  const noStamp = useRef(getRandomStamp("no")).current;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const yesOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const noOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const scale = 1 - stackIndex * 0.04;
  const y = stackIndex * 8;
  const opacity = 1 - stackIndex * 0.2;

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      onSwipe(info.offset.x > 0 ? "right" : "left");
    }
  }

  const posterUrl = getTmdbImageUrl(item.posterPath, "w500");
  const genreNames = item.genreIds.slice(0, 3).map(getGenreNameByTmdbId);

  return (
    <motion.div
      className="absolute w-full max-w-sm cursor-grab active:cursor-grabbing"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale,
        y,
        opacity,
        zIndex: 10 - stackIndex,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={isTop ? handleDragEnd : undefined}
      onTap={isTop ? onTap : undefined}
      exit={(custom) => ({
        x: custom?.direction === "left" ? -800 : 800,
        opacity: 0,
        rotate: custom?.direction === "left" ? -30 : 30,
        transition: { duration: 0.3 },
      })}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
        {/* Poster */}
        <div className="relative aspect-[2/3] w-full">
          {posterUrl ? (
            <img src={posterUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-neon-pink to-purple-800 text-white/30 text-sm">
              No Poster
            </div>
          )}
          {/* Stamp overlays */}
          {isTop && (
            <>
              <motion.div style={{ opacity: yesOpacity }}>
                <ClapperboardStamp type="yes" opacity={1} stamp={yesStamp} />
              </motion.div>
              <motion.div style={{ opacity: noOpacity }}>
                <ClapperboardStamp type="no" opacity={1} stamp={noStamp} />
              </motion.div>
            </>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-lg font-bold text-white">
            {item.title} <span className="text-white/40 font-normal">({item.year})</span>
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {genreNames.map((name) => (
              <span
                key={name}
                className="rounded-full bg-neon-pink/15 px-2.5 py-0.5 text-xs text-neon-pink"
              >
                {name}
              </span>
            ))}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/50">
            {item.overview}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shuffle/swipe-card.tsx
git commit -m "feat: add swipe card component with motion drag gestures and stamp overlay"
```

---

### Task 6: Action buttons component

**Files:**
- Create: `src/components/shuffle/action-buttons.tsx`

- [ ] **Step 1: Create action buttons with arc layout**

```typescript
import { X, RotateCcw, EyeOff, Check } from "lucide-react";

interface ActionButtonsProps {
  onNo: () => void;
  onUndo: () => void;
  onHide: () => void;
  onYes: () => void;
  canUndo: boolean;
}

export function ActionButtons({ onNo, onUndo, onHide, onYes, canUndo }: ActionButtonsProps) {
  return (
    <div className="flex items-end justify-center gap-3">
      <button
        type="button"
        onClick={onNo}
        className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-500 text-red-500 transition-colors hover:bg-red-500/10"
      >
        <X className="h-6 w-6" />
      </button>

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/40 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <RotateCcw className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onHide}
        className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/40 transition-colors hover:bg-white/5"
      >
        <EyeOff className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onYes}
        className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-500 text-green-500 transition-colors hover:bg-green-500/10"
      >
        <Check className="h-6 w-6" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shuffle/action-buttons.tsx
git commit -m "feat: add action buttons component with arc layout"
```

---

### Task 7: Match celebration component

**Files:**
- Create: `src/components/shuffle/match-celebration.tsx`

- [ ] **Step 1: Create red curtain match celebration modal**

```typescript
import { motion, AnimatePresence } from "motion/react";
import { useEffect } from "react";

interface MatchCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  posterPath: string | null;
  watchlistName: string;
}

export function MatchCelebration({
  isOpen,
  onClose,
  title,
  posterPath,
  watchlistName,
}: MatchCelebrationProps) {
  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="relative w-full max-w-sm px-6">
            {/* Curtain rod */}
            <motion.div
              className="mx-auto mb-0 h-2 w-64 rounded-full"
              style={{ background: "linear-gradient(to bottom, #fbbf24, #b45309)" }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3 }}
            />

            {/* Curtains */}
            <div className="relative overflow-hidden">
              {/* Left curtain */}
              <motion.div
                className="absolute left-0 top-0 bottom-0 z-10 w-1/2"
                style={{
                  background: "linear-gradient(to right, #7f1d1d, #dc2626 40%, #991b1b)",
                  borderRadius: "0 0 40% 0",
                }}
                initial={{ x: 0 }}
                animate={{ x: "-100%" }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeInOut" }}
              />
              {/* Right curtain */}
              <motion.div
                className="absolute right-0 top-0 bottom-0 z-10 w-1/2"
                style={{
                  background: "linear-gradient(to left, #7f1d1d, #dc2626 40%, #991b1b)",
                  borderRadius: "0 0 0 40%",
                }}
                initial={{ x: 0 }}
                animate={{ x: "100%" }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeInOut" }}
              />

              {/* Content behind curtains */}
              <motion.div
                className="flex flex-col items-center py-8"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <div className="text-xs tracking-[4px] text-amber-400/60">CURTAIN CALL</div>
                <div className="mt-1 text-3xl font-black text-amber-50" style={{ textShadow: "0 0 12px rgba(253,230,138,0.5)" }}>
                  MATCH!
                </div>
                <div className="mx-auto mt-1 h-px w-16" style={{ background: "linear-gradient(to right, transparent, #fbbf24, transparent)" }} />

                {posterPath && (
                  <img
                    src={`https://image.tmdb.org/t/p/w342${posterPath}`}
                    alt={title}
                    className="mt-4 h-40 w-28 rounded-lg border border-white/15 object-cover"
                  />
                )}

                <div className="mt-3 text-lg font-bold text-white">{title}</div>
                <div className="mt-1 text-sm text-white/50">
                  Added to <span className="text-purple-400">{watchlistName}</span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shuffle/match-celebration.tsx
git commit -m "feat: add red curtain match celebration modal"
```

---

### Task 8: Mode switcher component

**Files:**
- Create: `src/components/shuffle/mode-switcher.tsx`

- [ ] **Step 1: Create mode switcher dropdown**

```typescript
import { useTRPC } from "#/integrations/trpc/react";
import { useQuery } from "@tanstack/react-query";

interface ModeSwitcherProps {
  currentWatchlistId: string | null;
  shuffleWatchlistId: string;
  onSelect: (watchlistId: string) => void;
}

export function ModeSwitcher({ currentWatchlistId, shuffleWatchlistId, onSelect }: ModeSwitcherProps) {
  const trpc = useTRPC();
  const { data: watchlists } = useQuery(trpc.shuffle.getWatchlistOptions.queryOptions());

  const isSolo = !currentWatchlistId || currentWatchlistId === shuffleWatchlistId;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-white/40">Shuffling for</span>
      <select
        value={isSolo ? shuffleWatchlistId : currentWatchlistId}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white outline-none"
      >
        <option value={shuffleWatchlistId}>Just Me</option>
        {watchlists?.map((wl) => (
          <option key={wl.id} value={wl.id}>
            {wl.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shuffle/mode-switcher.tsx
git commit -m "feat: add mode switcher component for solo/group selection"
```

---

### Task 9: Card stack and shuffle page

**Files:**
- Create: `src/components/shuffle/card-stack.tsx`
- Create: `src/routes/app/shuffle.tsx`

- [ ] **Step 1: Create card stack component**

Manages the stack of cards, prefetching, swipe state, undo buffer, and match celebration.

```typescript
import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { useTRPC } from "#/integrations/trpc/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { FeedItem } from "#/lib/feed-assembler";
import { SwipeCard } from "./swipe-card";
import { ActionButtons } from "./action-buttons";
import { MatchCelebration } from "./match-celebration";

interface CardStackProps {
  watchlistId: string;
}

export function CardStack({ watchlistId }: CardStackProps) {
  const trpc = useTRPC();

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cards, setCards] = useState<FeedItem[]>([]);
  const [lastSwiped, setLastSwiped] = useState<{ item: FeedItem; action: string } | null>(null);
  const [matchData, setMatchData] = useState<{
    title: string;
    posterPath: string | null;
    watchlistName: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    ...trpc.shuffle.getFeed.queryOptions({ watchlistId, cursor }),
    enabled: cards.length < 5,
  });

  // Merge fetched items into cards when they arrive
  useEffect(() => {
    if (!data?.items || data.items.length === 0) return;
    setCards((prev) => {
      const existingIds = new Set(prev.map((c) => `${c.tmdbId}-${c.mediaType}`));
      const newItems = data.items.filter(
        (item) => !existingIds.has(`${item.tmdbId}-${item.mediaType}`),
      );
      return newItems.length > 0 ? [...prev, ...newItems] : prev;
    });
    if (data.nextCursor) setCursor(data.nextCursor);
  }, [data]);

  const swipeMutation = useMutation(trpc.shuffle.recordSwipe.mutationOptions());
  const undoMutation = useMutation(trpc.shuffle.undoSwipe.mutationOptions());

  const handleSwipe = useCallback(
    async (direction: "left" | "right") => {
      const item = cards[0];
      if (!item) return;

      const action = direction === "right" ? "yes" : "no";
      setLastSwiped({ item, action });
      setCards((prev) => prev.slice(1));

      const result = await swipeMutation.mutateAsync({
        watchlistId,
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        action: action as "yes" | "no",
      });

      if (result.match && "watchlistName" in result) {
        setMatchData({
          title: item.title,
          posterPath: item.posterPath,
          watchlistName: result.watchlistName as string,
        });
      }
    },
    [cards, watchlistId, swipeMutation],
  );

  const handleHide = useCallback(async () => {
    const item = cards[0];
    if (!item) return;

    setLastSwiped({ item, action: "hide" });
    setCards((prev) => prev.slice(1));

    await swipeMutation.mutateAsync({
      watchlistId,
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      action: "hide",
    });
  }, [cards, watchlistId, swipeMutation]);

  const handleUndo = useCallback(async () => {
    if (!lastSwiped) return;

    await undoMutation.mutateAsync({
      watchlistId,
      tmdbId: lastSwiped.item.tmdbId,
      mediaType: lastSwiped.item.mediaType,
    });

    setCards((prev) => [lastSwiped.item, ...prev]);
    setLastSwiped(null);
  }, [lastSwiped, watchlistId, undoMutation]);

  if (isLoading && cards.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-white/30">
        Loading your shuffle...
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center text-white/30">
        <p className="text-lg">No more titles to shuffle!</p>
        <p className="mt-2 text-sm">Check back later for fresh picks.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Card stack */}
      <div className="relative h-[500px] w-full max-w-sm">
        <AnimatePresence>
          {cards.slice(0, 3).map((item, index) => (
            <SwipeCard
              key={`${item.tmdbId}-${item.mediaType}`}
              item={item}
              onSwipe={handleSwipe}
              onTap={() => {
                // TODO: expand card detail view
              }}
              isTop={index === 0}
              stackIndex={index}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <ActionButtons
        onNo={() => handleSwipe("left")}
        onUndo={handleUndo}
        onHide={handleHide}
        onYes={() => handleSwipe("right")}
        canUndo={!!lastSwiped}
      />

      {/* Match celebration */}
      <MatchCelebration
        isOpen={!!matchData}
        onClose={() => setMatchData(null)}
        title={matchData?.title ?? ""}
        posterPath={matchData?.posterPath ?? null}
        watchlistName={matchData?.watchlistName ?? ""}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create shuffle route**

Create `src/routes/app/shuffle.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useTRPC } from "#/integrations/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { CardStack } from "#/components/shuffle/card-stack";
import { ModeSwitcher } from "#/components/shuffle/mode-switcher";
import { useState, useEffect } from "react";

const shuffleSearchSchema = z.object({
  watchlistId: z.string().optional(),
});

export const Route = createFileRoute("/app/shuffle")({
  validateSearch: (search) => shuffleSearchSchema.parse(search),
  component: ShufflePage,
});

function ShufflePage() {
  const { watchlistId: initialWatchlistId } = Route.useSearch();
  const trpc = useTRPC();

  // Get or create the user's shuffle watchlist
  const { data: shuffleWatchlist, isLoading } = useQuery(
    trpc.shuffle.getOrCreateShuffleWatchlist.queryOptions(),
  );

  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(
    initialWatchlistId ?? null,
  );

  // Default to shuffle watchlist once loaded
  useEffect(() => {
    if (!activeWatchlistId && shuffleWatchlist) {
      setActiveWatchlistId(shuffleWatchlist.id);
    }
  }, [shuffleWatchlist, activeWatchlistId]);

  if (isLoading || !shuffleWatchlist || !activeWatchlistId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/30">
        Setting up your shuffle...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col items-center gap-6">
        <ModeSwitcher
          currentWatchlistId={activeWatchlistId}
          shuffleWatchlistId={shuffleWatchlist.id}
          onSelect={setActiveWatchlistId}
        />

        <CardStack
          key={activeWatchlistId}
          watchlistId={activeWatchlistId}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/shuffle/card-stack.tsx src/routes/app/shuffle.tsx
git commit -m "feat: add card stack component and shuffle route page"
```

---

### Task 10: Nav link and watchlist button integration

**Files:**
- Modify: `src/routes/app/route.tsx`

- [ ] **Step 1: Add Shuffle link to navbar**

In `src/routes/app/route.tsx`, import `Shuffle` icon from lucide-react and add a nav link after the Search link:

```typescript
import { Search, Shuffle } from "lucide-react";
```

Add inside the `nav links` div, after the Search Link:

```tsx
<Link
  to="/app/shuffle"
  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-cream/50 no-underline transition-colors hover:bg-cream/5 hover:text-cream/80 [&.active]:text-neon-cyan [&.active]:bg-neon-cyan/8"
>
  <Shuffle className="h-3.5 w-3.5" />
  Shuffle
</Link>
```

- [ ] **Step 2: Verify in browser**

```bash
bun run dev
```

Navigate to `/app/shuffle` — should see the mode switcher and card stack loading.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/route.tsx
git commit -m "feat: add Shuffle nav link to app layout"
```

---

### Task 11: Watchlist detail "Showtime Shuffle" button

**Files:**
- Modify: `src/components/watchlist/watchlist-detail-header.tsx`

- [ ] **Step 1: Add Showtime Shuffle button to watchlist detail header**

In `src/components/watchlist/watchlist-detail-header.tsx`, add a Link button that navigates to the shuffle page with the watchlist ID:

```typescript
import { Link } from "@tanstack/react-router";
import { Shuffle } from "lucide-react";
```

Add the button near the existing action buttons in the header:

```tsx
<Link
  to="/app/shuffle"
  search={{ watchlistId: watchlist.id }}
  className="flex items-center gap-1.5 rounded-lg border border-neon-pink/30 bg-neon-pink/10 px-3 py-1.5 text-sm font-medium text-neon-pink no-underline transition-colors hover:bg-neon-pink/20"
>
  <Shuffle className="h-3.5 w-3.5" />
  Showtime Shuffle
</Link>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/watchlist/watchlist-detail-header.tsx
git commit -m "feat: add Showtime Shuffle button to watchlist detail page"
```

---

### Task 12: Card detail expand view

**Files:**
- Create: `src/components/shuffle/card-detail-modal.tsx`
- Modify: `src/components/shuffle/card-stack.tsx`

- [ ] **Step 1: Create card detail modal**

A modal that shows expanded info when tapping a card. Uses the existing title detail page's data pattern via TMDB.

```typescript
import { motion, AnimatePresence } from "motion/react";
import type { FeedItem } from "#/lib/feed-assembler";
import { getTmdbImageUrl } from "#/lib/tmdb";
import { getGenreNameByTmdbId } from "#/lib/genre-map";

interface CardDetailModalProps {
  item: FeedItem | null;
  onClose: () => void;
}

export function CardDetailModal({ item, onClose }: CardDetailModalProps) {
  if (!item) return null;

  const posterUrl = getTmdbImageUrl(item.posterPath, "w500");
  const genreNames = item.genreIds.map(getGenreNameByTmdbId);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[#1a1a2e] sm:rounded-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {posterUrl && (
              <img src={posterUrl} alt={item.title} className="h-72 w-full object-cover" />
            )}
            <div className="p-5">
              <h2 className="text-xl font-bold text-white">
                {item.title} <span className="text-white/40 font-normal">({item.year})</span>
              </h2>
              <div className="mt-2 flex items-center gap-3 text-sm text-white/50">
                <span>⭐ {item.rating.toFixed(1)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {genreNames.map((name) => (
                  <span key={name} className="rounded-full bg-neon-pink/15 px-2.5 py-0.5 text-xs text-neon-pink">
                    {name}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/60">{item.overview}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Wire up in CardStack**

In `src/components/shuffle/card-stack.tsx`, add state and the modal:

```typescript
import { CardDetailModal } from "./card-detail-modal";

// Add state:
const [detailItem, setDetailItem] = useState<FeedItem | null>(null);

// Update onTap:
onTap={() => setDetailItem(cards[0])}

// Add modal in JSX after MatchCelebration:
<CardDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shuffle/card-detail-modal.tsx src/components/shuffle/card-stack.tsx
git commit -m "feat: add card detail modal for expanded title info"
```

---

### Task 13: Match toast notifications

**Files:**
- Create: `src/components/shuffle/match-toast.tsx`
- Modify: `src/components/shuffle/card-stack.tsx`

- [ ] **Step 1: Add match toast using Sonner**

The app already uses Sonner for toasts. For the triggering user, the match celebration modal handles it. For polling recent matches (when another member triggers it), add a lightweight query.

In the shuffle router (`src/integrations/trpc/routers/shuffle.ts`), add a `getRecentMatches` procedure:

```typescript
getRecentMatches: protectedProcedure
  .input(z.object({ watchlistId: z.string() }))
  .query(async ({ ctx, input }) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentItems = await db.query.watchlistItem.findMany({
      where: and(
        eq(watchlistItem.watchlistId, input.watchlistId),
        // Items added by someone else (not the current user)
        not(eq(watchlistItem.addedBy, ctx.userId)),
      ),
    });
    // Filter to recent items (added in the last hour)
    return recentItems.filter((item) => new Date(item.createdAt) > oneHourAgo);
  }),
```

- [ ] **Step 2: Poll and show toast in CardStack**

In `src/components/shuffle/card-stack.tsx`, add polling for recent matches:

```typescript
import { toast } from "sonner";

// Add query that polls every 30 seconds (only in group mode):
const { data: recentMatches } = useQuery({
  ...trpc.shuffle.getRecentMatches.queryOptions({ watchlistId }),
  refetchInterval: 30000,
  enabled: watchlistId !== shuffleWatchlistId, // only in group mode
});

// Show toast for new matches (use a ref to track seen matches):
const seenMatches = useRef(new Set<string>());
useEffect(() => {
  if (!recentMatches) return;
  for (const match of recentMatches) {
    const key = `${match.tmdbId}-${match.mediaType}`;
    if (!seenMatches.current.has(key)) {
      seenMatches.current.add(key);
      toast("🎬 New match!", { description: "A title was matched in your group watchlist!" });
    }
  }
}, [recentMatches]);
```

Note: This is a simple polling approach. A more sophisticated solution would use WebSockets, but polling is sufficient for the initial implementation.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/shuffle.ts src/components/shuffle/card-stack.tsx
git commit -m "feat: add match toast notifications via polling for group members"
```

---

### Task 14: Manual testing and polish

- [ ] **Step 1: Test solo shuffle flow**

1. Open `/app/shuffle`
2. Verify cards load with posters, titles, genres, synopsis
3. Swipe right — check clapperboard stamp appears, card flies off
4. Swipe left — check red stamp appears, card flies off
5. Click undo — card returns
6. Click hide button — card removed
7. Verify "yes" items appear in Showtime Shuffle watchlist

- [ ] **Step 2: Test group shuffle flow**

1. Create a group watchlist with members (from watchlist page)
2. Navigate to `/app/shuffle?watchlistId=<group-id>`
3. Swipe right on a title
4. Switch to another user, swipe right on the same title
5. Verify match celebration appears
6. Verify item added to group watchlist

- [ ] **Step 3: Fix any issues discovered during testing**

Address UI glitches, animation timing, responsive layout issues.

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "fix: polish shuffle UI and fix issues from manual testing"
```
