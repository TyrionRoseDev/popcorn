import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	user,
	userGenre,
	userTitle,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { protectedProcedure, publicProcedure } from "#/integrations/trpc/init";
import {
	deduplicateFeed,
	type FeedCursor,
	type FeedItem,
	interleaveFeed,
	parseCursor,
	serializeCursor,
} from "#/lib/feed-assembler";
import { getUnifiedGenreById, UNIFIED_GENRES } from "#/lib/genre-map";
import {
	discoverMovies,
	discoverTv,
	fetchTrending,
	searchMulti,
	type TmdbMovieResult,
	type TmdbSearchResult,
	type TmdbTvResult,
} from "#/lib/tmdb";

// --- Exported helper functions ---

export function mapMovieToFeedItem(
	movie: TmdbMovieResult,
	isTrending = false,
): FeedItem {
	return {
		tmdbId: movie.id,
		mediaType: "movie",
		title: movie.title,
		posterPath: movie.poster_path,
		overview: movie.overview,
		year: movie.release_date ? movie.release_date.slice(0, 4) : "",
		rating: movie.vote_average,
		genreIds: movie.genre_ids,
		isTrending,
	};
}

export function mapTvToFeedItem(
	show: TmdbTvResult,
	isTrending = false,
): FeedItem {
	return {
		tmdbId: show.id,
		mediaType: "tv",
		title: show.name,
		posterPath: show.poster_path,
		overview: show.overview,
		year: show.first_air_date ? show.first_air_date.slice(0, 4) : "",
		rating: show.vote_average,
		genreIds: show.genre_ids,
		isTrending,
	};
}

export function mapSearchResultToFeedItem(result: TmdbSearchResult): FeedItem {
	if (result.media_type === "movie") {
		return {
			tmdbId: result.id,
			mediaType: "movie",
			title: result.title ?? "",
			posterPath: result.poster_path,
			overview: result.overview,
			year: result.release_date ? result.release_date.slice(0, 4) : "",
			rating: result.vote_average,
			genreIds: result.genre_ids,
			isTrending: false,
		};
	}
	return {
		tmdbId: result.id,
		mediaType: "tv",
		title: result.name ?? "",
		posterPath: result.poster_path,
		overview: result.overview,
		year: result.first_air_date ? result.first_air_date.slice(0, 4) : "",
		rating: result.vote_average,
		genreIds: result.genre_ids,
		isTrending: false,
	};
}

interface GenreInput {
	unifiedId: number;
	movieGenreId: number | null;
	tvGenreId: number | null;
}

const PAGE_SIZE = 20;

