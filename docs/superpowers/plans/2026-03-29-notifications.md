# Notification Dropdown & Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a notification system with a bell icon in the navbar, a dropdown showing recent notifications, and server-side notification creation triggered by watchlist/shuffle actions.

**Architecture:** A `notification` table stores all notification records with a JSONB `data` column for type-specific payloads. A shared `createNotification()` helper is called from existing tRPC routers when actions occur. The frontend polls for unread count every 30s and fetches the full list on dropdown open via a Radix Popover.

**Tech Stack:** Drizzle ORM (PostgreSQL), tRPC, React Query, Radix UI Popover, Lucide icons, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-29-notifications-design.md`

---

## Task 1: Add notification table to database schema

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add the notification table and relations**

Add after the `shuffleSwipe` table definition (after line 225), before the relations section:

```typescript
import { jsonb } from "drizzle-orm/pg-core";
// Add jsonb to the existing import from "drizzle-orm/pg-core"
```

```typescript
export const notification = pgTable(
	"notification",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		actorId: text("actor_id").references(() => user.id, {
			onDelete: "set null",
		}),
		type: text("type").notNull(),
		data: jsonb("data").notNull().default({}),
		read: boolean("read").notNull().default(false),
		actionTaken: text("action_taken"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("notification_recipient_id_idx").on(table.recipientId),
		index("notification_created_at_idx").on(table.createdAt),
	],
);
```

Add `notification` relations after the existing `shuffleSwipeRelations`:

```typescript
export const notificationRelations = relations(notification, ({ one }) => ({
	recipient: one(user, {
		fields: [notification.recipientId],
		references: [user.id],
		relationName: "notificationRecipient",
	}),
	actor: one(user, {
		fields: [notification.actorId],
		references: [user.id],
		relationName: "notificationActor",
	}),
}));
```

Add to `userRelations` (the existing `many` entries):

```typescript
notificationsReceived: many(notification, { relationName: "notificationRecipient" }),
notificationsActed: many(notification, { relationName: "notificationActor" }),
```

- [ ] **Step 2: Generate and push the migration**

Run: `bun run db:generate`
Expected: Migration file created in `drizzle/` directory

Run: `bun run db:push`
Expected: Schema pushed to database successfully

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(notifications): add notification table to schema"
```

---

## Task 2: Create notification helper and tRPC router

**Files:**
- Create: `src/integrations/trpc/routers/notification.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Create the notification router with createNotification helper**

Create `src/integrations/trpc/routers/notification.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { notification, user } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";

const NOTIFICATION_TYPES = [
	"watchlist_item_added",
	"watchlist_member_joined",
	"shuffle_match",
	"item_watched",
	"watchlist_invite",
	"friend_request",
	"title_reviewed",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export async function createNotification(params: {
	recipientId: string;
	actorId: string;
	type: NotificationType;
	data: Record<string, unknown>;
}) {
	// Don't notify yourself
	if (params.recipientId === params.actorId) return;

	await db.insert(notification).values({
		recipientId: params.recipientId,
		actorId: params.actorId,
		type: params.type,
		data: params.data,
	});
}

function twentyDaysAgo() {
	const d = new Date();
	d.setDate(d.getDate() - 20);
	return d;
}

export const notificationRouter = {
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const rows = await db
			.select({
				id: notification.id,
				type: notification.type,
				data: notification.data,
				read: notification.read,
				actionTaken: notification.actionTaken,
				createdAt: notification.createdAt,
				actorId: notification.actorId,
				actorUsername: user.username,
				actorAvatarUrl: user.avatarUrl,
			})
			.from(notification)
			.leftJoin(user, eq(notification.actorId, user.id))
			.where(
				and(
					eq(notification.recipientId, ctx.userId),
					gte(notification.createdAt, twentyDaysAgo()),
				),
			)
			.orderBy(desc(notification.createdAt));

		return rows;
	}),

	getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
		const [result] = await db
			.select({ value: count() })
			.from(notification)
			.where(
				and(
					eq(notification.recipientId, ctx.userId),
					eq(notification.read, false),
					gte(notification.createdAt, twentyDaysAgo()),
				),
			);

		return result?.value ?? 0;
	}),

	markAsRead: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input, ctx }) => {
			await db
				.update(notification)
				.set({ read: true })
				.where(
					and(
						eq(notification.id, input.id),
						eq(notification.recipientId, ctx.userId),
					),
				);
		}),

	markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
		await db
			.update(notification)
			.set({ read: true })
			.where(
				and(
					eq(notification.recipientId, ctx.userId),
					eq(notification.read, false),
				),
			);
	}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input, ctx }) => {
			await db
				.delete(notification)
				.where(
					and(
						eq(notification.id, input.id),
						eq(notification.recipientId, ctx.userId),
					),
				);
		}),

	deleteAll: protectedProcedure.mutation(async ({ ctx }) => {
		await db
			.delete(notification)
			.where(eq(notification.recipientId, ctx.userId));
	}),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register the router**

