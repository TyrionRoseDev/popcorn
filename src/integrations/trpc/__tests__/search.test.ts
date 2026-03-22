import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock env
vi.mock("#/env", () => ({
	env: { TMDB_READ_ACCESS_TOKEN: "test-api-key" },
}));

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

import {
	fetchNewReleases,
	fetchSearchResults,
	fetchTopRated,
	fetchTrendingLanding,
} from "../routers/search";

function makeMockPageResponse(results: object[], page = 1, totalPages = 1) {
	return {
		ok: true,
		json: async () => ({
			results,
			page,
			total_pages: totalPages,
			total_results: results.length,
		}),
	};
}

function makeMovieResult(id: number, overrides: object = {}) {
	return {
		id,
		title: `Movie ${id}`,
		poster_path: `/movie${id}.jpg`,
		overview: `Overview for movie ${id}`,
		release_date: "2023-06-15",
		vote_average: 7.5,
		genre_ids: [28],
		...overrides,
	};
}

function makeTvResult(id: number, overrides: object = {}) {
	return {
		id,
		name: `Show ${id}`,
		poster_path: `/show${id}.jpg`,
		overview: `Overview for show ${id}`,
		first_air_date: "2023-06-15",
		vote_average: 7.0,
		genre_ids: [18],
		...overrides,
	};
}

beforeEach(() => {
	mockFetch.mockReset();
});

describe("fetchSearchResults", () => {
	it("searches both movies and TV when type is 'all'", async () => {
		// type="all" => pagesPerEndpoint=2 => 4 fetch calls total
		// calls: searchMovies p1, searchMovies p2, searchTvShows p1, searchTvShows p2
		mockFetch
			.mockResolvedValueOnce(
				makeMockPageResponse([makeMovieResult(1), makeMovieResult(2)]),
			)
			.mockResolvedValueOnce(makeMockPageResponse([makeMovieResult(3)]))
			.mockResolvedValueOnce(
				makeMockPageResponse([makeTvResult(10), makeTvResult(11)]),
			)
			.mockResolvedValueOnce(makeMockPageResponse([makeTvResult(12)]));

		const result = await fetchSearchResults({
			q: "action",
			type: "all",
			sort: "relevance",
			page: 1,
		});

		expect(result.results).toHaveLength(6);
		const ids = result.results.map((r) => r.tmdbId);
		expect(ids).toContain(1);
		expect(ids).toContain(10);
		// Both movie and TV items present
		expect(result.results.some((r) => r.mediaType === "movie")).toBe(true);
		expect(result.results.some((r) => r.mediaType === "tv")).toBe(true);
		expect(mockFetch).toHaveBeenCalledTimes(4);
	});

	it("only searches movies when type is 'movie'", async () => {
		// type="movie" => pagesPerEndpoint=3 => 3 fetch calls
		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse([makeMovieResult(1)]))
			.mockResolvedValueOnce(makeMockPageResponse([makeMovieResult(2)]))
			.mockResolvedValueOnce(makeMockPageResponse([makeMovieResult(3)]));

		const result = await fetchSearchResults({
			q: "action",
			type: "movie",
			sort: "relevance",
			page: 1,
		});

		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(result.results.every((r) => r.mediaType === "movie")).toBe(true);

		// Verify all calls went to /search/movie
		for (const call of mockFetch.mock.calls) {
			const url: string = call[0];
			expect(url).toContain("/search/movie");
		}
	});

	it("only searches TV shows when type is 'tv'", async () => {
		// type="tv" => pagesPerEndpoint=3 => 3 fetch calls
		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse([makeTvResult(10)]))
			.mockResolvedValueOnce(makeMockPageResponse([makeTvResult(11)]))
			.mockResolvedValueOnce(makeMockPageResponse([makeTvResult(12)]));

		const result = await fetchSearchResults({
			q: "drama",
			type: "tv",
			sort: "relevance",
			page: 1,
		});

		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(result.results.every((r) => r.mediaType === "tv")).toBe(true);

		for (const call of mockFetch.mock.calls) {
			const url: string = call[0];
			expect(url).toContain("/search/tv");
		}
	});

	it("deduplicates results with the same tmdbId and mediaType", async () => {
		// Both pages return the same movie
		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse([makeMovieResult(1)]))
			.mockResolvedValueOnce(makeMockPageResponse([makeMovieResult(1)]))
			.mockResolvedValueOnce(makeMockPageResponse([makeTvResult(10)]))
			.mockResolvedValueOnce(makeMockPageResponse([makeTvResult(10)]));

		const result = await fetchSearchResults({
			q: "test",
			type: "all",
			sort: "relevance",
			page: 1,
		});

		const movieIds = result.results
			.filter((r) => r.mediaType === "movie")
			.map((r) => r.tmdbId);
		// Deduplicated: only one item with id 1
		expect(movieIds.filter((id) => id === 1)).toHaveLength(1);
	});

	it("returns correct pagination metadata", async () => {
		// Return 25 movies across 2 pages (all type, 2 pages each endpoint)
		const movies1 = Array.from({ length: 15 }, (_, i) =>
			makeMovieResult(i + 1),
		);
		const movies2 = Array.from({ length: 10 }, (_, i) =>
			makeMovieResult(i + 16),
		);
		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse(movies1))
			.mockResolvedValueOnce(makeMockPageResponse(movies2))
			.mockResolvedValueOnce(makeMockPageResponse([]))
			.mockResolvedValueOnce(makeMockPageResponse([]));

		const result = await fetchSearchResults({
			q: "test",
			type: "all",
			sort: "relevance",
			page: 1,
		});

		expect(result.totalResults).toBe(25);
		expect(result.totalPages).toBe(2);
		expect(result.results).toHaveLength(20); // PAGE_SIZE = 20
	});

	it("applies rating filter", async () => {
		const lowRated = makeMovieResult(1, { vote_average: 4.0 });
		const highRated = makeMovieResult(2, { vote_average: 8.5 });
		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse([lowRated, highRated]))
			.mockResolvedValueOnce(makeMockPageResponse([]))
			.mockResolvedValueOnce(makeMockPageResponse([]))
			.mockResolvedValueOnce(makeMockPageResponse([]));

		const result = await fetchSearchResults({
			q: "test",
			type: "all",
			rating: 7.0,
			sort: "relevance",
			page: 1,
		});

		expect(result.results).toHaveLength(1);
		expect(result.results[0].tmdbId).toBe(2);
	});

	it("handles fetch failures gracefully by skipping that page", async () => {
		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse([makeMovieResult(1)]))
			.mockRejectedValueOnce(new Error("Network error"))
			.mockResolvedValueOnce(makeMockPageResponse([makeTvResult(10)]))
			.mockResolvedValueOnce(makeMockPageResponse([]));

		const result = await fetchSearchResults({
			q: "test",
			type: "all",
			sort: "relevance",
			page: 1,
		});

		// Should still return results from successful calls
		expect(result.results.some((r) => r.tmdbId === 1)).toBe(true);
		expect(result.results.some((r) => r.tmdbId === 10)).toBe(true);
	});
});

