# TV Show Watch Time Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculate accurate watch time for TV shows by letting users select which seasons they've watched, computing runtime from per-season episode counts.

**Architecture:** Add `watchedSeasons` column to `watchlistItem`. Extract per-season episode counts from TMDB's existing TV detail response. When a user marks a TV show watched, show a season picker modal; on confirm, compute `runtime = episodeRuntime × totalEpisodesInSelectedSeasons` and store both `watchedSeasons` and the computed `runtime`. Movies are unchanged.

**Tech Stack:** Drizzle ORM (schema + push), tRPC (backend mutations), React + Radix Dialog/Checkbox (season picker UI), Vitest (tests)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/db/schema.ts` | Modify | Add `watchedSeasons` jsonb column to `watchlistItem` |
| `src/lib/tmdb-title.ts` | Modify | Extract per-season data from TMDB TV detail, add to `TitleData` |
| `src/integrations/trpc/routers/watchlist.ts` | Modify | Update `quickMarkWatched` to accept `watchedSeasons` + compute runtime |
| `src/components/watched/season-picker-modal.tsx` | Create | Season picker dialog with checkboxes and select-all |
| `src/components/title/title-actions.tsx` | Modify | Wire season picker into TV show watched flow |
| `src/routes/app/title.$mediaType.$tmdbId.tsx` | Modify | Pass season data to `TitleActions` |
| `src/integrations/trpc/__tests__/watchlist.test.ts` | Modify | Add tests for updated `quickMarkWatched` |
| `src/lib/__tests__/tmdb-title.test.ts` | Create | Test season data extraction |

---

### Task 1: Add `watchedSeasons` column to schema

**Files:**
- Modify: `src/db/schema.ts:154-182`

- [ ] **Step 1: Add the column**

In `src/db/schema.ts`, add `watchedSeasons` to the `watchlistItem` table definition, after the `runtime` column:

```typescript
watchedSeasons: jsonb("watched_seasons").$type<number[]>(),
```

- [ ] **Step 2: Push schema change**

Run: `bun drizzle-kit push`
Expected: Schema applied successfully, new `watched_seasons` column on `watchlist_item` table.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add watchedSeasons column to watchlistItem schema"
```

---

### Task 2: Extract per-season data from TMDB

**Files:**
- Modify: `src/lib/tmdb-title.ts:19-34` (TmdbTvDetail interface), `src/lib/tmdb-title.ts:76-101` (TitleData interface), `src/lib/tmdb-title.ts:213-242` (TV return block)
- Create: `src/lib/__tests__/tmdb-title.test.ts`

TMDB's `/tv/{id}` response already includes a `seasons` array with objects like `{ season_number: 1, episode_count: 13, name: "Season 1" }`. We just need to type it and pass it through.

- [ ] **Step 1: Write failing test for season data extraction**

