# Friends List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mutual friendship system with request/accept/decline flow, blocking, profile pages (friend vs non-friend views), a friends management page, onboarding additions, and watchlist fork on unfriend/block.

**Architecture:** Two new tables (`friendship`, `block`) plus user column additions. A new `friend` tRPC router handles all friend/block operations. Profile pages render different views based on friendship status. The friends page uses a cinema lobby / ticket-stub UI. Existing routers are modified to enforce friendship gates.

**Tech Stack:** Drizzle ORM (PostgreSQL), tRPC, React Query, TanStack Router, Motion (animations), Lucide icons, Tailwind CSS, Zod

**Spec:** `docs/superpowers/specs/2026-03-29-friends-list-design.md`

---

## Task 1: Add friendship and block tables to database schema

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add friendship table, block table, and user column additions**

Add after the `notification` table definition and before the relations section:

```typescript
export const friendship = pgTable(
	"friendship",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		requesterId: text("requester_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		addresseeId: text("addressee_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status", { enum: ["pending", "accepted"] })
			.notNull()
			.default("pending"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("friendship_requester_addressee_idx").on(
			table.requesterId,
			table.addresseeId,
		),
		index("friendship_addressee_id_idx").on(table.addresseeId),
	],
);

export const block = pgTable(
	"block",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		blockerId: text("blocker_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		blockedId: text("blocked_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("block_blocker_blocked_idx").on(
			table.blockerId,
			table.blockedId,
		),
	],
);
```

Add relations after the existing `notificationRelations`:

```typescript
export const friendshipRelations = relations(friendship, ({ one }) => ({
	requester: one(user, {
		fields: [friendship.requesterId],
		references: [user.id],
		relationName: "friendshipRequester",
	}),
	addressee: one(user, {
		fields: [friendship.addresseeId],
		references: [user.id],
		relationName: "friendshipAddressee",
	}),
}));

export const blockRelations = relations(block, ({ one }) => ({
	blocker: one(user, {
		fields: [block.blockerId],
		references: [user.id],
		relationName: "blockBlocker",
	}),
	blocked: one(user, {
		fields: [block.blockedId],
		references: [user.id],
		relationName: "blockBlocked",
	}),
}));
```

Add new columns to the existing `user` table definition:

```typescript
bio: text("bio"),
favouriteFilmTmdbId: integer("favourite_film_tmdb_id"),
favouriteGenreId: integer("favourite_genre_id"),
```

Add friendship and block relations to the existing `userRelations`:

```typescript
friendshipsRequested: many(friendship, { relationName: "friendshipRequester" }),
friendshipsReceived: many(friendship, { relationName: "friendshipAddressee" }),
blocksCreated: many(block, { relationName: "blockBlocker" }),
blocksReceived: many(block, { relationName: "blockBlocked" }),
```

- [ ] **Step 2: Generate and run the database migration**

Run: `bunx drizzle-kit generate`
Then: `bunx drizzle-kit migrate`

Expected: Migration creates `friendship` table, `block` table, and adds 3 columns to `user`.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add friendship, block tables and user profile columns"
```

---

## Task 2: Create friend router — core queries

**Files:**
- Create: `src/integrations/trpc/routers/friend.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Write tests for friend list and pending requests queries**

Create: `src/integrations/trpc/__tests__/friend.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db before imports
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();

vi.mock("#/db", () => ({
	db: {
		select: mockSelect,
		insert: mockInsert,
		delete: mockDelete,
		update: mockUpdate,
		query: {
			friendship: { findFirst: vi.fn(), findMany: vi.fn() },
			block: { findFirst: vi.fn() },
			watchlistMember: { findMany: vi.fn() },
		},
		transaction: vi.fn(),
	},
}));

vi.mock("#/integrations/trpc/routers/notification", () => ({
	createNotification: vi.fn(),
}));

import { createTRPCRouter } from "#/integrations/trpc/init";
import { friendRouter } from "#/integrations/trpc/routers/friend";

const router = createTRPCRouter({ friend: friendRouter });

function createCaller(userId: string | null = "user-1") {
	return router.createCaller({ userId });
}

describe("friend router", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("list", () => {
		it("requires authentication", async () => {
			const caller = createCaller(null);
			await expect(caller.friend.list()).rejects.toThrow("UNAUTHORIZED");
		});
	});

	describe("pendingRequests", () => {
		it("requires authentication", async () => {
			const caller = createCaller(null);
			await expect(caller.friend.pendingRequests()).rejects.toThrow(
				"UNAUTHORIZED",
			);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/integrations/trpc/__tests__/friend.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the friend router with list and pendingRequests queries**

Create `src/integrations/trpc/routers/friend.ts`:

```typescript
import { and, eq, ne, or, sql, inArray, notInArray } from "drizzle-orm";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { db } from "#/db";
import { friendship, block, user, watchlist, watchlistMember, watchlistItem } from "#/db/schema";
import { createTRPCRouter, protectedProcedure } from "#/integrations/trpc/init";
import { createNotification } from "#/integrations/trpc/routers/notification";

