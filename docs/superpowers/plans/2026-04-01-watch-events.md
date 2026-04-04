# Watch Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-review-per-title system with a journal-style watch event model supporting multiple viewings, companions (friends + free text), edit/delete, and an activity feed page.

**Architecture:** Two new DB tables (`watch_event`, `watch_event_companion`) replace the `review` table. A new `watchEvent` tRPC router handles CRUD. The existing review modal is modified to create watch events instead of reviews, with a new "Watched with" companion modal. A new `/app/feed` page shows chronological activity from the user and their friends.

**Tech Stack:** Drizzle ORM (PostgreSQL), tRPC, TanStack Router, TanStack Query, React, Tailwind CSS, Vitest

---

## File Structure

### New files
- `src/db/schema.ts` — Add `watchEvent` and `watchEventCompanion` tables + relations (modify existing)
- `src/integrations/trpc/routers/watch-event.ts` — New tRPC router for watch event CRUD + feed
- `src/components/watched/watched-with-modal.tsx` — Companion picker modal (friends + free text)
- `src/components/watched/watch-event-card.tsx` — Reusable watch event display card with overflow menu
- `src/routes/app/feed.tsx` — Activity feed page
- `src/integrations/trpc/__tests__/watch-event.test.ts` — Tests for the watch event router

### Modified files
- `src/integrations/trpc/router.ts` — Register `watchEvent` router
- `src/integrations/trpc/routers/notification.ts` — Add `"watched_with"` notification type
- `src/components/notifications/notification-item.tsx` — Render `"watched_with"` notifications
- `src/components/watched/review-modal.tsx` — Rename to watch event modal, add companion button, date/time picker, create `watchEvent` instead of `review`
- `src/components/title/title-actions.tsx` — Use `createWatchEvent` instead of `quickMarkWatched` + `submitReview`, show watch history
- `src/routes/app/route.tsx` — Add Feed link to navbar
- `src/routes/app/profile.$userId.tsx` — Rename Reviews tab to Diary, use `getUserWatchEvents`
- `src/components/watchlist/watchlist-item-card.tsx` — Open watch event modal on mark watched
- `src/integrations/trpc/routers/watchlist.ts` — Remove `submitReview`, `getReview`, `getUserReviews`; update `markWatched`/`quickMarkWatched`
- `src/integrations/trpc/routers/friend.ts` — Update watch time computation to use `watch_event` table

---

## Task 1: Schema — Add `watch_event` and `watch_event_companion` tables

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `watchEvent` table definition**

Add after the `review` table definition (line 344) in `src/db/schema.ts`:

```typescript
export const watchEvent = pgTable(
	"watch_event",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(),
		rating: integer("rating"),
		note: text("note"),
		watchedAt: timestamp("watched_at").defaultNow().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("watch_event_user_id_idx").on(table.userId),
		index("watch_event_user_title_idx").on(
			table.userId,
			table.tmdbId,
			table.mediaType,
		),
		index("watch_event_watched_at_idx").on(table.watchedAt),
	],
);
```

- [ ] **Step 2: Add `watchEventCompanion` table definition**

Add directly after the `watchEvent` table:

```typescript
export const watchEventCompanion = pgTable(
	"watch_event_companion",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		watchEventId: text("watch_event_id")
			.notNull()
			.references(() => watchEvent.id, { onDelete: "cascade" }),
		friendId: text("friend_id").references(() => user.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
	},
	(table) => [
		index("watch_event_companion_event_idx").on(table.watchEventId),
	],
);
```

- [ ] **Step 3: Add relations for both new tables**

Add after the existing `reviewRelations`:

```typescript
export const watchEventRelations = relations(watchEvent, ({ one, many }) => ({
	user: one(user, {
		fields: [watchEvent.userId],
		references: [user.id],
	}),
	companions: many(watchEventCompanion),
}));

export const watchEventCompanionRelations = relations(
	watchEventCompanion,
	({ one }) => ({
		watchEvent: one(watchEvent, {
			fields: [watchEventCompanion.watchEventId],
			references: [watchEvent.id],
		}),
		friend: one(user, {
			fields: [watchEventCompanion.friendId],
			references: [user.id],
		}),
	}),
);
```

- [ ] **Step 4: Add `watchEvents` relation to `userRelations`**

In the existing `userRelations` definition, add `watchEvents: many(watchEvent),` alongside the existing `reviews: many(review)`.

- [ ] **Step 5: Generate and apply the migration**

Run:
```bash
bun run db:generate
```
Expected: A new migration file `drizzle/0007_*.sql` is created with `CREATE TABLE watch_event` and `CREATE TABLE watch_event_companion`.

Then push to DB:
```bash
bun run db:push
```
Expected: Tables created successfully.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add watch_event and watch_event_companion tables"
```

---

## Task 2: Watch Event tRPC Router — CRUD procedures

**Files:**
- Create: `src/integrations/trpc/routers/watch-event.ts`
- Modify: `src/integrations/trpc/router.ts`
- Modify: `src/integrations/trpc/routers/notification.ts`

- [ ] **Step 1: Add `"watched_with"` to notification types**

In `src/integrations/trpc/routers/notification.ts`, add `"watched_with"` to the `NOTIFICATION_TYPES` array:

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
	"title_recommendation",
	"watched_with",
] as const;
```

- [ ] **Step 2: Create the watch event router file**