Create `src/lib/__tests__/tmdb-title.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

// Mock the tmdb fetch module
const mockTmdbFetch = vi.fn();
vi.mock("#/lib/tmdb", () => ({
  tmdbFetch: (...args: unknown[]) => mockTmdbFetch(...args),
}));

import { fetchTitleDetails } from "#/lib/tmdb-title";

// Helper to build a minimal TV detail response
function makeTvDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 1399,
    name: "Breaking Bad",
    tagline: "",
    overview: "A chemistry teacher turns to making meth.",
    first_air_date: "2008-01-20",
    vote_average: 8.9,
    episode_run_time: [47],
    number_of_seasons: 5,
    number_of_episodes: 62,
    status: "Ended",
    genres: [{ id: 18, name: "Drama" }],
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    created_by: [{ name: "Vince Gilligan" }],
    seasons: [
      { season_number: 0, episode_count: 11, name: "Specials" },
      { season_number: 1, episode_count: 7, name: "Season 1" },
      { season_number: 2, episode_count: 13, name: "Season 2" },
      { season_number: 3, episode_count: 13, name: "Season 3" },
      { season_number: 4, episode_count: 13, name: "Season 4" },
      { season_number: 5, episode_count: 16, name: "Season 5" },
    ],
    ...overrides,
  };
}

function makeCredits() {
  return { cast: [], crew: [] };
}
function makeVideos() {
  return { results: [] };
}
function makeContentRatings() {
  return { results: [] };
}

describe("fetchTitleDetails — TV season data", () => {
  it("returns seasonList with season numbers, episode counts, and names", async () => {
    const tvDetail = makeTvDetail();
    mockTmdbFetch
      .mockResolvedValueOnce(tvDetail) // /tv/1399
      .mockResolvedValueOnce(makeCredits()) // /tv/1399/credits
      .mockResolvedValueOnce(makeVideos()) // /tv/1399/videos
      .mockResolvedValueOnce(makeContentRatings()); // /tv/1399/content_ratings

    const result = await fetchTitleDetails("tv", 1399);

    expect(result.seasonList).toEqual([
      { seasonNumber: 0, episodeCount: 11, name: "Specials" },
      { seasonNumber: 1, episodeCount: 7, name: "Season 1" },
      { seasonNumber: 2, episodeCount: 13, name: "Season 2" },
      { seasonNumber: 3, episodeCount: 13, name: "Season 3" },
      { seasonNumber: 4, episodeCount: 13, name: "Season 4" },
      { seasonNumber: 5, episodeCount: 16, name: "Season 5" },
    ]);
  });

  it("returns undefined seasonList for movies", async () => {
    const movieDetail = {
      id: 550,
      title: "Fight Club",
      tagline: "",
      overview: "An insomniac office worker...",
      release_date: "1999-10-15",
      runtime: 139,
      vote_average: 8.4,
      genres: [{ id: 18, name: "Drama" }],
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
    };
    mockTmdbFetch
      .mockResolvedValueOnce(movieDetail)
      .mockResolvedValueOnce(makeCredits())
      .mockResolvedValueOnce(makeVideos())
      .mockResolvedValueOnce({ results: [] }); // release_dates

    const result = await fetchTitleDetails("movie", 550);

    expect(result.seasonList).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/__tests__/tmdb-title.test.ts`
Expected: FAIL — `seasonList` property doesn't exist on `TitleData`.

- [ ] **Step 3: Add seasons array to TmdbTvDetail interface**

In `src/lib/tmdb-title.ts`, add to the `TmdbTvDetail` interface (after `created_by`):

```typescript
seasons: Array<{
  season_number: number;
  episode_count: number;
  name: string;
}>;
```

- [ ] **Step 4: Add seasonList to TitleData interface**

In `src/lib/tmdb-title.ts`, add to the `TitleData` interface (after `status`):

```typescript
seasonList?: Array<{
  seasonNumber: number;
  episodeCount: number;
  name: string;
}>;
```

- [ ] **Step 5: Return seasonList in the TV branch of fetchTitleDetails**

In the TV show return block (after `status: tv.status`), add:

```typescript
seasonList: tv.seasons.map((s) => ({
  seasonNumber: s.season_number,
  episodeCount: s.episode_count,
  name: s.name,
})),
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test src/lib/__tests__/tmdb-title.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/tmdb-title.ts src/lib/__tests__/tmdb-title.test.ts
git commit -m "feat: extract per-season data from TMDB TV detail response"
```

---

### Task 3: Update `quickMarkWatched` to accept seasons and compute runtime

**Files:**
- Modify: `src/integrations/trpc/routers/watchlist.ts:598-652`
- Modify: `src/integrations/trpc/__tests__/watchlist.test.ts`

The mutation needs to:
1. Accept optional `watchedSeasons` (number array) and `seasonEpisodeCounts` (array of `{ seasonNumber, episodeCount }`)
2. For TV shows: compute `runtime = episodeRuntime × sum(episodeCounts for selected seasons)`
3. Store both `watchedSeasons` and computed `runtime` on the watchlist item
4. For unwatching (already watched → toggle off): clear `watchedSeasons` and `runtime`

- [ ] **Step 1: Write failing test for TV show marking with seasons**

Add to `src/integrations/trpc/__tests__/watchlist.test.ts`:

