# Rewatch Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users rewatch shows from the tracker, preserving old progress/notes while starting a fresh watch-through with independent episode tracking.

**Architecture:** Add a `watchNumber` column to `episodeWatch`, `journalEntry`, and `watchEvent` tables, and a `currentWatchNumber` column to `userTitle`. All queries filter by the active watch number. A new `startRewatch` mutation increments the counter. The UI gets a rewatch button (hover on dashboard card, persistent on detail page), a confirmation modal, and a watch-through switcher on the detail page.

**Tech Stack:** Drizzle ORM (Postgres), tRPC, React, Radix UI Dialog, TanStack Query, Tailwind CSS, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-02-rewatch-feature-design.md`

---

## File Map

**Modify:**
- `src/db/schema.ts` — Add `watchNumber` to 3 tables, `currentWatchNumber` to `userTitle`, update unique index
- `src/integrations/trpc/routers/episode-tracker.ts` — Add `startRewatch`, `getWatchNumber`; update `markEpisodes`, `unmarkEpisode`, `getForShow`, `getTrackedShows`
- `src/integrations/trpc/routers/journal-entry.ts` — Update `create` to tag with `watchNumber`
- `src/integrations/trpc/routers/watch-event.ts` — Update `create` to tag with `watchNumber`
- `src/components/tracker/tracker-show-card.tsx` — Add hover rewatch button + rewatch badge
- `src/routes/app/tracker.index.tsx` — Wire rewatch flow on dashboard
- `src/routes/app/tracker.$tmdbId.tsx` — Add rewatch button, watch-through switcher, read-only mode, note labels
- `src/components/tracker/season-row.tsx` — Accept `readOnly` prop

**Create:**
- `src/components/tracker/rewatch-confirm-modal.tsx` — Confirmation dialog for starting a rewatch

---

### Task 1: Schema Changes

**Files:**
- Modify: `src/db/schema.ts:111-132` (userTitle), `src/db/schema.ts:441-470` (episodeWatch), `src/db/schema.ts:267-310` (watchEvent), `src/db/schema.ts:472-498` (journalEntry)

- [ ] **Step 1: Add `currentWatchNumber` to `userTitle`**

In `src/db/schema.ts`, inside the `userTitle` table definition, add after the `createdAt` field (line 120):

```typescript
currentWatchNumber: integer("current_watch_number").default(1).notNull(),
```

- [ ] **Step 2: Add `watchNumber` to `episodeWatch` and update unique index**

In `src/db/schema.ts`, inside the `episodeWatch` table definition, add after the `watchEventId` field (line 457):

```typescript
watchNumber: integer("watch_number").default(1).notNull(),
```

Update the unique index (line 461) to include `watchNumber`:

```typescript
uniqueIndex("episode_watch_unique").on(
    table.userId,
    table.tmdbId,
    table.seasonNumber,
    table.episodeNumber,
    table.watchNumber,
),
```

- [ ] **Step 3: Add `watchNumber` to `watchEvent`**

In `src/db/schema.ts`, inside the `watchEvent` table definition, add after the `scopeEpisodeNumber` field (around line 289):

```typescript
watchNumber: integer("watch_number").default(1).notNull(),
```

- [ ] **Step 4: Add `watchNumber` to `journalEntry`**

In `src/db/schema.ts`, inside the `journalEntry` table definition, add after the `isPublic` field (around line 488):

```typescript
watchNumber: integer("watch_number").default(1).notNull(),
```

- [ ] **Step 5: Push schema to database**

Run: `bunx drizzle-kit push`
Expected: Schema changes applied, new columns added with default value 1 for all existing rows.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(schema): add watchNumber columns for rewatch tracking"
```

---

### Task 2: Backend — `startRewatch` and `getWatchNumber` Procedures

**Files:**
- Modify: `src/integrations/trpc/routers/episode-tracker.ts:1-10` (imports), add new procedures

- [ ] **Step 1: Add `userTitle` import if not present**

In `src/integrations/trpc/routers/episode-tracker.ts`, the import on line 6 already includes `userTitle`:
```typescript
import { episodeWatch, journalEntry, userTitle } from "#/db/schema";
```
No change needed.

- [ ] **Step 2: Add `startRewatch` mutation**

Add this procedure to the `episodeTrackerRouter` object, after `addShow` (after line 24):

