# Episode & Season Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TV show episode tracker with progress tracking, journal entries, scoped reviews, and unified watch time.

**Architecture:** New `episodeWatch` and `journalEntry` DB tables. New tRPC routers for episode tracking and journal entries. Two new route pages (tracker dashboard + show tracker). TMDB season endpoint for episode-level data. Modifications to watch time calculation, feed query, title page actions, and watchEvent schema for scoped reviews.

**Tech Stack:** Drizzle ORM, tRPC, TanStack Router, TanStack Query, React, Tailwind CSS, shadcn/ui, TMDB API

**Spec:** `docs/superpowers/specs/2026-04-02-episode-tracker-design.md`

---

### Task 1: Database Schema — New Tables

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `episodeWatch` table to schema**

Add after the `watchEventCompanion` table definition (line ~436):

```typescript
export const episodeWatch = pgTable(
	"episode_watch",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		seasonNumber: integer("season_number").notNull(),
		episodeNumber: integer("episode_number").notNull(),
		runtime: integer("runtime").notNull(),
		watchedAt: timestamp("watched_at").defaultNow().notNull(),
		watchEventId: text("watch_event_id").references(() => watchEvent.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("episode_watch_unique").on(
			table.userId,
			table.tmdbId,
			table.seasonNumber,
			table.episodeNumber,
		),
		index("episode_watch_userId_idx").on(table.userId),
		index("episode_watch_tmdbId_idx").on(table.userId, table.tmdbId),
	],
);
```

- [ ] **Step 2: Add `journalEntry` table to schema**

Add after the `episodeWatch` table:

```typescript
export const journalEntry = pgTable(
	"journal_entry",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		titleName: text("title_name").notNull(),
		scope: text("scope").notNull(), // 'episode' | 'season' | 'show'
		seasonNumber: integer("season_number"),
		episodeNumber: integer("episode_number"),
		note: text("note").notNull(),
		isPublic: boolean("is_public").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("journal_entry_userId_idx").on(table.userId),
		index("journal_entry_tmdbId_idx").on(table.userId, table.tmdbId),
	],
);
```

- [ ] **Step 3: Add scope fields to `watchEvent` table**

Add three new columns to the existing `watchEvent` table definition (after `posterPath` on line ~284):

```typescript
		scope: text("scope"), // 'episode' | 'season' | 'show' | null (null = legacy/film)
		scopeSeasonNumber: integer("scope_season_number"),
		scopeEpisodeNumber: integer("scope_episode_number"),
```

- [ ] **Step 4: Add relations for new tables**

Add after the `recommendationRelations` block (line ~615):

```typescript
export const episodeWatchRelations = relations(episodeWatch, ({ one }) => ({
	user: one(user, {
		fields: [episodeWatch.userId],
		references: [user.id],
	}),
	watchEvent: one(watchEvent, {
		fields: [episodeWatch.watchEventId],
		references: [watchEvent.id],
	}),
}));

export const journalEntryRelations = relations(journalEntry, ({ one }) => ({
	user: one(user, {
		fields: [journalEntry.userId],
		references: [user.id],
	}),
}));
```

Also add to `userRelations` (around line 438), inside the `relations(user, ({ many }) => ({` block:

```typescript
	episodeWatches: many(episodeWatch),
	journalEntries: many(journalEntry),
```

And add to `watchEventRelations` (around line 582), inside the block:

```typescript
	episodeWatches: many(episodeWatch),
```

- [ ] **Step 5: Push schema to database**

Run: `bunx drizzle-kit push`
Expected: Tables `episode_watch` and `journal_entry` created, `watch_event` table updated with scope columns.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(schema): add episodeWatch and journalEntry tables, add scope fields to watchEvent"
```

---

### Task 2: TMDB API — Season Episode Details

**Files:**
- Modify: `src/lib/tmdb-title.ts`

- [ ] **Step 1: Add TMDB season detail types**

Add after `TmdbTvContentRatingsResponse` (line ~77):

```typescript
export interface TmdbEpisode {
	episode_number: number;
	name: string;
	overview: string;
	runtime: number | null;
	air_date: string | null;
	still_path: string | null;
	season_number: number;
}

interface TmdbSeasonDetail {
	season_number: number;
	name: string;
	episodes: TmdbEpisode[];
}
```

- [ ] **Step 2: Add `fetchSeasonDetails` function**

Add after the `fetchTitleDetails` function (after line ~258):

```typescript
export interface SeasonEpisode {
	episodeNumber: number;
	name: string;
	runtime: number | null;
	airDate: string | null;
	seasonNumber: number;
}