Create `src/integrations/trpc/routers/watch-event.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	friendship,
	user,
	watchEvent,
	watchEventCompanion,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { createNotification } from "./notification";

const companionSchema = z.object({
	friendId: z.string().optional(),
	name: z.string().min(1).max(100),
});

export const watchEventRouter = {
	create: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				rating: z.number().min(1).max(5).optional(),
				note: z.string().max(1000).optional(),
				watchedAt: z.string().datetime().optional(),
				companions: z.array(companionSchema).optional(),
				titleName: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const [event] = await db
				.insert(watchEvent)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					rating: input.rating ?? null,
					note: input.note ?? null,
					watchedAt: input.watchedAt ? new Date(input.watchedAt) : new Date(),
				})
				.returning();

			if (input.companions && input.companions.length > 0) {
				await db.insert(watchEventCompanion).values(
					input.companions.map((c) => ({
						watchEventId: event.id,
						friendId: c.friendId ?? null,
						name: c.name,
					})),
				);

				// Notify linked friends
				for (const c of input.companions) {
					if (c.friendId) {
						await createNotification({
							recipientId: c.friendId,
							actorId: ctx.userId,
							type: "watched_with",
							data: {
								tmdbId: input.tmdbId,
								mediaType: input.mediaType,
								titleName: input.titleName ?? "",
								watchEventId: event.id,
							},
						});
					}
				}
			}

			// Notify watchlist members (item_watched) for any watchlist containing this title
			const userMemberships = await db.query.watchlistMember.findMany({
				where: eq(watchlistMember.userId, ctx.userId),
				columns: { watchlistId: true },
			});
			for (const membership of userMemberships) {
				const item = await db.query.watchlistItem.findFirst({
					where: and(
						eq(watchlistItem.watchlistId, membership.watchlistId),
						eq(watchlistItem.tmdbId, input.tmdbId),
						eq(watchlistItem.mediaType, input.mediaType),
					),
				});
				if (!item) continue;
				const wl = await db.query.watchlist.findFirst({
					where: eq(watchlist.id, membership.watchlistId),
					columns: { name: true },
				});
				const members = await db.query.watchlistMember.findMany({
					where: eq(watchlistMember.watchlistId, membership.watchlistId),
					columns: { userId: true },
				});
				for (const member of members) {
					await createNotification({
						recipientId: member.userId,
						actorId: ctx.userId,
						type: "item_watched",
						data: {
							watchlistId: membership.watchlistId,
							watchlistName: wl?.name ?? "",
							titleName: input.titleName ?? "",
							tmdbId: input.tmdbId,
							mediaType: input.mediaType,
						},
					});
				}
			}

			return event;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				rating: z.number().min(1).max(5).optional().nullable(),
				note: z.string().max(1000).optional().nullable(),
				watchedAt: z.string().datetime().optional(),
				companions: z.array(companionSchema).optional(),
				titleName: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.id, input.id),
					eq(watchEvent.userId, ctx.userId),
				),
			});
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const [updated] = await db
				.update(watchEvent)
				.set({
					...(input.rating !== undefined ? { rating: input.rating } : {}),
					...(input.note !== undefined ? { note: input.note } : {}),
					...(input.watchedAt
						? { watchedAt: new Date(input.watchedAt) }
						: {}),
				})
				.where(eq(watchEvent.id, input.id))
				.returning();

			if (input.companions !== undefined) {
				// Replace all companions
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

					// Notify new linked friends
					for (const c of input.companions) {
						if (c.friendId) {
							await createNotification({
								recipientId: c.friendId,
								actorId: ctx.userId,
								type: "watched_with",
								data: {
									tmdbId: existing.tmdbId,
									mediaType: existing.mediaType,
									titleName: input.titleName ?? "",
									watchEventId: input.id,
								},
							});
						}
					}
				}
			}

			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.id, input.id),
					eq(watchEvent.userId, ctx.userId),
				),
			});
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			// Delete event (companions cascade)
			await db.delete(watchEvent).where(eq(watchEvent.id, input.id));

			// Check if this was the last watch event for this title
			// If so, unmark watchlist items as watched
			const remaining = await db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.userId, ctx.userId),
					eq(watchEvent.tmdbId, existing.tmdbId),
					eq(watchEvent.mediaType, existing.mediaType),
				),
			});

			if (!remaining) {
				// Get all watchlists the user is a member of
				const memberships = await db.query.watchlistMember.findMany({
					where: eq(watchlistMember.userId, ctx.userId),
					columns: { watchlistId: true },
				});
				const wlIds = memberships.map((m) => m.watchlistId);

				if (wlIds.length > 0) {
					await db
						.update(watchlistItem)
						.set({ watched: false })
						.where(
							and(
								inArray(watchlistItem.watchlistId, wlIds),
								eq(watchlistItem.tmdbId, existing.tmdbId),
								eq(watchlistItem.mediaType, existing.mediaType),
							),
						);
				}
			}

			return { deleted: true };
		}),

	getForTitle: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				userId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const targetUserId = input.userId ?? ctx.userId;
			const events = await db.query.watchEvent.findMany({
				where: and(
					eq(watchEvent.userId, targetUserId),
					eq(watchEvent.tmdbId, input.tmdbId),
					eq(watchEvent.mediaType, input.mediaType),
				),
				with: {
					companions: true,
				},
				orderBy: (e, { desc }) => [desc(e.watchedAt)],
			});
			return events;
		}),

	getUserEvents: protectedProcedure
		.input(
			z.object({
				userId: z.string(),
				limit: z.number().min(1).max(50).optional().default(20),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			const events = await db.query.watchEvent.findMany({
				where: and(
					eq(watchEvent.userId, input.userId),
					...(input.cursor
						? [
								sql`${watchEvent.watchedAt} < (SELECT watched_at FROM watch_event WHERE id = ${input.cursor})`,
							]
						: []),
				),
				with: {
					companions: true,
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

	getLatestRating: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.query(async ({ input, ctx }) => {
			const event = await db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.userId, ctx.userId),
					eq(watchEvent.tmdbId, input.tmdbId),
					eq(watchEvent.mediaType, input.mediaType),
					sql`${watchEvent.rating} IS NOT NULL`,
				),
				orderBy: (e, { desc }) => [desc(e.watchedAt)],
				columns: { rating: true },
			});
			return event?.rating ?? null;
		}),

	getFeed: protectedProcedure
		.input(
			z.object({
				filter: z.enum(["all", "mine"]).optional().default("all"),
				limit: z.number().min(1).max(50).optional().default(20),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			let userIds: string[];

			if (input.filter === "mine") {
				userIds = [ctx.userId];
			} else {
				// Get friend IDs
				const friendships = await db.query.friendship.findMany({
					where: and(
						or(
							eq(friendship.requesterId, ctx.userId),
							eq(friendship.addresseeId, ctx.userId),
						),
						eq(friendship.status, "accepted"),
					),
				});
				const friendIds = friendships.map((f) =>
					f.requesterId === ctx.userId ? f.addresseeId : f.requesterId,
				);
				userIds = [ctx.userId, ...friendIds];
			}

			const events = await db.query.watchEvent.findMany({
				where: and(
					inArray(watchEvent.userId, userIds),
					...(input.cursor
						? [
								sql`${watchEvent.watchedAt} < (SELECT watched_at FROM watch_event WHERE id = ${input.cursor})`,
							]
						: []),
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
} satisfies TRPCRouterRecord;
```

- [ ] **Step 3: Register the router**

In `src/integrations/trpc/router.ts`, add the import and register:

```typescript
import { watchEventRouter } from "./routers/watch-event";
```

Add to `createTRPCRouter({...})`:
```typescript
watchEvent: watchEventRouter,
```

- [ ] **Step 4: Verify the server starts**

Run:
```bash
bun run dev
```
Expected: Dev server starts without errors.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/trpc/routers/watch-event.ts src/integrations/trpc/router.ts src/integrations/trpc/routers/notification.ts
git commit -m "feat: add watch event tRPC router with CRUD and feed"
```

---

## Task 3: Watched With Modal

**Files:**
- Create: `src/components/watched/watched-with-modal.tsx`

- [ ] **Step 1: Create the Watched With Modal component**

Create `src/components/watched/watched-with-modal.tsx`. This follows the same pattern as `recommend-modal.tsx` but supports both friend selection and free text entry:

```typescript
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";