In `src/integrations/trpc/router.ts`, add the import and register it:

```typescript
import { notificationRouter } from "./routers/notification";
```

Add to the `createTRPCRouter` call:

```typescript
notification: notificationRouter,
```

- [ ] **Step 3: Verify the server starts**

Run: `bun run dev`
Expected: No TypeScript errors, server starts successfully

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/notification.ts src/integrations/trpc/router.ts
git commit -m "feat(notifications): add notification tRPC router with createNotification helper"
```

---

## Task 3: Wire createNotification into watchlist router

**Files:**
- Modify: `src/integrations/trpc/routers/watchlist.ts`

- [ ] **Step 1: Add notification calls to addItem**

Import at top of `watchlist.ts`:
```typescript
import { createNotification } from "./notification";
```

In the `addItem` mutation, after the insert, add notification creation for other members. The updated mutation body:

```typescript
addItem: protectedProcedure
	.input(
		z.object({
			watchlistId: z.string(),
			tmdbId: z.number(),
			mediaType: z.enum(["movie", "tv"]),
			titleName: z.string().optional(),
		}),
	)
	.mutation(async ({ input, ctx }) => {
		await assertMember(input.watchlistId, ctx.userId);
		await db
			.insert(watchlistItem)
			.values({
				watchlistId: input.watchlistId,
				tmdbId: input.tmdbId,
				mediaType: input.mediaType,
				addedBy: ctx.userId,
			})
			.onConflictDoNothing();

		// Notify other members
		const wl = await db.query.watchlist.findFirst({
			where: eq(watchlist.id, input.watchlistId),
			columns: { name: true },
		});
		const members = await db.query.watchlistMember.findMany({
			where: eq(watchlistMember.watchlistId, input.watchlistId),
			columns: { userId: true },
		});
		for (const member of members) {
			await createNotification({
				recipientId: member.userId,
				actorId: ctx.userId,
				type: "watchlist_item_added",
				data: {
					watchlistId: input.watchlistId,
					watchlistName: wl?.name ?? "",
					titleName: input.titleName ?? "",
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
				},
			});
		}
	}),
```

Note: `titleName` is added as an optional input param. The caller should pass it when available. The `createNotification` helper already skips self-notifications.

- [ ] **Step 2: Add notification calls to addMember**

In the `addMember` mutation, after inserting the member, notify other existing members:

```typescript
addMember: protectedProcedure
	.input(
		z.object({
			watchlistId: z.string(),
			userId: z.string(),
		}),
	)
	.mutation(async ({ input, ctx }) => {
		await assertOwner(input.watchlistId, ctx.userId);
		await db
			.insert(watchlistMember)
			.values({
				watchlistId: input.watchlistId,
				userId: input.userId,
				role: "member",
			})
			.onConflictDoNothing();

		// Notify other members (including the new member)
		const wl = await db.query.watchlist.findFirst({
			where: eq(watchlist.id, input.watchlistId),
			columns: { name: true },
		});
		const members = await db.query.watchlistMember.findMany({
			where: eq(watchlistMember.watchlistId, input.watchlistId),
			columns: { userId: true },
		});
		for (const member of members) {
			await createNotification({
				recipientId: member.userId,
				actorId: ctx.userId,
				type: "watchlist_member_joined",
				data: {
					watchlistId: input.watchlistId,
					watchlistName: wl?.name ?? "",
				},
			});
		}
	}),