export async function fetchSeasonDetails(
	tmdbId: number,
	seasonNumber: number,
): Promise<SeasonEpisode[]> {
	const season = await tmdbFetch<TmdbSeasonDetail>(
		`/tv/${tmdbId}/season/${seasonNumber}`,
	);
	return season.episodes.map((ep) => ({
		episodeNumber: ep.episode_number,
		name: ep.name,
		runtime: ep.runtime,
		airDate: ep.air_date,
		seasonNumber: ep.season_number,
	}));
}

export async function fetchAllSeasons(
	tmdbId: number,
	seasonList: Array<{ seasonNumber: number }>,
): Promise<SeasonEpisode[]> {
	const seasons = await Promise.all(
		seasonList
			.filter((s) => s.seasonNumber > 0) // Exclude specials (Season 0)
			.map((s) => fetchSeasonDetails(tmdbId, s.seasonNumber).catch(() => [])),
	);
	return seasons.flat();
}
```

- [ ] **Step 3: Add `status` and `nextEpisodeAirDate` to `TitleData`**

Update the `TitleData` interface to include `nextEpisodeAirDate`:

```typescript
	nextEpisodeAirDate?: string | null;
```

In the TV return block of `fetchTitleDetails`, add `next_episode_to_air` to the `TmdbTvDetail` interface:

```typescript
	next_episode_to_air: { air_date: string; name: string; episode_number: number; season_number: number } | null;
```

And return it in the TV result:

```typescript
		nextEpisodeAirDate: tv.next_episode_to_air?.air_date ?? null,
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/tmdb-title.ts
git commit -m "feat(tmdb): add season episode detail fetching and next air date"
```

---

### Task 3: Episode Tracker tRPC Router

**Files:**
- Create: `src/integrations/trpc/routers/episode-tracker.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Create the episode tracker router**

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { episodeWatch, watchEvent } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { fetchAllSeasons, fetchSeasonDetails } from "#/lib/tmdb-title";

export const episodeTrackerRouter = {
	/** Mark individual episodes as watched */
	markEpisodes: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				episodes: z.array(
					z.object({
						seasonNumber: z.number(),
						episodeNumber: z.number(),
						runtime: z.number(),
					}),
				),
				watchEventId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const values = input.episodes.map((ep) => ({
				userId: ctx.userId,
				tmdbId: input.tmdbId,
				seasonNumber: ep.seasonNumber,
				episodeNumber: ep.episodeNumber,
				runtime: ep.runtime,
				watchEventId: input.watchEventId ?? null,
			}));
			await db
				.insert(episodeWatch)
				.values(values)
				.onConflictDoNothing();
			return { marked: input.episodes.length };
		}),

	/** Unmark a single episode */
	unmarkEpisode: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				seasonNumber: z.number(),
				episodeNumber: z.number(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const deleted = await db
				.delete(episodeWatch)
				.where(
					and(
						eq(episodeWatch.userId, ctx.userId),
						eq(episodeWatch.tmdbId, input.tmdbId),
						eq(episodeWatch.seasonNumber, input.seasonNumber),
						eq(episodeWatch.episodeNumber, input.episodeNumber),
					),
				)
				.returning();
			if (deleted.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Episode not found" });
			}
			return { runtime: deleted[0].runtime };
		}),

	/** Get all watched episodes for a specific show */
	getForShow: protectedProcedure
		.input(z.object({ tmdbId: z.number() }))
		.query(async ({ input, ctx }) => {
			const episodes = await db.query.episodeWatch.findMany({
				where: and(
					eq(episodeWatch.userId, ctx.userId),
					eq(episodeWatch.tmdbId, input.tmdbId),
				),
				orderBy: [episodeWatch.seasonNumber, episodeWatch.episodeNumber],
			});
			return episodes;
		}),

	/** Get all tracked shows for the dashboard */
	getTrackedShows: protectedProcedure.query(async ({ ctx }) => {
		const shows = await db
			.select({
				tmdbId: episodeWatch.tmdbId,
				episodeCount: sql<number>`count(*)::int`,
				totalRuntime: sql<number>`coalesce(sum(${episodeWatch.runtime}), 0)::int`,
				lastWatchedAt: sql<string>`max(${episodeWatch.watchedAt})`,
			})
			.from(episodeWatch)
			.where(eq(episodeWatch.userId, ctx.userId))
			.groupBy(episodeWatch.tmdbId)
			.orderBy(sql`max(${episodeWatch.watchedAt}) desc`);
		return shows;
	}),

	/** Get TV watch time for a user (used in profile) */
	getTvWatchTime: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.query(async ({ input }) => {
			const [result] = await db
				.select({
					total: sql<number>`coalesce(sum(${episodeWatch.runtime}), 0)::int`,
				})
				.from(episodeWatch)
				.where(eq(episodeWatch.userId, input.userId));
			return { minutes: result?.total ?? 0 };
		}),

	/** Check if user has any episodes tracked for a show */
	hasTracked: protectedProcedure
		.input(z.object({ tmdbId: z.number() }))
		.query(async ({ input, ctx }) => {
			const first = await db.query.episodeWatch.findFirst({
				where: and(
					eq(episodeWatch.userId, ctx.userId),
					eq(episodeWatch.tmdbId, input.tmdbId),
				),
			});
			return { tracked: !!first };
		}),

	/** Fetch season episodes from TMDB */
	getSeasonEpisodes: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				seasonNumber: z.number(),
			}),
		)
		.query(async ({ input }) => {
			return fetchSeasonDetails(input.tmdbId, input.seasonNumber);
		}),

	/** Fetch all season episodes from TMDB */
	getAllSeasonEpisodes: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				seasonList: z.array(
					z.object({ seasonNumber: z.number() }),
				),
			}),
		)
		.query(async ({ input }) => {
			return fetchAllSeasons(input.tmdbId, input.seasonList);
		}),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register the router**