export const friendRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		const friends = await db
			.select({
				id: user.id,
				username: user.username,
				avatarUrl: user.avatarUrl,
				favouriteFilmTmdbId: user.favouriteFilmTmdbId,
				favouriteGenreId: user.favouriteGenreId,
				bio: user.bio,
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
				),
			);

		return friends;
	}),

	pendingRequests: protectedProcedure.query(async ({ ctx }) => {
		const requests = await db
			.select({
				friendshipId: friendship.id,
				requesterId: friendship.requesterId,
				username: user.username,
				avatarUrl: user.avatarUrl,
				createdAt: friendship.createdAt,
			})
			.from(friendship)
			.innerJoin(user, eq(user.id, friendship.requesterId))
			.where(
				and(
					eq(friendship.addresseeId, ctx.userId),
					eq(friendship.status, "pending"),
				),
			)
			.orderBy(friendship.createdAt);

		return requests;
	}),

	mutualFriends: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.query(async ({ input, ctx }) => {
			// Get current user's friends
			const myFriends = db
				.select({ friendId: sql`CASE WHEN ${friendship.requesterId} = ${ctx.userId} THEN ${friendship.addresseeId} ELSE ${friendship.requesterId} END`.as("friend_id") })
				.from(friendship)
				.where(
					and(
						eq(friendship.status, "accepted"),
						or(
							eq(friendship.requesterId, ctx.userId),
							eq(friendship.addresseeId, ctx.userId),
						),
					),
				)
				.as("my_friends");

			// Get target user's friends
			const theirFriends = db
				.select({ friendId: sql`CASE WHEN ${friendship.requesterId} = ${input.userId} THEN ${friendship.addresseeId} ELSE ${friendship.requesterId} END`.as("friend_id") })
				.from(friendship)
				.where(
					and(
						eq(friendship.status, "accepted"),
						or(
							eq(friendship.requesterId, input.userId),
							eq(friendship.addresseeId, input.userId),
						),
					),
				)
				.as("their_friends");

			// Intersect
			const mutual = await db
				.select({
					id: user.id,
					username: user.username,
					avatarUrl: user.avatarUrl,
				})
				.from(user)
				.innerJoin(myFriends, eq(user.id, myFriends.friendId))
				.innerJoin(theirFriends, eq(user.id, theirFriends.friendId));

			return mutual;
		}),
});
```

- [ ] **Step 4: Register the friend router in the main router**

In `src/integrations/trpc/router.ts`, add:

```typescript
import { friendRouter } from "./routers/friend";
```

And add to the router object:

```typescript
friend: friendRouter,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run src/integrations/trpc/__tests__/friend.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/routers/friend.ts src/integrations/trpc/router.ts src/integrations/trpc/__tests__/friend.test.ts
git commit -m "feat: add friend router with list, pendingRequests, mutualFriends queries"
```

---

## Task 3: Friend router — mutations (send, accept, decline, cancel)

**Files:**
- Modify: `src/integrations/trpc/routers/friend.ts`
- Modify: `src/integrations/trpc/__tests__/friend.test.ts`

- [ ] **Step 1: Add tests for sendRequest and acceptRequest**

Add to the test file:

```typescript
describe("sendRequest", () => {
	it("requires authentication", async () => {
		const caller = createCaller(null);
		await expect(
			caller.friend.sendRequest({ userId: "user-2" }),
		).rejects.toThrow("UNAUTHORIZED");
	});
});

