import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	TmdbMovieResult,
	TmdbSearchResult,
	TmdbTvResult,
} from "#/lib/tmdb";

// Mock env
vi.mock("#/env", () => ({
	env: { TMDB_API_KEY: "test-api-key" },
}));

// Mock TMDB functions
vi.mock("#/lib/tmdb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("#/lib/tmdb")>();
	return {
		...actual,
		discoverMovies: vi.fn(),
		discoverTv: vi.fn(),
		fetchTrending: vi.fn(),
		searchMulti: vi.fn(),
	};
});

import { discoverMovies, discoverTv, fetchTrending } from "#/lib/tmdb";
import {
	buildFeed,
	mapMovieToFeedItem,
	mapSearchResultToFeedItem,
	mapTvToFeedItem,
} from "../routers/taste-profile";

const mockDiscoverMovies = vi.mocked(discoverMovies);
const mockDiscoverTv = vi.mocked(discoverTv);
const mockFetchTrending = vi.mocked(fetchTrending);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("mapMovieToFeedItem", () => {
	it("maps TMDB movie to FeedItem correctly", () => {
		const movie: TmdbMovieResult = {
			id: 123,
			title: "Inception",
			poster_path: "/poster.jpg",
			overview: "A mind-bending thriller",
			release_date: "2010-07-16",
			vote_average: 8.8,
			genre_ids: [28, 878],
		};

		const result = mapMovieToFeedItem(movie);

		expect(result).toEqual({
			tmdbId: 123,
			mediaType: "movie",
			title: "Inception",
			posterPath: "/poster.jpg",
			overview: "A mind-bending thriller",
			year: "2010",
			rating: 8.8,
			genreIds: [28, 878],
			isTrending: false,
		});
	});

	it("sets isTrending when passed true", () => {
		const movie: TmdbMovieResult = {
			id: 456,
			title: "Trending Movie",
			poster_path: null,
			overview: "Trending",
			release_date: "2024-01-01",
			vote_average: 7.0,
			genre_ids: [28],
		};

		const result = mapMovieToFeedItem(movie, true);
		expect(result.isTrending).toBe(true);
	});

	it("handles missing release_date", () => {
		const movie: TmdbMovieResult = {
			id: 789,
			title: "No Date Movie",
			poster_path: null,
			overview: "Unknown date",
			release_date: "",
			vote_average: 6.0,
			genre_ids: [35],
		};

		const result = mapMovieToFeedItem(movie);
		expect(result.year).toBe("");
	});
});

describe("mapTvToFeedItem", () => {
	it("maps TMDB TV show to FeedItem correctly", () => {
		const show: TmdbTvResult = {
			id: 456,
			name: "Breaking Bad",
			poster_path: "/bb.jpg",
			overview: "A chemistry teacher turns to crime",
			first_air_date: "2008-01-20",
			vote_average: 9.5,
			genre_ids: [18, 80],
		};

		const result = mapTvToFeedItem(show);

		expect(result).toEqual({
			tmdbId: 456,
			mediaType: "tv",
			title: "Breaking Bad",
			posterPath: "/bb.jpg",
			overview: "A chemistry teacher turns to crime",
			year: "2008",
			rating: 9.5,
			genreIds: [18, 80],
			isTrending: false,
		});
	});

	it("sets isTrending when passed true", () => {
		const show: TmdbTvResult = {
			id: 789,
			name: "Trending Show",
			poster_path: null,
			overview: "Trending",
			first_air_date: "2024-06-01",
			vote_average: 8.0,
			genre_ids: [18],
		};

		const result = mapTvToFeedItem(show, true);
		expect(result.isTrending).toBe(true);
	});
});

describe("mapSearchResultToFeedItem", () => {
	it("maps movie search result correctly", () => {
		const result: TmdbSearchResult = {
			id: 100,
			media_type: "movie",
			title: "Search Movie",
			poster_path: "/search.jpg",
			overview: "A movie found by search",
			release_date: "2023-05-10",
			vote_average: 7.5,
			genre_ids: [28, 12],
		};

		const mapped = mapSearchResultToFeedItem(result);

		expect(mapped).toEqual({
			tmdbId: 100,
			mediaType: "movie",
			title: "Search Movie",
			posterPath: "/search.jpg",
			overview: "A movie found by search",
			year: "2023",
			rating: 7.5,
			genreIds: [28, 12],
			isTrending: false,
		});
	});

	it("maps TV search result correctly", () => {
		const result: TmdbSearchResult = {
			id: 200,
			media_type: "tv",
			name: "Search Show",
			poster_path: "/show.jpg",
			overview: "A show found by search",
			first_air_date: "2022-09-15",
			vote_average: 8.2,
			genre_ids: [18],
		};

		const mapped = mapSearchResultToFeedItem(result);

		expect(mapped).toEqual({
			tmdbId: 200,
			mediaType: "tv",
			title: "Search Show",
			posterPath: "/show.jpg",
			overview: "A show found by search",
			year: "2022",
			rating: 8.2,
			genreIds: [18],
			isTrending: false,
		});
	});
});