In `src/integrations/trpc/router.ts`, add:

Import:
```typescript
import { episodeTrackerRouter } from "./routers/episode-tracker";
```

In the `createTRPCRouter` call:
```typescript
	episodeTracker: episodeTrackerRouter,
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/episode-tracker.ts src/integrations/trpc/router.ts
git commit -m "feat(api): add episode tracker tRPC router with mark/unmark/query procedures"
```

---

### Task 4: Journal Entry tRPC Router

**Files:**
- Create: `src/integrations/trpc/routers/journal-entry.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Create the journal entry router**

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { journalEntry } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";

export const journalEntryRouter = {
	create: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				titleName: z.string(),
				scope: z.enum(["episode", "season", "show"]),
				seasonNumber: z.number().optional(),
				episodeNumber: z.number().optional(),
				note: z.string().min(1).max(2000),
				isPublic: z.boolean().default(false),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const [entry] = await db
				.insert(journalEntry)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					titleName: input.titleName,
					scope: input.scope,
					seasonNumber: input.seasonNumber ?? null,
					episodeNumber: input.episodeNumber ?? null,
					note: input.note,
					isPublic: input.isPublic,
				})
				.returning();
			return entry;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				note: z.string().min(1).max(2000).optional(),
				isPublic: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.journalEntry.findFirst({
				where: and(
					eq(journalEntry.id, input.id),
					eq(journalEntry.userId, ctx.userId),
				),
			});
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
			const [updated] = await db
				.update(journalEntry)
				.set({
					...(input.note !== undefined && { note: input.note }),
					...(input.isPublic !== undefined && { isPublic: input.isPublic }),
				})
				.where(eq(journalEntry.id, input.id))
				.returning();
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.journalEntry.findFirst({
				where: and(
					eq(journalEntry.id, input.id),
					eq(journalEntry.userId, ctx.userId),
				),
			});
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
			await db.delete(journalEntry).where(eq(journalEntry.id, input.id));
			return { success: true };
		}),

	/** Get all journal entries for a specific show */
	getForShow: protectedProcedure
		.input(z.object({ tmdbId: z.number() }))
		.query(async ({ input, ctx }) => {
			return db.query.journalEntry.findMany({
				where: and(
					eq(journalEntry.userId, ctx.userId),
					eq(journalEntry.tmdbId, input.tmdbId),
				),
				orderBy: [desc(journalEntry.createdAt)],
			});
		}),

	/** Get all journal entries across all shows (for Journal tab) */
	getAll: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(50).default(20),
				cursor: z.string().optional(),
				tmdbId: z.number().optional(), // optional filter by show
			}),
		)
		.query(async ({ input, ctx }) => {
			const cursorDate = input.cursor ? new Date(input.cursor) : undefined;
			const entries = await db.query.journalEntry.findMany({
				where: and(
					eq(journalEntry.userId, ctx.userId),
					...(input.tmdbId ? [eq(journalEntry.tmdbId, input.tmdbId)] : []),
					...(cursorDate
						? [sql`${journalEntry.createdAt} < ${cursorDate}`]
						: []),
				),
				orderBy: [desc(journalEntry.createdAt)],
				limit: input.limit + 1,
			});
			const hasMore = entries.length > input.limit;
			const items = hasMore ? entries.slice(0, input.limit) : entries;
			return {
				items,
				nextCursor: hasMore
					? items[items.length - 1]?.createdAt.toISOString()
					: undefined,
			};
		}),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register the router**

In `src/integrations/trpc/router.ts`, add:

Import:
```typescript
import { journalEntryRouter } from "./routers/journal-entry";
```

In the `createTRPCRouter` call:
```typescript
	journalEntry: journalEntryRouter,
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/journal-entry.ts src/integrations/trpc/router.ts
git commit -m "feat(api): add journal entry tRPC router with CRUD and pagination"
```

---

### Task 5: Update Watch Time Calculation

**Files:**
- Modify: `src/integrations/trpc/routers/friend.ts`

- [ ] **Step 1: Update profile watch time to include TV episode time**

Find the watch time calculation block (around lines 604-622) and update:

Add import at top of file:
```typescript
import { episodeWatch } from "#/db/schema";
```

Replace the watch time block:

```typescript
			// Film watch time (from watchlist items)
			let filmWatchTimeMinutes = 0;
			if (wlIds.length > 0) {
				const [result] = await db
					.select({
						total: sql<number>`coalesce(sum(${watchlistItem.runtime}), 0)::int`,
					})
					.from(watchlistItem)
					.where(
						and(
							inArray(watchlistItem.watchlistId, wlIds),
							eq(watchlistItem.watched, true),
							eq(watchlistItem.mediaType, "movie"),
						),
					);
				filmWatchTimeMinutes = result?.total ?? 0;
			}

			// TV watch time (from episode tracker)
			const [tvResult] = await db
				.select({
					total: sql<number>`coalesce(sum(${episodeWatch.runtime}), 0)::int`,
				})
				.from(episodeWatch)
				.where(eq(episodeWatch.userId, input.userId));
			const tvWatchTimeMinutes = tvResult?.total ?? 0;

			const watchTimeMinutes = filmWatchTimeMinutes + tvWatchTimeMinutes;
