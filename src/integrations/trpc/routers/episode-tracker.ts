import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { episodeWatch, journalEntry, userTitle, watchEvent } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { evaluateAchievements } from "#/lib/evaluate-achievements";
import {
	fetchAllSeasons,
	fetchSeasonDetails,
	fetchTitleDetails,
} from "#/lib/tmdb-title";

export const episodeTrackerRouter = {
	/** Add a show to the tracker (creates a userTitle record) */
	addShow: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				seasonEpisodeCounts: z.record(z.string(), z.number()).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const inserted = await db
				.insert(userTitle)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					mediaType: "tv",
					...(input.seasonEpisodeCounts && {
						seasonEpisodeCounts: input.seasonEpisodeCounts,
					}),
				})
				.onConflictDoNothing()
				.returning({ id: userTitle.id });

			const newAchievements =
				inserted.length > 0
					? await evaluateAchievements(ctx.userId, "show_tracked")
					: [];
			return { success: true, newAchievements };
		}),

	/** Increment currentWatchNumber to start a new rewatch */
	startRewatch: protectedProcedure
		.input(z.object({ tmdbId: z.number() }))
		.mutation(async ({ input, ctx }) => {
			const [updated] = await db
				.update(userTitle)
				.set({
					currentWatchNumber: sql`${userTitle.currentWatchNumber} + 1`,
				})
				.where(
					and(
						eq(userTitle.userId, ctx.userId),
						eq(userTitle.tmdbId, input.tmdbId),
						eq(userTitle.mediaType, "tv"),
					),
				)
				.returning({ currentWatchNumber: userTitle.currentWatchNumber });
			if (!updated) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Show not found in tracker",
				});
			}
			const newAchievements = await evaluateAchievements(
				ctx.userId,
				"rewatch_started",
			);
			return {
				currentWatchNumber: updated.currentWatchNumber,
				newAchievements,
			};
		}),

	/** Get the current watch number for a show */
	getWatchNumber: protectedProcedure
		.input(z.object({ tmdbId: z.number() }))
		.query(async ({ input, ctx }) => {
			const title = await db.query.userTitle.findFirst({
				where: and(
					eq(userTitle.userId, ctx.userId),
					eq(userTitle.tmdbId, input.tmdbId),
					eq(userTitle.mediaType, "tv"),
				),
				columns: { currentWatchNumber: true },
			});
			return { currentWatchNumber: title?.currentWatchNumber ?? 1 };
		}),

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
			const title = await db.query.userTitle.findFirst({
				where: and(
					eq(userTitle.userId, ctx.userId),
					eq(userTitle.tmdbId, input.tmdbId),
					eq(userTitle.mediaType, "tv"),
				),
				columns: { currentWatchNumber: true },
			});
			const watchNum = title?.currentWatchNumber ?? 1;

			// Validate watchEventId ownership if provided
			if (input.watchEventId) {
				const event = await db.query.watchEvent.findFirst({
					where: and(
						eq(watchEvent.id, input.watchEventId),
						eq(watchEvent.userId, ctx.userId),
						eq(watchEvent.tmdbId, input.tmdbId),
					),
				});
				if (!event) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Invalid watch event",
					});
				}
			}

			const values = input.episodes.map((ep) => ({
				userId: ctx.userId,
				tmdbId: input.tmdbId,
				seasonNumber: ep.seasonNumber,
				episodeNumber: ep.episodeNumber,
				runtime: ep.runtime,
				watchEventId: input.watchEventId ?? null,
				watchNumber: watchNum,
			}));
			await db.insert(episodeWatch).values(values).onConflictDoNothing();

			const newAchievements = await evaluateAchievements(
				ctx.userId,
				"episode_marked",
				{
					tmdbId: input.tmdbId,
					mediaType: "tv",
					watchedAt: new Date(),
				},
			);

			return { marked: input.episodes.length, newAchievements };
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
			const title = await db.query.userTitle.findFirst({
				where: and(
					eq(userTitle.userId, ctx.userId),
					eq(userTitle.tmdbId, input.tmdbId),
					eq(userTitle.mediaType, "tv"),
				),
				columns: { currentWatchNumber: true },
			});
			const watchNum = title?.currentWatchNumber ?? 1;

			const deleted = await db
				.delete(episodeWatch)
				.where(
					and(
						eq(episodeWatch.userId, ctx.userId),
						eq(episodeWatch.tmdbId, input.tmdbId),
						eq(episodeWatch.seasonNumber, input.seasonNumber),
						eq(episodeWatch.episodeNumber, input.episodeNumber),
						eq(episodeWatch.watchNumber, watchNum),
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
		.input(
			z.object({
				tmdbId: z.number(),
				watchNumber: z.number().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			let targetWatchNumber = input.watchNumber;
			if (targetWatchNumber == null) {
				const title = await db.query.userTitle.findFirst({
					where: and(
						eq(userTitle.userId, ctx.userId),
						eq(userTitle.tmdbId, input.tmdbId),
						eq(userTitle.mediaType, "tv"),
					),
					columns: { currentWatchNumber: true },
				});
				targetWatchNumber = title?.currentWatchNumber ?? 1;
			}
			return db.query.episodeWatch.findMany({
				where: and(
					eq(episodeWatch.userId, ctx.userId),
					eq(episodeWatch.tmdbId, input.tmdbId),
					eq(episodeWatch.watchNumber, targetWatchNumber),
				),
				orderBy: [episodeWatch.seasonNumber, episodeWatch.episodeNumber],
			});
		}),

	/** Get all tracked shows for the dashboard */
	getTrackedShows: protectedProcedure.query(async ({ ctx }) => {
		// Fetch user titles with currentWatchNumber
		const trackedShows = await db
			.select({
				tmdbId: userTitle.tmdbId,
				currentWatchNumber: userTitle.currentWatchNumber,
				createdAt: sql<string>`${userTitle.createdAt}`,
			})
			.from(userTitle)
			.where(
				and(eq(userTitle.userId, ctx.userId), eq(userTitle.mediaType, "tv")),
			);
		const watchNumMap = new Map(
			trackedShows.map((t) => [t.tmdbId, t.currentWatchNumber]),
		);

		// Episode watches grouped by tmdbId + watchNumber
		const episodeRows = await db
			.select({
				tmdbId: episodeWatch.tmdbId,
				watchNumber: episodeWatch.watchNumber,
				episodeCount: sql<number>`count(*)::int`,
				totalRuntime: sql<number>`coalesce(sum(${episodeWatch.runtime}), 0)::int`,
				lastWatchedAt: sql<string>`max(${episodeWatch.watchedAt})`,
			})
			.from(episodeWatch)
			.where(eq(episodeWatch.userId, ctx.userId))
			.groupBy(episodeWatch.tmdbId, episodeWatch.watchNumber);

		// Keep only rows matching the current watch-through
		const episodeShows = episodeRows
			.filter((r) => r.watchNumber === (watchNumMap.get(r.tmdbId) ?? 1))
			.map(({ watchNumber: _, ...rest }) => rest);

		// Shows with only journal entries (no episode watches), scoped to current watch-through
		const journalOnlyShows = await db
			.select({
				tmdbId: journalEntry.tmdbId,
				lastCreatedAt: sql<string>`max(${journalEntry.createdAt})`,
			})
			.from(journalEntry)
			.innerJoin(
				userTitle,
				and(
					eq(journalEntry.tmdbId, userTitle.tmdbId),
					eq(journalEntry.userId, userTitle.userId),
					eq(userTitle.mediaType, "tv"),
					eq(journalEntry.watchNumber, userTitle.currentWatchNumber),
				),
			)
			.where(eq(journalEntry.userId, ctx.userId))
			.groupBy(journalEntry.tmdbId);

		// Merge: episode shows take priority, then journal-only, then tracker-only
		const episodeTmdbIds = new Set(episodeShows.map((s) => s.tmdbId));
		const journalOnly = journalOnlyShows
			.filter((s) => !episodeTmdbIds.has(s.tmdbId))
			.map((s) => ({
				tmdbId: s.tmdbId,
				episodeCount: 0,
				totalRuntime: 0,
				lastWatchedAt: s.lastCreatedAt,
				currentWatchNumber: watchNumMap.get(s.tmdbId) ?? 1,
			}));

		const knownTmdbIds = new Set([
			...episodeTmdbIds,
			...journalOnly.map((s) => s.tmdbId),
		]);
		const trackerOnly = trackedShows
			.filter((s) => !knownTmdbIds.has(s.tmdbId))
			.map((s) => ({
				tmdbId: s.tmdbId,
				episodeCount: 0,
				totalRuntime: 0,
				lastWatchedAt: s.createdAt,
				currentWatchNumber: s.currentWatchNumber,
			}));

		const withWatchNum = episodeShows.map((s) => ({
			...s,
			currentWatchNumber: watchNumMap.get(s.tmdbId) ?? 1,
		}));

		return [...withWatchNum, ...journalOnly, ...trackerOnly].sort(
			(a, b) =>
				new Date(b.lastWatchedAt).getTime() -
				new Date(a.lastWatchedAt).getTime(),
		);
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

	/** Remove a show from the tracker (deletes all episode watches, journal entries, watch events, and user title) */
	removeShow: protectedProcedure
		.input(z.object({ tmdbId: z.number() }))
		.mutation(async ({ input, ctx }) => {
			await db
				.delete(episodeWatch)
				.where(
					and(
						eq(episodeWatch.userId, ctx.userId),
						eq(episodeWatch.tmdbId, input.tmdbId),
					),
				);
			await db
				.delete(journalEntry)
				.where(
					and(
						eq(journalEntry.userId, ctx.userId),
						eq(journalEntry.tmdbId, input.tmdbId),
					),
				);
			await db
				.delete(watchEvent)
				.where(
					and(
						eq(watchEvent.userId, ctx.userId),
						eq(watchEvent.tmdbId, input.tmdbId),
						eq(watchEvent.mediaType, "tv"),
					),
				);
			await db
				.delete(userTitle)
				.where(
					and(
						eq(userTitle.userId, ctx.userId),
						eq(userTitle.tmdbId, input.tmdbId),
						eq(userTitle.mediaType, "tv"),
					),
				);
			return { success: true };
		}),
	/** Mark episodes from a companion notification — adds show to tracker and marks relevant episodes */
	markFromNotification: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				scope: z.enum(["episode", "season"]).nullable(),
				scopeSeasonNumber: z.number().int().nullable(),
				scopeEpisodeNumber: z.number().int().nullable(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// Add show to tracker if not already tracked
			await db
				.insert(userTitle)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					mediaType: "tv",
				})
				.onConflictDoNothing();

			// Populate seasonEpisodeCounts if not already set
			const existingTitle = await db.query.userTitle.findFirst({
				where: and(
					eq(userTitle.userId, ctx.userId),
					eq(userTitle.tmdbId, input.tmdbId),
					eq(userTitle.mediaType, "tv"),
				),
				columns: { currentWatchNumber: true, seasonEpisodeCounts: true },
			});

			if (existingTitle && !existingTitle.seasonEpisodeCounts) {
				const titleData = await fetchTitleDetails("tv", input.tmdbId);
				if (titleData.seasonList) {
					const counts: Record<string, number> = {};
					for (const s of titleData.seasonList) {
						if (s.seasonNumber > 0) {
							counts[String(s.seasonNumber)] = s.episodeCount;
						}
					}
					await db
						.update(userTitle)
						.set({ seasonEpisodeCounts: counts })
						.where(
							and(
								eq(userTitle.userId, ctx.userId),
								eq(userTitle.tmdbId, input.tmdbId),
								eq(userTitle.mediaType, "tv"),
							),
						);
				}
			}

			const title = await db.query.userTitle.findFirst({
				where: and(
					eq(userTitle.userId, ctx.userId),
					eq(userTitle.tmdbId, input.tmdbId),
					eq(userTitle.mediaType, "tv"),
				),
				columns: { currentWatchNumber: true },
			});
			const watchNum = title?.currentWatchNumber ?? 1;

			let episodesMarked = 0;

			// Mark specific episode if scoped
			if (
				input.scope === "episode" &&
				input.scopeSeasonNumber != null &&
				input.scopeEpisodeNumber != null
			) {
				const seasonData = await fetchSeasonDetails(
					input.tmdbId,
					input.scopeSeasonNumber,
				);
				const episode = seasonData.find(
					(ep: { episodeNumber: number }) =>
						ep.episodeNumber === input.scopeEpisodeNumber,
				);
				if (!episode) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Requested episode not found",
					});
				}
				const inserted = await db
					.insert(episodeWatch)
					.values({
						userId: ctx.userId,
						tmdbId: input.tmdbId,
						seasonNumber: input.scopeSeasonNumber,
						episodeNumber: input.scopeEpisodeNumber,
						runtime: episode.runtime ?? 0,
						watchNumber: watchNum,
					})
					.onConflictDoNothing()
					.returning({ id: episodeWatch.id });
				episodesMarked = inserted.length;
			} else if (input.scope === "season" && input.scopeSeasonNumber != null) {
				// Mark entire season
				const episodes = await fetchSeasonDetails(
					input.tmdbId,
					input.scopeSeasonNumber,
				);
				if (episodes.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Requested season not found",
					});
				}
				const inserted = await db
					.insert(episodeWatch)
					.values(
						episodes.map(
							(ep: { episodeNumber: number; runtime: number | null }) => ({
								userId: ctx.userId,
								tmdbId: input.tmdbId,
								seasonNumber: input.scopeSeasonNumber as number,
								episodeNumber: ep.episodeNumber,
								runtime: ep.runtime ?? 0,
								watchNumber: watchNum,
							}),
						),
					)
					.onConflictDoNothing()
					.returning({ id: episodeWatch.id });
				episodesMarked = inserted.length;
			}

			const newAchievements =
				episodesMarked > 0
					? await evaluateAchievements(ctx.userId, "episode_marked", {
							tmdbId: input.tmdbId,
							mediaType: "tv",
							watchedAt: new Date(),
						})
					: [];
			return { success: true, newAchievements };
		}),
} satisfies TRPCRouterRecord;