export interface Companion {
	friendId?: string;
	name: string;
}

interface WatchedWithModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: Companion[];
	onChange: (companions: Companion[]) => void;
}

export function WatchedWithModal({
	open,
	onOpenChange,
	value,
	onChange,
}: WatchedWithModalProps) {
	const trpc = useTRPC();
	const [search, setSearch] = useState("");

	const { data: friends } = useQuery(trpc.friend.list.queryOptions());

	const filtered = (friends ?? []).filter((f) => {
		if (value.some((c) => c.friendId === f.id)) return false;
		if (!search) return true;
		const q = search.toLowerCase().replace("@", "");
		return f.username?.toLowerCase().includes(q);
	});

	function addFriend(friend: { id: string; username: string | null }) {
		onChange([
			...value,
			{ friendId: friend.id, name: friend.username ?? friend.id },
		]);
	}

	function addFreeText() {
		const trimmed = search.trim();
		if (!trimmed) return;
		if (value.some((c) => !c.friendId && c.name === trimmed)) return;
		onChange([...value, { name: trimmed }]);
		setSearch("");
	}

	function remove(index: number) {
		onChange(value.filter((_, i) => i !== index));
	}

	function handleDone() {
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogOverlay />
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="w-full max-w-[360px] flex flex-col items-center">
						{/* Cyan marquee header */}
						<div className="w-[calc(100%-16px)] border-2 border-neon-cyan/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(0,229,255,0.08)]">
							<div className="flex justify-center gap-3 mb-1.5">
								{Array.from({ length: 8 }).map((_, i) => (
									<div
										key={`bulb-${i.toString()}`}
										className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_4px_1px_rgba(0,229,255,0.6)] animate-[chase_1.2s_infinite]"
										style={{ animationDelay: `${i * 0.15}s` }}
									/>
								))}
							</div>
							<div className="font-display text-xl text-cream tracking-wide">
								Watched With
							</div>
							<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-cyan/50 mt-0.5">
								Who did you watch with?
							</div>
						</div>

						{/* Card body */}
						<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
							<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan/70 to-transparent shadow-[0_0_10px_rgba(0,229,255,0.4)]" />

							<div className="p-5 flex flex-col gap-4 relative">
								{/* Close */}
								<div className="flex justify-end -mb-2">
									<button
										type="button"
										onClick={() => onOpenChange(false)}
										className="font-mono-retro text-[10px] tracking-[2px] uppercase text-cream/30 hover:text-cream/60 transition-colors duration-200"
									>
										close ✕
									</button>
								</div>

								{/* Search */}
								<div>
									<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
										Search Friends or Type a Name
									</div>
									<input
										type="text"
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && search.trim()) {
												// If there's an exact friend match, add them; otherwise add as free text
												const exactMatch = filtered.find(
													(f) =>
														f.username?.toLowerCase() ===
														search.trim().toLowerCase(),
												);
												if (exactMatch) {
													addFriend(exactMatch);
												} else {
													addFreeText();
												}
											}
										}}
										placeholder="@friend or a name…"
										className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-2.5 font-mono-retro text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-neon-cyan/25 transition-colors duration-200"
									/>
								</div>

								{/* Autocomplete results */}
								{search.trim() && (
									<div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
										{filtered.slice(0, 5).map((friend) => (
											<button
												key={friend.id}
												type="button"
												onClick={() => addFriend(friend)}
												className="flex items-center gap-2.5 px-3 py-2 rounded-md border bg-black/20 border-cream/[0.05] hover:border-cream/10 transition-colors duration-200 text-left"
											>
												<div className="w-7 h-7 rounded-full flex items-center justify-center font-mono-retro text-xs shrink-0 border border-cream/10 bg-cream/[0.06] text-cream/40">
													{friend.username
														?.slice(0, 2)
														.toUpperCase() ?? "?"}
												</div>
												<span className="flex-1 text-sm text-cream/70">
													@{friend.username}
												</span>
												<span className="text-[10px] text-cream/25">
													friend
												</span>
											</button>
										))}
										{/* Free text option */}
										{search.trim() &&
											!filtered.some(
												(f) =>
													f.username?.toLowerCase() ===
													search.trim().toLowerCase(),
											) && (
												<button
													type="button"
													onClick={addFreeText}
													className="flex items-center gap-2.5 px-3 py-2 rounded-md border bg-black/20 border-neon-amber/10 hover:border-neon-amber/20 transition-colors duration-200 text-left"
												>
													<div className="w-7 h-7 rounded-full flex items-center justify-center font-mono-retro text-xs shrink-0 border border-neon-amber/15 bg-neon-amber/[0.06] text-neon-amber/50">
														+
													</div>
													<span className="flex-1 text-sm text-cream/50">
														Add "{search.trim()}" as text
													</span>
												</button>
											)}
									</div>
								)}

								{/* Selected chips */}
								{value.length > 0 && (
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Watching With
										</div>
										<div className="flex gap-1.5 flex-wrap">
											{value.map((c, i) => (
												<div
													key={c.friendId ?? `text-${c.name}`}
													className={`flex items-center gap-1 px-2.5 py-1 border rounded-full font-mono-retro text-xs ${
														c.friendId
															? "bg-neon-cyan/[0.08] border-neon-cyan/25 text-neon-cyan"
															: "bg-neon-amber/[0.08] border-neon-amber/25 text-neon-amber"
													}`}
												>
													{c.friendId ? `@${c.name}` : c.name}
													<button
														type="button"
														onClick={() => remove(i)}
														className="opacity-40 hover:opacity-80 transition-opacity"
													>
														<X className="w-3 h-3" />
													</button>
												</div>
											))}
										</div>
									</div>
								)}

								<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

								{/* Done button */}
								<button
									type="button"
									onClick={handleDone}
									className="w-full py-3 px-6 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-base tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200"
								>
									Done
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