```typescript
describe("watchlist.quickMarkWatched", () => {
  it("stores watchedSeasons and computed runtime for TV shows", async () => {
    // getOrCreateDefaultWatchlist: findFirst returns existing
    mockQueryWatchlistFindFirst.mockResolvedValueOnce({ id: WATCHLIST_ID });

    // insert().values().onConflictDoNothing() — item upsert
    mockOnConflictDoNothing.mockResolvedValueOnce(undefined);

    // query.watchlistItem.findFirst — item not yet watched
    mockQueryWatchlistItemFindFirst.mockResolvedValueOnce({ watched: false });

    // update().set().where() — mark watched
    mockWhere.mockResolvedValueOnce(undefined);

    const caller = createCaller(OWNER_ID);
    const result = await caller.watchlist.quickMarkWatched({
      tmdbId: 1399,
      mediaType: "tv",
      titleName: "Breaking Bad",
      runtime: 47,
      watchedSeasons: [1, 2, 3],
      seasonEpisodeCounts: [
        { seasonNumber: 1, episodeCount: 7 },
        { seasonNumber: 2, episodeCount: 13 },
        { seasonNumber: 3, episodeCount: 13 },
      ],
    });

    expect(result.watched).toBe(true);
    // Verify update was called with computed runtime: 47 * (7 + 13 + 13) = 1551
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        watched: true,
        runtime: 1551,
        watchedSeasons: [1, 2, 3],
      }),
    );
  });

  it("clears watchedSeasons and runtime when unwatching TV show", async () => {
    // getOrCreateDefaultWatchlist
    mockQueryWatchlistFindFirst.mockResolvedValueOnce({ id: WATCHLIST_ID });

    // insert().values().onConflictDoNothing()
    mockOnConflictDoNothing.mockResolvedValueOnce(undefined);

    // query.watchlistItem.findFirst — already watched
    mockQueryWatchlistItemFindFirst.mockResolvedValueOnce({ watched: true });

    // update().set().where()
    mockWhere.mockResolvedValueOnce(undefined);

    const caller = createCaller(OWNER_ID);
    const result = await caller.watchlist.quickMarkWatched({
      tmdbId: 1399,
      mediaType: "tv",
      titleName: "Breaking Bad",
    });

    expect(result.watched).toBe(false);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        watched: false,
        runtime: null,
        watchedSeasons: null,
      }),
    );
  });

  it("stores plain runtime for movies (no watchedSeasons)", async () => {
    // getOrCreateDefaultWatchlist
    mockQueryWatchlistFindFirst.mockResolvedValueOnce({ id: WATCHLIST_ID });

    // insert().values().onConflictDoNothing()
    mockOnConflictDoNothing.mockResolvedValueOnce(undefined);

    // query.watchlistItem.findFirst — not watched
    mockQueryWatchlistItemFindFirst.mockResolvedValueOnce({ watched: false });

    // update().set().where()
    mockWhere.mockResolvedValueOnce(undefined);

    const caller = createCaller(OWNER_ID);
    const result = await caller.watchlist.quickMarkWatched({
      tmdbId: 550,
      mediaType: "movie",
      runtime: 139,
    });

    expect(result.watched).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        watched: true,
        runtime: 139,
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/integrations/trpc/__tests__/watchlist.test.ts`
Expected: FAIL — `watchedSeasons` and `seasonEpisodeCounts` not accepted by input schema.

- [ ] **Step 3: Update quickMarkWatched input schema and logic**

In `src/integrations/trpc/routers/watchlist.ts`, replace the `quickMarkWatched` procedure (lines 598-652):