```

- [ ] **Step 2: Verify the profile still renders correctly**

Run: `bun run dev`
Navigate to a user profile and confirm the watch time stat still displays.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/friend.ts
git commit -m "feat(profile): split watch time into film (watchlistItem) + TV (episodeWatch)"
```

---

### Task 6: Add Journal Entries to Feed

**Files:**
- Modify: `src/integrations/trpc/routers/watch-event.ts`

- [ ] **Step 1: Add journal entries to the feed query**

In the `getFeed` procedure, add an import for `journalEntry` at the top of the file:

```typescript
import { journalEntry, watchEvent, watchEventCompanion } from "#/db/schema";
```

Inside the `getFeed` query handler, after fetching `watchEvents` and `watchlistCreations`, add:

```typescript
			// Fetch public journal entries from user + friends
			const journalEntries = await db.query.journalEntry.findMany({
				where: and(
					inArray(journalEntry.userId, userIds),
					eq(journalEntry.isPublic, true),
					...(cursorDate
						? [sql`${journalEntry.createdAt} < ${cursorDate}`]
						: []),
				),
				with: {
					user: {
						columns: { id: true, username: true, avatarUrl: true },
					},
				},
				orderBy: (e, { desc }) => [desc(e.createdAt)],
				limit: input.limit + 1,
			});
```

Note: The `user` relation on `journalEntryRelations` was already added in Task 1 step 4, so no schema changes needed here.

Then update the `FeedItem` type and merge logic to include journal entries:

```typescript
			type FeedItem =
				| { type: "watch_event"; timestamp: Date; data: (typeof watchEvents)[0] }
				| { type: "watchlist_created"; timestamp: Date; data: (typeof watchlistCreations)[0] }
				| { type: "journal_entry"; timestamp: Date; data: (typeof journalEntries)[0] };

			const merged: FeedItem[] = [
				...watchEvents.map((e) => ({
					type: "watch_event" as const,
					timestamp: new Date(e.watchedAt),
					data: e,
				})),
				...watchlistCreations.map((wl) => ({
					type: "watchlist_created" as const,
					timestamp: new Date(wl.createdAt),
					data: wl,
				})),
				...journalEntries.map((je) => ({
					type: "journal_entry" as const,
					timestamp: new Date(je.createdAt),
					data: je,
				})),
			].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
```

- [ ] **Step 2: Commit**

