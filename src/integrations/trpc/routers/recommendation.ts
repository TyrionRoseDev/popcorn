import type { TRPCRouterRecord } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { recommendation } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { evaluateAchievements } from "#/lib/evaluate-achievements";
import { createNotification } from "./notification";

export const recommendationRouter = {
	send: protectedProcedure
		.input(z.object({
			tmdbId: z.number(),
			mediaType: z.enum(["movie", "tv"]),
			friendIds: z.array(z.string()).min(1),
			titleName: z.string().optional(),
		}))
		.mutation(async ({ input, ctx }) => {
			await db.insert(recommendation).values(
				input.friendIds.map((friendId) => ({
					senderId: ctx.userId,
					recipientId: friendId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
				})),
			);

			for (const friendId of input.friendIds) {
				await createNotification({
					recipientId: friendId,
					actorId: ctx.userId,
					type: "recommendation",
					data: {
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
						titleName: input.titleName ?? "",
					},
				});
			}

			const newAchievements = await evaluateAchievements(ctx.userId, "recommendation_sent");
			return { newAchievements };
		}),

	received: protectedProcedure.query(async ({ ctx }) => {
		return db.query.recommendation.findMany({
			where: eq(recommendation.recipientId, ctx.userId),
			orderBy: desc(recommendation.createdAt),
		});
	}),
} satisfies TRPCRouterRecord;