```typescript
quickMarkWatched: protectedProcedure
  .input(
    z.object({
      tmdbId: z.number(),
      mediaType: z.enum(["movie", "tv"]),
      titleName: z.string().optional(),
      posterPath: z.string().nullish(),
      runtime: z.number().optional(),
      watchedSeasons: z.array(z.number()).optional(),
      seasonEpisodeCounts: z
        .array(
          z.object({
            seasonNumber: z.number(),
            episodeCount: z.number(),
          }),
        )
        .optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const defaultWl = await getOrCreateDefaultWatchlist(ctx.userId);

    // Add item if not already there
    await db
      .insert(watchlistItem)
      .values({
        watchlistId: defaultWl.id,
        tmdbId: input.tmdbId,
        mediaType: input.mediaType,
        title: input.titleName,
        posterPath: input.posterPath ?? null,
        addedBy: ctx.userId,
        runtime: input.runtime ?? null,
      })
      .onConflictDoNothing();

    // Get current watched state
    const item = await db.query.watchlistItem.findFirst({
      where: and(
        eq(watchlistItem.watchlistId, defaultWl.id),
        eq(watchlistItem.tmdbId, input.tmdbId),
        eq(watchlistItem.mediaType, input.mediaType),
      ),
      columns: { watched: true },
    });

    const newWatched = !item?.watched;

    // Compute runtime for TV shows based on selected seasons
    let computedRuntime: number | null = input.runtime ?? null;
    if (
      newWatched &&
      input.watchedSeasons &&
      input.seasonEpisodeCounts &&
      input.runtime
    ) {
      const selectedSet = new Set(input.watchedSeasons);
      const totalEpisodes = input.seasonEpisodeCounts
        .filter((s) => selectedSet.has(s.seasonNumber))
        .reduce((sum, s) => sum + s.episodeCount, 0);
      computedRuntime = input.runtime * totalEpisodes;
    }

    await db
      .update(watchlistItem)
      .set({
        watched: newWatched,
        runtime: newWatched ? computedRuntime : null,
        watchedSeasons: newWatched ? (input.watchedSeasons ?? null) : null,
      })
      .where(
        and(
          eq(watchlistItem.watchlistId, defaultWl.id),
          eq(watchlistItem.tmdbId, input.tmdbId),
          eq(watchlistItem.mediaType, input.mediaType),
        ),
      );

    return { watched: newWatched };
  }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/integrations/trpc/__tests__/watchlist.test.ts`
Expected: PASS

- [ ] **Step 5: Run all tests to check for regressions**

Run: `bun run test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts src/integrations/trpc/__tests__/watchlist.test.ts
git commit -m "feat: compute TV show runtime from selected seasons in quickMarkWatched"
```

---

### Task 4: Create the season picker modal component

**Files:**
- Create: `src/components/watched/season-picker-modal.tsx`

This modal matches the existing drive-in aesthetic used in the review modal. It uses Radix Dialog + Checkbox primitives already in the project.

- [ ] **Step 1: Create the season picker modal**

Create `src/components/watched/season-picker-modal.tsx`:

```tsx
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "#/components/ui/checkbox";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";

interface Season {
  seasonNumber: number;
  episodeCount: number;
  name: string;
}

interface SeasonPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleName: string;
  seasons: Season[];
  /** Pre-selected season numbers (for editing) */
  initialSelected?: number[];
  onConfirm: (selectedSeasons: number[]) => void;
  isPending?: boolean;
}

export function SeasonPickerModal({
  open,
  onOpenChange,
  titleName,
  seasons,
  initialSelected,
  onConfirm,
  isPending,
}: SeasonPickerModalProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initialSelected ?? []),
  );

  // Reset selection when modal opens
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSelected(new Set(initialSelected ?? []));
    }
    onOpenChange(nextOpen);
  }

  // Filter out season 0 (Specials) from the main list — most users don't watch specials
  const regularSeasons = seasons.filter((s) => s.seasonNumber > 0);
  const allSelected = regularSeasons.every((s) => selected.has(s.seasonNumber));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(regularSeasons.map((s) => s.seasonNumber)));
    }
  }

  function toggleSeason(seasonNumber: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) {
        next.delete(seasonNumber);
      } else {
        next.add(seasonNumber);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (selected.size === 0) return;
    onConfirm(Array.from(selected).sort((a, b) => a - b));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[360px] flex flex-col items-center">
            {/* Marquee header */}
            <div className="w-[calc(100%-16px)] border-2 border-neon-cyan/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(0,229,255,0.08)] relative">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="absolute top-2.5 right-3 p-1 text-cream/25 hover:text-cream/60 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex justify-center gap-3 mb-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={`dot-${i.toString()}`}
                    className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_4px_1px_rgba(0,229,255,0.6)] animate-[chase_1.2s_infinite]"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <div className="font-display text-2xl text-cream tracking-wide">
                Seasons Watched
              </div>
              <div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-cyan/55 mt-0.5 truncate">
                {titleName}
              </div>
            </div>

            {/* Modal card */}
            <div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan/80 to-transparent shadow-[0_0_10px_rgba(0,229,255,0.4)]" />

              <div className="p-5 flex flex-col gap-4 relative">
                {/* Select All */}
                <label className="flex items-center gap-3 px-3 py-2 rounded-md bg-neon-cyan/[0.04] border border-neon-cyan/15 cursor-pointer hover:border-neon-cyan/30 transition-colors duration-200">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    className="border-neon-cyan/40 data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
                  />
                  <span className="font-mono-retro text-xs tracking-[2px] uppercase text-neon-cyan/70">
                    Select All
                  </span>
                </label>

                {/* Season list */}
                <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto scrollbar-amber pr-1">
                  {regularSeasons.map((season) => (
                    <label
                      key={season.seasonNumber}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-cream/[0.03] cursor-pointer transition-colors duration-200"
                    >
                      <Checkbox
                        checked={selected.has(season.seasonNumber)}
                        onCheckedChange={() =>
                          toggleSeason(season.seasonNumber)
                        }
                        className="border-cream/20 data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-cream/80">
                          {season.name}
                        </span>
                        <span className="text-xs text-cream/30 ml-2">
                          {season.episodeCount} episodes
                        </span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Confirm button */}
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={selected.size === 0 || isPending}
                  className="w-full py-3 px-6 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-base tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Confirm"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/watched/season-picker-modal.tsx
git commit -m "feat: add season picker modal component"
```