```bash
git add src/integrations/trpc/routers/watch-event.ts src/db/schema.ts
git commit -m "feat(feed): add journal entries to activity feed"
```

---

### Task 7: Update WatchEvent for Scoped Reviews

**Files:**
- Modify: `src/integrations/trpc/routers/watch-event.ts`

- [ ] **Step 1: Update the `create` mutation input to accept scope**

In the `create` mutation's input schema, add:

```typescript
				scope: z.enum(["episode", "season", "show"]).optional(),
				scopeSeasonNumber: z.number().optional(),
				scopeEpisodeNumber: z.number().optional(),
```

In the `.values()` call when inserting, add:

```typescript
				scope: input.scope ?? null,
				scopeSeasonNumber: input.scopeSeasonNumber ?? null,
				scopeEpisodeNumber: input.scopeEpisodeNumber ?? null,
```

- [ ] **Step 2: Update the `update` mutation similarly**

Add the same optional scope fields to the update input and set logic.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/watch-event.ts
git commit -m "feat(api): add scope fields to watch event create/update for scoped TV reviews"
```

---

### Task 8: Tracker Dashboard Page

**Files:**
- Create: `src/routes/app/tracker.index.tsx`
- Create: `src/components/tracker/tracker-show-card.tsx`

This task creates the UI. Use the `frontend-design` skill for implementation.

- [ ] **Step 1: Create the tracker dashboard route**

Create `src/routes/app/tracker.index.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";
import { TrackerShowCard } from "#/components/tracker/tracker-show-card";

export const Route = createFileRoute("/app/tracker/")({
	component: TrackerDashboard,
});

function TrackerDashboard() {
	const trpc = useTRPC();
	const { data: trackedShows, isLoading } = useQuery(
		trpc.episodeTracker.getTrackedShows.queryOptions(),
	);

	// Fetch TMDB details for each tracked show to get poster, title, status, totalEpisodes
	// Group into "Watching" and "Completed" sections
	// Render TrackerShowCard for each show

	return (
		<div className="mx-auto max-w-4xl px-4 py-8">
			{/* Page header */}
			{/* Tab: My Shows | Journal */}
			{/* Watching section */}
			{/* Completed section */}
		</div>
	);
}
```

- [ ] **Step 2: Create the `TrackerShowCard` component**

Create `src/components/tracker/tracker-show-card.tsx`:

Each card displays:
- Poster thumbnail (TMDB image)
- Show title (links to `/app/tracker/:tmdbId`)
- Progress bar with episode count (e.g., "23/62 episodes")
- Status badge: "In Progress", "Caught Up — More episodes coming soon", or "Completed"
- Star rating if reviewed (for completed shows)

Style with the app's existing drive-in aesthetic: dark card with neon accents, `font-mono-retro` for labels, `neon-cyan` for progress bars, `neon-amber` for completed state.

- [ ] **Step 3: Add navigation link**

In `src/routes/app/route.tsx`, add a "Tracker" nav link after the Feed link (around line 94):

Import `Tv` icon from lucide-react.

```typescript
						<Link
							to="/app/tracker"
							className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-cream/50 no-underline transition-colors hover:bg-cream/5 hover:text-cream/80 [&.active]:text-neon-cyan [&.active]:bg-neon-cyan/8"
						>
							<Tv className="h-3.5 w-3.5" />
							Tracker
						</Link>
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/tracker.index.tsx src/components/tracker/tracker-show-card.tsx src/routes/app/route.tsx
git commit -m "feat(ui): add tracker dashboard page with show cards and nav link"
```

---

### Task 9: Show Tracker Page — Episode Cards

**Files:**
- Create: `src/routes/app/tracker.$tmdbId.tsx`
- Create: `src/components/tracker/season-row.tsx`
- Create: `src/components/tracker/episode-card.tsx`

This task creates the UI. Use the `frontend-design` skill for implementation.

- [ ] **Step 1: Create the show tracker route**

Create `src/routes/app/tracker.$tmdbId.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";

export const Route = createFileRoute("/app/tracker/$tmdbId")({
	component: ShowTracker,
});