describe("acceptRequest", () => {
	it("requires authentication", async () => {
		const caller = createCaller(null);
		await expect(
			caller.friend.acceptRequest({ friendshipId: "f-1" }),
		).rejects.toThrow("UNAUTHORIZED");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/integrations/trpc/__tests__/friend.test.ts`
Expected: FAIL — procedures not found

- [ ] **Step 3: Add sendRequest, acceptRequest, declineRequest, cancelRequest mutations**

Add to `friendRouter` in `src/integrations/trpc/routers/friend.ts`:

```typescript
sendRequest: protectedProcedure
	.input(z.object({ userId: z.string() }))
	.mutation(async ({ input, ctx }) => {
		if (input.userId === ctx.userId) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot send request to yourself" });
		}

		// Check if blocked
		const blocked = await db.query.block.findFirst({
			where: or(
				and(eq(block.blockerId, ctx.userId), eq(block.blockedId, input.userId)),
				and(eq(block.blockerId, input.userId), eq(block.blockedId, ctx.userId)),
			),
		});
		if (blocked) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Cannot send request" });
		}

		// Check if friendship already exists
		const existing = await db.query.friendship.findFirst({
			where: or(
				and(eq(friendship.requesterId, ctx.userId), eq(friendship.addresseeId, input.userId)),
				and(eq(friendship.requesterId, input.userId), eq(friendship.addresseeId, ctx.userId)),
			),
		});
		if (existing) {
			throw new TRPCError({ code: "CONFLICT", message: "Request already exists" });
		}

		const [request] = await db
			.insert(friendship)
			.values({
				requesterId: ctx.userId,
				addresseeId: input.userId,
			})
			.returning();

		await createNotification({
			recipientId: input.userId,
			actorId: ctx.userId,
			type: "friend_request",
			data: {},
		});

		return request;
	}),

acceptRequest: protectedProcedure
	.input(z.object({ friendshipId: z.string() }))
	.mutation(async ({ input, ctx }) => {
		const request = await db.query.friendship.findFirst({
			where: and(
				eq(friendship.id, input.friendshipId),
				eq(friendship.addresseeId, ctx.userId),
				eq(friendship.status, "pending"),
			),
		});

		if (!request) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
		}

		const [updated] = await db
			.update(friendship)
			.set({ status: "accepted" })
			.where(eq(friendship.id, input.friendshipId))
			.returning();

		await createNotification({
			recipientId: request.requesterId,
			actorId: ctx.userId,
			type: "friend_request_accepted",
			data: {},
		});

		return updated;
	}),

declineRequest: protectedProcedure
	.input(z.object({ friendshipId: z.string() }))
	.mutation(async ({ input, ctx }) => {
		const request = await db.query.friendship.findFirst({
			where: and(
				eq(friendship.id, input.friendshipId),
				eq(friendship.addresseeId, ctx.userId),
				eq(friendship.status, "pending"),
			),
		});

		if (!request) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
		}

		await db.delete(friendship).where(eq(friendship.id, input.friendshipId));
		return { success: true };
	}),

cancelRequest: protectedProcedure
	.input(z.object({ friendshipId: z.string() }))
	.mutation(async ({ input, ctx }) => {
		const request = await db.query.friendship.findFirst({
			where: and(
				eq(friendship.id, input.friendshipId),
				eq(friendship.requesterId, ctx.userId),
				eq(friendship.status, "pending"),
			),
		});

		if (!request) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
		}

		await db.delete(friendship).where(eq(friendship.id, input.friendshipId));
		return { success: true };
	}),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/integrations/trpc/__tests__/friend.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/integrations/trpc/routers/friend.ts src/integrations/trpc/__tests__/friend.test.ts
