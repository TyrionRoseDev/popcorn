# Recommend to Friend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users recommend movies/TV shows to friends, with accept/decline flow that adds accepted recommendations to a dedicated watchlist.

**Architecture:** New `recommendation` table + `recommendedBy`/`recommendationMessage` columns on `watchlist_item` + new `type: "recommendations"` value for watchlists. New `recommendation` tRPC router handles send/accept/decline. Existing notification system delivers recommendation alerts. Existing watchlist UI renders the recommendations watchlist identically to other watchlists but with "Recommended by" attribution and a "Sort by recommender" option.

**Tech Stack:** Drizzle ORM, tRPC, React, TanStack Query, Zod, Lucide icons, Sonner toasts

---

## File Structure

**New files:**
- `src/integrations/trpc/routers/recommendation.ts` — tRPC router for send/accept/decline
- `src/components/title/recommend-modal.tsx` — friend picker popup with multi-select + message

**Modified files:**
- `src/db/schema.ts` — add `recommendation` table, add `recommendedBy`/`recommendationMessage` to `watchlistItem`, add `"recommendations"` to watchlist type comment
- `src/integrations/trpc/routers/notification.ts` — add `recommendation_received` and `recommendation_reviewed` to NOTIFICATION_TYPES
- `src/integrations/trpc/router.ts` — register recommendation router
- `src/components/notifications/notification-item.tsx` — render recommendation notifications with accept/decline buttons
- `src/routes/app/title.$mediaType.$tmdbId.tsx` — wire up Send button to open recommend modal
- `src/components/watchlist/watchlist-item-card.tsx` — show "Recommended by" attribution
- `src/components/watchlist/watchlist-filters.tsx` — add "Recommender" sort option
- `src/routes/app/watchlists/$watchlistId.tsx` — handle "recommender" sort, pass recommendedBy to item cards

**Migration file:**
- `drizzle/0005_recommendation.sql` — create recommendation table, alter watchlist_item

---

### Task 1: Database Schema Changes

**Files:**
- Modify: `src/db/schema.ts:133-179` (watchlist + watchlistItem tables)
- Modify: `src/db/schema.ts:368-384` (watchlistItem relations)

- [ ] **Step 1: Add recommendation table to schema**

Add after the `block` table and its relations (end of file, before closing):

```typescript
export const recommendation = pgTable(
	"recommendation",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		senderId: text("sender_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(),
		message: text("message"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("recommendation_sender_id_idx").on(table.senderId),
		index("recommendation_recipient_id_idx").on(table.recipientId),
	],
);

export const recommendationRelations = relations(recommendation, ({ one }) => ({
	sender: one(user, {
		fields: [recommendation.senderId],
		references: [user.id],
		relationName: "recommendationSender",
	}),
	recipient: one(user, {
		fields: [recommendation.recipientId],
		references: [user.id],
		relationName: "recommendationRecipient",
	}),
}));
```

- [ ] **Step 2: Add recommendedBy and recommendationMessage to watchlistItem**

In the `watchlistItem` table definition (around line 154), add two new columns after `watched`:

```typescript
recommendedBy: text("recommended_by").references(() => user.id, {
	onDelete: "set null",
}),
recommendationMessage: text("recommendation_message"),
```

- [ ] **Step 3: Add recommendedByUser relation to watchlistItemRelations**

In `watchlistItemRelations` (around line 375), add a new relation:

```typescript
export const watchlistItemRelations = relations(watchlistItem, ({ one }) => ({
	watchlist: one(watchlist, {
		fields: [watchlistItem.watchlistId],
		references: [watchlist.id],
	}),
	addedByUser: one(user, {
		fields: [watchlistItem.addedBy],
		references: [user.id],
	}),
	recommendedByUser: one(user, {
		fields: [watchlistItem.recommendedBy],
		references: [user.id],
		relationName: "recommendedByUser",
	}),
}));
```

- [ ] **Step 4: Generate and apply migration**

Run:
```bash
bunx drizzle-kit generate --name recommendation
```

