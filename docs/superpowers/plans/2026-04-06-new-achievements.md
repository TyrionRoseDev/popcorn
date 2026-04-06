# New Achievements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 15 new achievements across tracker, journal, and reviews categories (31 → 46 total).

**Architecture:** Add new condition types and action contexts to the achievement system. Store per-season episode counts on `userTitle` for completion/binge detection. Wire up `evaluateAchievements` calls in episode-tracker and journal-entry routers. Frontend only needs a small change to pass `seasonEpisodeCounts` when adding a show.

**Tech Stack:** Drizzle ORM (schema + queries), tRPC (router wiring), Vitest (tests)

---

### Task 1: Add `seasonEpisodeCounts` column to `userTitle`

**Files:**
- Modify: `src/db/schema.ts:112-134`

- [ ] **Step 1: Add the JSONB column**

In `src/db/schema.ts`, add `seasonEpisodeCounts` to the `userTitle` table definition, after the `currentWatchNumber` field:

```typescript
currentWatchNumber: integer("current_watch_number").default(1).notNull(),
seasonEpisodeCounts: jsonb("season_episode_counts").$type<Record<string, number>>(),
```

- [ ] **Step 2: Push schema**

Run: `bunx drizzle-kit push`

Expected: Table altered, column added. Confirm with `y` when prompted.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add seasonEpisodeCounts column to userTitle"
```

---

### Task 2: Add achievement definitions

**Files:**
- Modify: `src/lib/achievements.ts`

- [ ] **Step 1: Add new categories**

In `src/lib/achievements.ts`, add `"tracker"` and `"journal"` to the `ACHIEVEMENT_CATEGORIES` array (before `"meta"`):

```typescript
export const ACHIEVEMENT_CATEGORIES = [
	"watching",
	"time-based",
	"social",
	"discovery",
	"watchlists",
	"recommendations",
	"reviews",
	"tracker",
	"journal",
	"profile",
	"meta",
] as const;
```

- [ ] **Step 2: Add new condition types**

Add these variants to the `AchievementCondition` union type, before the closing semicolon:

```typescript
| { type: "trackedShowCount"; threshold: number }
| { type: "episodeWatchCount"; threshold: number }
| { type: "completedSeriesCount"; threshold: number }
| { type: "startedRewatch" }
| { type: "bingeWatchSeason" }
| { type: "journalEntryCount"; threshold: number }
| { type: "journalAllScopes" }
| { type: "reviewGenreCountAll" }
```

- [ ] **Step 3: Add new action contexts**

Add these entries to `ACTION_CONTEXT_MAP`:

```typescript
episode_marked: [
	"trackedShowCount",
	"episodeWatchCount",
	"completedSeriesCount",
	"bingeWatchSeason",
	"achievementCount",
	"achievementCountAll",
],
show_tracked: [
	"trackedShowCount",
	"achievementCount",
	"achievementCountAll",
],
rewatch_started: [
	"startedRewatch",
	"achievementCount",
	"achievementCountAll",
],
journal_entry: [
	"journalEntryCount",
	"journalAllScopes",
	"achievementCount",
	"achievementCountAll",
],
```

Also add `"reviewGenreCountAll"` to the existing `review` context array:

```typescript
review: [
	"firstReview",
	"reviewCount",
	"reviewGenreCountAll",
	"recRatedHighly",
	"achievementCount",
	"achievementCountAll",
],
```

- [ ] **Step 4: Add 9 tracker achievements**

Add to the `ACHIEVEMENTS` array, after the Reviews section and before Profile:

```typescript
// Tracker (9)
{
	id: "now-showing",
	name: "Now Showing",
	description: "Add your first show to the tracker",
	icon: "📡",
	category: "tracker",
	condition: { type: "trackedShowCount", threshold: 1 },
},
{
	id: "episode-one",
	name: "Episode One",
	description: "Watch 50 episodes",
	icon: "▶️",
	category: "tracker",
	condition: { type: "episodeWatchCount", threshold: 50 },
},
{
	id: "season-pass",
	name: "Season Pass",
	description: "Watch 200 episodes",
	icon: "📺",
	category: "tracker",
	condition: { type: "episodeWatchCount", threshold: 200 },
},
{
	id: "marathon-runner",
	name: "Marathon Runner",
	description: "Watch 500 episodes",
	icon: "🏃",
	category: "tracker",
	condition: { type: "episodeWatchCount", threshold: 500 },
},
{
	id: "series-finale",
	name: "Series Finale",
	description: "Complete a full series",
	icon: "🔚",
	category: "tracker",
	condition: { type: "completedSeriesCount", threshold: 1 },
},
{
	id: "serial-finisher",
	name: "Serial Finisher",
	description: "Complete 5 series",
	icon: "📚",
	category: "tracker",
	condition: { type: "completedSeriesCount", threshold: 5 },
},
{
	id: "series-sweep",
	name: "Series Sweep",
	description: "Complete 10 series",
	icon: "🧹",
	category: "tracker",
	condition: { type: "completedSeriesCount", threshold: 10 },
},
{
	id: "binge-watch",
	name: "Binge Watch",
	description: "Watch an entire season in one day",
	icon: "⏭️",
	category: "tracker",
	condition: { type: "bingeWatchSeason" },
},
{
	id: "rerun",
	name: "Rerun",
	description: "Start a rewatch of a series",
	icon: "🔄",
	category: "tracker",
	condition: { type: "startedRewatch" },
},
```

- [ ] **Step 5: Add 3 journal achievements**

```typescript
// Journal (3)
{
	id: "dear-diary",
	name: "Dear Diary",
	description: "Write your first journal entry",
	icon: "📝",
	category: "journal",
	condition: { type: "journalEntryCount", threshold: 1 },
},
{
	id: "frequent-writer",
	name: "Frequent Writer",
	description: "Write 10 journal entries",
	icon: "🖊️",
	category: "journal",
	condition: { type: "journalEntryCount", threshold: 10 },
},
{
	id: "triple-take",
	name: "Triple Take",
	description: "Write an episode, season, and show journal entry",
	icon: "🎯",
	category: "journal",
	condition: { type: "journalAllScopes" },
},
```

- [ ] **Step 6: Add 3 review achievements**

Add after the existing `five-star-critic` entry in the reviews section:

```typescript
{
	id: "seasoned-critic",
	name: "Seasoned Critic",
	description: "Leave 25 reviews",
	icon: "🎙️",
	category: "reviews",
	condition: { type: "reviewCount", threshold: 25 },
},
{
	id: "review-machine",
	name: "Review Machine",
	description: "Leave 50 reviews",
	icon: "⌨️",
	category: "reviews",
	condition: { type: "reviewCount", threshold: 50 },
},
{
	id: "genre-critic",
	name: "Genre Critic",
	description: "Leave a review for every genre",
	icon: "📰",
	category: "reviews",
	condition: { type: "reviewGenreCountAll" },
},
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/achievements.ts
git commit -m "feat: add 15 new achievement definitions for tracker, journal, and reviews"
```

---

### Task 3: Add evaluation logic for new condition types

**Files:**
- Modify: `src/lib/evaluate-achievements.ts`

- [ ] **Step 1: Add imports**

Add `episodeWatch`, `userTitle`, and `journalEntry` to the schema imports at the top of `evaluate-achievements.ts`:

```typescript
import {
	earnedAchievement,
	episodeWatch,
	friendship,
	journalEntry,
	recommendation,
	review,
	shuffleSwipe,
	user,
	userTitle,
	watchEvent,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
```

Also add `UNIFIED_GENRES` import:

```typescript
import { UNIFIED_GENRES } from "./genre-map";
```

- [ ] **Step 2: Add `trackedShowCount` condition handler**

Add this case to the `switch` statement in `checkCondition`, before the `default` case:

```typescript
case "trackedShowCount": {
	const result = await db
		.select({ value: count() })
		.from(userTitle)
		.where(
			and(
				eq(userTitle.userId, userId),
				eq(userTitle.mediaType, "tv"),
			),
		);
	return (result[0]?.value ?? 0) >= condition.threshold;
}
```

- [ ] **Step 3: Add `episodeWatchCount` condition handler**

```typescript
case "episodeWatchCount": {
	const result = await db
		.select({ value: count() })
		.from(episodeWatch)
		.where(eq(episodeWatch.userId, userId));
	return (result[0]?.value ?? 0) >= condition.threshold;
}
```

- [ ] **Step 4: Add `completedSeriesCount` condition handler**

```typescript
case "completedSeriesCount": {
	// Get all tracked shows with their season episode counts
	const shows = await db
		.select({
			tmdbId: userTitle.tmdbId,
			currentWatchNumber: userTitle.currentWatchNumber,
			seasonEpisodeCounts: userTitle.seasonEpisodeCounts,
		})
		.from(userTitle)
		.where(
			and(
				eq(userTitle.userId, userId),
				eq(userTitle.mediaType, "tv"),
			),
		);

	let completedCount = 0;
	for (const show of shows) {
		if (!show.seasonEpisodeCounts) continue;
		const totalEpisodes = Object.values(
			show.seasonEpisodeCounts as Record<string, number>,
		).reduce((sum, count) => sum + count, 0);
		if (totalEpisodes === 0) continue;

		const [watched] = await db
			.select({ value: count() })
			.from(episodeWatch)
			.where(
				and(
					eq(episodeWatch.userId, userId),
					eq(episodeWatch.tmdbId, show.tmdbId),
					eq(episodeWatch.watchNumber, show.currentWatchNumber),
				),
			);
		if ((watched?.value ?? 0) >= totalEpisodes) {
			completedCount++;
		}
	}
	return completedCount >= condition.threshold;
}
```

- [ ] **Step 5: Add `startedRewatch` condition handler**

```typescript
case "startedRewatch": {
	const result = await db
		.select({ value: count() })
		.from(userTitle)
		.where(
			and(
				eq(userTitle.userId, userId),
				eq(userTitle.mediaType, "tv"),
				gte(userTitle.currentWatchNumber, 2),
			),
		);
	return (result[0]?.value ?? 0) >= 1;
}
```

- [ ] **Step 6: Add `bingeWatchSeason` condition handler**

```typescript
case "bingeWatchSeason": {
	// Check if all episodes of any season were watched on the same calendar day
	const shows = await db
		.select({
			tmdbId: userTitle.tmdbId,
			currentWatchNumber: userTitle.currentWatchNumber,
			seasonEpisodeCounts: userTitle.seasonEpisodeCounts,
		})
		.from(userTitle)
		.where(
			and(
				eq(userTitle.userId, userId),
				eq(userTitle.mediaType, "tv"),
			),
		);

	for (const show of shows) {
		if (!show.seasonEpisodeCounts) continue;
		const counts = show.seasonEpisodeCounts as Record<string, number>;

		for (const [seasonStr, expectedCount] of Object.entries(counts)) {
			if (expectedCount === 0) continue;
			const seasonNum = Number(seasonStr);

			// Group episode watches by date for this season
			const result = await db
				.select({
					watchDate: sql<string>`DATE(${episodeWatch.watchedAt})`,
					episodeCount: sql<number>`count(*)::int`,
				})
				.from(episodeWatch)
				.where(
					and(
						eq(episodeWatch.userId, userId),
						eq(episodeWatch.tmdbId, show.tmdbId),
						eq(episodeWatch.seasonNumber, seasonNum),
						eq(episodeWatch.watchNumber, show.currentWatchNumber),
					),
				)
				.groupBy(sql`DATE(${episodeWatch.watchedAt})`);

			if (result.some((r) => r.episodeCount >= expectedCount)) {
				return true;
			}
		}
	}
	return false;
}
```

- [ ] **Step 7: Add `journalEntryCount` condition handler**

```typescript
case "journalEntryCount": {
	const result = await db
		.select({ value: count() })
		.from(journalEntry)
		.where(eq(journalEntry.userId, userId));
	return (result[0]?.value ?? 0) >= condition.threshold;
}
```

- [ ] **Step 8: Add `journalAllScopes` condition handler**

```typescript
case "journalAllScopes": {
	const scopes = await db
		.selectDistinct({ scope: journalEntry.scope })
		.from(journalEntry)
		.where(eq(journalEntry.userId, userId));
	const scopeSet = new Set(scopes.map((s) => s.scope));
	return scopeSet.has("episode") && scopeSet.has("season") && scopeSet.has("show");
}
```

- [ ] **Step 9: Add `reviewGenreCountAll` condition handler**

```typescript
case "reviewGenreCountAll": {
	// Get all TMDB genre IDs from watch events that have a matching review
	const result = await db.execute(sql`
		SELECT DISTINCT jsonb_array_elements(we.genre_ids)::int AS genre_id
		FROM ${review} r
		JOIN ${watchEvent} we
			ON we.tmdb_id = r.tmdb_id
			AND we.media_type = r.media_type
			AND we.user_id = r.user_id
			AND we.genre_ids IS NOT NULL
		WHERE r.user_id = ${userId}
	`);
	const tmdbGenreIds = (result.rows ?? []).map((r: { genre_id: number }) => r.genre_id);
	// Map TMDB genre IDs to unified genre IDs and check coverage
	const coveredUnifiedIds = new Set<number>();
	for (const tmdbId of tmdbGenreIds) {
		for (const genre of UNIFIED_GENRES) {
			if (genre.movieGenreId === tmdbId || genre.tvGenreId === tmdbId) {
				coveredUnifiedIds.add(genre.id);
			}
		}
	}
	return coveredUnifiedIds.size >= UNIFIED_GENRES.length;
}
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/evaluate-achievements.ts
git commit -m "feat: add evaluation logic for 8 new achievement condition types"
```

---

### Task 4: Wire up evaluateAchievements in routers

**Files:**
- Modify: `src/integrations/trpc/routers/episode-tracker.ts`
- Modify: `src/integrations/trpc/routers/journal-entry.ts`

- [ ] **Step 1: Update `addShow` to accept and store `seasonEpisodeCounts`**

In `src/integrations/trpc/routers/episode-tracker.ts`, update the `addShow` input schema and mutation:

```typescript
addShow: protectedProcedure
	.input(
		z.object({
			tmdbId: z.number(),
			seasonEpisodeCounts: z.record(z.string(), z.number()).optional(),
		}),
	)
	.mutation(async ({ input, ctx }) => {
		await db
			.insert(userTitle)
			.values({
				userId: ctx.userId,
				tmdbId: input.tmdbId,
				mediaType: "tv",
				...(input.seasonEpisodeCounts && {
					seasonEpisodeCounts: input.seasonEpisodeCounts,
				}),
			})
			.onConflictDoNothing();

		const newAchievements = await evaluateAchievements(
			ctx.userId,
			"show_tracked",
		);
		return { success: true, newAchievements };
	}),
```

- [ ] **Step 2: Update `markEpisodes` to use `episode_marked` context**

In the `markEpisodes` mutation, change the `evaluateAchievements` call from `"watched"` to `"episode_marked"`:

```typescript
const newAchievements = await evaluateAchievements(
	ctx.userId,
	"episode_marked",
	{
		tmdbId: input.tmdbId,
		mediaType: "tv",
		watchedAt: new Date(),
	},
);
```

- [ ] **Step 3: Add `evaluateAchievements` to `startRewatch`**

In the `startRewatch` mutation, add achievement evaluation after the successful update (before the return):

```typescript
const newAchievements = await evaluateAchievements(
	ctx.userId,
	"rewatch_started",
);
return { currentWatchNumber: updated.currentWatchNumber, newAchievements };
```

- [ ] **Step 4: Update `markFromNotification` to store seasonEpisodeCounts and evaluate**

In the `markFromNotification` mutation, after the `onConflictDoNothing()` insert for `userTitle`, add TMDB fetch and update for `seasonEpisodeCounts`. Also add achievement evaluation at the end.

Replace the `markFromNotification` mutation body. After the existing `db.insert(userTitle)...onConflictDoNothing()` call, add:

```typescript
// Populate seasonEpisodeCounts if not already set
const existingTitle = await db.query.userTitle.findFirst({
	where: and(
		eq(userTitle.userId, ctx.userId),
		eq(userTitle.tmdbId, input.tmdbId),
		eq(userTitle.mediaType, "tv"),
	),
	columns: { currentWatchNumber: true, seasonEpisodeCounts: true },
});

if (existingTitle && !existingTitle.seasonEpisodeCounts) {
	// Fetch season data from TMDB to populate counts
	const { fetchTitleDetails } = await import("#/lib/tmdb-title");
	const titleData = await fetchTitleDetails("tv", input.tmdbId);
	if (titleData.seasonList) {
		const counts: Record<string, number> = {};
		for (const s of titleData.seasonList) {
			if (s.seasonNumber > 0) {
				counts[String(s.seasonNumber)] = s.episodeCount;
			}
		}
		await db
			.update(userTitle)
			.set({ seasonEpisodeCounts: counts })
			.where(
				and(
					eq(userTitle.userId, ctx.userId),
					eq(userTitle.tmdbId, input.tmdbId),
					eq(userTitle.mediaType, "tv"),
				),
			);
	}
}
```

And at the end of the mutation (before `return { success: true }`), add:

```typescript
const newAchievements = await evaluateAchievements(
	ctx.userId,
	"episode_marked",
	{
		tmdbId: input.tmdbId,
		mediaType: "tv",
		watchedAt: new Date(),
	},
);

return { success: true, newAchievements };
```

- [ ] **Step 5: Add evaluateAchievements to journal-entry create**

In `src/integrations/trpc/routers/journal-entry.ts`, add the import at the top:

```typescript
import { evaluateAchievements } from "#/lib/evaluate-achievements";
```

Then in the `create` mutation, after the `db.insert(journalEntry)` call and before the return:

```typescript
const newAchievements = await evaluateAchievements(
	ctx.userId,
	"journal_entry",
);
return { ...entry, newAchievements };
```

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/routers/episode-tracker.ts src/integrations/trpc/routers/journal-entry.ts
git commit -m "feat: wire up evaluateAchievements for tracker, journal, and review contexts"
```

---

### Task 5: Frontend - Pass seasonEpisodeCounts to addShow

**Files:**
- Modify: `src/components/title/title-actions.tsx`

- [ ] **Step 1: Destructure seasonList from props**

In `src/components/title/title-actions.tsx`, add `seasonList` to the destructured props on line 44:

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
	status,
}: TitleActionsProps) {
```

- [ ] **Step 2: Build and pass seasonEpisodeCounts in handleWatched**

In the `handleWatched` function, update the `addToTracker.mutate` call to include `seasonEpisodeCounts`:

```typescript
function handleWatched() {
	// For TV shows, add to tracker and redirect
	if (mediaType === "tv") {
		const seasonEpisodeCounts: Record<string, number> = {};
		if (seasonList) {
			for (const s of seasonList) {
				if (s.seasonNumber > 0) {
					seasonEpisodeCounts[String(s.seasonNumber)] = s.episodeCount;
				}
			}
		}
		addToTracker.mutate(
			{ tmdbId, seasonEpisodeCounts },
			{
				onSuccess: () => {
```

- [ ] **Step 3: Check if seasonList is passed from the parent component**

Search for where `TitleActions` is rendered to verify `seasonList` is passed. If it's already passed from the title page (which has `TitleData.seasonList`), no additional changes needed. If not, add it to the parent.

Run: `grep -n "TitleActions" src/routes/app/title.*.tsx src/components/title/*.tsx`

Fix any missing prop pass-through.

- [ ] **Step 4: Commit**

```bash
git add src/components/title/title-actions.tsx
git commit -m "feat: pass seasonEpisodeCounts when adding show to tracker"
```

---

### Task 6: Tests for new condition types

**Files:**
- Modify: `src/lib/__tests__/evaluate-achievements.test.ts`

- [ ] **Step 1: Add mock for userTitle query**

In the `vi.hoisted` block, add a mock for `userTitle` queries. The existing mock setup chains `select → from → where`. The new conditions query `userTitle`, `episodeWatch`, and `journalEntry` tables. Since all queries go through the same mock chain, the existing mock infrastructure works — we just need to set up the right return values per test.

Also add `mockGroupBy` to the hoisted block:

```typescript
const mockGroupBy = vi.fn();
```

And update the `mockWhere` default to support `.groupBy()`:

In `resetMocks()`, after `mockWhere.mockResolvedValue([])`, add:

```typescript
mockGroupBy.mockResolvedValue([]);
mockWhere.mockReturnValue({ groupBy: mockGroupBy });
```

Wait — this conflicts with the default `mockWhere.mockResolvedValue([])`. The mock needs to handle both `.where()` returning a promise (for simple queries) and `.where().groupBy()` (for binge check). Handle this by making `mockWhere` return an object with `groupBy` that is also thenable:

Actually, the simpler approach: since the existing tests rely on `mockWhere.mockResolvedValue`, and we just need `.groupBy()` for the binge check, add `mockGroupBy` to the chain. In `resetMocks()`:

```typescript
mockGroupBy.mockResolvedValue([]);
mockWhere.mockResolvedValue([]);
// Also make mockWhere chainable for .groupBy()
mockWhere.mockImplementation(() => {
	const result = Promise.resolve([]);
	(result as any).groupBy = mockGroupBy;
	return result;
});
```

This makes `mockWhere` return a thenable that also has `.groupBy()`.

- [ ] **Step 2: Add mock for db.selectDistinct (journalAllScopes)**

The existing `mockSelectDistinct` mock is already set up. It chains `selectDistinct → from → where`. The `journalAllScopes` condition uses `selectDistinct`.

- [ ] **Step 3: Write tests for `trackedShowCount`**

```typescript
describe("trackedShowCount condition", () => {
	it("returns now-showing when user tracks their first show", async () => {
		mockWhere.mockResolvedValueOnce([]); // earned
		mockWhere.mockResolvedValueOnce([{ value: 1 }]); // trackedShowCount
		mockWhere.mockResolvedValue([{ value: 0 }]);

		const result = await evaluateAchievements(USER_ID, "show_tracked");

		expect(result).toContain("now-showing");
	});

	it("does not return now-showing when no shows tracked", async () => {
		mockWhere.mockResolvedValueOnce([]); // earned
		mockWhere.mockResolvedValue([{ value: 0 }]);

		const result = await evaluateAchievements(USER_ID, "show_tracked");

		expect(result).not.toContain("now-showing");
	});
});
```

- [ ] **Step 4: Write tests for `episodeWatchCount`**

```typescript
describe("episodeWatchCount condition", () => {
	it("returns episode-one when 50 episodes watched", async () => {
		mockWhere.mockResolvedValueOnce([]); // earned
		// trackedShowCount (now-showing already earned or not — set high)
		mockWhere.mockResolvedValueOnce([{ value: 1 }]); // trackedShowCount for now-showing
		mockWhere.mockResolvedValueOnce([{ value: 50 }]); // episodeWatchCount
		mockWhere.mockResolvedValue([{ value: 0 }]);

		const result = await evaluateAchievements(USER_ID, "episode_marked");

		expect(result).toContain("episode-one");
	});
});
```

- [ ] **Step 5: Write tests for `journalEntryCount`**

```typescript
describe("journalEntryCount condition", () => {
	it("returns dear-diary when first journal entry is written", async () => {
		mockWhere.mockResolvedValueOnce([]); // earned
		mockWhere.mockResolvedValueOnce([{ value: 1 }]); // journalEntryCount
		mockWhere.mockResolvedValue([{ value: 0 }]);

		const result = await evaluateAchievements(USER_ID, "journal_entry");

		expect(result).toContain("dear-diary");
	});
});
```

- [ ] **Step 6: Write tests for `journalAllScopes`**

```typescript
describe("journalAllScopes condition", () => {
	it("returns triple-take when all three scopes exist", async () => {
		mockWhere.mockResolvedValueOnce([]); // earned
		mockWhere.mockResolvedValueOnce([{ value: 5 }]); // journalEntryCount (dear-diary)
		mockWhere.mockResolvedValueOnce([{ value: 5 }]); // journalEntryCount (frequent-writer)
		// journalAllScopes uses selectDistinct
		mockWhere.mockResolvedValueOnce([
			{ scope: "episode" },
			{ scope: "season" },
			{ scope: "show" },
		]);
		mockWhere.mockResolvedValue([{ value: 0 }]);

		const result = await evaluateAchievements(USER_ID, "journal_entry");

		expect(result).toContain("triple-take");
	});

	it("does not return triple-take when missing a scope", async () => {
		mockWhere.mockResolvedValueOnce([]); // earned
		mockWhere.mockResolvedValueOnce([{ value: 5 }]); // journalEntryCount
		mockWhere.mockResolvedValueOnce([{ value: 5 }]); // journalEntryCount
		mockWhere.mockResolvedValueOnce([
			{ scope: "episode" },
			{ scope: "season" },
		]); // missing "show"
		mockWhere.mockResolvedValue([{ value: 0 }]);

		const result = await evaluateAchievements(USER_ID, "journal_entry");

		expect(result).not.toContain("triple-take");
	});
});
```

- [ ] **Step 7: Write test for `startedRewatch`**

```typescript
describe("startedRewatch condition", () => {
	it("returns rerun when a rewatch has been started", async () => {
		mockWhere.mockResolvedValueOnce([]); // earned
		mockWhere.mockResolvedValueOnce([{ value: 1 }]); // startedRewatch
		mockWhere.mockResolvedValue([{ value: 0 }]);

		const result = await evaluateAchievements(USER_ID, "rewatch_started");

		expect(result).toContain("rerun");
	});
});
```

- [ ] **Step 8: Run tests**

Run: `bunx vitest run src/lib/__tests__/evaluate-achievements.test.ts`

Expected: All tests pass. If mock ordering issues arise, adjust the `mockResolvedValueOnce` chain to match the actual query order (achievements are evaluated in array order, so the mock calls follow the order conditions appear in `ACHIEVEMENTS`).

- [ ] **Step 9: Commit**

```bash
git add src/lib/__tests__/evaluate-achievements.test.ts
git commit -m "test: add tests for new achievement condition types"
```

---

### Task 7: Verify and fix

- [ ] **Step 1: Run full test suite**

Run: `bunx vitest run`

Expected: All tests pass. Fix any type errors or import issues.

- [ ] **Step 2: Run type check**

Run: `bunx tsc --noEmit`

Expected: No type errors. The new condition types in the union must be exhaustively handled in the `switch` statement (enforced by `condition satisfies never` at the end).

- [ ] **Step 3: Run lint**

Run: `bunx biome check src/lib/achievements.ts src/lib/evaluate-achievements.ts src/integrations/trpc/routers/episode-tracker.ts src/integrations/trpc/routers/journal-entry.ts src/components/title/title-actions.tsx`

Expected: No lint errors. Fix any that appear.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: address type/lint issues from new achievements"
```