```typescript
/** Start a rewatch — increments currentWatchNumber on userTitle */
startRewatch: protectedProcedure
    .input(z.object({ tmdbId: z.number() }))
    .mutation(async ({ input, ctx }) => {
        const [updated] = await db
            .update(userTitle)
            .set({
                currentWatchNumber: sql`${userTitle.currentWatchNumber} + 1`,
            })
            .where(
                and(
                    eq(userTitle.userId, ctx.userId),
                    eq(userTitle.tmdbId, input.tmdbId),
                    eq(userTitle.mediaType, "tv"),
                ),
            )
            .returning({ currentWatchNumber: userTitle.currentWatchNumber });
        if (!updated) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Show not found in tracker",
            });
        }
        return { currentWatchNumber: updated.currentWatchNumber };
    }),
```

- [ ] **Step 3: Add `getWatchNumber` query**

Add this procedure to the `episodeTrackerRouter` object, after `startRewatch`:

```typescript
/** Get the current watch number for a show */
getWatchNumber: protectedProcedure
    .input(z.object({ tmdbId: z.number() }))
    .query(async ({ input, ctx }) => {
        const title = await db.query.userTitle.findFirst({
            where: and(
                eq(userTitle.userId, ctx.userId),
                eq(userTitle.tmdbId, input.tmdbId),
                eq(userTitle.mediaType, "tv"),
            ),
            columns: { currentWatchNumber: true },
        });
        return { currentWatchNumber: title?.currentWatchNumber ?? 1 };
    }),
```

- [ ] **Step 4: Verify server compiles**

Run: `bun run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/trpc/routers/episode-tracker.ts
git commit -m "feat(api): add startRewatch and getWatchNumber procedures"
```

---

### Task 3: Backend — Update Episode Tracker Queries

**Files:**
- Modify: `src/integrations/trpc/routers/episode-tracker.ts`

- [ ] **Step 1: Update `markEpisodes` to use current watch number**

Replace the `markEpisodes` mutation body (lines 41-51) with:

```typescript
.mutation(async ({ input, ctx }) => {
    const title = await db.query.userTitle.findFirst({
        where: and(
            eq(userTitle.userId, ctx.userId),
            eq(userTitle.tmdbId, input.tmdbId),
            eq(userTitle.mediaType, "tv"),
        ),
        columns: { currentWatchNumber: true },
    });
    const watchNum = title?.currentWatchNumber ?? 1;

    const values = input.episodes.map((ep) => ({
        userId: ctx.userId,
        tmdbId: input.tmdbId,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        runtime: ep.runtime,
        watchEventId: input.watchEventId ?? null,
        watchNumber: watchNum,
    }));
    await db.insert(episodeWatch).values(values).onConflictDoNothing();
    return { marked: input.episodes.length };
}),
```

- [ ] **Step 2: Update `unmarkEpisode` to filter by current watch number**

Replace the `unmarkEpisode` mutation body (lines 63-81) with:

```typescript
.mutation(async ({ input, ctx }) => {
    const title = await db.query.userTitle.findFirst({
        where: and(
            eq(userTitle.userId, ctx.userId),
            eq(userTitle.tmdbId, input.tmdbId),
            eq(userTitle.mediaType, "tv"),
        ),
        columns: { currentWatchNumber: true },
    });
    const watchNum = title?.currentWatchNumber ?? 1;

    const deleted = await db
        .delete(episodeWatch)
        .where(
            and(
                eq(episodeWatch.userId, ctx.userId),
                eq(episodeWatch.tmdbId, input.tmdbId),
                eq(episodeWatch.seasonNumber, input.seasonNumber),
                eq(episodeWatch.episodeNumber, input.episodeNumber),
                eq(episodeWatch.watchNumber, watchNum),
            ),
        )
        .returning();
    if (deleted.length === 0) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Episode not found",
        });
    }
    return { runtime: deleted[0].runtime };
}),
```

- [ ] **Step 3: Update `getForShow` to accept optional `watchNumber`**

Replace the `getForShow` query (lines 85-96) with:

```typescript
/** Get watched episodes for a show, optionally for a specific watch-through */
getForShow: protectedProcedure
    .input(
        z.object({
            tmdbId: z.number(),
            watchNumber: z.number().optional(),
        }),
    )
    .query(async ({ input, ctx }) => {
        let targetWatchNumber = input.watchNumber;
        if (targetWatchNumber == null) {
            const title = await db.query.userTitle.findFirst({
                where: and(
                    eq(userTitle.userId, ctx.userId),
                    eq(userTitle.tmdbId, input.tmdbId),
                    eq(userTitle.mediaType, "tv"),
                ),
                columns: { currentWatchNumber: true },
            });
            targetWatchNumber = title?.currentWatchNumber ?? 1;
        }
        return db.query.episodeWatch.findMany({
            where: and(
                eq(episodeWatch.userId, ctx.userId),
                eq(episodeWatch.tmdbId, input.tmdbId),
                eq(episodeWatch.watchNumber, targetWatchNumber),
            ),
            orderBy: [episodeWatch.seasonNumber, episodeWatch.episodeNumber],
        });
    }),
```