Then review the generated SQL file in `drizzle/` and run:
```bash
bunx drizzle-kit push
```

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add recommendation table and watchlist_item attribution columns"
```

---

### Task 2: Notification Types

**Files:**
- Modify: `src/integrations/trpc/routers/notification.ts:8-17`

- [ ] **Step 1: Add new notification types**

Update `NOTIFICATION_TYPES` to include the two new types:

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
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/integrations/trpc/routers/notification.ts
git commit -m "feat: add recommendation notification types"
```

---

### Task 3: Recommendation tRPC Router

**Files:**
- Create: `src/integrations/trpc/routers/recommendation.ts`
- Modify: `src/integrations/trpc/router.ts:29-38`

- [ ] **Step 1: Create recommendation router**

Create `src/integrations/trpc/routers/recommendation.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	friendship,
	notification,
	recommendation,
	user,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { createNotification } from "./notification";

async function getOrCreateRecommendationsWatchlist(userId: string) {
	const existing = await db.query.watchlist.findFirst({
		where: and(eq(watchlist.ownerId, userId), eq(watchlist.type, "recommendations")),
	});
	if (existing) return existing.id;

	return db.transaction(async (tx) => {
		// Double-check inside transaction to prevent race condition
		const check = await tx.query.watchlist.findFirst({
			where: and(eq(watchlist.ownerId, userId), eq(watchlist.type, "recommendations")),
		});
		if (check) return check.id;

		const [wl] = await tx
			.insert(watchlist)
			.values({
				name: "Recommendations",
				ownerId: userId,
				type: "recommendations",
			})
			.returning({ id: watchlist.id });

		await tx.insert(watchlistMember).values({
			watchlistId: wl.id,
			userId,
			role: "owner",
		});

		return wl.id;
	});
}

export const recommendationRouter = {
	send: protectedProcedure
		.input(
			z.object({
				recipientIds: z.array(z.string()).min(1),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				titleName: z.string(),
				message: z.string().max(150).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// Verify all recipients are friends
			for (const recipientId of input.recipientIds) {
				if (recipientId === ctx.userId) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Cannot recommend to yourself",
					});
				}

				const isFriend = await db.query.friendship.findFirst({
					where: and(
						eq(friendship.status, "accepted"),
						or(
							and(
								eq(friendship.requesterId, ctx.userId),
								eq(friendship.addresseeId, recipientId),
							),
							and(
								eq(friendship.addresseeId, ctx.userId),
								eq(friendship.requesterId, recipientId),
							),
						),
					),
				});

				if (!isFriend) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only recommend to friends",
					});
				}
			}

			// Insert recommendations and send notifications
			for (const recipientId of input.recipientIds) {
				await db.insert(recommendation).values({
					senderId: ctx.userId,
					recipientId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					message: input.message ?? null,
				});

				await createNotification({
					recipientId,
					actorId: ctx.userId,
					type: "recommendation_received",
					data: {
						titleName: input.titleName,
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
						message: input.message ?? null,
					},
				});
			}
		}),

	accept: protectedProcedure
		.input(
			z.object({
				notificationId: z.string(),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				recommendedBy: z.string(),
				message: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const watchlistId = await getOrCreateRecommendationsWatchlist(ctx.userId);

			await db
				.insert(watchlistItem)
				.values({
					watchlistId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					addedBy: ctx.userId,
					recommendedBy: input.recommendedBy,
					recommendationMessage: input.message ?? null,
				})
				.onConflictDoNothing();

			// Mark notification as actioned
			await db
				.update(notification)
				.set({ actionTaken: "accepted", read: true })
				.where(
					and(
						eq(notification.id, input.notificationId),
						eq(notification.recipientId, ctx.userId),
					),
				);
		}),

	decline: protectedProcedure
		.input(z.object({ notificationId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			await db
				.update(notification)
				.set({ actionTaken: "declined", read: true })
				.where(
					and(
						eq(notification.id, input.notificationId),
						eq(notification.recipientId, ctx.userId),
					),
				);
		}),

	searchFriends: protectedProcedure
		.input(z.object({ query: z.string().min(1) }))
		.query(async ({ input, ctx }) => {
			const friends = await db
				.select({
					id: user.id,
					username: user.username,
					avatarUrl: user.avatarUrl,
				})
				.from(friendship)
				.innerJoin(
					user,
					or(
						and(
							eq(friendship.requesterId, ctx.userId),
							eq(user.id, friendship.addresseeId),
						),
						and(
							eq(friendship.addresseeId, ctx.userId),
							eq(user.id, friendship.requesterId),
						),
					),
				)
				.where(
					and(
						eq(friendship.status, "accepted"),
						or(
							eq(friendship.requesterId, ctx.userId),
							eq(friendship.addresseeId, ctx.userId),
						),
						ilike(user.username, `%${input.query}%`),
					),
				)
				.limit(10);

			return friends;
		}),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register router**

In `src/integrations/trpc/router.ts`, add the import and register it:

```typescript
import { recommendationRouter } from "./routers/recommendation";
```

Add to the router object:

```typescript
export const trpcRouter = createTRPCRouter({
	todos: todosRouter,
	friend: friendRouter,
	tasteProfile: tasteProfileRouter,
	search: searchRouter,
	shuffle: shuffleRouter,
	title: titleRouter,
	notification: notificationRouter,
	watchlist: watchlistRouter,
	recommendation: recommendationRouter,
});
```

- [ ] **Step 3: Verify the app compiles**

Run:
```bash
bun run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/recommendation.ts src/integrations/trpc/router.ts
git commit -m "feat: add recommendation tRPC router with send/accept/decline"
```

---

### Task 4: Recommend Modal Component

**Files:**
- Create: `src/components/title/recommend-modal.tsx`

- [ ] **Step 1: Create the recommend modal**

Create `src/components/title/recommend-modal.tsx`:

```tsx
import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Loader2, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";