---

### Task 5: Wire season picker into the title page watch flow

**Files:**
- Modify: `src/routes/app/title.$mediaType.$tmdbId.tsx:118-126`
- Modify: `src/components/title/title-actions.tsx`

This task connects the season picker into the existing flow: for TV shows, clicking "Watched" opens the season picker first, then on confirm calls `quickMarkWatched` with season data and opens the review modal. For movies, the flow is unchanged.

- [ ] **Step 1: Pass seasonList to TitleActions**

In `src/routes/app/title.$mediaType.$tmdbId.tsx`, update the `TitleActions` usage to pass the new prop:

```tsx
<TitleActions
  tmdbId={tmdbId}
  mediaType={mediaType}
  title={data.title}
  posterPath={data.posterPath}
  runtime={data.runtimeMinutes}
  year={data.year}
  reviewEventId={reviewEventId}
  seasonList={data.seasonList}
/>
```

- [ ] **Step 2: Update TitleActions to accept seasonList and show season picker for TV**

In `src/components/title/title-actions.tsx`:

Add to the imports:

```typescript
import { SeasonPickerModal } from "#/components/watched/season-picker-modal";
```

Update the `TitleActionsProps` interface — add after `reviewEventId`:

```typescript
seasonList?: Array<{
  seasonNumber: number;
  episodeCount: number;
  name: string;
}>;
```

Update the component destructuring to include `seasonList`:

```typescript
export function TitleActions({
  tmdbId,
  mediaType,
  title,
  posterPath,
  runtime,
  year,
  reviewEventId,
  seasonList,
}: TitleActionsProps) {
```

Add state for the season picker (alongside existing state declarations):

```typescript
const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
```

Replace the `handleWatched` function:

```typescript
function handleWatched() {
  // For TV shows that aren't yet watched, open season picker
  if (mediaType === "tv" && !isWatched && seasonList) {
    setSeasonPickerOpen(true);
    return;
  }

  // Movies or unwatching: use existing quick toggle
  quickWatchedMutation.mutate({
    tmdbId,
    mediaType,
    titleName: title,
    posterPath,
    runtime: runtime ?? undefined,
  });
}

function handleSeasonConfirm(selectedSeasons: number[]) {
  quickWatchedMutation.mutate(
    {
      tmdbId,
      mediaType,
      titleName: title,
      posterPath,
      runtime: runtime ?? undefined,
      watchedSeasons: selectedSeasons,
      seasonEpisodeCounts: seasonList?.map((s) => ({
        seasonNumber: s.seasonNumber,
        episodeCount: s.episodeCount,
      })),
    },
    {
      onSuccess: () => {
        setSeasonPickerOpen(false);
      },
    },
  );
}
```

Add the `SeasonPickerModal` to the JSX (before the closing `</>`, alongside existing modals):

```tsx
{seasonList && (
  <SeasonPickerModal
    open={seasonPickerOpen}
    onOpenChange={setSeasonPickerOpen}
    titleName={title}
    seasons={seasonList}
    onConfirm={handleSeasonConfirm}
    isPending={quickWatchedMutation.isPending}
  />
)}
```

- [ ] **Step 3: Verify it compiles**