- [ ] **Step 4: Update `getTrackedShows` to filter by current watch number and include it in response**

Replace the `getTrackedShows` query (lines 99-163) with:

```typescript
/** Get all tracked shows for the dashboard */
getTrackedShows: protectedProcedure.query(async ({ ctx }) => {
    // Fetch user titles with currentWatchNumber
    const trackedShows = await db
        .select({
            tmdbId: userTitle.tmdbId,
            currentWatchNumber: userTitle.currentWatchNumber,
            createdAt: sql<string>`${userTitle.createdAt}`,
        })
        .from(userTitle)
        .where(
            and(eq(userTitle.userId, ctx.userId), eq(userTitle.mediaType, "tv")),
        );
    const watchNumMap = new Map(
        trackedShows.map((t) => [t.tmdbId, t.currentWatchNumber]),
    );

    // Episode watches grouped by tmdbId + watchNumber
    const episodeRows = await db
        .select({
            tmdbId: episodeWatch.tmdbId,
            watchNumber: episodeWatch.watchNumber,
            episodeCount: sql<number>`count(*)::int`,
            totalRuntime: sql<number>`coalesce(sum(${episodeWatch.runtime}), 0)::int`,
            lastWatchedAt: sql<string>`max(${episodeWatch.watchedAt})`,
        })
        .from(episodeWatch)
        .where(eq(episodeWatch.userId, ctx.userId))
        .groupBy(episodeWatch.tmdbId, episodeWatch.watchNumber);

    // Keep only rows matching the current watch-through
    const episodeShows = episodeRows
        .filter((r) => r.watchNumber === (watchNumMap.get(r.tmdbId) ?? 1))
        .map(({ watchNumber: _, ...rest }) => rest);

    // Shows with only journal entries (no episode watches)
    const journalOnlyShows = await db
        .select({
            tmdbId: journalEntry.tmdbId,
            lastCreatedAt: sql<string>`max(${journalEntry.createdAt})`,
        })
        .from(journalEntry)
        .where(eq(journalEntry.userId, ctx.userId))
        .groupBy(journalEntry.tmdbId);

    // Merge: episode shows take priority, then journal-only, then tracker-only
    const episodeTmdbIds = new Set(episodeShows.map((s) => s.tmdbId));
    const journalOnly = journalOnlyShows
        .filter((s) => !episodeTmdbIds.has(s.tmdbId))
        .map((s) => ({
            tmdbId: s.tmdbId,
            episodeCount: 0,
            totalRuntime: 0,
            lastWatchedAt: s.lastCreatedAt,
            currentWatchNumber: watchNumMap.get(s.tmdbId) ?? 1,
        }));

    const knownTmdbIds = new Set([
        ...episodeTmdbIds,
        ...journalOnly.map((s) => s.tmdbId),
    ]);
    const trackerOnly = trackedShows
        .filter((s) => !knownTmdbIds.has(s.tmdbId))
        .map((s) => ({
            tmdbId: s.tmdbId,
            episodeCount: 0,
            totalRuntime: 0,
            lastWatchedAt: s.createdAt,
            currentWatchNumber: s.currentWatchNumber,
        }));

    const withWatchNum = episodeShows.map((s) => ({
        ...s,
        currentWatchNumber: watchNumMap.get(s.tmdbId) ?? 1,
    }));

    return [...withWatchNum, ...journalOnly, ...trackerOnly].sort(
        (a, b) =>
            new Date(b.lastWatchedAt).getTime() -
            new Date(a.lastWatchedAt).getTime(),
    );
}),
```

- [ ] **Step 5: Verify server compiles**

