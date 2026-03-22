import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	discoverMovies,
	discoverMoviesWithParams,
	discoverTv,
	discoverTvWithParams,
	fetchTrending,
	getTmdbImageUrl,
	searchMovies,
	searchMulti,
	searchTvShows,
} from "../tmdb";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock env to avoid needing real env vars in tests
vi.mock("#/env", () => ({
	env: { TMDB_READ_ACCESS_TOKEN: "test-api-key" },
}));

beforeEach(() => {
	mockFetch.mockReset();
});

describe("getTmdbImageUrl", () => {
	it("builds correct URL with default size", () => {
		expect(getTmdbImageUrl("/abc123.jpg")).toBe(
			"https://image.tmdb.org/t/p/w500/abc123.jpg",
		);
	});

	it("builds correct URL with custom size", () => {
		expect(getTmdbImageUrl("/abc123.jpg", "w780")).toBe(
			"https://image.tmdb.org/t/p/w780/abc123.jpg",
		);
	});

	it("returns null for null poster path", () => {
		expect(getTmdbImageUrl(null)).toBeNull();
	});
});

describe("discoverMovies", () => {
	it("calls TMDB discover/movie with correct params", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [
					{
						id: 1,
						title: "Test Movie",
						poster_path: "/test.jpg",
						overview: "A test movie",
						release_date: "2024-01-15",
						vote_average: 7.5,
						genre_ids: [28],
					},
				],
				page: 1,
				total_pages: 5,
			}),
		});

		const result = await discoverMovies(28, 1);

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/discover/movie"),
			expect.objectContaining({
				headers: { Authorization: "Bearer test-api-key" },
			}),
		);
		const url = mockFetch.mock.calls[0][0] as string;
		expect(url).toContain("with_genres=28");
		expect(url).toContain("include_adult=false");
		expect(url).toContain("vote_count.gte=200");
		expect(url).toContain("vote_average.gte=6");
		expect(url).toContain("sort_by=popularity.desc");
		expect(result.results).toHaveLength(1);
		expect(result.results[0].title).toBe("Test Movie");
	});

	it("throws on non-ok response", async () => {
		mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
		await expect(discoverMovies(28, 1)).rejects.toThrow("TMDB API error: 401");
	});
});

describe("discoverTv", () => {
	it("calls TMDB discover/tv with correct params", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [
					{
						id: 1,
						name: "Test Show",
						poster_path: "/test.jpg",
						overview: "A test show",
						first_air_date: "2024-01-15",
						vote_average: 8.0,
						genre_ids: [18],
					},
				],
				page: 1,
				total_pages: 3,
			}),
		});

		const result = await discoverTv(18, 1);

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/discover/tv"),
			expect.objectContaining({
				headers: { Authorization: "Bearer test-api-key" },
			}),
		);
		const url = mockFetch.mock.calls[0][0] as string;
		expect(url).toContain("with_genres=18");
		expect(result.results).toHaveLength(1);
		expect(result.results[0].name).toBe("Test Show");
	});
});

describe("fetchTrending", () => {
	it("calls TMDB trending/all/week with correct params", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [
					{
						id: 1,
						media_type: "movie",
						title: "Trending Movie",
						poster_path: "/t.jpg",
						overview: "...",
						release_date: "2024-01-01",
						vote_average: 8,
						genre_ids: [28],
					},
				],
				page: 1,
				total_pages: 10,
			}),
		});

		const result = await fetchTrending(1);

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/trending/all/week"),
			expect.objectContaining({
				headers: { Authorization: "Bearer test-api-key" },
			}),
		);
		expect(result.results).toHaveLength(1);
	});
});

describe("discoverMoviesWithParams", () => {
	it("calls /discover/movie with page and custom params", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [
					{
						id: 10,
						title: "Top Rated Movie",
						poster_path: "/top.jpg",
						overview: "Great movie",
						release_date: "2024-05-01",
						vote_average: 9.0,
						genre_ids: [18],
					},
				],
				page: 1,
				total_pages: 10,
				total_results: 200,
			}),
		});

		const result = await discoverMoviesWithParams(1, {
			sort_by: "vote_average.desc",
			"vote_count.gte": "300",
		});

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/discover/movie"),
			expect.objectContaining({
				headers: { Authorization: "Bearer test-api-key" },
			}),
		);
		const url = mockFetch.mock.calls[0][0] as string;
		expect(url).toContain("page=1");
		expect(url).toContain("include_adult=false");
		expect(url).toContain("sort_by=vote_average.desc");
		expect(url).toContain("vote_count.gte=300");
		expect(result.results).toHaveLength(1);
		expect(result.results[0].title).toBe("Top Rated Movie");
	});

	it("calls /discover/movie with only page when no extra params provided", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [],
				page: 2,
				total_pages: 1,
				total_results: 0,
			}),
		});

		await discoverMoviesWithParams(2);

		const url = mockFetch.mock.calls[0][0] as string;
		expect(url).toContain("page=2");
		expect(url).toContain("include_adult=false");
	});
});

