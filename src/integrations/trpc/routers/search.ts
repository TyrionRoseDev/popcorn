import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "#/integrations/trpc/init";
import { deduplicateFeed, type FeedItem } from "#/lib/feed-assembler";
import { filterResults, sortResults } from "#/lib/search-filters";
import {
	discoverMoviesWithParams,
	discoverTvWithParams,
	fetchTrending,
	searchMovies,
	searchTvShows,
} from "#/lib/tmdb";
import {
	mapMovieToFeedItem,
	mapSearchResultToFeedItem,
	mapTvToFeedItem,
} from "./taste-profile";

const PAGE_SIZE = 20;

const searchParamsSchema = z.object({
	q: z.string(),
	type: z.enum(["all", "movie", "tv"]).default("all"),
	genre: z.number().optional(),
	yearMin: z.number().optional(),
	yearMax: z.number().optional(),
	rating: z.number().optional(),
	sort: z
		.enum(["relevance", "popularity", "rating", "newest", "oldest"])
		.default("relevance"),
	page: z.number().default(1),
});

type SearchParams = z.infer<typeof searchParamsSchema>;

export async function fetchSearchResults(params: SearchParams) {
	const { q, type, genre, yearMin, yearMax, rating, sort, page } = params;

	// Determine how many pages to fetch per endpoint.
	// "all" = 2 pages each (4 calls), single type = 3 pages (3 calls).
	const pagesPerEndpoint = type === "all" ? 2 : 3;
	const pageNumbers = Array.from({ length: pagesPerEndpoint }, (_, i) => i + 1);

	let allItems: FeedItem[] = [];

	if (type === "all" || type === "movie") {
		const moviePages = await Promise.all(
			pageNumbers.map((p) => searchMovies(q, p).catch(() => null)),
		);
		if (moviePages.every((r) => r == null)) {
			throw new Error("TMDB: all movie page requests failed");
		}
		for (const res of moviePages) {
			if (res) {
				allItems.push(...res.results.map((r) => mapMovieToFeedItem(r)));
			}
		}
	}

	if (type === "all" || type === "tv") {
		const tvPages = await Promise.all(
			pageNumbers.map((p) => searchTvShows(q, p).catch(() => null)),
		);
		if (tvPages.every((r) => r == null)) {
			throw new Error("TMDB: all TV page requests failed");
		}
		for (const res of tvPages) {
			if (res) {
				allItems.push(...res.results.map((r) => mapTvToFeedItem(r)));
			}
		}
	}

	allItems = deduplicateFeed(allItems);

	// Apply server-side filters (genre, year, rating).
	// Type is already handled at fetch level — pass "all" to avoid double-filtering.
	const filtered = filterResults(allItems, {
		type: "all",
		genre,
		yearMin,
		yearMax,
		rating,
	});

	const sorted = sortResults(filtered, sort);

	// Paginate
	const totalResults = sorted.length;
	const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
	const start = (page - 1) * PAGE_SIZE;
	const results = sorted.slice(start, start + PAGE_SIZE);

	return { results, totalPages, totalResults };
}

export async function fetchTrendingLanding(): Promise<FeedItem[]> {
	const res = await fetchTrending(1);
	const items = res.results
		.filter((t) => t.media_type !== "person")
		.map((t) =>
			mapSearchResultToFeedItem({
				...t,
				media_type: t.media_type as "movie" | "tv",
			}),
		);
	return items.slice(0, 6);
}

export async function fetchTopRated(): Promise<FeedItem[]> {
	const [movies, tv] = await Promise.all([
		discoverMoviesWithParams(1, {
			sort_by: "vote_average.desc",
			"vote_count.gte": "500",
		}),
		discoverTvWithParams(1, {
			sort_by: "vote_average.desc",
			"vote_count.gte": "500",
		}),
	]);

	const items: FeedItem[] = [
		...movies.results.map((m) => mapMovieToFeedItem(m)),
		...tv.results.map((s) => mapTvToFeedItem(s)),
	];

	return items.sort((a, b) => b.rating - a.rating).slice(0, 6);
}

export async function fetchNewReleases(): Promise<FeedItem[]> {
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

	const [movies, tv] = await Promise.all([
		discoverMoviesWithParams(1, {
			sort_by: "popularity.desc",
			"primary_release_date.gte": dateStr,
		}),
		discoverTvWithParams(1, {
			sort_by: "popularity.desc",
			"first_air_date.gte": dateStr,
		}),
	]);

	const items: FeedItem[] = [
		...movies.results.map((m) => mapMovieToFeedItem(m)),
		...tv.results.map((s) => mapTvToFeedItem(s)),
	];

	return items.slice(0, 6);
}

export const searchRouter = {
	results: publicProcedure
		.input(searchParamsSchema)
		.query(async ({ input }) => fetchSearchResults(input)),

	trending: publicProcedure.query(async () => ({
		results: await fetchTrendingLanding(),
	})),

	topRated: publicProcedure.query(async () => ({
		results: await fetchTopRated(),
	})),

	newReleases: publicProcedure.query(async () => ({
		results: await fetchNewReleases(),
	})),
} satisfies TRPCRouterRecord;