git commit -m "feat: add friend request mutations (send, accept, decline, cancel)"
```

---

## Task 4: Friend router — removeFriend with watchlist fork

**Files:**
- Modify: `src/integrations/trpc/routers/friend.ts`

- [ ] **Step 1: Add forkSharedWatchlists helper and removeFriend mutation**

Add helper function above the router definition:

```typescript
async function forkSharedWatchlists(userId: string, removedUserId: string) {
	// Find watchlists where both users are members
	const sharedMemberships = await db
		.select({ watchlistId: watchlistMember.watchlistId })
		.from(watchlistMember)
		.where(eq(watchlistMember.userId, removedUserId))
		.innerJoin(
			watchlist,
			eq(watchlist.id, watchlistMember.watchlistId),
		);

	for (const { watchlistId } of sharedMemberships) {
		// Check if the other user is also a member
		const otherMembership = await db.query.watchlistMember.findFirst({
			where: and(
				eq(watchlistMember.watchlistId, watchlistId),
				eq(watchlistMember.userId, userId),
			),
		});

		if (!otherMembership) continue;

		// Get the original watchlist
		const original = await db.query.watchlist.findFirst({
			where: eq(watchlist.id, watchlistId),
		});

		if (!original) continue;

		await db.transaction(async (tx) => {
			// Create a copy for the removed user
			const [copy] = await tx
				.insert(watchlist)
				.values({
					name: original.name,
					ownerId: removedUserId,
					isPublic: false,
					type: original.type === "default" ? "custom" : original.type,
				})
				.returning();

			// Add removed user as owner of the copy
			await tx.insert(watchlistMember).values({
				watchlistId: copy.id,
				userId: removedUserId,
				role: "owner",
			});

			// Copy all items
			const items = await tx
				.select()
				.from(watchlistItem)
				.where(eq(watchlistItem.watchlistId, watchlistId));

			if (items.length > 0) {
				await tx.insert(watchlistItem).values(
					items.map((item) => ({
						watchlistId: copy.id,
						tmdbId: item.tmdbId,
						mediaType: item.mediaType,
						addedBy: item.addedBy,
						watched: item.watched,
					})),
				);
			}

			// Remove the user from the original watchlist
			await tx
				.delete(watchlistMember)
				.where(
					and(
						eq(watchlistMember.watchlistId, watchlistId),
						eq(watchlistMember.userId, removedUserId),
					),
				);
		});
	}
}
```

Add removeFriend mutation to the router:

```typescript
removeFriend: protectedProcedure
	.input(z.object({ userId: z.string() }))
	.mutation(async ({ input, ctx }) => {
		const existing = await db.query.friendship.findFirst({
			where: and(
				eq(friendship.status, "accepted"),
				or(
					and(eq(friendship.requesterId, ctx.userId), eq(friendship.addresseeId, input.userId)),
					and(eq(friendship.requesterId, input.userId), eq(friendship.addresseeId, ctx.userId)),
				),
			),
		});

		if (!existing) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Friendship not found" });
		}

		await forkSharedWatchlists(ctx.userId, input.userId);

		await db.delete(friendship).where(eq(friendship.id, existing.id));

		return { success: true };
	}),
```

- [ ] **Step 2: Run tests**

Run: `bunx vitest run src/integrations/trpc/__tests__/friend.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/friend.ts
git commit -m "feat: add removeFriend with watchlist fork logic"
```

---

## Task 5: Friend router — block and unblock

**Files:**
- Modify: `src/integrations/trpc/routers/friend.ts`

- [ ] **Step 1: Add block and unblock mutations**

```typescript
block: protectedProcedure
	.input(z.object({ userId: z.string() }))
	.mutation(async ({ input, ctx }) => {
		if (input.userId === ctx.userId) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot block yourself" });
		}

		// Fork watchlists before removing friendship
		await forkSharedWatchlists(ctx.userId, input.userId);

		// Remove any existing friendship
		await db
			.delete(friendship)
			.where(
				or(
					and(eq(friendship.requesterId, ctx.userId), eq(friendship.addresseeId, input.userId)),
					and(eq(friendship.requesterId, input.userId), eq(friendship.addresseeId, ctx.userId)),
				),
			);

		// Create block (ignore conflict if already blocked)
		await db
			.insert(block)
			.values({
				blockerId: ctx.userId,
				blockedId: input.userId,
			})
			.onConflictDoNothing();

		return { success: true };
	}),

unblock: protectedProcedure
	.input(z.object({ userId: z.string() }))
	.mutation(async ({ input, ctx }) => {
		await db
			.delete(block)
			.where(
				and(
					eq(block.blockerId, ctx.userId),
					eq(block.blockedId, input.userId),
				),
			);

		return { success: true };
	}),