function ShowTracker() {
	const { tmdbId } = Route.useParams();
	const trpc = useTRPC();
	const tmdbIdNum = Number(tmdbId);

	// Fetch title details (includes seasonList, status, poster, etc.)
	const { data: titleData } = useQuery(
		trpc.title.details.queryOptions({ tmdbId: tmdbIdNum, mediaType: "tv" }),
	);

	// Fetch user's watched episodes for this show
	const { data: watchedEpisodes } = useQuery(
		trpc.episodeTracker.getForShow.queryOptions({ tmdbId: tmdbIdNum }),
	);

	// Fetch all episode details from TMDB
	const { data: allEpisodes } = useQuery(
		trpc.episodeTracker.getAllSeasonEpisodes.queryOptions({
			tmdbId: tmdbIdNum,
			seasonList: titleData?.seasonList ?? [],
		}),
	);

	// Render: show header, progress, season rows with episode cards
	// Actions: "Write about this", "Log a watch"
	// Notes & Reviews section at bottom
}
```

- [ ] **Step 2: Create `SeasonRow` component**

Create `src/components/tracker/season-row.tsx`:

Horizontal scrollable row of episode cards for one season. Contains:
- Season header: "Season 1 — 8/10 episodes"
- "Mark season" button
- Horizontally scrollable container of `EpisodeCard` components
- Use `overflow-x-auto` with `scrollbar-none` or custom scrollbar styling

- [ ] **Step 3: Create `EpisodeCard` component**

Create `src/components/tracker/episode-card.tsx`:

Netflix-style card (~130px wide) showing:
- Episode number and runtime at top
- Episode name below
- Watched state: filled background (`neon-cyan` or brand color) when watched, dark with border when unwatched
- Bottom accent bar when watched
- Click handler to toggle watched/unwatched
- Confirmation dialog when unmarking (shows runtime being removed)

```typescript
interface EpisodeCardProps {
	tmdbId: number;
	seasonNumber: number;
	episodeNumber: number;
	name: string;
	runtime: number | null;
	isWatched: boolean;
	onMark: (episode: { seasonNumber: number; episodeNumber: number; runtime: number }) => void;
	onUnmark: (episode: { seasonNumber: number; episodeNumber: number }) => void;
}
```

- [ ] **Step 4: Wire up mark/unmark mutations in the show tracker**

In the show tracker page, use `trpc.episodeTracker.markEpisodes` and `trpc.episodeTracker.unmarkEpisode` mutations. Invalidate `episodeTracker.getForShow` and `episodeTracker.getTrackedShows` on success.

- [ ] **Step 5: Add "Mark all" button**

At the top of the show tracker, add a "Mark all episodes" button that marks every episode across all seasons. Uses `markEpisodes` mutation with all episode data.

- [ ] **Step 6: Commit**

```bash
git add src/routes/app/tracker.$tmdbId.tsx src/components/tracker/season-row.tsx src/components/tracker/episode-card.tsx
git commit -m "feat(ui): add show tracker page with season rows and episode cards"
```

---

### Task 10: Show Tracker — Status, Progress & Completion

**Files:**
- Modify: `src/routes/app/tracker.$tmdbId.tsx`

- [ ] **Step 1: Compute show status from tracker + TMDB data**

In the show tracker page, derive the status:

```typescript
function getShowStatus(
	titleData: TitleData,
	watchedCount: number,
	totalEpisodes: number,
): "in_progress" | "caught_up" | "completed" {
	const allWatched = watchedCount >= totalEpisodes;
	const isFinished = titleData.status === "Ended" || titleData.status === "Canceled";

	if (allWatched && isFinished) return "completed";
	if (allWatched && !isFinished) return "caught_up";
	return "in_progress";
}
```

Display:
- "In Progress" — with progress bar
- "Caught Up — More episodes coming soon" or "Next episode: [date]" if `nextEpisodeAirDate` available
- "Completed" — with prompt for review if not already reviewed

- [ ] **Step 2: Add completion review prompt**

When status changes to "completed" after marking the last episode, show a dialog:
- "You've finished [show name]! Want to leave a review?"
- "Yes" → opens the existing `ReviewModal` with scope="show"
- "Not now" → dismisses, show moves to completed

Check if a full show review already exists using `trpc.watchEvent.getForTitle` filtered by `scope === "show"`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/tracker.$tmdbId.tsx
git commit -m "feat(ui): add show status computation and completion review prompt"
```

---

### Task 11: "Write About This" Flow

**Files:**
- Create: `src/components/tracker/write-about-modal.tsx`
- Modify: `src/routes/app/tracker.$tmdbId.tsx`

This task creates UI. Use the `frontend-design` skill for implementation.

- [ ] **Step 1: Create the "Write About This" modal**

Create `src/components/tracker/write-about-modal.tsx`:

Multi-step modal:

**Step 1 — Choose type:**
- "Note" (journal entry icon) or "Review" (star icon)

**Step 2 — Choose scope:**
- Episode / Season / Full Show
- If Episode: season + episode number picker
- If Season: season number picker

