import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { review } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { evaluateAchievements } from "#/lib/evaluate-achievements";

export const reviewRouter = {
	upsert: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				rating: z.number().min(1).max(5),
				text: z.string().optional(),
				titleName: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const [result] = await db
				.insert(review)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					rating: input.rating,
					text: input.text ?? null,
				})
				.onConflictDoUpdate({
					target: [review.userId, review.tmdbId, review.mediaType],
					set: { rating: input.rating, text: input.text ?? null },
				})
				.returning({ id: review.id });

			const newAchievements = await evaluateAchievements(ctx.userId, "review", {
				tmdbId: input.tmdbId,
				mediaType: input.mediaType,
			});
			return { id: result.id, newAchievements };
		}),

	get: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				userId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const targetUserId = input.userId ?? ctx.userId;
			return db.query.review.findFirst({
				where: and(
					eq(review.userId, targetUserId),
					eq(review.tmdbId, input.tmdbId),
					eq(review.mediaType, input.mediaType),
				),
			});
		}),

	userReviews: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.query(async ({ input }) => {
			return db.query.review.findMany({
				where: eq(review.userId, input.userId),
				orderBy: desc(review.createdAt),
			});
		}),
} satisfies TRPCRouterRecord;