getBlockedUsers: protectedProcedure.query(async ({ ctx }) => {
	const blocked = await db
		.select({
			id: user.id,
			username: user.username,
			avatarUrl: user.avatarUrl,
			blockedAt: block.createdAt,
		})
		.from(block)
		.innerJoin(user, eq(user.id, block.blockedId))
		.where(eq(block.blockerId, ctx.userId))
		.orderBy(block.createdAt);

	return blocked;
}),
```

- [ ] **Step 2: Run tests**

Run: `bunx vitest run src/integrations/trpc/__tests__/friend.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/friend.ts
git commit -m "feat: add block, unblock, and getBlockedUsers procedures"
```

---

## Task 6: Friend router — profile query

**Files:**
- Modify: `src/integrations/trpc/routers/friend.ts`

- [ ] **Step 1: Add profile query that returns full or slim data based on friendship**

```typescript
profile: protectedProcedure
	.input(z.object({ userId: z.string() }))
	.query(async ({ input, ctx }) => {
		const [targetUser] = await db
			.select({
				id: user.id,
				username: user.username,
				avatarUrl: user.avatarUrl,
				bio: user.bio,
				favouriteFilmTmdbId: user.favouriteFilmTmdbId,
				favouriteGenreId: user.favouriteGenreId,
			})
			.from(user)
			.where(eq(user.id, input.userId));

		if (!targetUser) {
			throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
		}

		// Get friend count
		const [friendCount] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(friendship)
			.where(
				and(
					eq(friendship.status, "accepted"),
					or(
						eq(friendship.requesterId, input.userId),
						eq(friendship.addresseeId, input.userId),
					),
				),
			);

		// Check relationship status
		const existingFriendship = await db.query.friendship.findFirst({
			where: or(
				and(eq(friendship.requesterId, ctx.userId), eq(friendship.addresseeId, input.userId)),
				and(eq(friendship.requesterId, input.userId), eq(friendship.addresseeId, ctx.userId)),
			),
		});

		const existingBlock = await db.query.block.findFirst({
			where: or(
				and(eq(block.blockerId, ctx.userId), eq(block.blockedId, input.userId)),
				and(eq(block.blockerId, input.userId), eq(block.blockedId, ctx.userId)),
			),
		});

		let relationshipStatus: "none" | "friends" | "request_sent" | "request_received" | "blocked" = "none";
		let friendshipId: string | null = null;

		if (existingBlock) {
			relationshipStatus = "blocked";
		} else if (existingFriendship) {
			friendshipId = existingFriendship.id;
			if (existingFriendship.status === "accepted") {
				relationshipStatus = "friends";
			} else if (existingFriendship.requesterId === ctx.userId) {
				relationshipStatus = "request_sent";
			} else {
				relationshipStatus = "request_received";
			}
		}

		const isFriend = relationshipStatus === "friends";

		// Base profile (always returned)
		const profile = {
			...targetUser,
			friendCount: friendCount?.count ?? 0,
			relationshipStatus,
			friendshipId,
			isFriend,
			publicWatchlists: [] as Array<{ id: string; name: string; itemCount: number; memberCount: number }>,
		};

		// Friends get public watchlists
		if (isFriend) {
			const watchlists = await db
				.select({
					id: watchlist.id,
					name: watchlist.name,
				})
				.from(watchlist)
				.where(
					and(
						eq(watchlist.ownerId, input.userId),
						eq(watchlist.isPublic, true),
					),
				);

			profile.publicWatchlists = await Promise.all(
				watchlists.map(async (wl) => {
					const [itemCount] = await db
						.select({ count: sql<number>`count(*)::int` })
						.from(watchlistItem)
						.where(eq(watchlistItem.watchlistId, wl.id));

					const [memberCount] = await db
						.select({ count: sql<number>`count(*)::int` })
						.from(watchlistMember)
						.where(eq(watchlistMember.watchlistId, wl.id));

					return {
						...wl,
						itemCount: itemCount?.count ?? 0,
						memberCount: memberCount?.count ?? 0,
					};
				}),
			);
		}

		return profile;
	}),
```

- [ ] **Step 2: Run tests**

Run: `bunx vitest run src/integrations/trpc/__tests__/friend.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/friend.ts
git commit -m "feat: add profile query with friend/non-friend views"
```

---

## Task 7: Update notification system for friend_request_accepted

**Files:**
- Modify: `src/integrations/trpc/routers/notification.ts`
- Modify: `src/components/notifications/notification-item.tsx`

- [ ] **Step 1: Add friend_request_accepted to NOTIFICATION_TYPES**

In `src/integrations/trpc/routers/notification.ts`, update the array:

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
] as const;
```

- [ ] **Step 2: Update notification-item.tsx to handle friend_request_accepted and link friend_request to profile**

In `src/components/notifications/notification-item.tsx`, update the `getNotificationMessage` switch:

