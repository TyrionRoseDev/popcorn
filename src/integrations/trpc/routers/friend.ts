import { TRPCError } from "@trpc/server";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	block,
	friendship,
	user,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { createTRPCRouter, protectedProcedure } from "#/integrations/trpc/init";
import { createNotification } from "#/integrations/trpc/routers/notification";

async function forkSharedWatchlists(userId: string, removedUserId: string) {
	// Find watchlists where both users are members
	const sharedMemberships = await db
		.select({ watchlistId: watchlistMember.watchlistId })
		.from(watchlistMember)
		.where(eq(watchlistMember.userId, removedUserId))
		.innerJoin(watchlist, eq(watchlist.id, watchlistMember.watchlistId));

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
			const myFriends = db
				.select({
					friendId:
						sql`CASE WHEN ${friendship.requesterId} = ${ctx.userId} THEN ${friendship.addresseeId} ELSE ${friendship.requesterId} END`.as(
							"friend_id",
						),
				})
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

			const theirFriends = db
				.select({
					friendId:
						sql`CASE WHEN ${friendship.requesterId} = ${input.userId} THEN ${friendship.addresseeId} ELSE ${friendship.requesterId} END`.as(
							"friend_id",
						),
				})
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

	sendRequest: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			if (input.userId === ctx.userId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot send request to yourself",
				});
			}

			// Check if blocked
			const blocked = await db.query.block.findFirst({
				where: or(
					and(
						eq(block.blockerId, ctx.userId),
						eq(block.blockedId, input.userId),
					),
					and(
						eq(block.blockerId, input.userId),
						eq(block.blockedId, ctx.userId),
					),
				),
			});
			if (blocked) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Cannot send request",
				});
			}

			// Check if friendship already exists
			const existing = await db.query.friendship.findFirst({
				where: or(
					and(
						eq(friendship.requesterId, ctx.userId),
						eq(friendship.addresseeId, input.userId),
					),
					and(
						eq(friendship.requesterId, input.userId),
						eq(friendship.addresseeId, ctx.userId),
					),
				),
			});
			if (existing) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Request already exists",
				});
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
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Request not found",
				});
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
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Request not found",
				});
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
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Request not found",
				});
			}

			await db.delete(friendship).where(eq(friendship.id, input.friendshipId));
			return { success: true };
		}),

	removeFriend: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.friendship.findFirst({
				where: and(
					eq(friendship.status, "accepted"),
					or(
						and(
							eq(friendship.requesterId, ctx.userId),
							eq(friendship.addresseeId, input.userId),
						),
						and(
							eq(friendship.requesterId, input.userId),
							eq(friendship.addresseeId, ctx.userId),
						),
					),
				),
			});

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Friendship not found",
				});
			}

			await forkSharedWatchlists(ctx.userId, input.userId);

			await db.delete(friendship).where(eq(friendship.id, existing.id));

			return { success: true };
		}),

	block: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			if (input.userId === ctx.userId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot block yourself",
				});
			}

			// Fork watchlists before removing friendship
			await forkSharedWatchlists(ctx.userId, input.userId);

			// Remove any existing friendship
			await db
				.delete(friendship)
				.where(
					or(
						and(
							eq(friendship.requesterId, ctx.userId),
							eq(friendship.addresseeId, input.userId),
						),
						and(
							eq(friendship.requesterId, input.userId),
							eq(friendship.addresseeId, ctx.userId),
						),
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
					and(
						eq(friendship.requesterId, ctx.userId),
						eq(friendship.addresseeId, input.userId),
					),
					and(
						eq(friendship.requesterId, input.userId),
						eq(friendship.addresseeId, ctx.userId),
					),
				),
			});

			const existingBlock = await db.query.block.findFirst({
				where: or(
					and(
						eq(block.blockerId, ctx.userId),
						eq(block.blockedId, input.userId),
					),
					and(
						eq(block.blockerId, input.userId),
						eq(block.blockedId, ctx.userId),
					),
				),
			});

			let relationshipStatus:
				| "none"
				| "friends"
				| "request_sent"
				| "request_received"
				| "blocked" = "none";
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
				publicWatchlists: [] as Array<{
					id: string;
					name: string;
					itemCount: number;
					memberCount: number;
				}>,
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
});