Run: `bun run build`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/routers/episode-tracker.ts
git commit -m "feat(api): update episode tracker queries for rewatch support"
```

---

### Task 4: Backend — Update Journal Entry and Watch Event Create

**Files:**
- Modify: `src/integrations/trpc/routers/journal-entry.ts:1-37`
- Modify: `src/integrations/trpc/routers/watch-event.ts:1-71`

- [ ] **Step 1: Update `journalEntry.create` to include `watchNumber`**

In `src/integrations/trpc/routers/journal-entry.ts`, add `userTitle` to the import on line 6:

```typescript
import { journalEntry, userTitle } from "#/db/schema";
```

Add `and, eq` to the drizzle-orm import on line 3:

```typescript
import { and, desc, eq, sql } from "drizzle-orm";
```

Replace the `create` mutation body (lines 22-36) with:

```typescript
.mutation(async ({ input, ctx }) => {
    const title = await db.query.userTitle.findFirst({
        where: and(
            eq(userTitle.userId, ctx.userId),
            eq(userTitle.tmdbId, input.tmdbId),
            eq(userTitle.mediaType, "tv"),
        ),
        columns: { currentWatchNumber: true },
    });
    const watchNum = title?.currentWatchNumber ?? 1;

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
            watchNumber: watchNum,
        })
        .returning();
    return entry;
}),
```

- [ ] **Step 2: Update `watchEvent.create` to include `watchNumber`**

In `src/integrations/trpc/routers/watch-event.ts`, add `userTitle` to the import on line 8:

```typescript
import {
    friendship,
    journalEntry,
    userTitle,
    watchEvent,
    watchEventCompanion,
    watchlist,
    watchlistItem,
    watchlistMember,
} from "#/db/schema";
```

In the `create` mutation body (around line 42), before the genre fetch, add the watch number lookup:

```typescript
.mutation(async ({ input, ctx }) => {
    // Get current watch number for TV shows
    let watchNum = 1;
    if (input.mediaType === "tv") {
        const title = await db.query.userTitle.findFirst({
            where: and(
                eq(userTitle.userId, ctx.userId),
                eq(userTitle.tmdbId, input.tmdbId),
                eq(userTitle.mediaType, "tv"),
            ),
            columns: { currentWatchNumber: true },
        });
        watchNum = title?.currentWatchNumber ?? 1;
    }

    let genreIds: number[] | null = null;
    // ... rest of existing code ...
```

Then in the `db.insert(watchEvent).values({...})` call (around line 51-71), add `watchNumber`:

```typescript
const [event] = await db
    .insert(watchEvent)
    .values({
        userId: ctx.userId,
        tmdbId: input.tmdbId,
        mediaType: input.mediaType,
        titleName: input.titleName ?? "",
        rating: input.rating ?? null,
        note: input.note ?? null,
        title: input.titleName ?? null,
        posterPath: input.posterPath ?? null,
        watchedAt: input.watchedAt ? new Date(input.watchedAt) : new Date(),
        reviewReminderAt: input.remindMe
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            : null,
        genreIds,
        scope: input.scope ?? null,
        scopeSeasonNumber: input.scopeSeasonNumber ?? null,
        scopeEpisodeNumber: input.scopeEpisodeNumber ?? null,
        watchNumber: watchNum,
    })
    .returning();
```

- [ ] **Step 3: Verify server compiles**

Run: `bun run build`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/journal-entry.ts src/integrations/trpc/routers/watch-event.ts
git commit -m "feat(api): tag journal entries and watch events with watchNumber"
```

---

### Task 5: Rewatch Confirmation Modal Component

**Files:**
- Create: `src/components/tracker/rewatch-confirm-modal.tsx`

- [ ] **Step 1: Create the rewatch confirmation modal**

Create `src/components/tracker/rewatch-confirm-modal.tsx`:

```tsx
import { RotateCcw } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";

interface RewatchConfirmModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	titleName: string;
	isComplete: boolean;
	watchedCount: number;
	totalEpisodes: number;
	currentWatchNumber: number;
	onConfirm: () => void;
	isPending?: boolean;
}

export function RewatchConfirmModal({
	open,
	onOpenChange,
	titleName,
	isComplete,
	watchedCount,
	totalEpisodes,
	currentWatchNumber,
	onConfirm,
	isPending,
}: RewatchConfirmModalProps) {
	const watchLabel =
		currentWatchNumber === 1
			? "Watch 1"
			: `Rewatch ${currentWatchNumber}`;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogOverlay className="bg-black/80 backdrop-blur-sm" />
				<DialogPrimitive.Content
					className="fixed inset-0 z-50 flex items-center justify-center outline-none"
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<div
						className="relative mx-6 flex max-w-sm flex-col items-center gap-5 rounded-xl px-8 py-8 text-center"
						style={{
							background:
								"linear-gradient(160deg, rgba(20,16,32,0.98) 0%, rgba(12,10,24,0.99) 100%)",
							border: "1px solid rgba(255,45,120,0.2)",
							boxShadow:
								"0 0 40px rgba(255,45,120,0.08), 0 8px 32px rgba(0,0,0,0.6)",
						}}
					>
						{/* Icon */}
						<div
							className="flex h-12 w-12 items-center justify-center rounded-full"
							style={{
								background: "rgba(255,45,120,0.1)",
								border: "1px solid rgba(255,45,120,0.25)",
								boxShadow: "0 0 20px rgba(255,45,120,0.1)",
							}}
						>
							<RotateCcw
								className="h-5 w-5 text-neon-pink"
								style={{
									filter: "drop-shadow(0 0 6px rgba(255,45,120,0.5))",
								}}
							/>
						</div>

						{/* Title */}
						<h2 className="font-display text-xl tracking-wide text-cream leading-tight">
							Start rewatching{" "}
							<span className="text-neon-pink">{titleName}</span>?
						</h2>

						{/* Description */}
						{isComplete ? (
							<p className="text-sm text-cream/40 leading-relaxed max-w-[280px]">
								Your progress and notes from {watchLabel} are saved.
								You'll start fresh tracking episodes again.
							</p>
						) : (
							<p className="text-sm text-cream/40 leading-relaxed max-w-[280px]">
								You haven't finished this show yet — you've watched{" "}
								<span className="text-cream/60">{watchedCount}</span> of{" "}
								<span className="text-cream/60">{totalEpisodes}</span>{" "}
								episodes. Your progress is saved but you'll be starting a
								fresh watch-through.
							</p>
						)}

						{/* Buttons */}
						<div className="mt-1 flex w-full flex-col gap-2.5">
							<button
								type="button"
								onClick={() => {
									onConfirm();
								}}
								disabled={isPending}
								className="w-full rounded-full px-6 py-2.5 font-mono-retro text-xs tracking-wider uppercase transition-all duration-200 hover:scale-[1.03] disabled:opacity-40 disabled:pointer-events-none"
								style={{
									background:
										"linear-gradient(135deg, rgba(255,45,120,0.2), rgba(255,45,120,0.1))",
									border: "1px solid rgba(255,45,120,0.4)",
									color: "#FF2D78",
									textShadow: "0 0 8px rgba(255,45,120,0.3)",
									boxShadow:
										"0 0 20px rgba(255,45,120,0.12), inset 0 1px 0 rgba(255,45,120,0.1)",
								}}
							>
								{isComplete ? "Start Rewatch" : "Start Rewatch Anyway"}
							</button>

							<button
								type="button"
								onClick={() => onOpenChange(false)}
								className="w-full rounded-full px-6 py-2 font-mono-retro text-[10px] tracking-wider uppercase text-cream/30 transition-colors duration-200 hover:text-cream/50"
								style={{
									border: "1px solid rgba(255,255,240,0.08)",
								}}
							>
								Cancel
							</button>
						</div>
					</div>
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/rewatch-confirm-modal.tsx
git commit -m "feat(ui): add rewatch confirmation modal component"
```

---

### Task 6: Dashboard Card — Hover Rewatch Button + Rewatch Badge

**Files:**
- Modify: `src/components/tracker/tracker-show-card.tsx`
- Modify: `src/routes/app/tracker.index.tsx`

- [ ] **Step 1: Add `currentWatchNumber` and `onRewatch` props to `TrackerShowCard`**

In `src/components/tracker/tracker-show-card.tsx`, add to the `TrackerShowCardProps` interface (after line 22):

```typescript
currentWatchNumber?: number;
onRewatch?: (tmdbId: number) => void;
```

Add `currentWatchNumber` and `onRewatch` to the destructured props (line 66-81):

```typescript
export function TrackerShowCard({
	tmdbId,
	title,
	posterPath,
	backdropPath,
	episodeCount,
	totalEpisodes,
	totalRuntime,
	showStatus,
	rating,
	genres: _genres,
	year,
	contentRating,
	seasonList,
	onRemove,
	currentWatchNumber = 1,
	onRewatch,
}: TrackerShowCardProps) {
```

Add the `RotateCcw` icon to the import from lucide-react (line 2):

```typescript
import { Clock, RotateCcw, Star, X } from "lucide-react";
```

- [ ] **Step 2: Add hover rewatch button to the card**

In `src/components/tracker/tracker-show-card.tsx`, after the remove button block (after line 225, after the closing of the `onRemove &&` block), add:

```tsx
{/* Rewatch button (top-left, appears on hover) */}
{onRewatch && (
    <button
        type="button"
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRewatch(tmdbId);
        }}
        className="absolute top-2 left-2 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1 opacity-0 transition-all duration-200 group-hover:opacity-100"
        style={{
            background: "rgba(255,45,120,0.15)",
            border: "1px solid rgba(255,45,120,0.3)",
            backdropFilter: "blur(4px)",
            color: "#FF2D78",
            fontSize: "8px",
            fontFamily: "var(--font-mono-retro)",
            letterSpacing: "1.5px",
            textTransform: "uppercase" as const,
            textShadow: "0 0 6px rgba(255,45,120,0.3)",
        }}
        onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = "rgba(255,45,120,0.25)";
            el.style.borderColor = "rgba(255,45,120,0.5)";
        }}
        onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = "rgba(255,45,120,0.15)";
            el.style.borderColor = "rgba(255,45,120,0.3)";
        }}
        title="Rewatch this show"
    >
        <RotateCcw className="h-2.5 w-2.5" />
        Rewatch
    </button>
)}
```

- [ ] **Step 3: Add rewatch badge to metadata area**

In `src/components/tracker/tracker-show-card.tsx`, inside the metadata `<div>` (around line 292), after the status badge `<span>` block (after line 316), add:

```tsx
{currentWatchNumber > 1 && (
    <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono-retro"
        style={{
            fontSize: "8px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#FF2D78",
            background: "rgba(255,45,120,0.12)",
            textShadow: "0 0 8px rgba(255,45,120,0.35)",
            boxShadow: "0 0 10px rgba(255,45,120,0.08)",
        }}
    >
        Watch {currentWatchNumber}
    </span>
)}
```

- [ ] **Step 4: Wire rewatch in `tracker.index.tsx`**

In `src/routes/app/tracker.index.tsx`, add these imports at the top:

```typescript
import { RewatchConfirmModal } from "#/components/tracker/rewatch-confirm-modal";
```

Add state and mutation inside `TrackerDashboard()`, after the `removeShow` mutation (after line 130):

```typescript
const [rewatchTarget, setRewatchTarget] = useState<number | null>(null);

const startRewatch = useMutation(
    trpc.episodeTracker.startRewatch.mutationOptions({
        onSuccess: (data) => {
            queryClient.invalidateQueries(
                trpc.episodeTracker.getTrackedShows.queryFilter(),
            );
            setRewatchTarget(null);
            toast.success(
                `Rewatch started — you're on Watch ${data.currentWatchNumber}`,
            );
        },
        onError: () => {
            toast.error("Failed to start rewatch");
        },
    }),
);