```

- [ ] **Step 3: Add notification calls to markWatched**

In the `markWatched` mutation, after updating, notify other members (only when marking as watched, not when unmarking):

```typescript
markWatched: protectedProcedure
	.input(
		z.object({
			watchlistId: z.string(),
			tmdbId: z.number(),
			mediaType: z.enum(["movie", "tv"]),
			watched: z.boolean(),
			titleName: z.string().optional(),
		}),
	)
	.mutation(async ({ input, ctx }) => {
		await assertMember(input.watchlistId, ctx.userId);
		await db
			.update(watchlistItem)
			.set({ watched: input.watched })
			.where(
				and(
					eq(watchlistItem.watchlistId, input.watchlistId),
					eq(watchlistItem.tmdbId, input.tmdbId),
					eq(watchlistItem.mediaType, input.mediaType),
				),
			);

		// Only notify when marking as watched (not unmarking)
		if (input.watched) {
			const wl = await db.query.watchlist.findFirst({
				where: eq(watchlist.id, input.watchlistId),
				columns: { name: true },
			});
			const members = await db.query.watchlistMember.findMany({
				where: eq(watchlistMember.watchlistId, input.watchlistId),
				columns: { userId: true },
			});
			for (const member of members) {
				await createNotification({
					recipientId: member.userId,
					actorId: ctx.userId,
					type: "item_watched",
					data: {
						watchlistId: input.watchlistId,
						watchlistName: wl?.name ?? "",
						titleName: input.titleName ?? "",
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
					},
				});
			}
		}
	}),
```

- [ ] **Step 4: Verify the server starts and types check**

Run: `bun run dev`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts
git commit -m "feat(notifications): wire createNotification into watchlist router"
```

---

## Task 4: Wire createNotification into shuffle router

**Files:**
- Modify: `src/integrations/trpc/routers/shuffle.ts`

- [ ] **Step 1: Add notification on shuffle match**

Import at top of `shuffle.ts`:
```typescript
import { createNotification } from "./notification";
```

In the `recordSwipe` mutation, after the unanimous match block (line 306-323), when `yesSwipes.length >= memberCount`, add notifications for all members who swiped yes. The match block becomes:

```typescript
if (yesSwipes.length >= memberCount) {
	// Unanimous match — add to watchlist
	await db
		.insert(watchlistItem)
		.values({
			watchlistId: input.watchlistId,
			tmdbId: input.tmdbId,
			mediaType: input.mediaType,
			addedBy: ctx.userId,
		})
		.onConflictDoNothing();

	// Notify all members about the match
	for (const swipe of yesSwipes) {
		await createNotification({
			recipientId: swipe.userId,
			actorId: ctx.userId,
			type: "shuffle_match",
			data: {
				watchlistId: input.watchlistId,
				titleName: "", // Will be populated by caller via input
				tmdbId: input.tmdbId,
				mediaType: input.mediaType,
			},
		});
	}

	return {
		match: true,
		watchlistName: wl.name,
		tmdbId: input.tmdbId,
		mediaType: input.mediaType,
	};
}
```

Note: The shuffle match notification won't have a `titleName` in the data since the shuffle router doesn't have it. The frontend can look it up from tmdbId/mediaType when rendering, or we can add a `titleName` input to `recordSwipe`. Use your judgement — if the caller already has the title name, add it as an optional input. Otherwise, the notification renderer can show "a title" as fallback and link to the title page.

- [ ] **Step 2: Verify the server starts**

Run: `bun run dev`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/shuffle.ts
git commit -m "feat(notifications): wire createNotification into shuffle match logic"
```

---

## Task 5: Build NotificationBell and NotificationDropdown components

**Files:**
- Create: `src/components/notifications/notification-bell.tsx`
- Create: `src/components/notifications/notification-item.tsx`
- Modify: `src/routes/app/route.tsx`

- [ ] **Step 1: Create the NotificationItem component**

Create `src/components/notifications/notification-item.tsx`:

```typescript
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useTRPC } from "#/integrations/trpc/react";

interface NotificationItemProps {
	notification: {
		id: string;
		type: string;
		data: unknown;
		read: boolean;
		actionTaken: string | null;
		createdAt: Date;
		actorId: string | null;
		actorUsername: string | null;
		actorAvatarUrl: string | null;
	};
}

function formatTimeAgo(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - new Date(date).getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "Just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay === 1) return "Yesterday";
	return `${diffDay}d ago`;
}

