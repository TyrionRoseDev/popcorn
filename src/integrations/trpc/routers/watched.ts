import { TRPCError } from "@trpc/server";
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
				watchedAt: z
					.string()
					.datetime()
					.refine((d) => new Date(d) <= new Date(), {
						message: "Watch date cannot be in the future",
					})
					.optional(),
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
					watchedAt: input.watchedAt ? new Date(input.watchedAt) : null,
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
				watchedAt: z
					.string()
					.datetime()
					.refine((d) => new Date(d) <= new Date(), {
						message: "Watch date cannot be in the future",
					})
					.optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// Fetch existing event to check prior review state
			const existing = await db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.id, input.watchEventId),
					eq(watchEvent.userId, ctx.userId),
				),
			});

			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const hadReview = existing.rating != null || !!existing.reviewText;

			await db
				.update(watchEvent)
				.set({
					rating: input.rating,
					reviewText: input.reviewText,
					reviewReminderAt: null,
					...(input.watchedAt && { watchedAt: new Date(input.watchedAt) }),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(watchEvent.id, input.watchEventId),
						eq(watchEvent.userId, ctx.userId),
					),
				);

			// Notify recommenders only on first review (not edits)
			const hasReview = input.rating != null || !!input.reviewText;
			if (!hadReview && hasReview && existing.visibility === "public") {
				const recs = await db.query.recommendation.findMany({
					where: and(
						eq(recommendation.recipientId, ctx.userId),
						eq(recommendation.tmdbId, existing.tmdbId),
						eq(recommendation.mediaType, existing.mediaType),
						eq(recommendation.status, "accepted"),
					),
				});

				for (const rec of recs) {
					await createNotification({
						recipientId: rec.senderId,
						actorId: ctx.userId,
						type: "recommendation_watched",
						data: {
							titleName: existing.titleName,
							tmdbId: existing.tmdbId,
							mediaType: existing.mediaType,
						},
					});
				}
			}
		}),

	setReminder: protectedProcedure
		.input(z.object({ watchEventId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const reminderDate = new Date();
			reminderDate.setDate(reminderDate.getDate() + 7);

			const result = await db
				.update(watchEvent)
				.set({ reviewReminderAt: reminderDate, updatedAt: new Date() })
				.where(
					and(
						eq(watchEvent.id, input.watchEventId),
						eq(watchEvent.userId, ctx.userId),
					),
				);

			if (result.rowCount === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
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
				orderBy: [
					desc(sql`COALESCE(${watchEvent.watchedAt}, ${watchEvent.createdAt})`),
				],
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

	delete: protectedProcedure
		.input(z.object({ watchEventId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const result = await db
				.delete(watchEvent)
				.where(
					and(
						eq(watchEvent.id, input.watchEventId),
						eq(watchEvent.userId, ctx.userId),
					),
				);

			if (result.rowCount === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
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