const rewatchShow = rewatchTarget
    ? showsWithDetails.find((s) => s.tmdbId === rewatchTarget)
    : null;
const rewatchIsComplete = rewatchShow
    ? (rewatchShow.details.status === "Ended" ||
          rewatchShow.details.status === "Canceled") &&
      (rewatchShow.details.episodes ?? 0) > 0 &&
      rewatchShow.episodeCount >= (rewatchShow.details.episodes ?? 0)
    : false;
```

Update the `showsWithDetails` type to include `currentWatchNumber` (around line 57). The type assertion at line 57 should become:

```typescript
.filter(Boolean) as Array<{
    tmdbId: number;
    episodeCount: number;
    totalRuntime: number;
    lastWatchedAt: string;
    currentWatchNumber: number;
    details: {
        title: string;
        posterPath: string | null;
        backdropPath: string | null;
        status?: string;
        episodes?: number;
        genres: string[];
        year: string;
        contentRating: string;
        seasonList?: Array<{
            seasonNumber: number;
            episodeCount: number;
            name: string;
        }>;
    };
}>;
```

Pass `currentWatchNumber` and `onRewatch` to every `<TrackerShowCard>` in both the watching and completed sections. Add to both TrackerShowCard usages:

```tsx
currentWatchNumber={show.currentWatchNumber}
onRewatch={setRewatchTarget}
```

Add the modal just before the closing `</div>` of the root (before the last `</div>` in the return):

```tsx
{/* Rewatch confirmation modal */}
<RewatchConfirmModal
    open={rewatchTarget !== null}
    onOpenChange={(open) => {
        if (!open) setRewatchTarget(null);
    }}
    titleName={rewatchShow?.details.title ?? ""}
    isComplete={rewatchIsComplete}
    watchedCount={rewatchShow?.episodeCount ?? 0}
    totalEpisodes={rewatchShow?.details.episodes ?? 0}
    currentWatchNumber={rewatchShow?.currentWatchNumber ?? 1}
    onConfirm={() => {
        if (rewatchTarget) {
            startRewatch.mutate({ tmdbId: rewatchTarget });
        }
    }}
    isPending={startRewatch.isPending}