```typescript
case "friend_request":
	return {
		text: "sent you a friend request",
		link: "/app/friends",
	};
case "friend_request_accepted":
	return {
		text: "accepted your friend request",
	};
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/notification.ts src/components/notifications/notification-item.tsx
git commit -m "feat: add friend_request_accepted notification type and link friend_request to friends page"
```

---

## Task 8: Modify existing routers for friendship gates

**Files:**
- Modify: `src/integrations/trpc/routers/watchlist.ts`

- [ ] **Step 1: Update searchUsers to exclude blocked users**

In `src/integrations/trpc/routers/watchlist.ts`, modify the `searchUsers` query to add a `notInArray` filter for blocked user IDs:

```typescript
searchUsers: protectedProcedure
	.input(z.object({ query: z.string().min(2) }))
	.query(async ({ input, ctx }) => {
		// Get blocked user IDs (both directions)
		const blockedIds = await db
			.select({ id: block.blockedId })
			.from(block)
			.where(eq(block.blockerId, ctx.userId));

		const blockerIds = await db
			.select({ id: block.blockerId })
			.from(block)
			.where(eq(block.blockedId, ctx.userId));

		const excludeIds = [
			ctx.userId,
			...blockedIds.map((b) => b.id),
			...blockerIds.map((b) => b.id),
		];

		return db
			.select({
				id: user.id,
				username: user.username,
				avatarUrl: user.avatarUrl,
			})
			.from(user)
			.where(
				and(
					ilike(user.username, `%${input.query}%`),
					notInArray(user.id, excludeIds),
				),
			)
			.limit(10);
	}),
```

Add imports at top of file:

```typescript
import { block } from "#/db/schema";
import { notInArray } from "drizzle-orm";
```

- [ ] **Step 2: Update addMember to check friendship**

In the `addMember` mutation, add a friendship check before inserting:

```typescript
// Check friendship (after the existing assertMember check)
const areFriends = await db.query.friendship.findFirst({
	where: and(
		eq(friendship.status, "accepted"),
		or(
			and(eq(friendship.requesterId, ctx.userId), eq(friendship.addresseeId, input.userId)),
			and(eq(friendship.requesterId, input.userId), eq(friendship.addresseeId, ctx.userId)),
		),
	),
});

if (!areFriends) {
	throw new TRPCError({ code: "FORBIDDEN", message: "You can only invite friends to watchlists" });
}
```

Add `friendship` to the imports from `#/db/schema`.

- [ ] **Step 3: Run existing watchlist tests**

Run: `bunx vitest run src/integrations/trpc/__tests__/watchlist.test.ts`
Expected: Tests may need mock updates for the new block/friendship queries. Fix any failures.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts
git commit -m "feat: add friendship and block gates to watchlist router"
```

---

## Task 9: Onboarding — add favourite film, genre, and bio steps

**Files:**
- Create: `src/components/onboarding/favourite-film-step.tsx`
- Create: `src/components/onboarding/favourite-genre-step.tsx`
- Create: `src/components/onboarding/bio-step.tsx`
- Modify: `src/routes/onboarding/index.tsx`
- Modify: `src/integrations/trpc/routers/taste-profile.ts`

- [ ] **Step 1: Add saveProfileExtras procedure to taste-profile router**

In `src/integrations/trpc/routers/taste-profile.ts`, add a new mutation:

```typescript
saveProfileExtras: protectedProcedure
	.input(
		z.object({
			favouriteFilmTmdbId: z.number().nullable(),
			favouriteGenreId: z.number().nullable(),
			bio: z.string().max(100).nullable(),
		}),
	)
	.mutation(async ({ input, ctx }) => {
		await db
			.update(user)
			.set({
				favouriteFilmTmdbId: input.favouriteFilmTmdbId,
				favouriteGenreId: input.favouriteGenreId,
				bio: input.bio,
			})
			.where(eq(user.id, ctx.userId));

		return { success: true };
	}),
