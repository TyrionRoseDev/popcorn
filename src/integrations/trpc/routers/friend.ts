import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	block,
	episodeWatch,
	friendship,
	user,
	watchEvent,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { createTRPCRouter, protectedProcedure } from "#/integrations/trpc/init";
import { createNotification } from "#/integrations/trpc/routers/notification";
import { ACHIEVEMENTS_BY_ID } from "#/lib/achievements";
import { evaluateAchievements } from "#/lib/evaluate-achievements";
import { getUnifiedGenreById, getUnifiedIdByTmdbId } from "#/lib/genre-map";

async function forkSharedWatchlists(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	userId: string,
	removedUserId: string,
) {
	// Find watchlists where both users are members
	const sharedMemberships = await tx
		.select({ watchlistId: watchlistMember.watchlistId })
		.from(watchlistMember)
		.where(eq(watchlistMember.userId, removedUserId))
		.innerJoin(watchlist, eq(watchlist.id, watchlistMember.watchlistId));

	for (const { watchlistId } of sharedMemberships) {
		// Check if the other user is also a member
		const [otherMembership] = await tx
			.select({ id: watchlistMember.id })
			.from(watchlistMember)
			.where(
				and(
					eq(watchlistMember.watchlistId, watchlistId),
					eq(watchlistMember.userId, userId),
				),
			)
			.limit(1);

		if (!otherMembership) continue;

		// Get the original watchlist
		const [original] = await tx
			.select()
			.from(watchlist)
			.where(eq(watchlist.id, watchlistId))
			.limit(1);

		if (!original) continue;

		if (original.ownerId === removedUserId) {
			// Removed user owns this watchlist — reassign ownership to another member
			const [newOwner] = await tx
				.select({ id: watchlistMember.id, userId: watchlistMember.userId })
				.from(watchlistMember)
				.where(
					and(
						eq(watchlistMember.watchlistId, watchlistId),
						sql`${watchlistMember.userId} <> ${removedUserId}`,
					),
				)
				.limit(1);

			if (newOwner) {
				await tx
					.update(watchlist)
					.set({ ownerId: newOwner.userId })
					.where(eq(watchlist.id, watchlistId));
				await tx
					.update(watchlistMember)
					.set({ role: "owner" })
					.where(eq(watchlistMember.id, newOwner.id));
			}

			// Remove the departing user from membership
			await tx
				.delete(watchlistMember)
				.where(
					and(
						eq(watchlistMember.watchlistId, watchlistId),
						eq(watchlistMember.userId, removedUserId),
					),
				);
		} else {
			// Removed user is a regular member — fork a copy for them
			const [copy] = await tx
				.insert(watchlist)
				.values({
					name: original.name,
					ownerId: removedUserId,
					isPublic: false,
					type: original.type === "default" ? "custom" : original.type,
				})
				.returning();

			await tx.insert(watchlistMember).values({
				watchlistId: copy.id,
				userId: removedUserId,
				role: "owner",
			});

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

			await tx
				.delete(watchlistMember)
				.where(
					and(
						eq(watchlistMember.watchlistId, watchlistId),
						eq(watchlistMember.userId, removedUserId),
					),
				);
		}
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
				favouriteFilmMediaType: user.favouriteFilmMediaType,
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

		if (friends.length === 0) return [];

		const friendIds = friends.map((f) => f.id);

		// Batch watch stats
		const watchStats = await db
			.select({
				userId: watchEvent.userId,
				watchCount: sql<number>`count(*)::int`,
				avgRating: sql<
					number | null
				>`round(avg(${watchEvent.rating})::numeric, 1)::float`,
			})
			.from(watchEvent)
			.where(inArray(watchEvent.userId, friendIds))
			.groupBy(watchEvent.userId);

		// Batch list counts (owned + member)
		const ownedCounts = await db
			.select({
				userId: watchlist.ownerId,
				count: sql<number>`count(*)::int`,
			})
			.from(watchlist)
			.where(
				and(
					inArray(watchlist.ownerId, friendIds),
					eq(watchlist.isPublic, true),
				),
			)
			.groupBy(watchlist.ownerId);

		const memberCounts = await db
			.select({
				userId: watchlistMember.userId,
				count: sql<number>`count(*)::int`,
			})
			.from(watchlistMember)
			.innerJoin(watchlist, eq(watchlist.id, watchlistMember.watchlistId))
			.where(
				and(
					inArray(watchlistMember.userId, friendIds),
					eq(watchlist.isPublic, true),
					sql`${watchlistMember.userId} <> ${watchlist.ownerId}`,
				),
			)
			.groupBy(watchlistMember.userId);

		const watchMap = new Map(watchStats.map((s) => [s.userId, s]));
		const ownedMap = new Map(ownedCounts.map((s) => [s.userId, s.count]));
		const memberMap = new Map(memberCounts.map((s) => [s.userId, s.count]));

		return friends.map((f) => ({
			...f,
			watchCount: watchMap.get(f.id)?.watchCount ?? 0,
			avgRating: watchMap.get(f.id)?.avgRating ?? null,
			listCount: (ownedMap.get(f.id) ?? 0) + (memberMap.get(f.id) ?? 0),
		}));
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

			let request: typeof friendship.$inferSelect;
			try {
				const [inserted] = await db
					.insert(friendship)
					.values({
						requesterId: ctx.userId,
						addresseeId: input.userId,
					})
					.returning();
				request = inserted;
			} catch (err: unknown) {
				const pgCode =
					err && typeof err === "object" && "code" in err
						? (err as { code: string }).code
						: undefined;
				if (pgCode === "23505") {
					throw new TRPCError({
						code: "CONFLICT",
						message: "Request already exists",
					});
				}
				throw err;
			}

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
			const [updated] = await db
				.update(friendship)
				.set({ status: "accepted" })
				.where(
					and(
						eq(friendship.id, input.friendshipId),
						eq(friendship.addresseeId, ctx.userId),
						eq(friendship.status, "pending"),
					),
				)
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Request not found",
				});
			}

			await createNotification({
				recipientId: updated.requesterId,
				actorId: ctx.userId,
				type: "friend_request_accepted",
				data: {},
			});

			// Evaluate friend-related achievements for both users
			const [requesterAchievements, addresseeAchievements] = await Promise.all([
				evaluateAchievements(updated.requesterId, "friend"),
				evaluateAchievements(ctx.userId, "friend"),
			]);

			// Notify friends about new achievements
			const notifyFriendsAboutAchievements = async (
				earnerId: string,
				achievementIds: string[],
			) => {
				if (achievementIds.length === 0) return;
				const friends = await db.query.friendship.findMany({
					where: and(
						sql`(${friendship.requesterId} = ${earnerId} OR ${friendship.addresseeId} = ${earnerId})`,
						eq(friendship.status, "accepted"),
					),
				});
				for (const f of friends) {
					const friendId =
						f.requesterId === earnerId ? f.addresseeId : f.requesterId;
					for (const achievementId of achievementIds) {
						const achievementDef = ACHIEVEMENTS_BY_ID.get(achievementId);
						await createNotification({
							recipientId: friendId,
							actorId: earnerId,
							type: "achievement_earned",
							data: {
								achievementId,
								achievementName: achievementDef?.name ?? "",
							},
						});
					}
				}
			};

			await notifyFriendsAboutAchievements(
				updated.requesterId,
				requesterAchievements,
			);
			await notifyFriendsAboutAchievements(ctx.userId, addresseeAchievements);

			return updated;
		}),

	declineRequest: protectedProcedure
		.input(z.object({ friendshipId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const deleted = await db
				.delete(friendship)
				.where(
					and(
						eq(friendship.id, input.friendshipId),
						eq(friendship.addresseeId, ctx.userId),
						eq(friendship.status, "pending"),
					),
				)
				.returning({ id: friendship.id });

			if (deleted.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Request not found",
				});
			}

			return { success: true };
		}),

	cancelRequest: protectedProcedure
		.input(z.object({ friendshipId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const deleted = await db
				.delete(friendship)
				.where(
					and(
						eq(friendship.id, input.friendshipId),
						eq(friendship.requesterId, ctx.userId),
						eq(friendship.status, "pending"),
					),
				)
				.returning({ id: friendship.id });

			if (deleted.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Request not found",
				});
			}

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

			await db.transaction(async (tx) => {
				await forkSharedWatchlists(tx, ctx.userId, input.userId);
				await tx.delete(friendship).where(eq(friendship.id, existing.id));
			});

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

			await db.transaction(async (tx) => {
				await forkSharedWatchlists(tx, ctx.userId, input.userId);

				await tx
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

				await tx
					.insert(block)
					.values({
						blockerId: ctx.userId,
						blockedId: input.userId,
					})
					.onConflictDoNothing();
			});

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
					favouriteFilmMediaType: user.favouriteFilmMediaType,
					favouriteGenreId: user.favouriteGenreId,
					createdAt: user.createdAt,
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

			const isSelf = ctx.userId === input.userId;
			const isFriend = relationshipStatus === "friends";

			// Compute total watch time (sum of runtime for watched items across user's watchlists)
			const userMemberships = await db
				.select({ watchlistId: watchlistMember.watchlistId })
				.from(watchlistMember)
				.where(eq(watchlistMember.userId, input.userId));
			const wlIds = userMemberships.map((m) => m.watchlistId);
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

			// Total titles watched (distinct watch events)
			const [watchedCount] = await db
				.select({
					count: sql<number>`count(distinct (${watchEvent.tmdbId}, ${watchEvent.mediaType}))::int`,
				})
				.from(watchEvent)
				.where(eq(watchEvent.userId, input.userId));

			// Rating distribution (1-5 stars)
			const ratingRows = await db
				.select({
					rating: watchEvent.rating,
					count: sql<number>`count(*)::int`,
				})
				.from(watchEvent)
				.where(
					and(
						eq(watchEvent.userId, input.userId),
						sql`${watchEvent.rating} IS NOT NULL`,
						...(isSelf ? [] : [eq(watchEvent.visibility, "public")]),
					),
				)
				.groupBy(watchEvent.rating);

			const ratingDistribution = [1, 2, 3, 4, 5].map((star) => ({
				star,
				count: ratingRows.find((r) => r.rating === star)?.count ?? 0,
			}));

			// Base profile (always returned)
			const profile = {
				...targetUser,
				friendCount: friendCount?.count ?? 0,
				watchTimeMinutes,
				totalWatched: watchedCount?.count ?? 0,
				ratingDistribution,
				relationshipStatus,
				friendshipId,
				isFriend,
				isSelf,
				publicWatchlists: [] as Array<{
					id: string;
					name: string;
					itemCount: number;
					memberCount: number;
				}>,
			};

			// Friends and self get public watchlists
			if (isFriend || isSelf) {
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

	genreStats: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.query(async ({ input, ctx }) => {
			// Only self or friends can see genre stats
			if (ctx.userId !== input.userId) {
				const existingFriendship = await db.query.friendship.findFirst({
					where: and(
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
						eq(friendship.status, "accepted"),
					),
				});
				if (!existingFriendship) return [];
			}

			const events = await db
				.select({ genreIds: watchEvent.genreIds })
				.from(watchEvent)
				.where(
					and(
						eq(watchEvent.userId, input.userId),
						sql`${watchEvent.genreIds} IS NOT NULL`,
					),
				);

			// Count occurrences of each TMDB genre ID
			const counts = new Map<number, number>();
			for (const event of events) {
				if (!event.genreIds) continue;
				for (const id of event.genreIds as number[]) {
					counts.set(id, (counts.get(id) ?? 0) + 1);
				}
			}

			// Convert to unified genre IDs and merge
			const unifiedCounts = new Map<number, { name: string; count: number }>();
			for (const [tmdbId, count] of counts) {
				const unifiedId = getUnifiedIdByTmdbId(tmdbId);
				if (unifiedId === null) continue;
				const genre = getUnifiedGenreById(unifiedId);
				if (!genre) continue;
				const existing = unifiedCounts.get(unifiedId);
				if (existing) {
					existing.count += count;
				} else {
					unifiedCounts.set(unifiedId, { name: genre.name, count });
				}
			}

			// Sort by count descending, return top 5
			return Array.from(unifiedCounts.values())
				.sort((a, b) => b.count - a.count)
				.slice(0, 5);
		}),

	watchActivity: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.query(async ({ input, ctx }) => {
			// Only self or friends can see watch activity
			if (ctx.userId !== input.userId) {
				const existingFriendship = await db.query.friendship.findFirst({
					where: and(
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
						eq(friendship.status, "accepted"),
					),
				});
				if (!existingFriendship) return [];
			}

			const result = await db
				.select({
					date: sql<string>`to_char(COALESCE(${watchEvent.watchedAt}, ${watchEvent.createdAt}), 'YYYY-MM-DD')`,
					count: sql<number>`count(*)::int`,
					titles: sql<string[]>`array_agg(${watchEvent.titleName})`,
				})
				.from(watchEvent)
				.where(eq(watchEvent.userId, input.userId))
				.groupBy(
					sql`to_char(COALESCE(${watchEvent.watchedAt}, ${watchEvent.createdAt}), 'YYYY-MM-DD')`,
				)
				.orderBy(
					sql`to_char(COALESCE(${watchEvent.watchedAt}, ${watchEvent.createdAt}), 'YYYY-MM-DD')`,
				);

			return result;
		}),

	ratingsByStars: protectedProcedure
		.input(
			z.object({ userId: z.string(), star: z.number().int().min(1).max(5) }),
		)
		.query(async ({ input, ctx }) => {
			// Only self or friends can see ratings
			if (ctx.userId !== input.userId) {
				const existingFriendship = await db.query.friendship.findFirst({
					where: and(
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
						eq(friendship.status, "accepted"),
					),
				});
				if (!existingFriendship) return [];
			}

			const rows = await db
				.select({
					tmdbId: watchEvent.tmdbId,
					mediaType: watchEvent.mediaType,
					titleName: watchEvent.titleName,
					reviewText: watchEvent.reviewText,
				})
				.from(watchEvent)
				.where(
					and(
						eq(watchEvent.userId, input.userId),
						eq(watchEvent.rating, input.star),
						eq(watchEvent.visibility, "public"),
					),
				)
				.orderBy(
					sql`COALESCE(${watchEvent.watchedAt}, ${watchEvent.createdAt}) desc`,
				);

			// Deduplicate by tmdbId+mediaType (keep first / most recent)
			const seen = new Set<string>();
			const deduped: typeof rows = [];
			for (const row of rows) {
				const key = `${row.tmdbId}-${row.mediaType}`;
				if (!seen.has(key)) {
					seen.add(key);
					deduped.push(row);
				}
			}

			return deduped;
		}),
});
