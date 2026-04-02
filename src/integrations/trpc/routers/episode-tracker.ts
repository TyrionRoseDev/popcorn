import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { episodeWatch } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { fetchAllSeasons, fetchSeasonDetails } from "#/lib/tmdb-title";

export const episodeTrackerRouter = {
	/** Mark individual episodes as watched */
	markEpisodes: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				episodes: z.array(
					z.object({
						seasonNumber: z.number(),
						episodeNumber: z.number(),
						runtime: z.number(),
					}),
				),
				watchEventId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const values = input.episodes.map((ep) => ({
				userId: ctx.userId,
				tmdbId: input.tmdbId,
				seasonNumber: ep.seasonNumber,
				episodeNumber: ep.episodeNumber,
				runtime: ep.runtime,
				watchEventId: input.watchEventId ?? null,
			}));
			await db.insert(episodeWatch).values(values).onConflictDoNothing();
			return { marked: input.episodes.length };
		}),

	/** Unmark a single episode */
	unmarkEpisode: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				seasonNumber: z.number(),
				episodeNumber: z.number(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const deleted = await db
				.delete(episodeWatch)
				.where(
					and(
						eq(episodeWatch.userId, ctx.userId),
						eq(episodeWatch.tmdbId, input.tmdbId),
						eq(episodeWatch.seasonNumber, input.seasonNumber),
						eq(episodeWatch.episodeNumber, input.episodeNumber),
					),
				)
				.returning();
			if (deleted.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Episode not found",
				});
			}
			return { runtime: deleted[0].runtime };
		}),

	/** Get all watched episodes for a specific show */
	getForShow: protectedProcedure
		.input(z.object({ tmdbId: z.number() }))
		.query(async ({ input, ctx }) => {
			const episodes = await db.query.episodeWatch.findMany({
				where: and(
					eq(episodeWatch.userId, ctx.userId),
					eq(episodeWatch.tmdbId, input.tmdbId),
				),
				orderBy: [episodeWatch.seasonNumber, episodeWatch.episodeNumber],
			});
			return episodes;
		}),

	/** Get all tracked shows for the dashboard */
	getTrackedShows: protectedProcedure.query(async ({ ctx }) => {
		const shows = await db
			.select({
				tmdbId: episodeWatch.tmdbId,
				episodeCount: sql<number>`count(*)::int`,
				totalRuntime: sql<number>`coalesce(sum(${episodeWatch.runtime}), 0)::int`,
				lastWatchedAt: sql<string>`max(${episodeWatch.watchedAt})`,
			})
			.from(episodeWatch)
			.where(eq(episodeWatch.userId, ctx.userId))
			.groupBy(episodeWatch.tmdbId)
			.orderBy(sql`max(${episodeWatch.watchedAt}) desc`);
		return shows;
	}),

	/** Get TV watch time for a user (used in profile) */
	getTvWatchTime: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.query(async ({ input }) => {
			const [result] = await db
				.select({
					total: sql<number>`coalesce(sum(${episodeWatch.runtime}), 0)::int`,
				})
				.from(episodeWatch)
				.where(eq(episodeWatch.userId, input.userId));
			return { minutes: result?.total ?? 0 };
		}),

	/** Check if user has any episodes tracked for a show */
	hasTracked: protectedProcedure
		.input(z.object({ tmdbId: z.number() }))
		.query(async ({ input, ctx }) => {
			const first = await db.query.episodeWatch.findFirst({
				where: and(
					eq(episodeWatch.userId, ctx.userId),
					eq(episodeWatch.tmdbId, input.tmdbId),
				),
			});
			return { tracked: !!first };
		}),

	/** Fetch season episodes from TMDB */
	getSeasonEpisodes: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				seasonNumber: z.number(),
			}),
		)
		.query(async ({ input }) => {
			return fetchSeasonDetails(input.tmdbId, input.seasonNumber);
		}),

	/** Fetch all season episodes from TMDB */
	getAllSeasonEpisodes: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				seasonList: z.array(z.object({ seasonNumber: z.number() })),
			}),
		)
		.query(async ({ input }) => {
			return fetchAllSeasons(input.tmdbId, input.seasonList);
		}),
} satisfies TRPCRouterRecord;