```

- [ ] **Step 2: Create FavouriteFilmStep component**

Create `src/components/onboarding/favourite-film-step.tsx`. Pattern follows existing `TasteProfileStep`:
- Search input with debounce
- TMDB search results via `trpc.tasteProfile.search` or `trpc.search.query`
- Single select with checkmark
- Skip and Continue buttons
- On continue: store selection in local state, call `onNext()`

The selected film TMDB ID will be saved in the final step (bio step calls `saveProfileExtras`).

- [ ] **Step 3: Create FavouriteGenreStep component**

Create `src/components/onboarding/favourite-genre-step.tsx`:
- Fetch genres via `trpc.tasteProfile.getGenres`
- 3-column grid of genre chips
- Single select (highlight with pink)
- Skip and Continue buttons

- [ ] **Step 4: Create BioStep component**

Create `src/components/onboarding/bio-step.tsx`:
- Textarea, max 100 chars, character count
- Skip and Finish buttons
- On finish: calls `saveProfileExtras` mutation with all collected data, then calls `onNext()`

- [ ] **Step 5: Update onboarding index to add new steps**

In `src/routes/onboarding/index.tsx`, update the `STEPS` array:

```typescript
const STEPS: StepConfig[] = [
	{ label: "Username", component: UsernameStep },
	{ label: "Avatar", component: AvatarStep },
	{ label: "Taste", component: TasteProfileStep },
	{ label: "Film", component: FavouriteFilmStep },
	{ label: "Genre", component: FavouriteGenreStep },
	{ label: "Bio", component: BioStep },
];
```

Note: The existing `saveTasteProfile` mutation marks `onboardingCompleted: true`. Move that flag to the new `saveProfileExtras` mutation instead, so onboarding completes after the final step.

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding/ src/routes/onboarding/index.tsx src/integrations/trpc/routers/taste-profile.ts
git commit -m "feat: add favourite film, genre, and bio onboarding steps"
```

---

## Task 10: Friends page — route and My Friends tab

**Files:**
- Create: `src/routes/app/friends.tsx`

- [ ] **Step 1: Create the friends page route**

Create `src/routes/app/friends.tsx` with the F.R.I.E.N.D.S cinema lobby UI:
- `createFileRoute("/app/friends")` with component
- Two tabs: My Friends | Requests (with badge count)
- My Friends tab: search bar, 2-column grid of ticket-stub cards
- Each card shows avatar, username, favourite film, minutes watched
- Cards link to `/app/profile/$userId`
- Use `trpc.friend.list` query
- Use `trpc.friend.pendingRequests` for the badge count
- F.R.I.E.N.D.S title with amber/pink neon styling
- Marquee light bulbs, starry background (existing app atmosphere)
- Tab switching with Motion for height transitions

- [ ] **Step 2: Add Friends link to navigation**