Run:
```bash
bun run dev
```
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/watched/watched-with-modal.tsx
git commit -m "feat: add Watched With companion picker modal"
```

---

## Task 4: Update Review Modal → Watch Event Modal

**Files:**
- Modify: `src/components/watched/review-modal.tsx`

- [ ] **Step 1: Update the review modal to create watch events**

Replace the full contents of `src/components/watched/review-modal.tsx`:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";
import type { Companion } from "./watched-with-modal";
import { WatchedWithModal } from "./watched-with-modal";
import { RecommendModal } from "./recommend-modal";
import { StarRating } from "./star-rating";

interface WatchEventModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	titleName: string;
	year?: string;
	tmdbId: number;
	mediaType: "movie" | "tv";
	/** If provided, modal is in edit mode */
	editEvent?: {
		id: string;
		rating: number | null;
		note: string | null;
		watchedAt: string;
		companions: Companion[];
	};
}

export function ReviewModal({
	open,
	onOpenChange,
	titleName,
	year,
	tmdbId,
	mediaType,
	editEvent,
}: WatchEventModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [rating, setRating] = useState<number | null>(null);
	const [note, setNote] = useState("");
	const [watchedAt, setWatchedAt] = useState("");
	const [companions, setCompanions] = useState<Companion[]>([]);
	const [watchedWithOpen, setWatchedWithOpen] = useState(false);
	const [recommendOpen, setRecommendOpen] = useState(false);

	// Reset / pre-fill on open
	useEffect(() => {
		if (open) {
			if (editEvent) {
				setRating(editEvent.rating);
				setNote(editEvent.note ?? "");
				setWatchedAt(editEvent.watchedAt.slice(0, 16)); // datetime-local format
				setCompanions(editEvent.companions);
			} else {
				setRating(null);
				setNote("");
				setWatchedAt(toLocalDatetime(new Date()));
				setCompanions([]);
			}
		}
	}, [open, editEvent]);

	function invalidateQueries() {
		queryClient.invalidateQueries(trpc.watchEvent.getForTitle.queryFilter());
		queryClient.invalidateQueries(trpc.watchEvent.getUserEvents.queryFilter());
		queryClient.invalidateQueries(trpc.watchEvent.getLatestRating.queryFilter());
		queryClient.invalidateQueries(trpc.watchEvent.getFeed.queryFilter());
	}

	const createEvent = useMutation(
		trpc.watchEvent.create.mutationOptions({
			onSuccess: () => {
				invalidateQueries();
				handleClose();
			},
		}),
	);

	const updateEvent = useMutation(
		trpc.watchEvent.update.mutationOptions({
			onSuccess: () => {
				invalidateQueries();
				handleClose();
			},
		}),
	);

	function handleClose() {
		setRating(null);
		setNote("");
		setCompanions([]);
		onOpenChange(false);
	}

	function handleSave() {
		const watchedAtISO = watchedAt
			? new Date(watchedAt).toISOString()
			: undefined;

		if (editEvent) {
			updateEvent.mutate({
				id: editEvent.id,
				rating: rating ?? null,
				note: note.trim() || null,
				watchedAt: watchedAtISO,
				companions,
				titleName,
			});
		} else {
			createEvent.mutate({
				tmdbId,
				mediaType,
				rating: rating ?? undefined,
				note: note.trim() || undefined,
				watchedAt: watchedAtISO,
				companions,
				titleName,
			});
		}
	}

	const isPending = createEvent.isPending || updateEvent.isPending;

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogPortal>
					<DialogOverlay />
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="w-full max-w-[360px] flex flex-col items-center">
							{/* Marquee header */}
							<div className="w-[calc(100%-16px)] border-2 border-neon-amber/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(255,184,0,0.08)] relative">
								<button
									type="button"
									onClick={handleClose}
									className="absolute top-2.5 right-3 p-1 text-cream/25 hover:text-cream/60 transition-colors duration-200"
								>
									<X className="w-4 h-4" />
								</button>
								<div className="flex justify-center gap-3 mb-1.5">
									{Array.from({ length: 8 }).map((_, i) => (
										<div
											key={`dot-${i.toString()}`}
											className="w-1.5 h-1.5 rounded-full bg-neon-amber shadow-[0_0_4px_1px_rgba(255,184,0,0.6)] animate-[chase_1.2s_infinite]"
											style={{
												animationDelay: `${i * 0.15}s`,
											}}
										/>
									))}
								</div>
								<div className="font-display text-2xl text-cream tracking-wide">
									{editEvent ? "Edit" : "Watched"}
								</div>
								<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-amber/55 mt-0.5">
									{titleName} {year ? `· ${year}` : ""}
								</div>
							</div>

							{/* Modal card */}
							<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
								<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan/80 to-transparent shadow-[0_0_10px_rgba(0,229,255,0.4)]" />
								<div className="absolute top-0 left-0 right-0 h-[60px] bg-gradient-to-b from-cream/[0.015] to-transparent pointer-events-none" />

								<div className="p-5 flex flex-col gap-5 relative">
									{/* Stars */}
									<StarRating value={rating} onChange={setRating} />

									<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

									{/* Note */}
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Your Review
										</div>
										<textarea
											value={note}
											onChange={(e) => setNote(e.target.value)}
											placeholder="Share your thoughts…"
											className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-3 min-h-16 font-sans text-sm text-cream placeholder:text-cream/25 placeholder:italic leading-relaxed shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] focus:outline-none focus:border-neon-cyan/20 resize-none transition-colors duration-200"
										/>
									</div>

									{/* Date & time */}
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Watched On
										</div>
										<input
											type="datetime-local"
											value={watchedAt}
											onChange={(e) => setWatchedAt(e.target.value)}
											className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-2.5 font-mono-retro text-sm text-cream focus:outline-none focus:border-neon-cyan/20 transition-colors duration-200 [color-scheme:dark]"
										/>
									</div>

									<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

									{/* Recommend to friend */}
									<button
										type="button"
										onClick={() => setRecommendOpen(true)}
										className="flex items-center gap-3 px-3.5 py-2.5 bg-neon-pink/[0.04] border border-neon-pink/15 rounded-md cursor-pointer hover:border-neon-pink/30 hover:shadow-[0_0_16px_rgba(255,45,120,0.08)] transition-all duration-200"
									>
										<div className="w-7 h-7 rounded-full bg-neon-pink/10 border border-neon-pink/20 flex items-center justify-center text-sm shrink-0">
											📽️
										</div>
										<span className="flex-1 text-left text-sm font-semibold text-neon-pink/75">
											Recommend to a friend
										</span>
										<span className="text-base text-neon-pink/30">›</span>
									</button>

									{/* Watched with */}
									<button
										type="button"
										onClick={() => setWatchedWithOpen(true)}
										className="flex items-center gap-3 px-3.5 py-2.5 bg-neon-cyan/[0.04] border border-neon-cyan/15 rounded-md cursor-pointer hover:border-neon-cyan/30 hover:shadow-[0_0_16px_rgba(0,229,255,0.08)] transition-all duration-200"
									>
										<div className="w-7 h-7 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center text-sm shrink-0">
											👥
										</div>
										<span className="flex-1 text-left text-sm font-semibold text-neon-cyan/75">
											{companions.length > 0
												? `Watched with ${companions.map((c) => c.name).join(", ")}`
												: "Watched with…"}
										</span>
										<span className="text-base text-neon-cyan/30">›</span>
									</button>

									{/* Save button */}
									<button
										type="button"
										onClick={handleSave}
										disabled={isPending}
										className="w-full py-3 px-6 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-base tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200 disabled:opacity-50"
									>
										{editEvent ? "Save Changes" : "Save & Done"}
									</button>

									{/* Skip (create mode only) */}
									{!editEvent && (
										<div className="flex justify-center items-center gap-6">
											<button
												type="button"
												onClick={handleClose}
												className="font-mono-retro text-[10px] tracking-[2px] uppercase text-cream/25 hover:text-cream/50 transition-colors duration-200 py-1.5"
											>
												skip
											</button>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</DialogPortal>
			</Dialog>
			<WatchedWithModal
				open={watchedWithOpen}
				onOpenChange={setWatchedWithOpen}
				value={companions}
				onChange={setCompanions}
			/>
			<RecommendModal
				open={recommendOpen}
				onOpenChange={setRecommendOpen}
				tmdbId={tmdbId}
				mediaType={mediaType}
				titleName={titleName}
			/>
		</>
	);
}

function toLocalDatetime(date: Date): string {
	const pad = (n: number) => n.toString().padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
bun run dev
```
Expected: No errors. The modal now uses `watchEvent.create` / `watchEvent.update` instead of `watchlist.submitReview`.