Run: `bun run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Run all tests to check for regressions**

Run: `bun run test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/app/title.$mediaType.$tmdbId.tsx src/components/title/title-actions.tsx
git commit -m "feat: wire season picker into TV show watched flow"
```

---

### Task 6: Handle editing seasons on already-watched TV shows

**Files:**
- Modify: `src/components/title/title-actions.tsx`
- Modify: `src/integrations/trpc/routers/watchlist.ts` (isWatched query)

When a user has already marked a TV show as watched and clicks "Watched" again, we want to unwatch. But they should also be able to edit which seasons they've watched. We'll add an "Edit Seasons" button that appears in the watch history area when the show is marked watched.

- [ ] **Step 1: Update isWatched to return watchedSeasons**

In `src/integrations/trpc/routers/watchlist.ts`, update the `isWatched` query to return the season data instead of just a boolean:

```typescript
isWatched: protectedProcedure
  .input(
    z.object({
      tmdbId: z.number(),
      mediaType: z.enum(["movie", "tv"]),
    }),
  )
  .query(async ({ input, ctx }) => {
    const defaultWl = await getOrCreateDefaultWatchlist(ctx.userId);

    const item = await db.query.watchlistItem.findFirst({
      where: and(
        eq(watchlistItem.watchlistId, defaultWl.id),
        eq(watchlistItem.tmdbId, input.tmdbId),
        eq(watchlistItem.mediaType, input.mediaType),
        eq(watchlistItem.watched, true),
      ),
      columns: { watched: true, watchedSeasons: true },
    });

    if (!item) return null;
    return {
      watched: true,
      watchedSeasons: item.watchedSeasons as number[] | null,
    };
  }),
```

- [ ] **Step 2: Update TitleActions to handle the new isWatched shape**

In `src/components/title/title-actions.tsx`, update the code that uses `isWatched`:

The `isWatched` query now returns `null` (not watched) or `{ watched: true, watchedSeasons: number[] | null }`.

Update the `handleWatched` function:

```typescript
function handleWatched() {
  // For TV shows that aren't yet watched, open season picker
  if (mediaType === "tv" && !isWatched && seasonList) {
    setSeasonPickerOpen(true);
    return;
  }

  // Movies or unwatching: use existing quick toggle
  quickWatchedMutation.mutate({
    tmdbId,
    mediaType,
    titleName: title,
    posterPath,
    runtime: runtime ?? undefined,
  });
}
```

Update the `ArcadeButton` for watched to use the new shape:

```tsx
<ArcadeButton
  icon={Check}
  label="Watched"
  color="cyan"
  active={isWatched !== null}
  onClick={handleWatched}
/>
```

Add an "Edit Seasons" button in the watch history section (after the watch events list, inside the `watchEvents && watchEvents.length > 0` block). Only show for TV shows that have been watched:

```tsx
{mediaType === "tv" && isWatched && seasonList && (
  <button
    type="button"
    onClick={() => setSeasonPickerOpen(true)}
    className="mt-2 w-full font-mono-retro text-[10px] tracking-[2px] uppercase text-neon-cyan/40 hover:text-neon-cyan/70 transition-colors duration-200 py-1.5 text-center"
  >
    Edit Seasons Watched
  </button>
)}
```

Update the `SeasonPickerModal` to pass `initialSelected` when editing:

```tsx
{seasonList && (
  <SeasonPickerModal
    open={seasonPickerOpen}
    onOpenChange={setSeasonPickerOpen}
    titleName={title}
    seasons={seasonList}
    initialSelected={isWatched?.watchedSeasons ?? undefined}
    onConfirm={handleSeasonConfirm}
    isPending={quickWatchedMutation.isPending}
  />
)}
```

Note: When editing seasons, `handleSeasonConfirm` calls `quickMarkWatched` which currently toggles watched state. Since the item is already watched, this would toggle it off. We need to handle this case — if `watchedSeasons` is provided and the item is already watched, update seasons instead of toggling. Update the `quickMarkWatched` procedure:

- [ ] **Step 3: Update quickMarkWatched to support season editing**

In `src/integrations/trpc/routers/watchlist.ts`, update the `quickMarkWatched` mutation. After getting the current watched state and before the update, add a branch for editing seasons on already-watched items:

Replace the toggle logic section (from `const newWatched = !item?.watched;` through the `return`):

```typescript
// If already watched and seasons provided, update seasons (don't toggle)
const isSeasonEdit =
  item?.watched && input.watchedSeasons && input.watchedSeasons.length > 0;