/>
```

- [ ] **Step 5: Verify it compiles and renders**

Run: `bun run build`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/tracker/tracker-show-card.tsx src/routes/app/tracker.index.tsx
git commit -m "feat(ui): add rewatch button and badge to tracker dashboard cards"
```

---

### Task 7: Show Detail Page — Rewatch Button, Switcher, Read-Only Mode

**Files:**
- Modify: `src/routes/app/tracker.$tmdbId.tsx`
- Modify: `src/components/tracker/season-row.tsx`

- [ ] **Step 1: Add `readOnly` prop to `SeasonSection`**

In `src/components/tracker/season-row.tsx`, add to the `SeasonSectionProps` interface:

```typescript
readOnly?: boolean;
```

Destructure it in the component function signature. When `readOnly` is true, disable the "Mark Season" button and make individual episode clicks no-ops. In the component, update the episode card and mark-all button:

Find the "Mark Season" button (it has text "Mark Season" or similar). Wrap it with a `readOnly` check — when `readOnly`, hide the button:

```tsx
{!readOnly && unwatchedEpisodes.length > 0 && (
    // existing Mark Season button
)}
```

Pass `readOnly` through to the EpisodeCard callbacks — when `readOnly`, replace `onMark`/`onUnmark` with no-ops:

```tsx
<EpisodeCard
    key={...}
    tmdbId={tmdbId}
    seasonNumber={ep.seasonNumber}
    episodeNumber={ep.episodeNumber}
    name={ep.name}
    runtime={ep.runtime}
    isWatched={isWatched}
    onMark={readOnly ? () => {} : (ep) => onMark([ep])}
    onUnmark={readOnly ? () => {} : onUnmark}
/>
```

