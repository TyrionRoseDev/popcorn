import { describe, expect, it, vi } from "vitest";

const mockTmdbFetch = vi.fn();
vi.mock("#/lib/tmdb", () => ({
	tmdbFetch: (...args: unknown[]) => mockTmdbFetch(...args),
}));

import { fetchTitleDetails } from "#/lib/tmdb-title";

function makeTvDetail(overrides: Record<string, unknown> = {}) {
	return {
		id: 1399,
		name: "Breaking Bad",
		tagline: "",
		overview: "A chemistry teacher turns to making meth.",
		first_air_date: "2008-01-20",
		vote_average: 8.9,
		episode_run_time: [47],
		number_of_seasons: 5,
		number_of_episodes: 62,
		status: "Ended",
		genres: [{ id: 18, name: "Drama" }],
		poster_path: "/poster.jpg",
		backdrop_path: "/backdrop.jpg",
		created_by: [{ name: "Vince Gilligan" }],
		seasons: [
			{ season_number: 0, episode_count: 11, name: "Specials" },
			{ season_number: 1, episode_count: 7, name: "Season 1" },
			{ season_number: 2, episode_count: 13, name: "Season 2" },
			{ season_number: 3, episode_count: 13, name: "Season 3" },
			{ season_number: 4, episode_count: 13, name: "Season 4" },
			{ season_number: 5, episode_count: 16, name: "Season 5" },
		],
		...overrides,
	};
}

function makeCredits() {
	return { cast: [], crew: [] };
}
function makeVideos() {
	return { results: [] };
}
function makeContentRatings() {
	return { results: [] };
}

describe("fetchTitleDetails — TV season data", () => {
	it("returns seasonList with season numbers, episode counts, and names", async () => {
		const tvDetail = makeTvDetail();
		mockTmdbFetch
			.mockResolvedValueOnce(tvDetail)
			.mockResolvedValueOnce(makeCredits())
			.mockResolvedValueOnce(makeVideos())
			.mockResolvedValueOnce(makeContentRatings());

		const result = await fetchTitleDetails("tv", 1399);

		expect(result.seasonList).toEqual([
			{ seasonNumber: 0, episodeCount: 11, name: "Specials" },
			{ seasonNumber: 1, episodeCount: 7, name: "Season 1" },
			{ seasonNumber: 2, episodeCount: 13, name: "Season 2" },
			{ seasonNumber: 3, episodeCount: 13, name: "Season 3" },
			{ seasonNumber: 4, episodeCount: 13, name: "Season 4" },
			{ seasonNumber: 5, episodeCount: 16, name: "Season 5" },
		]);
	});

	it("returns undefined seasonList for movies", async () => {
		const movieDetail = {
			id: 550,
			title: "Fight Club",
			tagline: "",
			overview: "An insomniac office worker...",
			release_date: "1999-10-15",
			runtime: 139,
			vote_average: 8.4,
			genres: [{ id: 18, name: "Drama" }],
			poster_path: "/poster.jpg",
			backdrop_path: "/backdrop.jpg",
		};
		mockTmdbFetch
			.mockResolvedValueOnce(movieDetail)
			.mockResolvedValueOnce(makeCredits())
			.mockResolvedValueOnce(makeVideos())
			.mockResolvedValueOnce({ results: [] });

		const result = await fetchTitleDetails("movie", 550);

		expect(result.seasonList).toBeUndefined();
	});
});