describe("buildFeed", () => {
	it("fetches from all selected genres in parallel", async () => {
		mockDiscoverMovies.mockResolvedValue({
			results: [
				{
					id: 1,
					title: "Action Movie",
					poster_path: "/a.jpg",
					overview: "Action!",
					release_date: "2024-01-01",
					vote_average: 7.0,
					genre_ids: [28],
				},
			],
			page: 1,
			total_pages: 5,
			total_results: 100,
		});

		mockDiscoverTv.mockResolvedValue({
			results: [
				{
					id: 2,
					name: "Action Show",
					poster_path: "/b.jpg",
					overview: "Action TV!",
					first_air_date: "2024-02-01",
					vote_average: 8.0,
					genre_ids: [10759],
				},
			],
			page: 1,
			total_pages: 3,
			total_results: 60,
		});

		mockFetchTrending.mockResolvedValue({
			results: [
				{
					id: 3,
					media_type: "movie",
					title: "Trending Action",
					poster_path: "/t.jpg",
					overview: "Trending!",
					release_date: "2024-03-01",
					vote_average: 9.0,
					genre_ids: [28],
				},
			],
			page: 1,
			total_pages: 10,
			total_results: 200,
		});

		const genres = [{ unifiedId: 1, movieGenreId: 28, tvGenreId: 10759 }];

		const result = await buildFeed(genres, undefined);

		// Should call discoverMovies for movie genre
		expect(mockDiscoverMovies).toHaveBeenCalledWith(28, 1);
		// Should call discoverTv for tv genre
		expect(mockDiscoverTv).toHaveBeenCalledWith(10759, 1);
		// Should call fetchTrending
		expect(mockFetchTrending).toHaveBeenCalledWith(1);

		// Should have items from all sources
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.some((i) => i.tmdbId === 1)).toBe(true);
		expect(result.items.some((i) => i.tmdbId === 2)).toBe(true);
	});

	it("skips TV discover when tvGenreId is null", async () => {
		mockDiscoverMovies.mockResolvedValue({
			results: [
				{
					id: 10,
					title: "Horror Movie",
					poster_path: "/h.jpg",
					overview: "Scary!",
					release_date: "2024-01-01",
					vote_average: 7.0,
					genre_ids: [27],
				},
			],
			page: 1,
			total_pages: 5,
			total_results: 100,
		});

		mockFetchTrending.mockResolvedValue({
			results: [],
			page: 1,
			total_pages: 1,
			total_results: 0,
		});

		// Horror has tvGenreId: null
		const genres = [{ unifiedId: 10, movieGenreId: 27, tvGenreId: null }];

		const result = await buildFeed(genres, undefined);

		// Should call discoverMovies for movie genre
		expect(mockDiscoverMovies).toHaveBeenCalledWith(27, 1);
		// Should NOT call discoverTv since tvGenreId is null
		expect(mockDiscoverTv).not.toHaveBeenCalled();

		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items[0].tmdbId).toBe(10);
	});

	it("skips movie discover when movieGenreId is null", async () => {
		mockDiscoverTv.mockResolvedValue({
			results: [
				{
					id: 20,
					name: "Reality Show",
					poster_path: "/r.jpg",
					overview: "Reality!",
					first_air_date: "2024-01-01",
					vote_average: 6.0,
					genre_ids: [10764],
				},
			],
			page: 1,
			total_pages: 3,
			total_results: 60,
		});

		mockFetchTrending.mockResolvedValue({
			results: [],
			page: 1,
			total_pages: 1,
			total_results: 0,
		});

		// Reality has movieGenreId: null
		const genres = [{ unifiedId: 19, movieGenreId: null, tvGenreId: 10764 }];

		const result = await buildFeed(genres, undefined);

		// Should NOT call discoverMovies since movieGenreId is null
		expect(mockDiscoverMovies).not.toHaveBeenCalled();
		// Should call discoverTv for tv genre
		expect(mockDiscoverTv).toHaveBeenCalledWith(10764, 1);

		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items[0].tmdbId).toBe(20);
	});
});