**If Note selected:**
**Step 3 — Write note:**
- Text area (max 2000 chars)
- Public/private toggle
- Submit button
- Calls `trpc.journalEntry.create`

**If Review selected:**
**Step 3 — Completion check:**
- Query watched episodes for the selected scope
- If incomplete: warning dialog with "Mark as complete" or "Continue anyway"
- "Mark as complete" calls `trpc.episodeTracker.markEpisodes` for missing episodes

**Step 4 — Review modal:**
- Opens existing `ReviewModal` component with scope context passed in header
- Pass `scope`, `scopeSeasonNumber`, `scopeEpisodeNumber` to the review creation

Style with the app's drive-in aesthetic: dark modal with neon accents, marquee-style header.

- [ ] **Step 2: Wire into show tracker page**

Add "Write about this" button to the show tracker page actions area. Opens `WriteAboutModal`.

- [ ] **Step 3: Add Notes & Reviews section below episode cards**

Query `trpc.journalEntry.getForShow` and `trpc.watchEvent.getForTitle` for the current show. Display them chronologically in a "Notes & Reviews" section:
- Journal entries: show note text, scope badge, timestamp, edit/delete
- Reviews: show rating, review text, scope badge, timestamp, edit/delete

- [ ] **Step 4: Commit**

```bash
git add src/components/tracker/write-about-modal.tsx src/routes/app/tracker.$tmdbId.tsx
git commit -m "feat(ui): add write-about-this modal with note and scoped review flows"
```

---

### Task 12: Journal Tab on Tracker Dashboard

**Files:**
- Modify: `src/routes/app/tracker.index.tsx`
- Create: `src/components/tracker/journal-entry-card.tsx`

- [ ] **Step 1: Add tab navigation to tracker dashboard**

Add two tabs at the top of the dashboard: "My Shows" (default) and "Journal".

Use a simple state toggle — no URL params needed:

```typescript
const [activeTab, setActiveTab] = useState<"shows" | "journal">("shows");
```

Tab styling: `font-mono-retro` labels, neon-cyan underline for active tab.

- [ ] **Step 2: Create `JournalEntryCard` component**

Create `src/components/tracker/journal-entry-card.tsx`:

Displays:
- Show title (links to `/app/title/tv/:tmdbId`)
- Scope badge (e.g., "S3E9" or "Season 3" or "Full Show")
- Note text
- Timestamp (relative)
- Edit/delete buttons (own entries only)
- Public/private indicator

Style similar to `WatchEventCard` but labeled "Journal Entry", no stars, with a left border accent in `neon-cyan`.

- [ ] **Step 3: Build the journal tab content**