- [ ] **Step 2: Update the show detail page with rewatch features**

In `src/routes/app/tracker.$tmdbId.tsx`, add imports:

```typescript
import { RotateCcw } from "lucide-react";
import { RewatchConfirmModal } from "#/components/tracker/rewatch-confirm-modal";
```

Inside `ShowTracker()`, add state for the rewatch flow and watch-through switcher, after the existing state declarations (after line 31):

```typescript
const [rewatchOpen, setRewatchOpen] = useState(false);
const [selectedWatchNumber, setSelectedWatchNumber] = useState<number | null>(null);
```

Add the `getWatchNumber` query after the existing queries (after line 55):

```typescript
const { data: watchNumberData } = useQuery(
    trpc.episodeTracker.getWatchNumber.queryOptions({ tmdbId }),
);
const currentWatchNumber = watchNumberData?.currentWatchNumber ?? 1;
```

Compute the active watch number (the one being viewed):

```typescript
const activeWatchNumber = selectedWatchNumber ?? currentWatchNumber;
const isViewingOldWatch = activeWatchNumber < currentWatchNumber;
```

Update the `getForShow` query to pass the active watch number. Replace the existing `getForShow` query (lines 39-41):

```typescript
const { data: watchedRows, isLoading: isLoadingWatched } = useQuery(
    trpc.episodeTracker.getForShow.queryOptions({
        tmdbId,
        watchNumber: activeWatchNumber,
    }),
);
```

Add the `startRewatch` mutation after the `createReminder` mutation:

```typescript
const startRewatchMut = useMutation(
    trpc.episodeTracker.startRewatch.mutationOptions({
        onSuccess: (data) => {
            queryClient.invalidateQueries(
                trpc.episodeTracker.getForShow.queryFilter(),
            );
            queryClient.invalidateQueries(
                trpc.episodeTracker.getTrackedShows.queryFilter(),
            );
            queryClient.invalidateQueries(
                trpc.episodeTracker.getWatchNumber.queryFilter(),
            );
            setRewatchOpen(false);
            setSelectedWatchNumber(null);
            toast.success(
                `Rewatch started — you're on Watch ${data.currentWatchNumber}`,
            );
        },
        onError: () => {
            toast.error("Failed to start rewatch");
        },
    }),
);
```

- [ ] **Step 3: Add the rewatch button to the action bar**

In the action buttons `<div>` (around line 414), add the rewatch button after the "Mark All" button:

```tsx
<button
    type="button"
    onClick={() => setRewatchOpen(true)}
    className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-mono-retro tracking-wider uppercase text-neon-pink transition-colors hover:bg-neon-pink/10"
    style={{ border: "1px solid rgba(255,45,120,0.2)" }}
>
    <RotateCcw className="h-3.5 w-3.5" />
    Rewatch