export async function buildFeed(
	genres: GenreInput[],
	cursor: string | undefined,
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
	const parsed = parseCursor(cursor);

	// Collect all TMDB genre IDs for trending filter
	const allTmdbGenreIds = new Set<number>();
	for (const g of genres) {
		if (g.movieGenreId !== null) allTmdbGenreIds.add(g.movieGenreId);
		if (g.tvGenreId !== null) allTmdbGenreIds.add(g.tvGenreId);
	}

	// Fetch discover results for each genre in parallel
	const discoverPromises: Promise<{
		key: string;
		items: FeedItem[];
	}>[] = [];

	for (const genre of genres) {
		if (genre.movieGenreId !== null) {
			const key = `${genre.unifiedId}_movie`;
			const page = parsed.genrePages[key] ?? 1;
			discoverPromises.push(
				discoverMovies(genre.movieGenreId, page).then((res) => ({
					key,
					items: res.results.map((m) => mapMovieToFeedItem(m)),
				})),
			);
		}
		if (genre.tvGenreId !== null) {
			const key = `${genre.unifiedId}_tv`;
			const page = parsed.genrePages[key] ?? 1;
			discoverPromises.push(
				discoverTv(genre.tvGenreId, page).then((res) => ({
					key,
					items: res.results.map((s) => mapTvToFeedItem(s)),
				})),
			);
		}
	}

	// Fetch trending in parallel
	const trendingPromise = fetchTrending(parsed.trendingPage);

	const [discoverResults, trendingRes] = await Promise.all([
		Promise.all(discoverPromises),
		trendingPromise,
	]);

	// Build genre buckets
	const genreBuckets: Record<string, FeedItem[]> = {};
	for (const { key, items } of discoverResults) {
		genreBuckets[key] = items;
	}

	// Filter trending to only items matching selected genres
	const trendingItems = trendingRes.results
		.filter(
			(t) =>
				t.media_type !== "person" &&
				t.genre_ids.some((gid) => allTmdbGenreIds.has(gid)),
		)
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

	// Interleave and deduplicate
	const interleaved = interleaveFeed(genreBuckets, trendingItems);
	const deduped = deduplicateFeed(interleaved);

	// Take PAGE_SIZE items
	const pageItems = deduped.slice(0, PAGE_SIZE);

	// Build next cursor
	const nextCursor: FeedCursor = {
		genrePages: { ...parsed.genrePages },
		trendingPage: parsed.trendingPage + 1,
	};
	for (const { key } of discoverResults) {
		nextCursor.genrePages[key] = (parsed.genrePages[key] ?? 1) + 1;
	}

	return {
		items: pageItems,
		nextCursor:
			pageItems.length < PAGE_SIZE ? null : serializeCursor(nextCursor),
	};
}

// --- tRPC Router ---

export const tasteProfileRouter = {
	getGenres: publicProcedure.query(() => {
		return UNIFIED_GENRES;
	}),

	getFeed: publicProcedure
		.input(
			z.object({
				genreIds: z.array(z.number()),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			const genres: GenreInput[] = input.genreIds
				.map((id) => {
					const genre = getUnifiedGenreById(id);
					if (!genre) return null;
					return {
						unifiedId: genre.id,
						movieGenreId: genre.movieGenreId,
						tvGenreId: genre.tvGenreId,
					};
				})
				.filter((g): g is GenreInput => g !== null);

			return buildFeed(genres, input.cursor);
		}),

	search: publicProcedure
		.input(
			z.object({
				query: z.string(),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			const page = input.cursor ? Number.parseInt(input.cursor, 10) : 1;
			const res = await searchMulti(input.query, page);
			const items = deduplicateFeed(res.results.map(mapSearchResultToFeedItem));
			const nextCursor = page < res.total_pages ? String(page + 1) : null;
			return { items, nextCursor };
		}),

	saveTasteProfile: protectedProcedure
		.input(
			z.object({
				genreIds: z.array(z.number()).min(3).max(5),
				titles: z
					.array(
						z.object({
							tmdbId: z.number(),
							mediaType: z.enum(["movie", "tv"]),
						}),
					)
					.min(3)
					.max(10),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const userId = ctx.userId;

			await db.transaction(async (tx) => {
				await tx
					.insert(userGenre)
					.values(input.genreIds.map((genreId) => ({ userId, genreId })));
				await tx.insert(userTitle).values(
					input.titles.map((t) => ({
						userId,
						tmdbId: t.tmdbId,
						mediaType: t.mediaType,
					})),
				);

				// Create default watchlist seeded with onboarding picks
				const [defaultWatchlist] = await tx
					.insert(watchlist)
					.values({
						name: "My Picks",
						ownerId: userId,
						isDefault: true,
					})
					.returning();

				await tx.insert(watchlistMember).values({
					watchlistId: defaultWatchlist.id,
					userId,
					role: "owner",
				});

				await tx.insert(watchlistItem).values(
					input.titles.map((t) => ({
						watchlistId: defaultWatchlist.id,
						tmdbId: t.tmdbId,
						mediaType: t.mediaType,
						addedBy: userId,
					})),
				);

				await tx
					.update(user)
					.set({ onboardingCompleted: true })
					.where(eq(user.id, userId));
			});

			return { success: true };
		}),
} satisfies TRPCRouterRecord;