interface RecommendModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	mediaType: "movie" | "tv";
	titleName: string;
}

export function RecommendModal({
	open,
	onOpenChange,
	tmdbId,
	mediaType,
	titleName,
}: RecommendModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [searchInput, setSearchInput] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [selectedFriends, setSelectedFriends] = useState<
		{ id: string; username: string | null; avatarUrl: string | null }[]
	>([]);
	const [message, setMessage] = useState("");

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(searchInput), 300);
		return () => clearTimeout(timer);
	}, [searchInput]);

	const { data: friends, isFetching } = useQuery(
		trpc.recommendation.searchFriends.queryOptions(
			debouncedQuery.length >= 1 ? { query: debouncedQuery } : skipToken,
		),
	);

	const sendRecommendation = useMutation(
		trpc.recommendation.send.mutationOptions({
			onSuccess: () => {
				const count = selectedFriends.length;
				toast.success(
					`Recommended ${titleName} to ${count} friend${count > 1 ? "s" : ""}`,
				);
				resetAndClose();
			},
			onError: (err) => {
				toast.error(err.message ?? "Failed to send recommendation");
			},
		}),
	);

	function resetAndClose() {
		setSearchInput("");
		setDebouncedQuery("");
		setSelectedFriends([]);
		setMessage("");
		onOpenChange(false);
	}

	function toggleFriend(friend: {
		id: string;
		username: string | null;
		avatarUrl: string | null;
	}) {
		setSelectedFriends((prev) => {
			const exists = prev.find((f) => f.id === friend.id);
			if (exists) return prev.filter((f) => f.id !== friend.id);
			return [...prev, friend];
		});
	}

	function handleSend() {
		if (selectedFriends.length === 0) return;
		sendRecommendation.mutate({
			recipientIds: selectedFriends.map((f) => f.id),
			tmdbId,
			mediaType,
			titleName,
			message: message.trim() || undefined,
		});
	}

	const filteredFriends = friends?.filter(
		(f) => !selectedFriends.some((s) => s.id === f.id),
	);
	const showResults = debouncedQuery.length >= 1 && filteredFriends;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) resetAndClose();
				else onOpenChange(nextOpen);
			}}
		>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-md">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Recommend {titleName}
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						Send this to a friend to watch.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{/* Selected friends chips */}
					{selectedFriends.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{selectedFriends.map((f) => (
								<span
									key={f.id}
									className="inline-flex items-center gap-1 rounded-full border border-neon-amber/30 bg-neon-amber/10 px-2.5 py-1 text-xs text-neon-amber"
								>
									@{f.username}
									<button
										type="button"
										onClick={() => toggleFriend(f)}
										className="ml-0.5 hover:text-cream transition-colors"
									>
										<X className="h-3 w-3" />
									</button>
								</span>
							))}
						</div>
					)}

					{/* Search input */}
					<input
						type="text"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder="Search friends..."
						disabled={sendRecommendation.isPending}
						autoFocus
						className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-amber/40 focus:outline-none disabled:opacity-50"
					/>

					{/* Loading */}
					{isFetching && (
						<div className="flex items-center gap-2 px-1 py-3 text-sm text-cream/40">
							<Loader2 className="h-4 w-4 animate-spin" />
							Searching...
						</div>
					)}

					{/* Results */}
					{showResults && !isFetching && filteredFriends.length > 0 && (
						<div className="flex flex-col max-h-[160px] overflow-y-auto">
							{filteredFriends.map((f) => (
								<button
									key={f.id}
									type="button"
									onClick={() => toggleFriend(f)}
									className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-cream/5 text-left transition-colors"
								>
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream/10 text-xs font-semibold text-cream/60 uppercase">
										{f.avatarUrl ? (
											<img
												src={f.avatarUrl}
												alt=""
												className="h-8 w-8 rounded-full object-cover"
											/>
										) : (
											(f.username?.[0] ?? "?")
										)}
									</div>
									<span className="text-sm text-cream/70 truncate">
										@{f.username}
									</span>
								</button>
							))}
						</div>
					)}

					{/* Empty */}
					{showResults && !isFetching && filteredFriends.length === 0 && (
						<p className="px-1 py-3 text-sm text-cream/30">No friends found</p>
					)}

					{/* Message input */}
					{selectedFriends.length > 0 && (
						<>
							<textarea
								value={message}
								onChange={(e) => setMessage(e.target.value.slice(0, 150))}
								placeholder="Add a message (optional)"
								rows={2}
								className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-amber/40 focus:outline-none resize-none"
							/>
							<div className="flex items-center justify-between">
								<span className="text-[11px] text-cream/25">
									{message.length}/150
								</span>
								<button
									type="button"
									onClick={handleSend}
									disabled={sendRecommendation.isPending}
									className="inline-flex items-center gap-1.5 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-4 py-1.5 text-sm font-semibold text-neon-amber transition-colors hover:bg-neon-amber/20 disabled:opacity-50"
								>
									<Send className="h-3.5 w-3.5" />
									{sendRecommendation.isPending ? "Sending..." : "Send"}
								</button>
							</div>
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
bun run build
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/title/recommend-modal.tsx
git commit -m "feat: add recommend-to-friend modal component"
```

---

### Task 5: Wire Up Title Page Button

**Files:**
- Modify: `src/routes/app/title.$mediaType.$tmdbId.tsx:75-79`

- [ ] **Step 1: Add state and import**

Add to the imports at the top of the file:

```typescript
import { useState } from "react";
import { RecommendModal } from "#/components/title/recommend-modal";
```

- [ ] **Step 2: Add state and modal to TitlePage component**

Inside the `TitlePage` function, after the `useQuery` call, add:

```typescript
const [recommendOpen, setRecommendOpen] = useState(false);
```

Update the Send button to add the onClick and add the modal after the buttons div:

```tsx
<div className="flex gap-4 justify-center mt-5">
	<ArcadeButton icon={Plus} label="Watchlist" color="pink" />
	<ArcadeButton icon={Check} label="Watched" color="cyan" />
	<ArcadeButton
		icon={Send}
		label="Recommend"
		color="amber"
		onClick={() => setRecommendOpen(true)}
	/>
</div>
<RecommendModal
	open={recommendOpen}
	onOpenChange={setRecommendOpen}
	tmdbId={tmdbId}
	mediaType={mediaType}
	titleName={data.title}
/>
```

Note: Change the label from "Invite" to "Recommend" to match the feature.

- [ ] **Step 3: Verify it compiles**

Run:
```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/title.\$mediaType.\$tmdbId.tsx
git commit -m "feat: wire recommend button to open recommendation modal"
```

---

### Task 6: Notification Rendering for Recommendations

**Files:**
- Modify: `src/components/notifications/notification-item.tsx:34-88` and `90-214`

- [ ] **Step 1: Add recommendation_received case to getNotificationMessage**

Add two new cases to the switch in `getNotificationMessage`:

```typescript
case "recommendation_received":
	return {
		text: `recommended ${data.titleName || "a title"} for you${data.message ? ` — "${data.message}"` : ""}`,
		link: data.tmdbId
			? `/app/title/${data.mediaType}/${data.tmdbId}`
			: undefined,
	};
case "recommendation_reviewed":
	return {
		text: `watched ${data.titleName || "a title"} that you recommended`,
		link: data.tmdbId
			? `/app/title/${data.mediaType}/${data.tmdbId}`
			: undefined,
	};
```

- [ ] **Step 2: Add accept/decline buttons to NotificationItem**

Import the mutation hooks and add the recommendation actions. First, add to imports:

```typescript
import { Check, X as XIcon } from "lucide-react";
```

Wait — `X` is already imported. Rename the existing `X` import or use a different approach. The existing code imports `X` from lucide-react. We need `Check` too. Update the import:

```typescript
import { Check, X } from "lucide-react";
```

Then inside the `NotificationItem` component, add the accept and decline mutations after the existing `deleteNotification` mutation:

```typescript
const acceptRecommendation = useMutation(
	trpc.recommendation.accept.mutationOptions({
		onSuccess: () => {
			queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
			queryClient.invalidateQueries(
				trpc.notification.getUnreadCount.queryFilter(),
			);
			queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
		},
	}),
);

const declineRecommendation = useMutation(
	trpc.recommendation.decline.mutationOptions({
		onSuccess: () => {
			queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
			queryClient.invalidateQueries(
				trpc.notification.getUnreadCount.queryFilter(),
			);
		},
	}),
);
```

Then in the JSX, add action buttons after the time-ago `<span>`. Add this inside the Content div, after the `<span>` with the time:

```tsx
{n.type === "recommendation_received" && !n.actionTaken && (
	<div className="mt-1.5 flex items-center gap-2">
		<button
			type="button"
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				acceptRecommendation.mutate({
					notificationId: n.id,
					tmdbId: data.tmdbId as number,
					mediaType: data.mediaType as "movie" | "tv",
					recommendedBy: n.actorId!,
					message: (data.message as string) ?? null,
				});
			}}
			disabled={acceptRecommendation.isPending}
			className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2.5 py-1 text-[11px] font-semibold text-neon-cyan transition-colors hover:bg-neon-cyan/20 disabled:opacity-50"
		>
			<Check className="h-3 w-3" />
			Accept
		</button>
		<button
			type="button"
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				declineRecommendation.mutate({
					notificationId: n.id,
				});
			}}
			disabled={declineRecommendation.isPending}
			className="rounded-full border border-cream/15 px-2.5 py-1 text-[11px] text-cream/40 transition-colors hover:text-cream/60 hover:border-cream/25 disabled:opacity-50"
		>
			Decline
		</button>
	</div>
)}
{n.type === "recommendation_received" && n.actionTaken === "accepted" && (
	<span className="mt-1 inline-block text-[10px] text-neon-cyan/60">
		Added to your Recommendations
	</span>
)}
{n.type === "recommendation_received" && n.actionTaken === "declined" && (
	<span className="mt-1 inline-block text-[10px] text-cream/25">
		Declined
	</span>
)}
```

- [ ] **Step 3: Verify it compiles**

Run:
```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/notifications/notification-item.tsx
git commit -m "feat: render recommendation notifications with accept/decline buttons"
```

---

### Task 7: Watchlist Item Card Attribution

**Files:**
- Modify: `src/components/watchlist/watchlist-item-card.tsx:20-35` and `152-158`

- [ ] **Step 1: Update WatchlistItemCardProps interface**

Add the optional `recommendedByUser` field to the `item` type in the props interface:

```typescript
interface WatchlistItemCardProps {
	item: {
		tmdbId: number;
		mediaType: string;
		watched: boolean;
		createdAt: Date | string;
		addedByUser: {
			id: string;
			username: string | null;
			avatarUrl: string | null;
		};
		recommendedBy?: string | null;
		recommendationMessage?: string | null;
		recommendedByUser?: {
			id: string;
			username: string | null;
			avatarUrl: string | null;
		} | null;
	};
	watchlistId: string;
	userRole: string | null;
	isShared: boolean;
}
```

- [ ] **Step 2: Add recommended-by display**

Replace the existing "Added by" section at the bottom of the component (the `{isShared && ...}` block) with:

```tsx
{/* Attribution */}
{item.recommendedByUser?.username ? (
	<p className="mt-1.5 truncate text-[11px] text-neon-amber/50">
		Recommended by @{item.recommendedByUser.username}
	</p>
) : isShared && item.addedByUser.username ? (
	<p className="mt-1.5 truncate text-[11px] text-cream/30">
		Added by @{item.addedByUser.username}
	</p>
) : null}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/watchlist/watchlist-item-card.tsx
git commit -m "feat: show recommended-by attribution on watchlist item cards"
```

---

### Task 8: Watchlist Detail Page + Filters — Sort by Recommender

**Files:**
- Modify: `src/components/watchlist/watchlist-filters.tsx:8-13`
- Modify: `src/routes/app/watchlists/$watchlistId.tsx:10-76`

- [ ] **Step 1: Add recommender sort option to filters**

In `watchlist-filters.tsx`, add a new sort option:

```typescript
const SORT_OPTIONS = [
	{ value: "date-added", label: "Date Added" },
	{ value: "title", label: "Title" },
	{ value: "year", label: "Year" },
	{ value: "rating", label: "Rating" },
	{ value: "recommender", label: "Recommender" },
];
```

- [ ] **Step 2: Update search schema in watchlist detail page**

In `$watchlistId.tsx`, update the search schema to include `"recommender"`:

```typescript
const searchSchema = z.object({
	sort: z
		.enum(["date-added", "title", "year", "rating", "recommender"])
		.default("date-added"),
	type: z.enum(["all", "movie", "tv"]).default("all"),
});
```

- [ ] **Step 3: Add recommender sort logic**

In the `filteredItems` function inside `WatchlistDetailPage`, add the recommender case to the sort switch:

```typescript
case "recommender":
	items.sort((a, b) => {
		const aName = a.recommendedByUser?.username ?? "";
		const bName = b.recommendedByUser?.username ?? "";
		return aName.localeCompare(bName);
	});
	break;
