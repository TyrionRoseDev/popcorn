import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, not, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	shuffleSwipe,
	userGenre,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { deduplicateFeed, type FeedItem } from "#/lib/feed-assembler";
import { getUnifiedGenreById, UNIFIED_GENRES } from "#/lib/genre-map";
import {
	GROUP_RATIO,
	interleaveShuffleFeed,
	parseShuffleCursor,
	SOLO_RATIO,
	serializeShuffleCursor,
} from "#/lib/shuffle-feed";
import {
	discoverMovies,
	discoverMoviesWithParams,
	discoverTv,
	discoverTvWithParams,
	fetchTrending,
} from "#/lib/tmdb";
import { createNotification } from "./notification";
import { mapMovieToFeedItem, mapTvToFeedItem } from "./taste-profile";

const BATCH_SIZE = 20;

async function assertMember(watchlistId: string, userId: string) {
	const membership = await db.query.watchlistMember.findFirst({
		where: and(
			eq(watchlistMember.watchlistId, watchlistId),
			eq(watchlistMember.userId, userId),
		),
	});
	if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
}

export const shuffleRouter = {
	getOrCreateShuffleWatchlist: protectedProcedure.query(async ({ ctx }) => {
		// Find existing shuffle watchlist
		const existing = await db.query.watchlist.findFirst({
			where: and(
				eq(watchlist.ownerId, ctx.userId),
				eq(watchlist.type, "shuffle"),
			),
		});
		if (existing) return existing;

		// Create a new shuffle watchlist
		return db.transaction(async (tx) => {
			const [wl] = await tx
				.insert(watchlist)
				.values({
					name: "Shuffle Picks",
					ownerId: ctx.userId,
					type: "shuffle",
				})
				.returning();

			await tx.insert(watchlistMember).values({
				watchlistId: wl.id,
				userId: ctx.userId,
				role: "owner",
			});

			return wl;
		});
	}),

	getFeed: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			await assertMember(input.watchlistId, ctx.userId);

			const parsed = parseShuffleCursor(input.cursor);

			// Determine if this is a solo or group watchlist
			const members = await db.query.watchlistMember.findMany({
				where: eq(watchlistMember.watchlistId, input.watchlistId),
			});
			const isGroup = members.length > 1;
			const ratio = isGroup ? GROUP_RATIO : SOLO_RATIO;

			// Get user's genres (for solo) or all members' genres (for group)
			const memberIds = members.map((m) => m.userId);
			const genreRows = await db.query.userGenre.findMany({
				where: inArray(userGenre.userId, memberIds),
			});

			// Deduplicate genre IDs
			const uniqueGenreIds = [...new Set(genreRows.map((g) => g.genreId))];
			const genres = uniqueGenreIds
				.map((id) => getUnifiedGenreById(id))
				.filter((g): g is NonNullable<typeof g> => g !== null);

			// Pick a genre in round-robin fashion based on cursor page
			const genreIndex = parsed.tastePage % Math.max(genres.length, 1);
			const activeGenre = genres[genreIndex] ?? UNIFIED_GENRES[0];

			// Fetch taste, trending, and discovery in parallel
			const tastePromises: Promise<FeedItem[]>[] = [];
			if (activeGenre.movieGenreId !== null) {
				tastePromises.push(
					discoverMovies(activeGenre.movieGenreId, parsed.tastePage).then(
						(res) => res.results.map((m) => mapMovieToFeedItem(m)),
					),
				);
			}
			if (activeGenre.tvGenreId !== null) {
				tastePromises.push(
					discoverTv(activeGenre.tvGenreId, parsed.tastePage).then((res) =>
						res.results.map((s) => mapTvToFeedItem(s)),
					),
				);
			}

			const [tasteResults, trendingRes, discoveryMovies, discoveryTv] =
				await Promise.all([
					Promise.all(tastePromises).then((arrays) => arrays.flat()),
					fetchTrending(parsed.trendingPage),
					discoverMoviesWithParams(parsed.discoveryPage, {
						sort_by: "popularity.desc",
						"vote_count.gte": "100",
					}),
					discoverTvWithParams(parsed.discoveryPage, {
						sort_by: "popularity.desc",
						"vote_count.gte": "100",
					}),
				]);

			const trendingItems: FeedItem[] = trendingRes.results
				.filter((t) => t.media_type !== "person")
				.map((t) => {
					if (t.media_type === "movie") {
						return mapMovieToFeedItem(
							{
								id: t.id,
								title: t.title ?? "",
								poster_path: t.poster_path,
								overview: t.overview,
								release_date: t.release_date ?? "",
								vote_average: t.vote_average,
								genre_ids: t.genre_ids,
							},
							true,
						);
					}
					return mapTvToFeedItem(
						{
							id: t.id,
							name: t.name ?? "",
							poster_path: t.poster_path,
							overview: t.overview,
							first_air_date: t.first_air_date ?? "",
							vote_average: t.vote_average,
							genre_ids: t.genre_ids,
						},
						true,
					);
				});

			const discoveryItems: FeedItem[] = [
				...discoveryMovies.results.map((m) => mapMovieToFeedItem(m)),
				...discoveryTv.results.map((s) => mapTvToFeedItem(s)),
			];

			// Interleave with appropriate ratio
			const interleaved = interleaveShuffleFeed(
				tasteResults,
				trendingItems,
				discoveryItems,
				ratio,
			);

			// Filter out already-swiped items
			const twoWeeksAgo = new Date();
			twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

			const swipes = await db.query.shuffleSwipe.findMany({
				where: and(
					eq(shuffleSwipe.userId, ctx.userId),
					eq(shuffleSwipe.watchlistId, input.watchlistId),
				),
				columns: {
					tmdbId: true,
					mediaType: true,
					action: true,
					createdAt: true,
				},
			});

			const swipedSet = new Set<string>();
			for (const s of swipes) {
				// Always filter: yes swipes and hide swipes (globally)
				if (s.action === "yes" || s.action === "hide") {
					swipedSet.add(`${s.tmdbId}-${s.mediaType}`);
				}
				// Filter no swipes only if within 2 weeks
				if (s.action === "no" && s.createdAt >= twoWeeksAgo) {
					swipedSet.add(`${s.tmdbId}-${s.mediaType}`);
				}
			}

			const filtered = deduplicateFeed(interleaved).filter(
				(item) => !swipedSet.has(`${item.tmdbId}-${item.mediaType}`),
			);

			const pageItems = filtered.slice(0, BATCH_SIZE);

			const nextCursor = serializeShuffleCursor({
				tastePage: parsed.tastePage + 1,
				trendingPage: parsed.trendingPage + 1,
				discoveryPage: parsed.discoveryPage + 1,
			});

			return {
				items: pageItems,
				nextCursor: pageItems.length < BATCH_SIZE ? null : nextCursor,
			};
		}),

	recordSwipe: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				action: z.enum(["yes", "no", "hide"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertMember(input.watchlistId, ctx.userId);

			// Upsert the swipe
			await db
				.insert(shuffleSwipe)
				.values({
					userId: ctx.userId,
					watchlistId: input.watchlistId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					action: input.action,
				})
				.onConflictDoUpdate({
					target: [
						shuffleSwipe.userId,
						shuffleSwipe.tmdbId,
						shuffleSwipe.mediaType,
						shuffleSwipe.watchlistId,
					],
					set: { action: input.action },
				});

			// Check watchlist type to determine solo vs group behavior
			const wl = await db.query.watchlist.findFirst({
				where: eq(watchlist.id, input.watchlistId),
			});
			if (!wl) throw new TRPCError({ code: "NOT_FOUND" });

			const isSolo = wl.type === "shuffle";

			if (input.action === "yes") {
				// Group mode: check member count for match logic
				const memberRows = isSolo
					? []
					: await db.query.watchlistMember.findMany({
							where: eq(watchlistMember.watchlistId, input.watchlistId),
						});
				const memberCount = memberRows.length;

				if (isSolo || memberCount <= 1) {
					// Solo mode or single-member watchlist: add directly, no curtain call
					await db
						.insert(watchlistItem)
						.values({
							watchlistId: input.watchlistId,
							tmdbId: input.tmdbId,
							mediaType: input.mediaType,
							addedBy: ctx.userId,
						})
						.onConflictDoNothing();

					return { match: false };
				}

				const yesSwipes = await db.query.shuffleSwipe.findMany({
					where: and(
						eq(shuffleSwipe.watchlistId, input.watchlistId),
						eq(shuffleSwipe.tmdbId, input.tmdbId),
						eq(shuffleSwipe.mediaType, input.mediaType),
						eq(shuffleSwipe.action, "yes"),
					),
				});

				if (yesSwipes.length >= memberCount) {
					// Unanimous match — add to watchlist
					const inserted = await db
						.insert(watchlistItem)
						.values({
							watchlistId: input.watchlistId,
							tmdbId: input.tmdbId,
							mediaType: input.mediaType,
							addedBy: ctx.userId,
						})
						.onConflictDoNothing()
						.returning({ id: watchlistItem.id });

					// Only notify if the item was actually added (not a duplicate)
					if (inserted.length > 0) {
						for (const swipe of yesSwipes) {
							await createNotification({
								recipientId: swipe.userId,
								actorId: ctx.userId,
								type: "shuffle_match",
								data: {
									watchlistId: input.watchlistId,
									titleName: "",
									tmdbId: input.tmdbId,
									mediaType: input.mediaType,
								},
							});
						}
					}

					return {
						match: true,
						watchlistName: wl.name,
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
					};
				}

				return { match: false };
			}

			return { match: false };
		}),

	undoSwipe: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertMember(input.watchlistId, ctx.userId);

			// Check watchlist type for solo cleanup
			const wl = await db.query.watchlist.findFirst({
				where: eq(watchlist.id, input.watchlistId),
			});
			if (!wl) throw new TRPCError({ code: "NOT_FOUND" });

			// Get the swipe before deleting, to know if it was a yes
			const existingSwipe = await db.query.shuffleSwipe.findFirst({
				where: and(
					eq(shuffleSwipe.userId, ctx.userId),
					eq(shuffleSwipe.watchlistId, input.watchlistId),
					eq(shuffleSwipe.tmdbId, input.tmdbId),
					eq(shuffleSwipe.mediaType, input.mediaType),
				),
			});

			// Delete the swipe record
			await db
				.delete(shuffleSwipe)
				.where(
					and(
						eq(shuffleSwipe.userId, ctx.userId),
						eq(shuffleSwipe.watchlistId, input.watchlistId),
						eq(shuffleSwipe.tmdbId, input.tmdbId),
						eq(shuffleSwipe.mediaType, input.mediaType),
					),
				);

			// If solo/single-member and it was a yes swipe, also remove from watchlist
			if (existingSwipe?.action === "yes") {
				const memberRows = await db.query.watchlistMember.findMany({
					where: eq(watchlistMember.watchlistId, input.watchlistId),
					columns: { userId: true },
				});

				if (wl.type === "shuffle" || memberRows.length <= 1) {
					await db
						.delete(watchlistItem)
						.where(
							and(
								eq(watchlistItem.watchlistId, input.watchlistId),
								eq(watchlistItem.tmdbId, input.tmdbId),
								eq(watchlistItem.mediaType, input.mediaType),
							),
						);
				}
			}
		}),

	getWatchlistOptions: protectedProcedure.query(async ({ ctx }) => {
		const memberships = await db.query.watchlistMember.findMany({
			where: eq(watchlistMember.userId, ctx.userId),
		});
		const watchlistIds = memberships.map((m) => m.watchlistId);
		if (watchlistIds.length === 0) return [];

		return db.query.watchlist.findMany({
			where: (wl, { inArray: inArr }) =>
				and(
					inArr(wl.id, watchlistIds),
					or(eq(wl.type, "shuffle"), eq(wl.type, "custom")),
				),
			columns: { id: true, name: true, type: true },
			with: {
				members: {
					columns: { userId: true },
				},
			},
			orderBy: (wl, { desc }) => [
				sql`CASE ${wl.type} WHEN 'shuffle' THEN 1 WHEN 'custom' THEN 2 ELSE 99 END`,
				desc(wl.updatedAt),
			],
		});
	}),

	getHiddenTitles: protectedProcedure.query(async ({ ctx }) => {
		const hiddenSwipes = await db.query.shuffleSwipe.findMany({
			where: and(
				eq(shuffleSwipe.userId, ctx.userId),
				eq(shuffleSwipe.action, "hide"),
			),
			columns: {
				id: true,
				tmdbId: true,
				mediaType: true,
				createdAt: true,
			},
		});

		return hiddenSwipes;
	}),

	unhideTitle: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await db
				.delete(shuffleSwipe)
				.where(
					and(
						eq(shuffleSwipe.userId, ctx.userId),
						eq(shuffleSwipe.tmdbId, input.tmdbId),
						eq(shuffleSwipe.mediaType, input.mediaType),
						eq(shuffleSwipe.action, "hide"),
					),
				);
		}),

	getRecentMatches: protectedProcedure
		.input(z.object({ watchlistId: z.string() }))
		.query(async ({ ctx, input }) => {
			await assertMember(input.watchlistId, ctx.userId);
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
			const recentItems = await db.query.watchlistItem.findMany({
				where: and(
					eq(watchlistItem.watchlistId, input.watchlistId),
					not(eq(watchlistItem.addedBy, ctx.userId)),
				),
			});
			return recentItems.filter(
				(item) => new Date(item.createdAt) > oneHourAgo,
			);
		}),
} satisfies TRPCRouterRecord;