const newWatched = isSeasonEdit ? true : !item?.watched;

// Compute runtime for TV shows based on selected seasons
let computedRuntime: number | null = input.runtime ?? null;
if (
  newWatched &&
  input.watchedSeasons &&
  input.seasonEpisodeCounts &&
  input.runtime
) {
  const selectedSet = new Set(input.watchedSeasons);
  const totalEpisodes = input.seasonEpisodeCounts
    .filter((s) => selectedSet.has(s.seasonNumber))
    .reduce((sum, s) => sum + s.episodeCount, 0);
  computedRuntime = input.runtime * totalEpisodes;
}

await db
  .update(watchlistItem)
  .set({
    watched: newWatched,
    runtime: newWatched ? computedRuntime : null,
    watchedSeasons: newWatched ? (input.watchedSeasons ?? null) : null,
  })
  .where(
    and(
      eq(watchlistItem.watchlistId, defaultWl.id),
      eq(watchlistItem.tmdbId, input.tmdbId),
      eq(watchlistItem.mediaType, input.mediaType),
    ),
  );

return { watched: newWatched };
```

- [ ] **Step 4: Add test for season editing**

Add to `src/integrations/trpc/__tests__/watchlist.test.ts`:

```typescript
it("updates seasons without toggling watched off when editing", async () => {
  // getOrCreateDefaultWatchlist
  mockQueryWatchlistFindFirst.mockResolvedValueOnce({ id: WATCHLIST_ID });

  // insert().values().onConflictDoNothing()
  mockOnConflictDoNothing.mockResolvedValueOnce(undefined);

  // query.watchlistItem.findFirst — already watched
  mockQueryWatchlistItemFindFirst.mockResolvedValueOnce({ watched: true });

  // update().set().where()
  mockWhere.mockResolvedValueOnce(undefined);

  const caller = createCaller(OWNER_ID);
  const result = await caller.watchlist.quickMarkWatched({
    tmdbId: 1399,
    mediaType: "tv",
    titleName: "Breaking Bad",
    runtime: 47,
    watchedSeasons: [1, 2, 3, 4, 5],
    seasonEpisodeCounts: [
      { seasonNumber: 1, episodeCount: 7 },
      { seasonNumber: 2, episodeCount: 13 },
      { seasonNumber: 3, episodeCount: 13 },
      { seasonNumber: 4, episodeCount: 13 },
      { seasonNumber: 5, episodeCount: 16 },
    ],
  });

  expect(result.watched).toBe(true);
  // 47 * (7 + 13 + 13 + 13 + 16) = 47 * 62 = 2914
  expect(mockSet).toHaveBeenCalledWith(
    expect.objectContaining({
      watched: true,
      runtime: 2914,
      watchedSeasons: [1, 2, 3, 4, 5],
    }),
  );
});
```

- [ ] **Step 5: Run all tests**

Run: `bun run test`
Expected: All tests pass.

- [ ] **Step 6: Verify build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts src/integrations/trpc/__tests__/watchlist.test.ts src/components/title/title-actions.tsx
git commit -m "feat: support editing watched seasons on already-watched TV shows"
```

---

### Task 7: Manual testing and cleanup

**Files:**
- No new files

- [ ] **Step 1: Push schema change**

Run: `bun drizzle-kit push`
Expected: Schema is up to date (or applies if not already done).

- [ ] **Step 2: Start the dev server and verify flows**

Run: `bun run dev`

Test these scenarios in the browser:
1. Navigate to a TV show page (e.g., Breaking Bad)
2. Click "Watched" → season picker should appear
3. Select some seasons → click Confirm → review modal should open
4. Check profile page → watch time should reflect selected seasons
5. Go back to the TV show → click "Edit Seasons Watched" → picker opens with previous selection
6. Update seasons → confirm → watch time should update
7. Click "Watched" on the already-watched show → should unwatch (no picker)
8. Navigate to a movie page → click "Watched" → should work as before (no picker)

- [ ] **Step 3: Commit any final fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