describe("fetchTrendingLanding", () => {
	it("returns up to 6 trending items excluding persons", async () => {
		const trendingResults = [
			{
				id: 1,
				media_type: "movie",
				title: "Trending Movie 1",
				poster_path: "/t1.jpg",
				overview: "Overview 1",
				release_date: "2024-01-01",
				vote_average: 8.0,
				genre_ids: [28],
			},
			{
				id: 2,
				media_type: "tv",
				name: "Trending Show 1",
				poster_path: "/t2.jpg",
				overview: "Overview 2",
				first_air_date: "2024-02-01",
				vote_average: 7.5,
				genre_ids: [18],
			},
			{
				id: 3,
				media_type: "person",
				name: "Famous Person",
				poster_path: "/p1.jpg",
				overview: "",
				vote_average: 0,
				genre_ids: [],
			},
			{
				id: 4,
				media_type: "movie",
				title: "Trending Movie 2",
				poster_path: "/t3.jpg",
				overview: "Overview 3",
				release_date: "2024-03-01",
				vote_average: 7.0,
				genre_ids: [35],
			},
		];

		mockFetch.mockResolvedValueOnce(makeMockPageResponse(trendingResults));

		const items = await fetchTrendingLanding();

		// Person should be excluded
		expect(
			items.every((i) => i.mediaType === "movie" || i.mediaType === "tv"),
		).toBe(true);
		expect(items.length).toBeLessThanOrEqual(6);
		expect(items.some((i) => i.tmdbId === 3)).toBe(false);
	});

	it("returns at most 6 items when more are available", async () => {
		const manyResults = Array.from({ length: 15 }, (_, i) => ({
			id: i + 1,
			media_type: "movie",
			title: `Movie ${i + 1}`,
			poster_path: `/m${i + 1}.jpg`,
			overview: `Overview ${i + 1}`,
			release_date: "2024-01-01",
			vote_average: 7.0,
			genre_ids: [28],
		}));

		mockFetch.mockResolvedValueOnce(makeMockPageResponse(manyResults));

		const items = await fetchTrendingLanding();

		expect(items).toHaveLength(6);
	});

	it("fetches from /trending/all/week", async () => {
		mockFetch.mockResolvedValueOnce(makeMockPageResponse([]));

		await fetchTrendingLanding();

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const url: string = mockFetch.mock.calls[0][0];
		expect(url).toContain("/trending/all/week");
	});
});

