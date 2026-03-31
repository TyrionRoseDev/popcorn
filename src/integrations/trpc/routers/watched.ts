import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { recommendation, watchEvent } from "#/db/schema";
import { createTRPCRouter, protectedProcedure } from "../init";
import { createNotification } from "./notification";

export const watchedRouter = createTRPCRouter({
	create: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				titleName: z.string(),
				watchedAt: z.string().datetime().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const [event] = await db
				.insert(watchEvent)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					titleName: input.titleName,
					watchedAt: input.watchedAt ? new Date(input.watchedAt) : new Date(),
				})
				.returning({ id: watchEvent.id });

			return event;
		}),

	updateReview: protectedProcedure
		.input(
			z.object({
				watchEventId: z.string(),
				rating: z.number().min(1).max(5).nullable(),
				reviewText: z.string().nullable(),
				watchedAt: z.string().datetime().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await db
				.update(watchEvent)
				.set({
					rating: input.rating,
					reviewText: input.reviewText,
					...(input.watchedAt && { watchedAt: new Date(input.watchedAt) }),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(watchEvent.id, input.watchEventId),
						eq(watchEvent.userId, ctx.userId),
					),
				);

			// Notify recommenders if this is a public review
			if (input.rating || input.reviewText) {
				const event = await db.query.watchEvent.findFirst({
					where: and(
						eq(watchEvent.id, input.watchEventId),
						eq(watchEvent.userId, ctx.userId),
					),
				});

				if (event?.reviewPublic) {
					const recs = await db.query.recommendation.findMany({
						where: and(
							eq(recommendation.recipientId, ctx.userId),
							eq(recommendation.tmdbId, event.tmdbId),
							eq(recommendation.mediaType, event.mediaType),
							eq(recommendation.status, "accepted"),
						),
					});

					for (const rec of recs) {
						await createNotification({
							recipientId: rec.senderId,
							actorId: ctx.userId,
							type: "recommendation_watched",
							data: {
								titleName: event.titleName,
								tmdbId: event.tmdbId,
								mediaType: event.mediaType,
							},
						});
					}
				}
			}
		}),

	setReminder: protectedProcedure
		.input(z.object({ watchEventId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const reminderDate = new Date();
			reminderDate.setDate(reminderDate.getDate() + 7);

			await db
				.update(watchEvent)
				.set({ reviewReminderAt: reminderDate, updatedAt: new Date() })
				.where(
					and(
						eq(watchEvent.id, input.watchEventId),
						eq(watchEvent.userId, ctx.userId),
					),
				);
		}),

	getForTitle: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.query(async ({ input, ctx }) => {
			return db.query.watchEvent.findMany({
				where: and(
					eq(watchEvent.userId, ctx.userId),
					eq(watchEvent.tmdbId, input.tmdbId),
					eq(watchEvent.mediaType, input.mediaType),
				),
				orderBy: [desc(watchEvent.watchedAt)],
			});
		}),

	getCount: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.query(async ({ input, ctx }) => {
			const result = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(watchEvent)
				.where(
					and(
						eq(watchEvent.userId, ctx.userId),
						eq(watchEvent.tmdbId, input.tmdbId),
						eq(watchEvent.mediaType, input.mediaType),
					),
				);
			return result[0]?.count ?? 0;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input, ctx }) => {
			return db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.id, input.id),
					eq(watchEvent.userId, ctx.userId),
				),
			});
		}),
});
