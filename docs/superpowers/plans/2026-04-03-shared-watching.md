# Shared Watching & Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reciprocal watch events for companions, three-tier visibility (public/private/companion), and inline episode review prompts.

**Architecture:** Replace `reviewPublic` boolean with `visibility` enum and add `originEventId` self-referential FK on `watchEvent`. Reciprocal events are regular watch event rows owned by the companion, with `originEventId` pointing to the original. Visibility filtering happens in all feed/profile queries. Episode review prompt is a client-side popup triggered after `markEpisodes` mutation succeeds.

**Tech Stack:** Drizzle ORM (Postgres), tRPC, React, TanStack Query, Sonner (toasts), Lucide icons, Tailwind CSS.

---

## Task 1: Schema — Replace `reviewPublic` with `visibility` and add `originEventId`

**Files:**
- Modify: `src/db/schema.ts:268-312` (watchEvent table)
- Modify: `src/db/schema.ts:651-658` (watchEventRelations)

- [ ] **Step 1: Replace `reviewPublic` with `visibility` and add `originEventId` to the watchEvent table**

In `src/db/schema.ts`, inside the `watchEvent` table definition, replace the `reviewPublic` line and add `originEventId`:

```typescript
// REMOVE this line:
reviewPublic: boolean("review_public").default(true).notNull(),

// ADD these two lines (place visibility where reviewPublic was, originEventId after it):
visibility: text("visibility").default("public").notNull(), // 'public' | 'private' | 'companion'
originEventId: text("origin_event_id").references(() => watchEvent.id, { onDelete: "set null" }),
```

- [ ] **Step 2: Add the `originEvent` relation to `watchEventRelations`**

In `src/db/schema.ts`, update the `watchEventRelations` to include the self-referential relation:

```typescript
export const watchEventRelations = relations(watchEvent, ({ one, many }) => ({
	user: one(user, {
		fields: [watchEvent.userId],
		references: [user.id],
	}),
	originEvent: one(watchEvent, {
		fields: [watchEvent.originEventId],
		references: [watchEvent.id],
		relationName: "reciprocal",
	}),
	companions: many(watchEventCompanion),
	episodeWatches: many(episodeWatch),
}));
```

- [ ] **Step 3: Push schema changes**

Run: `bunx drizzle-kit push`

Expected: Schema updated with `visibility` column (text, default 'public'), `origin_event_id` column (text, nullable FK), and `review_public` column removed.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: replace reviewPublic with visibility enum and add originEventId"
```

---

## Task 2: Update `watchEvent.create` — reciprocal events and adapted notifications

**Files:**
- Modify: `src/integrations/trpc/routers/watch-event.ts:26-159` (create procedure)
- Modify: `src/integrations/trpc/routers/notification.ts:8-22` (NOTIFICATION_TYPES)

- [ ] **Step 1: Add `companion_reviewed` to notification types**

In `src/integrations/trpc/routers/notification.ts`, add `"companion_reviewed"` to the `NOTIFICATION_TYPES` array:

```typescript
const NOTIFICATION_TYPES = [
	"watchlist_item_added",
	"watchlist_member_joined",
	"shuffle_match",
	"item_watched",
	"watchlist_invite",
	"friend_request",
	"friend_request_accepted",
	"title_reviewed",
	"recommendation_received",
	"recommendation_reviewed",
	"recommendation_watched",
	"review_reminder",
	"watched_with",
	"companion_reviewed",
] as const;
```

- [ ] **Step 2: Add `visibility` to the create input schema**

In `src/integrations/trpc/routers/watch-event.ts`, add `visibility` to the create procedure's input:

```typescript
visibility: z.enum(["public", "private", "companion"]).optional().default("public"),
```

Add this after the `scopeEpisodeNumber` field in the input schema.

- [ ] **Step 3: Include `visibility` in the insert values**

In the `db.insert(watchEvent).values(...)` call inside create, add:

```typescript
visibility: input.visibility,
```

Add this after the `watchNumber: watchNum` line (line 91).

- [ ] **Step 4: Add reciprocal event creation and adapted notifications in the companion loop**

Replace the entire companion block (lines 95-118) with:

```typescript
if (input.companions && input.companions.length > 0) {
	await db.insert(watchEventCompanion).values(
		input.companions.map((c) => ({
			watchEventId: event.id,
			friendId: c.friendId ?? null,
			name: c.name,
		})),
	);

	const hasReview = !!(input.rating || input.note);
	const creator = await db.query.user.findFirst({
		where: eq(user.id, ctx.userId),
		columns: { username: true },
	});

	for (const c of input.companions) {
		if (!c.friendId) continue;

		// Dedup: skip if companion already has a watch event for this title+scope
		const existing = await db.query.watchEvent.findFirst({
			where: and(
				eq(watchEvent.userId, c.friendId),
				eq(watchEvent.tmdbId, input.tmdbId),
				...(input.scope
					? [
							eq(watchEvent.scope, input.scope),
							...(input.scopeSeasonNumber != null
								? [eq(watchEvent.scopeSeasonNumber, input.scopeSeasonNumber)]
								: []),
							...(input.scopeEpisodeNumber != null
								? [eq(watchEvent.scopeEpisodeNumber, input.scopeEpisodeNumber)]
								: []),
						]
					: [sql`${watchEvent.scope} IS NULL`]),
				eq(watchEvent.watchNumber, watchNum),
			),
		});

		if (!existing) {
			// Create reciprocal event
			const [reciprocal] = await db
				.insert(watchEvent)
				.values({
					userId: c.friendId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					titleName: input.titleName ?? "",
					rating: null,
					note: null,
					title: input.titleName ?? null,
					posterPath: input.posterPath ?? null,
					watchedAt: input.watchedAt ? new Date(input.watchedAt) : new Date(),
					genreIds,
					scope: input.scope ?? null,
					scopeSeasonNumber: input.scopeSeasonNumber ?? null,
					scopeEpisodeNumber: input.scopeEpisodeNumber ?? null,
					watchNumber: watchNum,
					originEventId: event.id,
					visibility: "public",
				})
				.returning();

			// Add companion link on the reciprocal event (pointing back to the creator)
			await db.insert(watchEventCompanion).values({
				watchEventId: reciprocal.id,
				friendId: ctx.userId,
				name: creator?.username ?? "",
			});
		}

		// Send notification
		await createNotification({
			recipientId: c.friendId,
			actorId: ctx.userId,
			type: hasReview ? "companion_reviewed" : "watched_with",
			data: {
				tmdbId: input.tmdbId,
				mediaType: input.mediaType,
				titleName: input.titleName ?? "",
				watchEventId: event.id,
				scope: input.scope ?? null,
				scopeSeasonNumber: input.scopeSeasonNumber ?? null,
				scopeEpisodeNumber: input.scopeEpisodeNumber ?? null,
			},
		});
	}
}
```

**Important:** Ensure `user` is imported from `#/db/schema` at the top of the file (see Task 3, Step 4).