describe("discoverTvWithParams", () => {
	it("calls /discover/tv with page and custom params", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [
					{
						id: 20,
						name: "New Show",
						poster_path: "/new.jpg",
						overview: "Fresh show",
						first_air_date: "2024-11-01",
						vote_average: 7.8,
						genre_ids: [35],
					},
				],
				page: 1,
				total_pages: 5,
				total_results: 100,
			}),
		});

		const result = await discoverTvWithParams(1, {
			sort_by: "first_air_date.desc",
			"primary_release_date.gte": "2024-01-01",
		});

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/discover/tv"),
			expect.objectContaining({
				headers: { Authorization: "Bearer test-api-key" },
			}),
		);
		const url = mockFetch.mock.calls[0][0] as string;
		expect(url).toContain("page=1");
		expect(url).toContain("include_adult=false");
		expect(url).toContain("sort_by=first_air_date.desc");
		expect(result.results).toHaveLength(1);
		expect(result.results[0].name).toBe("New Show");
	});

	it("calls /discover/tv with only page when no extra params provided", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [],
				page: 3,
				total_pages: 1,
				total_results: 0,
			}),
		});

		await discoverTvWithParams(3);

		const url = mockFetch.mock.calls[0][0] as string;
		expect(url).toContain("page=3");
		expect(url).toContain("include_adult=false");
	});
});

describe("searchMovies", () => {
	it("calls /search/movie with query and page", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [
					{
						id: 100,
						title: "Search Movie",
						poster_path: "/s.jpg",
						overview: "A searched movie",
						release_date: "2023-07-20",
						vote_average: 6.5,
						genre_ids: [28, 12],
					},
				],
				page: 1,
				total_pages: 3,
				total_results: 42,
			}),
		});

		const result = await searchMovies("action hero", 1);

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/search/movie"),
			expect.objectContaining({
				headers: { Authorization: "Bearer test-api-key" },
			}),
		);
		const url = mockFetch.mock.calls[0][0] as string;
		expect(url).toContain("query=action+hero");
		expect(url).toContain("page=1");
		expect(url).toContain("include_adult=false");
		expect(result.results).toHaveLength(1);
		expect(result.results[0].title).toBe("Search Movie");
		expect(result.total_results).toBe(42);
	});

	it("throws on non-ok response", async () => {
		mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
		await expect(searchMovies("missing", 1)).rejects.toThrow(
			"TMDB API error: 404",
		);
	});
});

describe("searchTvShows", () => {
	it("calls /search/tv with query and page", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [
					{
						id: 200,
						name: "Search Show",
						poster_path: "/ss.jpg",
						overview: "A searched show",
						first_air_date: "2022-03-10",
						vote_average: 8.1,
						genre_ids: [10765],
					},
				],
				page: 2,
				total_pages: 4,
				total_results: 60,
			}),
		});

		const result = await searchTvShows("sci-fi", 2);

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/search/tv"),
			expect.objectContaining({
				headers: { Authorization: "Bearer test-api-key" },
			}),
		);
		const url = mockFetch.mock.calls[0][0] as string;
		expect(url).toContain("query=sci-fi");
		expect(url).toContain("page=2");
		expect(url).toContain("include_adult=false");
		expect(result.results).toHaveLength(1);
		expect(result.results[0].name).toBe("Search Show");
		expect(result.total_results).toBe(60);
	});

	it("throws on non-ok response", async () => {
		mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
		await expect(searchTvShows("broken", 1)).rejects.toThrow(
			"TMDB API error: 500",
		);
	});
});

describe("searchMulti", () => {
	it("queries /search/movie and /search/tv separately and merges results", async () => {
		// Mock /search/movie response
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [
					{
						id: 1,
						title: "Test Movie",
						poster_path: "/m.jpg",
						overview: "...",
						release_date: "2024-01-01",
						vote_average: 8,
						genre_ids: [28],
					},
				],
				page: 1,
				total_pages: 2,
				total_results: 25,
			}),
		});

		// Mock /search/tv response
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				results: [
					{
						id: 3,
						name: "Test Show",
						poster_path: "/t.jpg",
						overview: "...",
						first_air_date: "2023-06-01",
						vote_average: 7,
						genre_ids: [18],
					},
				],
				page: 1,
				total_pages: 1,
				total_results: 15,
			}),
		});

		const result = await searchMulti("test", 1);

		expect(result.results).toHaveLength(2);
		expect(result.results[0].media_type).toBe("movie");
		expect(result.results[1].media_type).toBe("tv");
		expect(result.total_results).toBe(40);
		expect(result.total_pages).toBe(2); // Math.ceil(40 / 20)

		// Verify both endpoints were called
		const calls = mockFetch.mock.calls;
		const urls = calls.slice(-2).map((c) => c[0] as string);
		expect(urls.some((u) => u.includes("/search/movie"))).toBe(true);
		expect(urls.some((u) => u.includes("/search/tv"))).toBe(true);
	});
});
