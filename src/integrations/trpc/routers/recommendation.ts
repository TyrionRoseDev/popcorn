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
					titleName: input.titleName,
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
			const escaped = input.query.replace(/%/g, "\\%").replace(/_/g, "\\_");
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
						ilike(user.username, `%${escaped}%`),
					),
				)
				.limit(10);

			return friends;
		}),
} satisfies TRPCRouterRecord;