</button>
```

- [ ] **Step 4: Add the watch-through switcher**

Below the progress section (after the action buttons `<div>`, before the episode list), add the switcher:

```tsx
{/* Watch-through switcher */}
{currentWatchNumber > 1 && (
    <div className="mb-10">
        <div className="flex items-center gap-2 flex-wrap">
            {Array.from({ length: currentWatchNumber }, (_, i) => i + 1).map(
                (num) => {
                    const isActive = num === activeWatchNumber;
                    return (
                        <button
                            key={num}
                            type="button"
                            onClick={() =>
                                setSelectedWatchNumber(
                                    num === currentWatchNumber ? null : num,
                                )
                            }
                            className="rounded-full px-3 py-1 text-[10px] font-mono-retro tracking-wider uppercase transition-all duration-200"
                            style={{
                                color: isActive
                                    ? "#FF2D78"
                                    : "rgba(255,255,240,0.3)",
                                background: isActive
                                    ? "rgba(255,45,120,0.15)"
                                    : "transparent",
                                border: isActive
                                    ? "1px solid rgba(255,45,120,0.3)"
                                    : "1px solid rgba(255,255,240,0.1)",
                                textShadow: isActive
                                    ? "0 0 8px rgba(255,45,120,0.3)"
                                    : "none",
                            }}
                        >
                            {num === 1 ? "Watch 1" : `Rewatch ${num}`}
                        </button>
                    );
                },
            )}
        </div>
        {isViewingOldWatch && (
            <p className="mt-2 text-[10px] font-mono-retro tracking-wider text-cream/25">
                Viewing {activeWatchNumber === 1 ? "Watch 1" : `Rewatch ${activeWatchNumber}`} (read-only)
            </p>
        )}
    </div>
)}
```

- [ ] **Step 5: Pass `readOnly` to `SeasonSection` and conditionally hide action buttons**

Update every `<SeasonSection>` in the episode list to include `readOnly`:

```tsx
<SeasonSection
    key={group.seasonNumber}
    tmdbId={tmdbId}
    seasonNumber={group.seasonNumber}
    seasonName={group.seasonName}
    episodes={group.episodes}
    watchedEpisodes={watchedSet}
    onMark={handleMark}
    onUnmark={handleUnmark}
    readOnly={isViewingOldWatch}
/>
```

Hide the "Write", "Mark All", and "Rewatch" action buttons when viewing an old watch-through. Wrap the action buttons div with:

```tsx
{!isViewingOldWatch && (
    <div className="flex items-center gap-3 mb-10">
        {/* ... existing buttons including the new Rewatch button ... */}
    </div>
)}
```

- [ ] **Step 6: Add the rewatch confirmation modal**

Before the closing `</div>` of the component, after the `WriteAboutModal`, add:

```tsx
{/* Rewatch confirmation modal */}
<RewatchConfirmModal
    open={rewatchOpen}
    onOpenChange={setRewatchOpen}
    titleName={titleData?.title ?? ""}
    isComplete={isComplete}
    watchedCount={watchedCount}
    totalEpisodes={totalEpisodes}
    currentWatchNumber={currentWatchNumber}
    onConfirm={() => {
        startRewatchMut.mutate({ tmdbId });
    }}
    isPending={startRewatchMut.isPending}
/>
```

- [ ] **Step 7: Verify it compiles**

Run: `bun run build`
Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
git add src/routes/app/tracker.\$tmdbId.tsx src/components/tracker/season-row.tsx
git commit -m "feat(ui): add rewatch button, watch-through switcher, and read-only mode"
```

---

### Task 8: Notes & Reviews — Watch-Through Labels

**Files:**
- Modify: `src/routes/app/tracker.$tmdbId.tsx` (NotesAndReviewsSection component)

- [ ] **Step 1: Add watch-through badge to journal notes**

In `src/routes/app/tracker.$tmdbId.tsx`, update the `NotesAndReviewsSectionProps` interface. The `journalEntries` array items need `watchNumber`:

```typescript
journalEntries: Array<{
    id: string;
    scope: string;
    seasonNumber: number | null;
    episodeNumber: number | null;
    note: string;
    isPublic: boolean;
    createdAt: Date;
    watchNumber: number;
}>;
```

The `watchEvents` array items also need `watchNumber`:

```typescript
watchEvents: Array<{
    id: string;
    rating: number | null;
    note: string | null;
    scope: string | null;
    scopeSeasonNumber: number | null;
    scopeEpisodeNumber: number | null;
    watchedAt: Date;
    createdAt: Date;
    watchNumber: number;
}>;
```

- [ ] **Step 2: Add watch-through badge to the note rendering**

In the `NotesAndReviewsSection` component, inside the note item rendering (the `item.type === "note"` branch), in the top row `<div>` with scope badge and time, add a watch-through badge after the scope badge:

```tsx
<span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-pink/[0.06] font-mono-retro text-[9px] tracking-wider text-neon-pink/40">
    {entry.watchNumber === 1
        ? "Watch 1"
        : `Rewatch ${entry.watchNumber}`}
</span>
```

- [ ] **Step 3: Add watch-through badge to the review rendering**

Similarly, in the review item rendering (the `item.type === "review"` branch), add the same badge in the top row after the scope badge:

```tsx
<span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-pink/[0.06] font-mono-retro text-[9px] tracking-wider text-neon-pink/40">
    {event.watchNumber === 1
        ? "Watch 1"
        : `Rewatch ${event.watchNumber}`}
</span>
```

- [ ] **Step 4: Verify it compiles**

Run: `bun run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/app/tracker.\$tmdbId.tsx
git commit -m "feat(ui): add watch-through labels to notes and reviews timeline"
```
