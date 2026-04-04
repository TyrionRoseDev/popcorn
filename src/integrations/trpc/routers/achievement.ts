import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { earnedAchievement } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_ID } from "#/lib/achievements";
import { syncAchievements } from "#/lib/evaluate-achievements";

export const achievementRouter = {
	myAchievements: protectedProcedure.query(async ({ ctx }) => {
		const earned = await db.query.earnedAchievement.findMany({
			where: eq(earnedAchievement.userId, ctx.userId),
		});
		return {
			earned: earned.map((e) => ({
				...ACHIEVEMENTS_BY_ID.get(e.achievementId),
				earnedAt: e.earnedAt,
			})),
			total: ACHIEVEMENTS.length,
		};
	}),

	userAchievements: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.query(async ({ input }) => {
			const earned = await db.query.earnedAchievement.findMany({
				where: eq(earnedAchievement.userId, input.userId),
			});
			return {
				earned: earned.map((e) => ({
					...ACHIEVEMENTS_BY_ID.get(e.achievementId),
					earnedAt: e.earnedAt,
				})),
				total: ACHIEVEMENTS.length,
			};
		}),

	sync: protectedProcedure.mutation(async ({ ctx }) => {
		const newAchievements = await syncAchievements(ctx.userId);
		return { newAchievements };
	}),

	compare: protectedProcedure
		.input(z.object({ friendId: z.string() }))
		.query(async ({ ctx, input }) => {
			const [myEarned, theirEarned] = await Promise.all([
				db.query.earnedAchievement.findMany({
					where: eq(earnedAchievement.userId, ctx.userId),
				}),
				db.query.earnedAchievement.findMany({
					where: eq(earnedAchievement.userId, input.friendId),
				}),
			]);
			const myIds = new Map(myEarned.map((e) => [e.achievementId, e.earnedAt]));
			const theirIds = new Map(
				theirEarned.map((e) => [e.achievementId, e.earnedAt]),
			);
			return {
				achievements: ACHIEVEMENTS.map((a) => ({
					...a,
					myEarnedAt: myIds.get(a.id) ?? null,
					theirEarnedAt: theirIds.get(a.id) ?? null,
				})),
				myTotal: myEarned.length,
				theirTotal: theirEarned.length,
				sharedCount: ACHIEVEMENTS.filter(
					(a) => myIds.has(a.id) && theirIds.has(a.id),
				).length,
			};
		}),
} satisfies TRPCRouterRecord;