```

- [ ] **Step 4: Update the watchlist.get query to include recommendedByUser**

In `src/integrations/trpc/routers/watchlist.ts`, update the `get` procedure's `with` clause for items to include the `recommendedByUser` relation. Find the `items` section in the `get` procedure (around line 112-118) and update it:

```typescript
items: {
	with: {
		addedByUser: {
			columns: { id: true, username: true, avatarUrl: true },
		},
		recommendedByUser: {
			columns: { id: true, username: true, avatarUrl: true },
		},
	},
	orderBy: (item, { desc }) => [desc(item.createdAt)],
},
```

- [ ] **Step 5: Verify it compiles**

Run:
```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/watchlist/watchlist-filters.tsx src/routes/app/watchlists/\$watchlistId.tsx src/integrations/trpc/routers/watchlist.ts
git commit -m "feat: add sort-by-recommender option to watchlist filters"
```

---

### Task 9: Watchlist Protections for Recommendations Watchlist

**Files:**
- Modify: `src/integrations/trpc/routers/watchlist.ts:283-297` (delete) and other procedures

- [ ] **Step 1: Protect recommendations watchlist from deletion**

In the `delete` procedure of the watchlist router, add a check for the recommendations type alongside the existing default check:

```typescript
if (wl?.type === "default" || wl?.type === "recommendations") {
	throw new TRPCError({
		code: "BAD_REQUEST",
		message: "Cannot delete this watchlist",
	});
}
```

- [ ] **Step 2: Protect from adding members**

In the `addMember` procedure, add a check at the beginning (after `assertOwner`):

```typescript
const wl = await db.query.watchlist.findFirst({
	where: eq(watchlist.id, input.watchlistId),
	columns: { type: true },
});
if (wl?.type === "recommendations") {
	throw new TRPCError({
		code: "BAD_REQUEST",
		message: "Cannot invite members to the Recommendations watchlist",
	});
}
```

- [ ] **Step 3: Update watchlist list ordering**

In the `list` procedure's orderBy (around line 87), update the CASE to include recommendations:

```typescript
sql`CASE ${wl.type} WHEN 'default' THEN 1 WHEN 'recommendations' THEN 2 WHEN 'custom' THEN 3 WHEN 'shuffle' THEN 4 ELSE 99 END`,
```

Do the same in `getForDropdown` (around line 179):

```typescript
sql`CASE ${wl.type} WHEN 'default' THEN 1 WHEN 'recommendations' THEN 2 WHEN 'custom' THEN 3 WHEN 'shuffle' THEN 4 ELSE 99 END`,
```

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts
git commit -m "feat: protect recommendations watchlist from deletion and member invites"
```