function getNotificationMessage(type: string, data: Record<string, unknown>, actorName: string): { text: string; link?: string } {
	switch (type) {
		case "watchlist_item_added":
			return {
				text: `added ${data.titleName || "a title"} to ${data.watchlistName}`,
				link: `/app/watchlists/${data.watchlistId}`,
			};
		case "watchlist_member_joined":
			return {
				text: `joined ${data.watchlistName}`,
				link: `/app/watchlists/${data.watchlistId}`,
			};
		case "shuffle_match":
			return {
				text: `You both want to watch ${data.titleName || "a title"}!`,
				link: data.tmdbId ? `/app/title/${data.mediaType}/${data.tmdbId}` : undefined,
			};
		case "item_watched":
			return {
				text: `marked ${data.titleName || "a title"} as watched in ${data.watchlistName}`,
				link: `/app/watchlists/${data.watchlistId}`,
			};
		case "watchlist_invite":
			return {
				text: `invited you to ${data.watchlistName}`,
				link: `/app/watchlists/${data.watchlistId}`,
			};
		case "friend_request":
			return { text: "sent you a friend request" };
		case "title_reviewed":
			return {
				text: `reviewed ${data.titleName || "a title"} you recommended`,
				link: data.tmdbId ? `/app/title/${data.mediaType}/${data.tmdbId}` : undefined,
			};
		default:
			return { text: "sent you a notification" };
	}
}

export function NotificationItem({ notification: n }: NotificationItemProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const markAsRead = useMutation(
		trpc.notification.markAsRead.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
				queryClient.invalidateQueries(trpc.notification.getUnreadCount.queryFilter());
			},
		}),
	);

	const deleteNotification = useMutation(
		trpc.notification.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
				queryClient.invalidateQueries(trpc.notification.getUnreadCount.queryFilter());
			},
		}),
	);

	const data = (n.data ?? {}) as Record<string, unknown>;
	const actorName = n.actorUsername ?? "Someone";
	const { text, link } = getNotificationMessage(n.type, data, actorName);
	const isMatch = n.type === "shuffle_match";

	const content = (
		<div
			className={`flex gap-2.5 px-4 py-3 ${
				n.read
					? "border-l-2 border-l-transparent"
					: "border-l-2 border-l-neon-cyan bg-neon-cyan/[0.04]"
			}`}
		>
			{/* Avatar */}
			<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cream/10">
				{isMatch ? (
					<span className="text-sm">🎉</span>
				) : n.actorAvatarUrl ? (
					<img
						src={n.actorAvatarUrl}
						alt=""
						className="h-8 w-8 rounded-full object-cover"
					/>
				) : (
					<span className="text-xs font-medium text-cream/60">
						{actorName.charAt(0).toUpperCase()}
					</span>
				)}
			</div>

			{/* Content */}
			<div className="min-w-0 flex-1">
				<p className={`text-[13px] leading-snug ${n.read ? "text-cream/50" : "text-cream/90"}`}>
					{isMatch ? (
						<>{text}</>
					) : (
						<>
							<strong className={n.read ? "text-cream/60" : "text-cream"}>{actorName}</strong>{" "}
							{text}
						</>
					)}
				</p>
				<span className={`text-[11px] ${n.read ? "text-cream/25" : "text-cream/35"}`}>
					{formatTimeAgo(n.createdAt)}
				</span>
			</div>

			{/* Dismiss */}
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					deleteNotification.mutate({ id: n.id });
				}}
				className="flex-shrink-0 p-0.5 text-cream/20 transition-colors hover:text-cream/50"
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</div>
	);

	if (link) {
		return (
			<Link
				to={link}
				className="block no-underline transition-colors hover:bg-cream/[0.03]"
				onClick={() => {
					if (!n.read) markAsRead.mutate({ id: n.id });
				}}
			>
				{content}
			</Link>
		);
	}

	return (
		<div
			className="transition-colors hover:bg-cream/[0.03]"
			onClick={() => {
				if (!n.read) markAsRead.mutate({ id: n.id });
			}}
		>
			{content}
		</div>
	);
}
```

- [ ] **Step 2: Create the NotificationBell component**

Create `src/components/notifications/notification-bell.tsx`:

```typescript
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { useTRPC } from "#/integrations/trpc/react";
import { NotificationItem } from "./notification-item";