In `src/routes/app/route.tsx`, add a Friends nav item (with Lucide `Users` icon) to the navigation alongside Search, Shuffle, Watchlists.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/friends.tsx src/routes/app/route.tsx
git commit -m "feat: add friends page with My Friends tab and ticket-stub cards"
```

---

## Task 11: Friends page — Requests tab

**Files:**
- Modify: `src/routes/app/friends.tsx`

- [ ] **Step 1: Add Requests tab content**

In the friends page, implement the Requests tab:
- List of incoming friend requests as ticket-stub cards
- Each shows avatar, username, mutual friends count
- Accept (cyan) / Decline (muted) buttons below the tear line
- Uses `trpc.friend.pendingRequests` query
- Uses `trpc.friend.mutualFriends` for mutual count per request
- Accept calls `trpc.friend.acceptRequest`, Decline calls `trpc.friend.declineRequest`
- Invalidate `friend.list`, `friend.pendingRequests`, and `notification.getUnreadCount` on success
- Empty state: "No pending requests"

- [ ] **Step 2: Commit**

```bash
git add src/routes/app/friends.tsx
git commit -m "feat: add Requests tab with accept/decline functionality"
```

---

## Task 12: Profile page

**Files:**
- Create: `src/routes/app/profile.$userId.tsx`

- [ ] **Step 1: Create the profile page route**

Create `src/routes/app/profile.$userId.tsx`:
- `createFileRoute("/app/profile/$userId")` with `userId` param
- Uses `trpc.friend.profile` query with the userId
- Uses `trpc.friend.mutualFriends` query
- Renders non-friend or friend view based on `profile.isFriend`

**Non-friend view** (drive-in card):
1. Marquee lights, avatar with neon ring, username
2. Contextual action button based on `profile.relationshipStatus`:
   - `none` → Add Friend button (calls `trpc.friend.sendRequest`)
   - `request_sent` → "Request Sent" with Cancel option (calls `trpc.friend.cancelRequest`)
   - `request_received` → Accept/Decline buttons
   - `blocked` → hidden/disabled
3. Stats row: friends count, minutes watched (placeholder "—"), favourite genre
4. Bio marquee (if set)
5. Favourite film poster (portrait, fetch from TMDB via `trpc.title.details`)
6. Achievements placeholder ("Coming soon")
7. Blurred activity teaser with lock overlay
8. Gated message

**Friend view** (same card, expanded):
1. Marquee lights, avatar, username
2. Remove/Block inline buttons
3. Stats row (same)
4. Bio (same)
5. Favourite film (same)
6. Achievements placeholder ("Coming soon")
7. Top genres chart (derived from watchlist items — placeholder if no data)
8. Watch activity heatmap (placeholder)
9. Color-coded tabs with Motion height transition:
   - Watchlists (cyan) — from `profile.publicWatchlists`
   - Reviews (amber) — "Coming soon"
   - Activity (pink) — placeholder
   - Each has "See all" button

- [ ] **Step 2: Commit**

```bash
git add src/routes/app/profile.\$userId.tsx
git commit -m "feat: add profile page with friend/non-friend views"
```

---

## Task 13: Blocked users page

**Files:**
- Create: `src/routes/app/settings/blocked.tsx`
- Modify: `src/integrations/better-auth/header-user.tsx`

- [ ] **Step 1: Create blocked users page**

Create `src/routes/app/settings/blocked.tsx`:
- Pattern follows `src/routes/app/shuffle/hidden.tsx`
- Back link to settings
- "Blocked Users" title + subtitle
- Uses `trpc.friend.getBlockedUsers` query
- List of blocked users with muted avatar, username, "Blocked X ago"
- Unblock button per user (calls `trpc.friend.unblock`, invalidates `friend.getBlockedUsers`)
- Empty state: "No blocked users"

- [ ] **Step 2: Add Blocked Users to header dropdown**

In `src/integrations/better-auth/header-user.tsx`, add a menu item before Settings:

```tsx
<DropdownMenuItem asChild>
	<Link
		to="/app/settings/blocked"
		className="text-cream/60 no-underline focus:bg-cream/5 focus:text-cream/80"
	>
		<Ban className="mr-2 h-4 w-4" />
		Blocked Users
	</Link>
</DropdownMenuItem>
```

Import `Ban` from `lucide-react`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/settings/blocked.tsx src/integrations/better-auth/header-user.tsx
git commit -m "feat: add blocked users page and header dropdown link"
```

---

## Task 14: Update create-watchlist dialog and invite modal

**Files:**
- Modify: `src/components/watchlist/create-watchlist-dialog.tsx`
- Modify: `src/components/watchlist/invite-member-modal.tsx`

- [ ] **Step 1: Replace knownUsers with friend.list in create-watchlist-dialog**

In `src/components/watchlist/create-watchlist-dialog.tsx`:
- Replace `trpc.watchlist.knownUsers` with `trpc.friend.list`
- Rename section label from "People you know" to "Friends"
- Keep the same deduplication logic for search results

- [ ] **Step 2: Update invite-member-modal to use friend search**

In `src/components/watchlist/invite-member-modal.tsx`:
- The search still uses `trpc.watchlist.searchUsers` (which now excludes blocked users)
- No major changes needed here since the friendship gate is on `addMember` server-side

- [ ] **Step 3: Commit**

```bash
git add src/components/watchlist/create-watchlist-dialog.tsx src/components/watchlist/invite-member-modal.tsx
git commit -m "feat: replace knownUsers with friend.list in watchlist dialogs"
```

---

## Task 15: Final cleanup and integration test

**Files:**
- Modify: `src/integrations/trpc/routers/watchlist.ts` (remove knownUsers procedure)

- [ ] **Step 1: Remove the deprecated knownUsers procedure**

Delete the `knownUsers` procedure from `src/integrations/trpc/routers/watchlist.ts` since it's been replaced by `friend.list`.

- [ ] **Step 2: Run all tests**

Run: `bunx vitest run`
Expected: All tests pass. Fix any failures from the removed procedure.

- [ ] **Step 3: Run type check**

Run: `bunx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Run lint**

Run: `bunx biome check src/`
Expected: Clean or minor formatting issues only.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: remove deprecated knownUsers, final cleanup"
```