- [ ] **Step 3: Commit**

```bash
git add src/components/watched/review-modal.tsx
git commit -m "feat: convert review modal to watch event modal with companions and date picker"
```

---

## Task 5: Update Title Actions — Use Watch Events

**Files:**
- Modify: `src/components/title/title-actions.tsx`

- [ ] **Step 1: Replace review queries with watch event queries**

In `src/components/title/title-actions.tsx`, update the component:

1. Replace the `existingReview` query with `latestRating`:
```typescript
const { data: latestRating } = useQuery(
	trpc.watchEvent.getLatestRating.queryOptions({ tmdbId, mediaType }),
);
```

2. In `quickWatchedMutation`'s `onSuccess`, change the review modal open condition:
```typescript
if (data.watched) {
	toast.success("Marked as watched");
	if (latestRating === null) {
		setReviewOpen(true);
	}
} else {
	toast.success("Removed from watched");
}
```

3. Update the query invalidations in `quickWatchedMutation.onSuccess` to also invalidate watch event queries:
```typescript
queryClient.invalidateQueries(trpc.watchEvent.getForTitle.queryFilter());
queryClient.invalidateQueries(trpc.watchEvent.getLatestRating.queryFilter());
queryClient.invalidateQueries(trpc.watchEvent.getFeed.queryFilter());
```

4. Remove the `existingReview` import/query and replace `getReview` invalidation with the watch event equivalents.

- [ ] **Step 2: Verify it compiles and the watched button still works**

Run:
```bash
bun run dev
```
Expected: No errors. Clicking "Watched" on a title page still works, opens the modal.

- [ ] **Step 3: Commit**

```bash
git add src/components/title/title-actions.tsx
git commit -m "feat: use watch event queries in title actions"
```

---

## Task 6: Watch Event Card Component

**Files:**
- Create: `src/components/watched/watch-event-card.tsx`

- [ ] **Step 1: Create the reusable watch event card**

Create `src/components/watched/watch-event-card.tsx`:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { useTRPC } from "#/integrations/trpc/react";
import type { Companion } from "./watched-with-modal";

interface WatchEventCardProps {
	event: {
		id: string;
		tmdbId: number;
		mediaType: string;
		rating: number | null;
		note: string | null;
		watchedAt: Date | string;
		companions: Array<{ friendId: string | null; name: string }>;
	};
	/** Show title name and link to title page */
	showTitle?: { name: string };
	/** Show actor info (for feed) */
	actor?: {
		id: string;
		username: string | null;
		avatarUrl: string | null;
	};
	/** Is this the current user's event? Controls overflow menu visibility */
	isOwn: boolean;
	/** Called when user wants to edit */
	onEdit?: (event: {
		id: string;
		rating: number | null;
		note: string | null;
		watchedAt: string;
		companions: Companion[];
	}) => void;
}