export function NotificationBell() {
	const [open, setOpen] = useState(false);
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: unreadCount = 0 } = useQuery({
		...trpc.notification.getUnreadCount.queryOptions(),
		refetchInterval: 30000,
	});

	const { data: notifications = [], isLoading } = useQuery({
		...trpc.notification.getAll.queryOptions(),
		enabled: open,
	});

	const markAllAsRead = useMutation(
		trpc.notification.markAllAsRead.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
				queryClient.invalidateQueries(trpc.notification.getUnreadCount.queryFilter());
			},
		}),
	);

	const deleteAll = useMutation(
		trpc.notification.deleteAll.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
				queryClient.invalidateQueries(trpc.notification.getUnreadCount.queryFilter());
			},
		}),
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="relative rounded-lg p-2 text-cream/50 transition-colors hover:bg-cream/5 hover:text-cream/80 data-[state=open]:text-neon-cyan"
				>
					<Bell className="h-5 w-5" />
					{unreadCount > 0 && (
						<span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-pink px-1 text-[10px] font-bold text-white">
							{unreadCount > 9 ? "9+" : unreadCount}
						</span>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 border-cream/10 bg-drive-in-card p-0"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-cream/8 px-4 py-3">
					<span className="text-sm font-semibold text-cream">
						Notifications
					</span>
					{unreadCount > 0 && (
						<button
							type="button"
							onClick={() => markAllAsRead.mutate()}
							className="text-xs text-cream/40 transition-colors hover:text-cream/60"
						>
							Mark all read
						</button>
					)}
				</div>

				{/* List */}
				<div className="max-h-[400px] overflow-y-auto">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<span className="text-sm text-cream/30">Loading...</span>
						</div>
					) : notifications.length === 0 ? (
						<div className="flex items-center justify-center py-8">
							<span className="text-sm text-cream/30">
								No notifications
							</span>
						</div>
					) : (
						notifications.map((n) => (
							<NotificationItem key={n.id} notification={n} />
						))
					)}
				</div>

				{/* Footer */}
				{notifications.length > 0 && (
					<div className="border-t border-cream/8 py-2.5 text-center">
						<button
							type="button"
							onClick={() => deleteAll.mutate()}
							className="text-xs text-neon-pink/70 transition-colors hover:text-neon-pink"
						>
							Delete all notifications
						</button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
```

- [ ] **Step 3: Add NotificationBell to the navbar**

In `src/routes/app/route.tsx`, add the import:

```typescript
import { NotificationBell } from "#/components/notifications/notification-bell";
```

Change the spacer + auth section from:

```tsx
<div className="ml-auto">
	<BetterAuthHeader />
</div>
```

To:

```tsx
<div className="ml-auto flex items-center gap-3">
	<NotificationBell />
	<BetterAuthHeader />
</div>
```

- [ ] **Step 4: Verify the app renders**

Run: `bun run dev`
Expected: Bell icon visible in navbar next to avatar. Clicking it opens the dropdown. No errors in console.

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/ src/routes/app/route.tsx
git commit -m "feat(notifications): add NotificationBell and NotificationDropdown UI"
```

---

## Task 6: Update addItem/markWatched callers to pass titleName

**Files:**
- Modify: Callers of `watchlist.addItem` and `watchlist.markWatched` mutations (find via grep)

- [ ] **Step 1: Find all callers**

Run: `grep -rn "addItem\.mutate\|markWatched\.mutate" src/ --include="*.tsx" --include="*.ts"`

For each call site, check if the title name is available in the component's context and pass it as `titleName` in the mutation input. Common patterns:
- `watchlist-item-card.tsx` has item data — pass the title name if available in props
- Components adding items from search/shuffle have title data in scope

This step requires reading each call site to understand what data is available. The `titleName` field is optional, so callers that don't have the title name readily available can omit it.

- [ ] **Step 2: Verify no type errors**

Run: `bun run dev`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "feat(notifications): pass titleName from callers to addItem/markWatched"
```

---

## Task 7: Manual end-to-end testing

- [ ] **Step 1: Test notification creation**

1. Open the app with two user accounts (or two browser sessions)
2. User A adds an item to a shared watchlist → User B should see a notification
3. User A adds User B to a watchlist → User B should see a "joined" notification
4. Mark an item as watched → other members should see the notification
5. Trigger a shuffle match → both users should see the match notification

- [ ] **Step 2: Test notification interactions**

1. Click the bell icon → dropdown opens with notifications
2. Click a notification → marks as read, navigates to the linked page
3. Click × on a notification → dismisses it
4. Click "Mark all read" → all notifications become read
5. Click "Delete all notifications" → all notifications removed
6. Verify badge count updates correctly after each action

- [ ] **Step 3: Test edge cases**

1. Verify self-notifications are suppressed (adding item to your own watchlist shouldn't notify you)
2. Verify empty state shows "No notifications"
3. Verify polling updates badge count every 30s
4. Verify old notifications (>20 days) don't appear

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "fix(notifications): address issues found during testing"
```
