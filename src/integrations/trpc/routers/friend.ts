import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "#/db";
import { friendship, user } from "#/db/schema";
import { createTRPCRouter, protectedProcedure } from "#/integrations/trpc/init";

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
					friendId: sql`CASE WHEN ${friendship.requesterId} = ${ctx.userId} THEN ${friendship.addresseeId} ELSE ${friendship.requesterId} END`.as("friend_id"),
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
					friendId: sql`CASE WHEN ${friendship.requesterId} = ${input.userId} THEN ${friendship.addresseeId} ELSE ${friendship.requesterId} END`.as("friend_id"),
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
});