Use `trpc.journalEntry.getAll` with infinite query for pagination. Add optional show filter dropdown.

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/tracker.index.tsx src/components/tracker/journal-entry-card.tsx
git commit -m "feat(ui): add journal tab to tracker dashboard with entry cards"
```

---

### Task 13: Journal Entry Card in Feed

**Files:**
- Modify: `src/routes/app/feed.tsx`
- Create: `src/components/tracker/feed-journal-card.tsx`

- [ ] **Step 1: Create feed-specific journal entry card**

Create `src/components/tracker/feed-journal-card.tsx`:

Similar to `WatchEventCard` but:
- Header: "[username] wrote about [show name]" with scope if applicable ("· S3E9")
- No star rating
- Shows note text (line-clamp-3)
- Timestamp
- Links to show on tracker

- [ ] **Step 2: Update feed page to render journal entries**

In `src/routes/app/feed.tsx`, update the feed item rendering to handle the new `type: "journal_entry"` discriminant:

```typescript
{item.type === "journal_entry" && (
	<FeedJournalCard entry={item.data} />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/feed.tsx src/components/tracker/feed-journal-card.tsx
git commit -m "feat(ui): render journal entries in activity feed"
```

---

### Task 14: Title Page — Redirect "Watched" Button for TV

**Files:**
- Modify: `src/components/title/title-actions.tsx`

- [ ] **Step 1: Update the `handleWatched` function for TV**

In `title-actions.tsx`, find the `handleWatched` function and update the TV flow:

```typescript
const handleWatched = async () => {
	if (mediaType === "tv") {
		// Redirect to tracker page instead of opening season picker
		navigate({ to: "/app/tracker/$tmdbId", params: { tmdbId: String(tmdbId) } });
		return;
	}
	// ... existing movie logic stays the same
};
```

- [ ] **Step 2: Remove season picker for TV**

Remove the `SeasonPickerModal` rendering and the "Edit Seasons Watched" button for TV shows. Keep the `SeasonPickerModal` import if it's still used elsewhere, otherwise remove it.

Remove the `seasonPickerOpen` state and `handleSeasonConfirm` handler if no longer needed.

- [ ] **Step 3: Commit**

```bash
git add src/components/title/title-actions.tsx
git commit -m "feat(title-page): redirect TV watched button to tracker, remove season picker"
```

---

### Task 15: Migration Script — watchedSeasons to episodeWatch

**Files:**
- Create: `src/scripts/migrate-watched-seasons.ts`

- [ ] **Step 1: Create the migration script**

```typescript
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "#/db";
import { episodeWatch, watchlistItem, watchlistMember } from "#/db/schema";
import { fetchSeasonDetails } from "#/lib/tmdb-title";

async function migrateWatchedSeasons() {
	console.log("Starting watchedSeasons migration...");

	// Find all TV watchlist items with watchedSeasons data
	const tvItems = await db.query.watchlistItem.findMany({
		where: and(
			eq(watchlistItem.mediaType, "tv"),
			isNotNull(watchlistItem.watchedSeasons),
		),
		with: {
			watchlist: {
				with: { owner: { columns: { id: true } } },
			},
		},
	});

	console.log(`Found ${tvItems.length} TV items with watchedSeasons`);

	for (const item of tvItems) {
		const userId = item.watchlist.owner.id;
		const seasons = item.watchedSeasons as number[];

		if (!seasons || seasons.length === 0) continue;

		console.log(`Migrating tmdbId=${item.tmdbId} for user=${userId}, seasons=${seasons.join(",")}`);

		for (const seasonNum of seasons) {
			try {
				const episodes = await fetchSeasonDetails(item.tmdbId, seasonNum);

				const values = episodes.map((ep) => ({
					userId,
					tmdbId: item.tmdbId,
					seasonNumber: ep.seasonNumber,
					episodeNumber: ep.episodeNumber,
					runtime: ep.runtime ?? 0,
				}));

				if (values.length > 0) {
					await db.insert(episodeWatch).values(values).onConflictDoNothing();
				}
			} catch (error) {
				console.error(`Failed to fetch season ${seasonNum} for tmdbId=${item.tmdbId}:`, error);
			}
		}

		// Clear old watchedSeasons and TV runtime from watchlist item
		await db
			.update(watchlistItem)
			.set({ watchedSeasons: null, runtime: null })
			.where(eq(watchlistItem.id, item.id));
	}

	console.log("Migration complete.");
}

migrateWatchedSeasons()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Migration failed:", err);
		process.exit(1);
	});
```

- [ ] **Step 2: Run the migration**

Run: `bun run src/scripts/migrate-watched-seasons.ts`
Expected: Logs migration progress, creates episodeWatch rows, clears old watchedSeasons data.

- [ ] **Step 3: Commit**

```bash
git add src/scripts/migrate-watched-seasons.ts
git commit -m "feat(migration): convert watchedSeasons data to episodeWatch rows"
```

---

### Task 16: Integration Testing & Polish

**Files:**
- Various files from previous tasks

- [ ] **Step 1: Test the full episode marking flow**

1. Navigate to a TV show title page
2. Click "Watched" → should redirect to `/app/tracker/:tmdbId`
3. Episode cards should load for all seasons
4. Click an episode card → should mark as watched (visual feedback + toast)
5. Click "Mark season" → should mark all episodes in that season
6. Navigate to `/app/tracker` dashboard → show should appear in "Watching" section with progress bar

- [ ] **Step 2: Test journal entry flow**

1. On show tracker page, click "Write about this"
2. Select "Note" → pick scope → write note → toggle public → submit
3. Note appears in "Notes & Reviews" section on tracker page
4. If public, note appears in the feed
5. Navigate to tracker dashboard → Journal tab → note appears

- [ ] **Step 3: Test review flow**

1. On show tracker page, click "Write about this"
2. Select "Review" → pick scope → completion check if needed → review modal
3. Review appears in feed and on tracker page

- [ ] **Step 4: Test watch time**

1. Mark several episodes of a TV show
2. Navigate to profile page → watch time should include episode runtimes
3. Unmark an episode → watch time should decrease

- [ ] **Step 5: Test completion flow**

1. Find a show with status "Ended" that has few episodes
2. Mark all episodes → completion prompt should appear
3. Leave a review → show moves to "Completed" section on dashboard

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish episode tracker integration issues"
```