---

### Task 10: Review Feedback Loop

**Files:**
- Modify: `src/integrations/trpc/routers/watchlist.ts:369-430` (markWatched procedure)

- [ ] **Step 1: Add recommendation notification on markWatched**

In the `markWatched` procedure, after the existing notification loop for `item_watched` (around line 428), add a check for whether this item was recommended. Add this code after the existing `if (input.watched) { ... }` block but still inside the overall mutation:

```typescript
// If this item was recommended, notify the recommender
if (input.watched) {
	const item = await db.query.watchlistItem.findFirst({
		where: and(
			eq(watchlistItem.watchlistId, input.watchlistId),
			eq(watchlistItem.tmdbId, input.tmdbId),
			eq(watchlistItem.mediaType, input.mediaType),
		),
		columns: { recommendedBy: true },
	});

	if (item?.recommendedBy) {
		// Check if the watchlist is a recommendations watchlist
		const wl = await db.query.watchlist.findFirst({
			where: eq(watchlist.id, input.watchlistId),
			columns: { type: true },
		});

		if (wl?.type === "recommendations") {
			await createNotification({
				recipientId: item.recommendedBy,
				actorId: ctx.userId,
				type: "recommendation_reviewed",
				data: {
					titleName: input.titleName ?? "",
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
				},
			});
		}
	}
}
```