function formatTimeAgo(date: Date | string): string {
	const now = new Date();
	const d = new Date(date);
	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "Just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay === 1) return "Yesterday";
	if (diffDay < 30) return `${diffDay}d ago`;
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDate(date: Date | string): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function WatchEventCard({
	event,
	showTitle,
	actor,
	isOwn,
	onEdit,
}: WatchEventCardProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [menuOpen, setMenuOpen] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const deleteEvent = useMutation(
		trpc.watchEvent.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.watchEvent.getForTitle.queryFilter());
				queryClient.invalidateQueries(trpc.watchEvent.getUserEvents.queryFilter());
				queryClient.invalidateQueries(trpc.watchEvent.getLatestRating.queryFilter());
				queryClient.invalidateQueries(trpc.watchEvent.getFeed.queryFilter());
				queryClient.invalidateQueries(trpc.watchlist.isWatched.queryFilter());
				toast.success("Watch event deleted");
			},
			onError: () => {
				toast.error("Failed to delete");
			},
		}),
	);

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
		});
	}

	function handleDelete() {
		if (!confirmDelete) {
			setConfirmDelete(true);
			return;
		}
		deleteEvent.mutate({ id: event.id });
		setMenuOpen(false);
		setConfirmDelete(false);
	}

	const companionText =
		event.companions.length > 0
			? `with ${event.companions.map((c) => c.name).join(", ")}`
			: null;

	return (
		<div className="rounded-lg border border-drive-in-border p-3 transition-colors hover:bg-cream/[0.03]">
			{/* Actor line (feed mode) */}
			{actor && (
				<div className="flex items-center gap-2 mb-2">
					<Link
						to="/app/profile/$userId"
						params={{ userId: actor.id }}
						className="flex items-center gap-2 no-underline"
					>
						<div className="w-7 h-7 rounded-full bg-cream/10 flex items-center justify-center text-xs font-medium text-cream/60 shrink-0">
							{actor.avatarUrl ? (
								<img
									src={actor.avatarUrl}
									alt=""
									className="w-7 h-7 rounded-full object-cover"
								/>
							) : (
								(actor.username?.charAt(0) ?? "?").toUpperCase()
							)}
						</div>
						<span className="text-xs font-semibold text-cream/80">
							{isOwn ? "You" : actor.username ?? "Someone"}
						</span>
					</Link>
					<span className="text-xs text-cream/30">watched</span>
					<span className="text-[10px] text-cream/25 ml-auto">
						{formatTimeAgo(event.watchedAt)}
					</span>
				</div>
			)}

			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					{/* Title (when showing in diary/feed) */}
					{showTitle && (
						<Link
							to="/app/title/$mediaType/$tmdbId"
							params={{
								mediaType: event.mediaType as "movie" | "tv",
								tmdbId: event.tmdbId.toString(),
							}}
							className="text-sm font-semibold text-cream/90 hover:text-cream no-underline"
						>
							{showTitle.name}
						</Link>
					)}

					{/* Rating */}
					{event.rating && (
						<div className="flex items-center gap-1 mt-1">
							{[1, 2, 3, 4, 5].map((s) => (
								<Star
									key={s}
									className={`h-3 w-3 ${
										s <= event.rating!
											? "text-neon-amber fill-neon-amber"
											: "text-cream/15"
									}`}
								/>
							))}
						</div>
					)}

					{/* Date (non-feed mode) */}
					{!actor && (
						<div className="text-[11px] text-cream/35 mt-1">
							{formatDate(event.watchedAt)}
						</div>
					)}

					{/* Companions */}
					{companionText && (
						<div className="text-[11px] text-cream/30 mt-0.5">
							{companionText}
						</div>
					)}

					{/* Note */}
					{event.note && (
						<p className="text-xs text-cream/50 mt-1.5 line-clamp-2">
							{event.note}
						</p>
					)}
				</div>

				{/* Overflow menu */}
				{isOwn && (
					<Popover open={menuOpen} onOpenChange={(o) => { setMenuOpen(o); if (!o) setConfirmDelete(false); }}>
						<PopoverTrigger asChild>
							<button
								type="button"
								className="p-1 text-cream/20 hover:text-cream/50 transition-colors shrink-0"
							>
								<MoreHorizontal className="h-4 w-4" />
							</button>
						</PopoverTrigger>
						<PopoverContent
							align="end"
							sideOffset={4}
							className="bg-drive-in-card border border-drive-in-border rounded-lg shadow-xl p-1 w-40"
						>
							<button
								type="button"
								onClick={handleEdit}
								className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-cream/5 text-sm text-cream/70 hover:text-cream transition-colors"
							>
								<Pencil className="h-3.5 w-3.5" />
								Edit
							</button>
							<button
								type="button"
								onClick={handleDelete}
								disabled={deleteEvent.isPending}
								className={`flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-red-500/10 text-sm transition-colors ${
									confirmDelete
										? "text-red-400 font-medium"
										: "text-red-400/70 hover:text-red-400"
								}`}
							>
								<Trash2 className="h-3.5 w-3.5" />
								{confirmDelete ? "Confirm Delete" : "Delete"}
							</button>
						</PopoverContent>
					</Popover>
				)}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
bun run dev
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/watched/watch-event-card.tsx
git commit -m "feat: add reusable WatchEventCard with edit/delete overflow menu"
```

---

## Task 7: Activity Feed Page

**Files:**
- Create: `src/routes/app/feed.tsx`
- Modify: `src/routes/app/route.tsx`

- [ ] **Step 1: Create the feed page**

Create `src/routes/app/feed.tsx`:

```typescript
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Film, Loader2 } from "lucide-react";
import { useState } from "react";
import { ReviewModal } from "#/components/watched/review-modal";
import { WatchEventCard } from "#/components/watched/watch-event-card";
import type { Companion } from "#/components/watched/watched-with-modal";
import { useTRPC } from "#/integrations/trpc/react";

export const Route = createFileRoute("/app/feed")({
	component: FeedPage,
});

function FeedPage() {
	const trpc = useTRPC();
	const [filter, setFilter] = useState<"all" | "mine">("all");
	const [editModal, setEditModal] = useState<{
		open: boolean;
		tmdbId: number;
		mediaType: "movie" | "tv";
		titleName: string;
		event?: {
			id: string;
			rating: number | null;
			note: string | null;
			watchedAt: string;
			companions: Companion[];
		};
	} | null>(null);

	const routeContext = Route.useRouteContext();
	const currentUserId = routeContext.user.id;

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
	} = useInfiniteQuery(
		trpc.watchEvent.getFeed.infiniteQueryOptions(
			{ filter, limit: 20 },
			{ getNextPageParam: (lastPage) => lastPage.nextCursor },
		),
	);

	const events = data?.pages.flatMap((p) => p.items) ?? [];

	return (
		<div className="mx-auto max-w-2xl px-4 py-8">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<h1 className="font-display text-2xl text-cream tracking-wide">
					Feed
				</h1>
				<select
					value={filter}
					onChange={(e) => setFilter(e.target.value as "all" | "mine")}
					className="bg-drive-in-card border border-drive-in-border rounded-md px-3 py-1.5 text-xs font-mono-retro text-cream/60 focus:outline-none focus:border-neon-cyan/20 [color-scheme:dark]"
				>
					<option value="all">Everyone</option>
					<option value="mine">Just Me</option>
				</select>
			</div>

			{/* Feed */}
			{isLoading ? (
				<div className="flex justify-center py-12">
					<Loader2 className="h-5 w-5 animate-spin text-cream/30" />
				</div>
			) : events.length === 0 ? (
				<div className="flex flex-col items-center py-12 text-center">
					<Film className="mb-3 h-8 w-8 text-cream/15" />
					<p className="text-sm text-cream/30">
						{filter === "mine"
							? "No watch events yet. Mark something as watched!"
							: "No activity yet. Add some friends to see their watches here."}
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{events.map((event) => (
						<WatchEventCard
							key={event.id}
							event={event}
							showTitle={{ name: `${event.tmdbId}` }}
							actor={event.user}
							isOwn={event.userId === currentUserId}
							onEdit={(e) =>
								setEditModal({
									open: true,
									tmdbId: event.tmdbId,
									mediaType: event.mediaType as "movie" | "tv",
									titleName: `${event.tmdbId}`,
									event: e,
								})
							}
						/>
					))}

					{/* Load more */}
					{hasNextPage && (
						<button
							type="button"
							onClick={() => fetchNextPage()}
							disabled={isFetchingNextPage}
							className="mx-auto py-2 px-6 text-xs font-mono-retro tracking-wider text-cream/30 hover:text-cream/60 transition-colors"
						>
							{isFetchingNextPage ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Load more"
							)}
						</button>
					)}
				</div>
			)}

			{/* Edit modal */}
			{editModal && (
				<ReviewModal
					open={editModal.open}
					onOpenChange={(open) => {
						if (!open) setEditModal(null);
					}}
					tmdbId={editModal.tmdbId}
					mediaType={editModal.mediaType}
					titleName={editModal.titleName}
					editEvent={editModal.event}
				/>
			)}
		</div>
	);
}
```

> **Note:** The feed currently shows `tmdbId` as the title name since we don't store title names on watch events. Task 9 adds title storage to fix this. For now the feed is functional and the title name will be a numeric ID.

- [ ] **Step 2: Add Feed link to the navbar**

In `src/routes/app/route.tsx`, add the Feed link after the Friends link. Import `Rss` from lucide-react:

```typescript
import { Bookmark, Rss, Search, Shuffle, Users } from "lucide-react";
```

Add the Feed link in the nav links div, after the Friends link:

```typescript
<Link
	to="/app/feed"
	className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-cream/50 no-underline transition-colors hover:bg-cream/5 hover:text-cream/80 [&.active]:text-neon-cyan [&.active]:bg-neon-cyan/8"
