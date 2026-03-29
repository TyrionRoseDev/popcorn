import { TRPCError } from "@trpc/server";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "#/db";
import { block, friendship, user } from "#/db/schema";
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
});