- [ ] **Step 5: Verify the create procedure compiles**

Run: `bun run build`

Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/routers/watch-event.ts src/integrations/trpc/routers/notification.ts
git commit -m "feat: create reciprocal watch events for companions with adapted notifications"
```

---

## Task 3: Update `watchEvent.update` — sync companion additions/removals

**Files:**
- Modify: `src/integrations/trpc/routers/watch-event.ts:161-242` (update procedure)

- [ ] **Step 1: Add `visibility` to the update input schema**

In the update procedure's input, add:

```typescript
visibility: z.enum(["public", "private", "companion"]).optional(),
```

- [ ] **Step 2: Include `visibility` in the update set**

In the `db.update(watchEvent).set(...)` call, add:

```typescript
...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
```

- [ ] **Step 3: Handle companion changes — delete reciprocals for removed companions, create for added**

After the existing companion update block (where companions are deleted and re-inserted), add logic to sync reciprocal events. Replace the entire companion handling section (lines 209-238) with:

```typescript
if (input.companions !== undefined) {
	// Get old companions before deleting
	const oldCompanions = await db.query.watchEventCompanion.findMany({
		where: eq(watchEventCompanion.watchEventId, input.id),
	});
	const oldFriendIds = new Set(
		oldCompanions.filter((c) => c.friendId).map((c) => c.friendId as string),
	);

	// Replace companions
	await db
		.delete(watchEventCompanion)
		.where(eq(watchEventCompanion.watchEventId, input.id));

	if (input.companions.length > 0) {
		await db.insert(watchEventCompanion).values(
			input.companions.map((c) => ({
				watchEventId: input.id,
				friendId: c.friendId ?? null,
				name: c.name,
			})),
		);
	}

	const newFriendIds = new Set(
		input.companions.filter((c) => c.friendId).map((c) => c.friendId as string),
	);

	// Delete reciprocal events for removed companions
	for (const oldId of oldFriendIds) {
		if (!newFriendIds.has(oldId)) {
			await db
				.delete(watchEvent)
				.where(
					and(
						eq(watchEvent.userId, oldId),
						eq(watchEvent.originEventId, input.id),
					),
				);
		}
	}

	// Create reciprocal events for newly added companions
	const creator = await db.query.user.findFirst({
		where: eq(user.id, ctx.userId),
		columns: { username: true },
	});

	for (const c of input.companions) {
		if (!c.friendId || oldFriendIds.has(c.friendId)) continue;

		// Dedup check
		const existingEvent = await db.query.watchEvent.findFirst({
			where: and(
				eq(watchEvent.userId, c.friendId),
				eq(watchEvent.tmdbId, existing.tmdbId),
				eq(watchEvent.watchNumber, existing.watchNumber),
				...(existing.scope
					? [
							eq(watchEvent.scope, existing.scope),
							...(existing.scopeSeasonNumber != null
								? [eq(watchEvent.scopeSeasonNumber, existing.scopeSeasonNumber)]
								: []),
							...(existing.scopeEpisodeNumber != null
								? [eq(watchEvent.scopeEpisodeNumber, existing.scopeEpisodeNumber)]
								: []),
						]
					: [sql`${watchEvent.scope} IS NULL`]),
			),
		});

		if (!existingEvent) {
			const [reciprocal] = await db
				.insert(watchEvent)
				.values({
					userId: c.friendId,
					tmdbId: existing.tmdbId,
					mediaType: existing.mediaType,
					titleName: input.titleName ?? existing.titleName,
					rating: null,
					note: null,
					title: input.titleName ?? existing.title,
					posterPath: existing.posterPath,
					watchedAt: existing.watchedAt,
					genreIds: existing.genreIds,
					scope: existing.scope,
					scopeSeasonNumber: existing.scopeSeasonNumber,
					scopeEpisodeNumber: existing.scopeEpisodeNumber,
					watchNumber: existing.watchNumber,
					originEventId: input.id,
					visibility: "public",
				})
				.returning();

			await db.insert(watchEventCompanion).values({
				watchEventId: reciprocal.id,
				friendId: ctx.userId,
				name: creator?.username ?? "",
			});
		}

		// Notify new companion
		const hasReview = !!(existing.rating || existing.note || input.rating || input.note);
		await createNotification({
			recipientId: c.friendId,
			actorId: ctx.userId,
			type: hasReview ? "companion_reviewed" : "watched_with",
			data: {
				tmdbId: existing.tmdbId,
				mediaType: existing.mediaType,
				titleName: input.titleName ?? existing.titleName,
				watchEventId: input.id,
			},
		});
	}
}
```

- [ ] **Step 4: Add `user` import if not already imported**

Ensure the `user` table is imported at the top of the file:

```typescript
import {
	friendship,
	journalEntry,
	user,
	userTitle,
	watchEvent,
	watchEventCompanion,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
```

- [ ] **Step 5: Verify compilation**

Run: `bun run build`

Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/routers/watch-event.ts
git commit -m "feat: sync reciprocal events on companion add/remove during update"
```

---

## Task 4: Update `watchEvent.create` — upgrade flow (replace reciprocal with authored event)

**Files:**
- Modify: `src/integrations/trpc/routers/watch-event.ts:49-93` (inside create, before the insert)

- [ ] **Step 1: Add upgrade logic before inserting the new event**

After the `genreIds` fetch block (around line 70) and before the `db.insert(watchEvent)` call, add:

```typescript
// Upgrade: if user has a reciprocal event for this title+scope, delete it
const existingReciprocal = await db.query.watchEvent.findFirst({
	where: and(
		eq(watchEvent.userId, ctx.userId),
		eq(watchEvent.tmdbId, input.tmdbId),
		sql`${watchEvent.originEventId} IS NOT NULL`,
		...(input.scope
			? [
					eq(watchEvent.scope, input.scope),
					...(input.scopeSeasonNumber != null
						? [eq(watchEvent.scopeSeasonNumber, input.scopeSeasonNumber)]
						: []),
					...(input.scopeEpisodeNumber != null
						? [eq(watchEvent.scopeEpisodeNumber, input.scopeEpisodeNumber)]
						: []),
				]
			: [sql`${watchEvent.scope} IS NULL`]),
		eq(watchEvent.watchNumber, watchNum),
	),
});

if (existingReciprocal) {
	await db.delete(watchEvent).where(eq(watchEvent.id, existingReciprocal.id));
}
```

- [ ] **Step 2: Verify compilation**

Run: `bun run build`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/watch-event.ts
git commit -m "feat: upgrade reciprocal events when user creates their own authored event"
```

---

## Task 5: Visibility filtering in `getFeed`, `getForTitle`, and `getUserEvents`

**Files:**
- Modify: `src/integrations/trpc/routers/watch-event.ts:291-347` (getForTitle, getUserEvents)
- Modify: `src/integrations/trpc/routers/watch-event.ts:370-510` (getFeed)

- [ ] **Step 1: Update `getForTitle` to filter by visibility**

Replace the `getForTitle` query (lines 300-312) with:

```typescript
.query(async ({ input, ctx }) => {
	const targetUserId = input.userId ?? ctx.userId;
	const isOwnProfile = targetUserId === ctx.userId;

	const events = await db.query.watchEvent.findMany({
		where: and(
			eq(watchEvent.userId, targetUserId),
			eq(watchEvent.tmdbId, input.tmdbId),
			eq(watchEvent.mediaType, input.mediaType),
			// Visibility filter: own = see all; other user = public only + companion if viewer is companion
			...(!isOwnProfile
				? [
						or(
							eq(watchEvent.visibility, "public"),
							// companion visibility: viewer must be a companion on this event
							sql`(${watchEvent.visibility} = 'companion' AND EXISTS (
								SELECT 1 FROM watch_event_companion
								WHERE watch_event_companion.watch_event_id = ${watchEvent.id}
								AND watch_event_companion.friend_id = ${ctx.userId}
							))`,
						),
					]
				: []),
		),
		with: {
			companions: true,
			originEvent: {
				with: {
					user: { columns: { id: true, username: true, avatarUrl: true } },
				},
				columns: {
					id: true,
					rating: true,
					note: true,
					visibility: true,
					userId: true,
				},
			},
		},
		orderBy: (e, { desc }) => [desc(e.watchedAt)],
	});
	return events;
}),
```

- [ ] **Step 2: Update `getUserEvents` to filter by visibility**

Update the `getUserEvents` query (lines 323-346). Add visibility filtering and include `originEvent`:

```typescript
.query(async ({ input, ctx }) => {
	const isOwnProfile = input.userId === ctx.userId;

	const events = await db.query.watchEvent.findMany({
		where: and(
			eq(watchEvent.userId, input.userId),
			...(input.cursor
				? [
						sql`${watchEvent.watchedAt} < (SELECT watched_at FROM watch_event WHERE id = ${input.cursor})`,
					]
				: []),
			...(!isOwnProfile
				? [
						or(
							eq(watchEvent.visibility, "public"),
							sql`(${watchEvent.visibility} = 'companion' AND EXISTS (
								SELECT 1 FROM watch_event_companion
								WHERE watch_event_companion.watch_event_id = ${watchEvent.id}
								AND watch_event_companion.friend_id = ${ctx.userId}
							))`,
						),
					]
				: []),
		),
		with: {
			companions: true,
			originEvent: {
				with: {
					user: { columns: { id: true, username: true, avatarUrl: true } },
				},
				columns: {
					id: true,
					rating: true,
					note: true,
					visibility: true,
					userId: true,
				},
			},
		},
		orderBy: (e, { desc }) => [desc(e.watchedAt)],
		limit: input.limit + 1,
	});

	const hasMore = events.length > input.limit;
	const items = hasMore ? events.slice(0, input.limit) : events;

	return {
		items,
		nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
	};
}),
```

- [ ] **Step 3: Update `getFeed` to filter by visibility and include originEvent**

In the `getFeed` procedure, update the watch events query (lines 405-422). Add visibility filtering:

```typescript
const watchEvents = await db.query.watchEvent.findMany({
	where: and(
		inArray(watchEvent.userId, userIds),
		...(cursorDate ? [sql`${watchEvent.createdAt} < ${cursorDate}`] : []),
		// Exclude private events from other users
		or(
			eq(watchEvent.userId, ctx.userId),
			eq(watchEvent.visibility, "public"),
			sql`(${watchEvent.visibility} = 'companion' AND EXISTS (
				SELECT 1 FROM watch_event_companion
				WHERE watch_event_companion.watch_event_id = ${watchEvent.id}
				AND watch_event_companion.friend_id = ${ctx.userId}
			))`,
		),
	),
	with: {
		companions: true,
		user: {
			columns: {
				id: true,
				username: true,
				avatarUrl: true,
			},
		},
		originEvent: {
			with: {
				user: { columns: { id: true, username: true, avatarUrl: true } },
			},
			columns: {
				id: true,
				rating: true,
				note: true,
				visibility: true,
				userId: true,
			},
		},
	},
	orderBy: (e, { desc }) => [desc(e.createdAt)],
	limit: input.limit + 1,
});
```

- [ ] **Step 4: Verify compilation**

Run: `bun run build`

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/trpc/routers/watch-event.ts
git commit -m "feat: add visibility filtering to feed and profile queries with originEvent joins"
```

---

## Task 6: Remove `reviewPublic` references from codebase

**Files:**
- Search and modify any file referencing `reviewPublic`

- [ ] **Step 1: Find all references to `reviewPublic`**

Run: `grep -rn "reviewPublic\|review_public" src/ --include="*.ts" --include="*.tsx"`

Remove or replace every reference found. The `reviewPublic` column no longer exists; it's been replaced by `visibility`.

- [ ] **Step 2: Verify compilation**

Run: `bun run build`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove all reviewPublic references, replaced by visibility"
```

---

## Task 7: Review modal — add visibility selector

**Files:**
- Modify: `src/components/watched/review-modal.tsx`

- [ ] **Step 1: Add visibility state and the selector UI**

In `ReviewModal`, add a `visibility` state variable alongside the existing state:

```typescript
const [visibility, setVisibility] = useState<"public" | "private" | "companion">("public");
```

Reset it in the `useEffect` that runs on `open`:

```typescript
if (editEvent) {
	// ... existing state resets ...
	setVisibility(editEvent.visibility ?? "public");
} else {
	// ... existing state resets ...
	setVisibility("public");
}
```

- [ ] **Step 2: Update the `editEvent` prop type to include `visibility`**

In the `WatchEventModalProps` interface, update the `editEvent` type:

```typescript
editEvent?: {
	id: string;
	rating: number | null;
	note: string | null;
	watchedAt: string;
	companions: Companion[];
	visibility?: string;
};
```

- [ ] **Step 3: Pass `visibility` to both create and update mutations**

In `handleSave`, add `visibility` to both mutation calls:

```typescript
// In the createEvent.mutate call:
visibility,

// In the updateEvent.mutate call:
visibility,
```

- [ ] **Step 4: Add the visibility selector UI between the "Watched with" button and the "Save" button**

Add this block after the "Watched with" button and before the "Save & Done" button:

```tsx
{/* Visibility selector */}
<div>
	<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
		Visibility
	</div>
	<div className="flex gap-1.5">
		{([
			{ value: "public" as const, label: "Public", icon: "🌐" },
			{ value: "companion" as const, label: "Shared", icon: "👥" },
			{ value: "private" as const, label: "Private", icon: "🔒" },
		]).map((opt) => {
			const isSelected = visibility === opt.value;
			const isDisabled = opt.value === "companion" && companions.length === 0;
			return (
				<button
					key={opt.value}
					type="button"
					onClick={() => !isDisabled && setVisibility(opt.value)}
					disabled={isDisabled}
					className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-all duration-200 ${
						isSelected
							? "bg-neon-amber/10 border-neon-amber/35"
							: isDisabled
								? "bg-transparent border-cream/[0.04] opacity-30 cursor-not-allowed"
								: "bg-cream/[0.02] border-cream/[0.08] hover:border-cream/15"
					}`}
				>
					<span className="text-sm">{opt.icon}</span>
					<span className={`text-[11px] font-medium ${
						isSelected ? "text-neon-amber" : "text-cream/40"
					}`}>
						{opt.label}
					</span>
				</button>
			);
		})}
	</div>
</div>
```

- [ ] **Step 5: Also pass `visibility` in the update mutation input schema**

In `src/integrations/trpc/routers/watch-event.ts`, the update input already has `visibility` from Task 3. Verify the `updateEvent.mutate` call in the modal passes it:

```typescript
updateEvent.mutate({
	id: editEvent.id,
	rating: rating ?? null,
	note: note.trim() || null,
	watchedAt: watchedAtISO,
	companions,
	titleName,
	visibility,
});
```

- [ ] **Step 6: Verify compilation**

Run: `bun run build`

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/watched/review-modal.tsx
git commit -m "feat: add visibility selector (public/shared/private) to review modal"
```

---

## Task 8: Watch event card — privacy badges and reciprocal attribution

**Files:**
- Modify: `src/components/watched/watch-event-card.tsx`

- [ ] **Step 1: Update the `WatchEventCardProps` interface to include new fields**

Update the `event` type in the interface:

```typescript
interface WatchEventCardProps {
	event: {
		id: string;
		tmdbId: number;
		mediaType: string;
		rating: number | null;
		note: string | null;
		watchedAt: Date | string;
		createdAt?: Date | string;
		companions: Array<{ friendId: string | null; name: string }>;
		visibility?: string;
		originEventId?: string | null;
		originEvent?: {
			id: string;
			rating: number | null;
			note: string | null;
			visibility: string;
			userId: string;
			user: {
				id: string;
				username: string | null;
				avatarUrl: string | null;
			};
		} | null;
	};
	showTitle?: { name: string };
	actor?: {
		id: string;
		username: string | null;
		avatarUrl: string | null;
	};
	isOwn: boolean;
	onEdit?: (event: {
		id: string;
		rating: number | null;
		note: string | null;
		watchedAt: string;
		companions: Companion[];
		visibility?: string;
	}) => void;
}
```

- [ ] **Step 2: Add privacy badge rendering**

Import `Lock` and `Users` from lucide-react at the top:

```typescript
import { Lock, MoreHorizontal, Pencil, Star, Trash2, Users } from "lucide-react";
```

Inside the component, before the return, compute the badge:

```typescript
const isPrivate = event.visibility === "private";
const isCompanionOnly = event.visibility === "companion";
```

Add the badge inside the card div, as the first child (before the header row):

```tsx
{/* Privacy badge */}
{isOwn && (isPrivate || isCompanionOnly) && (
	<div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded ${
		isPrivate
			? "bg-cream/[0.05]"
			: "bg-neon-cyan/[0.06]"
	}`}>
		{isPrivate ? (
			<Lock className="h-2.5 w-2.5 text-cream/35" />
		) : (
			<Users className="h-2.5 w-2.5 text-neon-cyan/50" />
		)}
		<span className={`text-[9px] font-mono-retro uppercase tracking-wider ${
			isPrivate ? "text-cream/35" : "text-neon-cyan/50"
		}`}>
			{isPrivate ? "Private" : "Shared"}
		</span>
	</div>
)}
```

- [ ] **Step 3: Adjust card border based on visibility**

Update the card's border style in the outer div:

```tsx
<div
	className={`relative rounded-[10px] border p-4 transition-all hover:-translate-y-px ${
		isPrivate
			? "border-cream/[0.08] hover:border-cream/15"
			: isCompanionOnly
				? "border-neon-cyan/15 hover:border-neon-cyan/25"
				: "border-neon-amber/20 hover:border-neon-amber/30"
	}`}
	style={{
		background:
			"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
		boxShadow: "0 0 12px rgba(255,184,0,0.04), 0 4px 16px rgba(0,0,0,0.3)",
	}}
>
```

- [ ] **Step 4: Add reciprocal attribution block**

After the note row (after the closing `}` of the `event.note` block), add:

```tsx
{/* Reciprocal attribution — original reviewer's review */}
{event.originEvent && event.originEvent.rating != null && (
	(() => {
		// Gate by original's visibility
		const orig = event.originEvent;
		const canSeeReview =
			orig.visibility === "public" ||
			(orig.visibility === "companion" && isOwn);
		if (!canSeeReview) return null;

		return (
			<div
				className="mt-2.5 py-2 px-3 rounded-r-md"
				style={{
					background: "rgba(255,184,0,0.03)",
					borderLeft: "2px solid rgba(255,184,0,0.3)",
				}}
			>
				<div className="flex items-center gap-1.5 mb-1">
					<div className="w-4 h-4 rounded-full bg-neon-amber/15 flex items-center justify-center text-[7px] font-semibold text-neon-amber shrink-0">
						{(orig.user?.username?.charAt(0) ?? "?").toUpperCase()}
					</div>
					<span className="text-[10px] font-semibold text-neon-amber/60">
						{orig.user?.username ?? "Someone"}'s review
					</span>
					{orig.rating && (
						<div className="flex items-center gap-0.5 ml-auto">
							{[1, 2, 3, 4, 5].map((s) => (
								<Star
									key={s}
									className={`h-[11px] w-[11px] ${
										s <= (orig.rating ?? 0)
											? "text-neon-amber fill-neon-amber"
											: "text-cream/8"
									}`}
								/>
							))}
						</div>
					)}
				</div>
				{orig.note && (
					<p className="text-[12px] text-cream/45 italic line-clamp-2">
						{orig.note}
					</p>
				)}
			</div>
		);
	})()
)}
```

- [ ] **Step 5: Pass visibility in onEdit callback**

Update `handleEdit` to include visibility:

```typescript
function handleEdit() {
	setMenuOpen(false);
	onEdit?.({
		id: event.id,
		rating: event.rating,
		note: event.note,
		watchedAt: new Date(event.watchedAt).toISOString(),
		companions: event.companions.map((c) => ({
			friendId: c.friendId ?? undefined,
			name: c.name,
		})),
		visibility: event.visibility,
	});
}
```

- [ ] **Step 6: Verify compilation**

Run: `bun run build`

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/watched/watch-event-card.tsx
git commit -m "feat: add privacy badges and reciprocal review attribution to watch event card"
```

---

## Task 9: Feed page — pass originEvent data through to cards

**Files:**
- Modify: `src/routes/app/feed.tsx:134-155`

- [ ] **Step 1: Update the edit modal handler to pass visibility**

In the feed page, find where `setEditModal` is called (around line 145-153). Update it to include `visibility`:

```typescript
onEdit={(e) =>
	setEditModal({
		open: true,
		tmdbId: event.tmdbId,
		mediaType: event.mediaType as "movie" | "tv",
		titleName: event.title ?? `Title #${event.tmdbId}`,
		event: { ...e, visibility: event.visibility },
	})
}
```

- [ ] **Step 2: Update the editModal state type to include visibility**

Find the state type for `editModal` and ensure the `event` property includes `visibility?: string`.

- [ ] **Step 3: Pass `visibility` to the ReviewModal from the edit modal state**

Find where `ReviewModal` is rendered and pass through `editEvent` including visibility.

- [ ] **Step 4: Verify compilation**

Run: `bun run build`

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/app/feed.tsx
git commit -m "feat: wire visibility through feed edit flow"
```

---

## Task 10: Notification UI — `companion_reviewed` type and tracker prompt

**Files:**
- Modify: `src/components/notifications/notification-item.tsx:35-123`

- [ ] **Step 1: Add the `companion_reviewed` case to `getNotificationMessage`**

In the `switch` statement inside `getNotificationMessage`, add this case before the `watched_with` case:

```typescript
case "companion_reviewed":
	return {
		text: `shared their thoughts on ${data.titleName || "a title"} that you watched together`,
		link: data.tmdbId
			? `/app/title/${data.mediaType}/${data.tmdbId}`
			: undefined,
	};
```

- [ ] **Step 2: Add action buttons for `companion_reviewed` notifications**

After the review reminder actions block (around line 336), add:

```tsx
{/* Companion reviewed actions */}
{n.type === "companion_reviewed" && !n.actionTaken && (
	<div className="flex gap-2 mt-1.5 flex-wrap">
		<button
			type="button"
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				setActionTaken.mutate({ id: n.id, action: "review" });
				navigate({
					to: "/app/title/$mediaType/$tmdbId",
					params: {
						mediaType: data.mediaType as "movie" | "tv",
						tmdbId: Number(data.tmdbId),
					},
				});
			}}
			className="px-2.5 py-1 rounded text-[11px] font-semibold bg-neon-cyan/10 border border-neon-cyan/25 text-neon-cyan/80 hover:bg-neon-cyan/20 hover:border-neon-cyan/40 transition-all"
		>
			Add yours
		</button>
		{data.mediaType === "tv" && (
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					setActionTaken.mutate({ id: n.id, action: "tracked" });
					// Mark in tracker — add show and mark episodes
					markInTracker.mutate({
						tmdbId: Number(data.tmdbId),
						scope: data.scope as string | null,
						scopeSeasonNumber: data.scopeSeasonNumber as number | null,
						scopeEpisodeNumber: data.scopeEpisodeNumber as number | null,
					});
				}}
				className="px-2.5 py-1 rounded text-[11px] font-semibold bg-neon-amber/10 border border-neon-amber/25 text-neon-amber/80 hover:bg-neon-amber/20 hover:border-neon-amber/40 transition-all"
			>
				Mark in tracker
			</button>
		)}
	</div>
)}
{n.type === "companion_reviewed" && n.actionTaken === "review" && (
	<span className="mt-1 inline-block text-[10px] text-neon-cyan/60">
		Reviewed
	</span>
)}
{n.type === "companion_reviewed" && n.actionTaken === "tracked" && (
	<span className="mt-1 inline-block text-[10px] text-neon-amber/60">
		Marked in tracker
	</span>
)}
```

- [ ] **Step 3: Add the `markInTracker` mutation**

At the top of the `NotificationItem` component, add a mutation for the tracker action:

```typescript
const markInTracker = useMutation(
	trpc.episodeTracker.markFromNotification.mutationOptions({
		onSuccess: () => {
			toast.success("Marked in your tracker");
			queryClient.invalidateQueries(trpc.episodeTracker.getForShow.queryFilter());
			queryClient.invalidateQueries(trpc.episodeTracker.getTrackedShows.queryFilter());
		},
		onError: () => {
			toast.error("Failed to mark in tracker");
		},
	}),
);
```

This references a new `markFromNotification` procedure we'll create in the next task.

- [ ] **Step 4: Import `toast` from sonner**

```typescript
import { toast } from "sonner";
```

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/notification-item.tsx
git commit -m "feat: add companion_reviewed notification UI with review and tracker actions"
```

---

## Task 11: Episode tracker — `markFromNotification` procedure

**Files:**
- Modify: `src/integrations/trpc/routers/episode-tracker.ts`

- [ ] **Step 1: Add the `markFromNotification` procedure**

Add this new procedure to the `episodeTrackerRouter` object:

```typescript
/** Mark episodes from a companion notification — adds show to tracker and marks relevant episodes */
markFromNotification: protectedProcedure
	.input(
		z.object({
			tmdbId: z.number(),
			scope: z.string().nullable(),
			scopeSeasonNumber: z.number().nullable(),
			scopeEpisodeNumber: z.number().nullable(),
		}),
	)
	.mutation(async ({ input, ctx }) => {
		// Add show to tracker if not already tracked
		await db
			.insert(userTitle)
			.values({
				userId: ctx.userId,
				tmdbId: input.tmdbId,
				mediaType: "tv",
			})
			.onConflictDoNothing();

		const title = await db.query.userTitle.findFirst({
			where: and(
				eq(userTitle.userId, ctx.userId),
				eq(userTitle.tmdbId, input.tmdbId),
				eq(userTitle.mediaType, "tv"),
			),
			columns: { currentWatchNumber: true },
		});
		const watchNum = title?.currentWatchNumber ?? 1;

		// Mark specific episode if scoped
		if (input.scope === "episode" && input.scopeSeasonNumber != null && input.scopeEpisodeNumber != null) {
			const seasonData = await fetchSeasonDetails(input.tmdbId, input.scopeSeasonNumber);
			const episode = seasonData.find(
				(ep: { episodeNumber: number }) => ep.episodeNumber === input.scopeEpisodeNumber,
			);
			if (episode) {
				await db
					.insert(episodeWatch)
					.values({
						userId: ctx.userId,
						tmdbId: input.tmdbId,
						seasonNumber: input.scopeSeasonNumber,
						episodeNumber: input.scopeEpisodeNumber,
						runtime: episode.runtime ?? 0,
						watchNumber: watchNum,
					})
					.onConflictDoNothing();
			}
		} else if (input.scope === "season" && input.scopeSeasonNumber != null) {
			// Mark entire season
			const episodes = await fetchSeasonDetails(input.tmdbId, input.scopeSeasonNumber);
			if (episodes.length > 0) {
				await db
					.insert(episodeWatch)
					.values(
						episodes.map((ep: { episodeNumber: number; runtime: number | null }) => ({
							userId: ctx.userId,
							tmdbId: input.tmdbId,
							seasonNumber: input.scopeSeasonNumber as number,
							episodeNumber: ep.episodeNumber,
							runtime: ep.runtime ?? 0,
							watchNumber: watchNum,
						})),
					)
					.onConflictDoNothing();
			}
		}

		return { success: true };
	}),
```

- [ ] **Step 2: Verify compilation**

Run: `bun run build`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/episode-tracker.ts
git commit -m "feat: add markFromNotification procedure for companion tracker actions"
```

---

## Task 12: Inline episode review prompt (TV only)

**Files:**
- Modify: `src/routes/app/tracker.$tmdbId.tsx`

- [ ] **Step 1: Add state for the episode review prompt**

Near the top of the `ShowTracker` component (around lines 95-100), add:

```typescript
const [reviewPromptEpisode, setReviewPromptEpisode] = useState<{
	seasonNumber: number;
	episodeNumber: number;
} | null>(null);
const [reviewModalOpen, setReviewModalOpen] = useState(false);
```

- [ ] **Step 2: Trigger the prompt after successful mark**

In the `markEpisodes` mutation's `onSuccess` callback (lines 142-169), after the toast, add:

```typescript
// Prompt for episode review (only for single episode marks)
if (variables.episodes.length === 1) {
	const ep = variables.episodes[0];
	setReviewPromptEpisode({
		seasonNumber: ep.seasonNumber,
		episodeNumber: ep.episodeNumber,
	});
} else if (variables.episodes.length > 1) {
	// Batch: prompt for the last episode only
	const lastEp = variables.episodes[variables.episodes.length - 1];
	setReviewPromptEpisode({
		seasonNumber: lastEp.seasonNumber,
		episodeNumber: lastEp.episodeNumber,
	});
}
```

- [ ] **Step 3: Render the review prompt dialog**

Import the `ReviewModal` component at the top if not already imported:

```typescript
import { ReviewModal } from "#/components/watched/review-modal";
```

At the bottom of the component's JSX (before the final closing tags), add:

```tsx
{/* Episode review prompt */}
{reviewPromptEpisode && !reviewModalOpen && (
	<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[rgba(15,15,40,0.98)] border border-neon-amber/25 rounded-xl px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_16px_rgba(255,184,0,0.08)] text-center animate-in slide-in-from-bottom-4 duration-300">
		<div className="text-[13px] text-cream/70 mb-3">
			Add thoughts on{" "}
			<span className="text-neon-cyan font-semibold">
				S{reviewPromptEpisode.seasonNumber}E{reviewPromptEpisode.episodeNumber}
			</span>
			?
		</div>
		<div className="flex gap-2 justify-center">
			<button
				type="button"
				onClick={() => {
					setReviewModalOpen(true);
				}}
				className="px-4 py-1.5 bg-neon-amber/15 border border-neon-amber/30 rounded-md text-[12px] font-semibold text-neon-amber hover:bg-neon-amber/25 transition-colors"
			>
				Yes
			</button>
			<button
				type="button"
				onClick={() => setReviewPromptEpisode(null)}
				className="px-4 py-1.5 bg-transparent border border-cream/10 rounded-md text-[12px] text-cream/40 hover:text-cream/60 transition-colors"
			>
				Dismiss
			</button>
		</div>
	</div>
)}

{reviewModalOpen && reviewPromptEpisode && (
	<ReviewModal
		open={reviewModalOpen}
		onOpenChange={(open) => {
			setReviewModalOpen(open);
			if (!open) setReviewPromptEpisode(null);
		}}
		titleName={showTitle ?? ""}
		tmdbId={tmdbId}
		mediaType="tv"
		scope="episode"
		scopeSeasonNumber={reviewPromptEpisode.seasonNumber}
		scopeEpisodeNumber={reviewPromptEpisode.episodeNumber}
		onEventCreated={() => {
			setReviewPromptEpisode(null);
			setReviewModalOpen(false);
		}}
	/>
)}
```

Note: `showTitle` should reference the show's name from the existing data in the component. Check what variable holds the show title (likely from a TMDB fetch or route params).

- [ ] **Step 4: Auto-dismiss the prompt after a timeout**

Add a `useEffect` to auto-dismiss after 8 seconds:

```typescript
useEffect(() => {
	if (reviewPromptEpisode && !reviewModalOpen) {
		const timer = setTimeout(() => setReviewPromptEpisode(null), 8000);
		return () => clearTimeout(timer);
	}
}, [reviewPromptEpisode, reviewModalOpen]);
```

- [ ] **Step 5: Verify compilation**

Run: `bun run build`

Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/app/tracker.$tmdbId.tsx
git commit -m "feat: add inline episode review prompt after marking episodes watched"
```

---

## Task 13: Final verification and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full build check**

Run: `bun run build`

Expected: Clean build with no errors.

- [ ] **Step 2: Push schema changes**

Run: `bunx drizzle-kit push`

Expected: Schema is up to date (should be a no-op if Task 1 push succeeded).

- [ ] **Step 3: Manual smoke test checklist**

Verify the following in the browser:

1. Create a watch event with a companion — verify reciprocal event appears on companion's profile
2. Check the reciprocal event shows the original reviewer's review with attribution
3. Toggle visibility to Private — verify the event disappears from friend feeds
4. Toggle visibility to Shared — verify only companion can see it
5. Mark an episode as watched — verify the review prompt appears
6. Dismiss the prompt — verify it goes away
7. Accept the prompt — verify the review modal opens scoped to the episode
8. Check notifications for the companion — verify adapted wording
9. Delete an event that has reciprocal events — verify reciprocal persists but loses attribution
10. Create an authored event that replaces a reciprocal — verify the upgrade

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