Note: This reuses the `input.watched` check that already exists. The best approach is to integrate this into the existing `if (input.watched)` block. Restructure the block so that after notifying members about `item_watched`, it also checks for recommendation attribution. The full updated `if (input.watched)` block should look like:

```typescript
if (input.watched) {
	const wl = await db.query.watchlist.findFirst({
		where: eq(watchlist.id, input.watchlistId),
		columns: { name: true, type: true },
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

	// If recommended item was watched, notify the recommender
	if (wl?.type === "recommendations") {
		const item = await db.query.watchlistItem.findFirst({
			where: and(
				eq(watchlistItem.watchlistId, input.watchlistId),
				eq(watchlistItem.tmdbId, input.tmdbId),
				eq(watchlistItem.mediaType, input.mediaType),
			),
			columns: { recommendedBy: true },
		});

		if (item?.recommendedBy) {
			await createNotification({
				recipientId: item.recommendedBy,
				actorId: ctx.userId,
				type: "recommendation_reviewed",
				data: {
					titleName: input.titleName ?? "",
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
				},
			});
		}
	}
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts
git commit -m "feat: notify recommender when friend watches recommended title"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Full build check**

Run:
```bash
bun run build
```

Expected: Clean build, no errors.

- [ ] **Step 2: Lint check**

Run:
```bash
bun run lint
```

Expected: No lint errors in modified/new files.

- [ ] **Step 3: Verify DB migration applies cleanly**

Run:
```bash
bunx drizzle-kit push
```

Expected: Migration applies without errors.

- [ ] **Step 4: Manual smoke test checklist**

Verify in browser:
1. Title page shows "Recommend" button (amber)
2. Clicking it opens the recommendation modal
3. Searching shows friends only
4. Can select multiple friends, add message, and send
5. Recipient sees notification with accept/decline
6. Accepting creates Recommendations watchlist with the item
7. Item shows "Recommended by @username" attribution
8. Recommendations watchlist cannot be deleted
9. Sort by recommender groups items correctly
10. Marking item as watched in recommendations watchlist sends notification to recommender