>
	<Rss className="h-3.5 w-3.5" />
	Feed
</Link>
```

- [ ] **Step 3: Verify the feed page loads**

Run:
```bash
bun run dev
```
Navigate to `/app/feed`. Expected: The feed page renders with empty state or existing events.

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/feed.tsx src/routes/app/route.tsx
git commit -m "feat: add activity feed page with navbar link"
```

---

## Task 8: Profile Diary Tab — Replace Reviews with Watch Events

**Files:**
- Modify: `src/routes/app/profile.$userId.tsx`

- [ ] **Step 1: Rename Reviews tab to Diary and update the tab content**

In `src/routes/app/profile.$userId.tsx`:

1. Update the `TABS` array — change the "reviews" entry:
```typescript
{
	key: "diary",
	label: "Diary",
	color: "neon-amber",
	activeColor: "text-neon-amber border-neon-amber",
},
```

2. Update the `FriendTab` type:
```typescript
type FriendTab = "watchlists" | "diary" | "activity";
```

3. Replace the tab rendering from `{activeTab === "reviews" && <ReviewsTab userId={profile.id} />}` to:
```typescript
{activeTab === "diary" && <DiaryTab userId={profile.id} isOwn={isOwnProfile} />}
```

(Where `isOwnProfile` is `profile.id === routeContext.user.id` — you'll need to get this from the route context.)

4. Replace the `ReviewsTab` function with a `DiaryTab` function:

```typescript
function DiaryTab({ userId, isOwn }: { userId: string; isOwn: boolean }) {
	const trpc = useTRPC();
	const { data, isLoading } = useQuery(
		trpc.watchEvent.getUserEvents.queryOptions({ userId, limit: 50 }),
	);

	const [editModal, setEditModal] = useState<{
		open: boolean;
		tmdbId: number;
		mediaType: "movie" | "tv";
		event?: {
			id: string;
			rating: number | null;
			note: string | null;
			watchedAt: string;
			companions: Array<{ friendId?: string; name: string }>;
		};
	} | null>(null);

	if (isLoading) {
		return (
			<div className="flex justify-center py-8">
				<div className="h-4 w-4 animate-spin rounded-full border-2 border-cream/20 border-t-cream/60" />
			</div>
		);
	}

	const events = data?.items ?? [];

	if (events.length === 0) {
		return (
			<div className="flex flex-col items-center py-8 text-center">
				<Film className="mb-2 h-6 w-6 text-neon-amber/20" />
				<p className="text-xs text-cream/30">No diary entries yet</p>
			</div>
		);
	}

	return (
		<>
			<div className="flex flex-col gap-3">
				{events.map((event) => (
					<WatchEventCard
						key={event.id}
						event={event}
						showTitle={{ name: `${event.tmdbId}` }}
						isOwn={isOwn}
						onEdit={(e) =>
							setEditModal({
								open: true,
								tmdbId: event.tmdbId,
								mediaType: event.mediaType as "movie" | "tv",
								event: e,
							})
						}
					/>
				))}
			</div>
			{editModal && (
				<ReviewModal
					open={editModal.open}
					onOpenChange={(open) => {
						if (!open) setEditModal(null);
					}}
					tmdbId={editModal.tmdbId}
					mediaType={editModal.mediaType}
					titleName={`${editModal.tmdbId}`}
					editEvent={editModal.event}
				/>
			)}
		</>
	);
}
```

5. Add the required imports at the top of the file:
```typescript
import { WatchEventCard } from "#/components/watched/watch-event-card";
import { ReviewModal } from "#/components/watched/review-modal";
```

- [ ] **Step 2: Verify the profile diary tab loads**

Run:
```bash
bun run dev
```
Navigate to a profile page. Expected: "Diary" tab replaces "Reviews", showing watch events.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/profile.\$userId.tsx
git commit -m "feat: replace profile Reviews tab with Diary showing watch events"
```

---

## Task 9: Add Title Name to Watch Events + Resolve in Feed/Diary

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/integrations/trpc/routers/watch-event.ts`
- Modify: `src/routes/app/feed.tsx`
- Modify: `src/routes/app/profile.$userId.tsx`

- [ ] **Step 1: Add `title` and `posterPath` columns to `watch_event`**

In `src/db/schema.ts`, add to the `watchEvent` table definition:

```typescript
title: text("title"),
posterPath: text("poster_path"),
```

- [ ] **Step 2: Generate and apply the migration**

Run:
```bash
bun run db:generate && bun run db:push
```

- [ ] **Step 3: Update the `create` procedure to save title data**

In `src/integrations/trpc/routers/watch-event.ts`, update the `create` input schema to include:
```typescript
titleName: z.string().optional(),
posterPath: z.string().nullish(),
```

And update the `.values()` call:
```typescript
title: input.titleName ?? null,
posterPath: input.posterPath ?? null,
```

- [ ] **Step 4: Update feed and diary to use the stored title**

In `src/routes/app/feed.tsx`, change the `showTitle` prop:
```typescript
showTitle={{ name: event.title ?? `Title #${event.tmdbId}` }}
```

In `src/routes/app/profile.$userId.tsx` `DiaryTab`, same change:
```typescript
showTitle={{ name: event.title ?? `Title #${event.tmdbId}` }}
```

- [ ] **Step 5: Verify titles appear in the feed and diary**

Run:
```bash
bun run dev
```
Expected: New watch events show the title name. Older events without titles show a fallback.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/ src/integrations/trpc/routers/watch-event.ts src/routes/app/feed.tsx src/routes/app/profile.\$userId.tsx
git commit -m "feat: store title name on watch events for feed/diary display"
```

---

## Task 10: Title Page — Watch History Section

**Files:**
- Modify: `src/routes/app/title.$mediaType.$tmdbId.tsx` (or wherever the title detail page lives)
- Modify: `src/components/title/title-actions.tsx`

- [ ] **Step 1: Read the title detail page to understand its structure**

Read `src/routes/app/title.$mediaType.$tmdbId.tsx` to understand where the title actions are rendered and where to add the watch history section.

- [ ] **Step 2: Add a watch history section below the action buttons**

In the title detail page or in `src/components/title/title-actions.tsx`, add a section that queries and displays the user's watch events for this title:

```typescript
const { data: watchEvents } = useQuery(
	trpc.watchEvent.getForTitle.queryOptions({ tmdbId, mediaType }),
);
```

Render the watch events below the action buttons when they exist:

```typescript
{watchEvents && watchEvents.length > 0 && (
	<div className="mt-6">
		<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-3">
			Your Watch History
		</div>
		<div className="flex flex-col gap-2">
			{watchEvents.map((event) => (
				<WatchEventCard
					key={event.id}
					event={event}
					isOwn={true}
					onEdit={(e) => {
						setEditEvent(e);
						setReviewOpen(true);
					}}
				/>
			))}
		</div>
	</div>
)}
```

Add state for editing:
```typescript
const [editEvent, setEditEvent] = useState<{
	id: string;
	rating: number | null;
	note: string | null;
	watchedAt: string;
	companions: Array<{ friendId?: string; name: string }>;
} | undefined>(undefined);
```

Pass `editEvent` to the `ReviewModal`:
```typescript
<ReviewModal
	open={reviewOpen}
	onOpenChange={(open) => {
		setReviewOpen(open);
		if (!open) setEditEvent(undefined);
	}}
	tmdbId={tmdbId}
	mediaType={mediaType}
	titleName={title}
	year={year}
	editEvent={editEvent}
/>
```

Add imports:
```typescript
import { WatchEventCard } from "#/components/watched/watch-event-card";
```

- [ ] **Step 3: Verify the watch history appears on title pages**

Run:
```bash
bun run dev
```
Navigate to a title page where you have watch events. Expected: Watch history section appears below the action buttons with edit/delete menus.

- [ ] **Step 4: Commit**

```bash
git add src/components/title/title-actions.tsx src/routes/app/title.\$mediaType.\$tmdbId.tsx
git commit -m "feat: show watch history section on title detail page"
```

---

## Task 11: Clean Up — Remove Old Review System

**Files:**
- Modify: `src/integrations/trpc/routers/watchlist.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/components/notifications/notification-item.tsx`

- [ ] **Step 1: Remove review procedures from watchlist router**

In `src/integrations/trpc/routers/watchlist.ts`:

1. Remove the `review` import from `#/db/schema`.
2. Remove the `submitReview`, `getReview`, and `getUserReviews` procedures entirely (lines ~710-765).

- [ ] **Step 2: Add `"watched_with"` notification rendering**

In `src/components/notifications/notification-item.tsx`, add a case in `getNotificationMessage`:

```typescript
case "watched_with":
	return {
		text: `watched ${data.titleName || "a title"} with you`,
		link: data.tmdbId
			? `/app/title/${data.mediaType}/${data.tmdbId}`
			: undefined,
	};
```

- [ ] **Step 3: Remove `review` table and relations from schema (deferred)**

> **Note:** Don't drop the `review` table yet if existing data needs migration. For now, leave the table definition in schema.ts but remove the `reviewRelations` and `reviews: many(review)` from `userRelations`. The actual data migration (inserting review rows as watch events, then dropping the table) should be done as a separate migration task once the new system is verified working.

Remove from `userRelations`:
```typescript
reviews: many(review),
```

- [ ] **Step 4: Verify everything compiles with no broken references**

Run:
```bash
bun run dev
```
Expected: No errors. No references to `submitReview`, `getReview`, or `getUserReviews` remain in active code.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts src/components/notifications/notification-item.tsx src/db/schema.ts
git commit -m "feat: remove old review procedures, add watched_with notification"
```

---

## Task 12: Migrate Existing Review Data

**Files:**
- New SQL migration file

- [ ] **Step 1: Create the data migration**

Create a SQL migration that moves review data to watch events. Generate a new migration:

```bash
bun run db:generate
```

If no schema changes are detected (since the review table is still defined), manually create a migration file. Add a file in `drizzle/` with the next sequence number (e.g., `0008_migrate_reviews.sql` or whatever the generator names it):

```sql
-- Migrate existing reviews to watch events
INSERT INTO watch_event (id, user_id, tmdb_id, media_type, rating, note, watched_at, created_at)
SELECT id, user_id, tmdb_id, media_type, rating, text, created_at, created_at
FROM review
WHERE NOT EXISTS (
  SELECT 1 FROM watch_event we
  WHERE we.user_id = review.user_id
    AND we.tmdb_id = review.tmdb_id
    AND we.media_type = review.media_type
);
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
bun run db:migrate
```
Expected: Reviews migrated to watch events.

- [ ] **Step 3: Verify migrated data appears in the diary**

Run:
```bash
bun run dev
```
Navigate to a profile with existing reviews. Expected: They appear in the Diary tab as watch events.

- [ ] **Step 4: Commit**

```bash
git add drizzle/
git commit -m "feat: migrate existing review data to watch events"
```

---

## Task 13: Update Watchlist Item Card — Open Watch Event Modal

**Files:**
- Modify: `src/components/watchlist/watchlist-item-card.tsx`

- [ ] **Step 1: Update the mark watched flow on watchlist items**

In `src/components/watchlist/watchlist-item-card.tsx`, when a user marks an item as watched within a watchlist, it should open the watch event modal. Read the file first to understand the current structure, then:

1. Add state for the review modal:
```typescript
const [reviewOpen, setReviewOpen] = useState(false);
```

2. In the `markWatched` mutation's `onSuccess`, when `watched` becomes true, open the modal:
```typescript
onSuccess: () => {
	// ... existing invalidations ...
	if (!item.watched) {
		setReviewOpen(true);
	}
}
```

3. Render the `ReviewModal` at the end of the component:
```typescript
<ReviewModal
	open={reviewOpen}
	onOpenChange={setReviewOpen}
	tmdbId={item.tmdbId}
	mediaType={item.mediaType as "movie" | "tv"}
	titleName={item.title ?? ""}
/>
```

4. Add the import:
```typescript
import { ReviewModal } from "#/components/watched/review-modal";
```

- [ ] **Step 2: Verify the watchlist watched toggle opens the modal**

Run:
```bash
bun run dev
```
Navigate to a watchlist, mark an item as watched. Expected: The watch event modal opens.

- [ ] **Step 3: Commit**

```bash
git add src/components/watchlist/watchlist-item-card.tsx
git commit -m "feat: open watch event modal when marking watchlist item as watched"
```

---

## Deferred: Watchlist Creations in Feed

The spec calls for watchlist creation events in the feed alongside watch events. This requires either a unified `feed_event` table or a UNION query combining `watch_event` rows with `watchlist` creation rows. To keep the initial implementation focused, the feed launches with watch events only. Watchlist creation events can be added as a follow-up by:

1. Adding a `watchlist.createdAt` query to `getFeed` and merging results by timestamp.
2. Adding a `type` discriminator to feed items (`"watch_event" | "watchlist_created"`).
3. Creating a `FeedItem` union component that renders differently per type.