describe("fetchTopRated", () => {
	it("returns items sorted by rating descending", async () => {
		const movies = [
			makeMovieResult(1, { vote_average: 7.0 }),
			makeMovieResult(2, { vote_average: 9.5 }),
		];
		const tvShows = [
			makeTvResult(10, { vote_average: 8.0 }),
			makeTvResult(11, { vote_average: 6.5 }),
		];

		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse(movies))
			.mockResolvedValueOnce(makeMockPageResponse(tvShows));

		const items = await fetchTopRated();

		// Should be sorted by rating descending
		for (let i = 0; i < items.length - 1; i++) {
			expect(items[i].rating).toBeGreaterThanOrEqual(items[i + 1].rating);
		}
	});

	it("returns at most 6 items", async () => {
		const movies = Array.from({ length: 10 }, (_, i) =>
			makeMovieResult(i + 1, { vote_average: 8.0 - i * 0.1 }),
		);
		const tvShows = Array.from({ length: 10 }, (_, i) =>
			makeTvResult(i + 100, { vote_average: 7.5 - i * 0.1 }),
		);

		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse(movies))
			.mockResolvedValueOnce(makeMockPageResponse(tvShows));

		const items = await fetchTopRated();

		expect(items).toHaveLength(6);
	});

	it("fetches from /discover/movie and /discover/tv", async () => {
		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse([]))
			.mockResolvedValueOnce(makeMockPageResponse([]));

		await fetchTopRated();

		const urls = mockFetch.mock.calls.map((c) => c[0] as string);
		expect(urls.some((u) => u.includes("/discover/movie"))).toBe(true);
		expect(urls.some((u) => u.includes("/discover/tv"))).toBe(true);
	});
});

describe("fetchNewReleases", () => {
	it("returns items sorted by rating descending", async () => {
		const movies = [
			makeMovieResult(1, { vote_average: 6.0 }),
			makeMovieResult(2, { vote_average: 8.5 }),
		];
		const tvShows = [makeTvResult(10, { vote_average: 7.0 })];

		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse(movies))
			.mockResolvedValueOnce(makeMockPageResponse(tvShows));

		const items = await fetchNewReleases();

		for (let i = 0; i < items.length - 1; i++) {
			expect(items[i].rating).toBeGreaterThanOrEqual(items[i + 1].rating);
		}
	});

	it("returns at most 6 items", async () => {
		const movies = Array.from({ length: 10 }, (_, i) =>
			makeMovieResult(i + 1, { vote_average: 8.0 }),
		);
		const tvShows = Array.from({ length: 10 }, (_, i) =>
			makeTvResult(i + 100, { vote_average: 7.0 }),
		);

		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse(movies))
			.mockResolvedValueOnce(makeMockPageResponse(tvShows));

		const items = await fetchNewReleases();

		expect(items).toHaveLength(6);
	});

	it("uses date filter for recent releases", async () => {
		mockFetch
			.mockResolvedValueOnce(makeMockPageResponse([]))
			.mockResolvedValueOnce(makeMockPageResponse([]));

		await fetchNewReleases();

		const urls = mockFetch.mock.calls.map((c) => c[0] as string);
		const movieUrl = urls.find((u) => u.includes("/discover/movie")) ?? "";
		const tvUrl = urls.find((u) => u.includes("/discover/tv")) ?? "";

		// Should include date filters
		expect(movieUrl).toContain("primary_release_date.gte");
		expect(tvUrl).toContain("first_air_date.gte");
	});
});
