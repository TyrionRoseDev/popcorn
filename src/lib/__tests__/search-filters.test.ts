import { describe, expect, it } from "vitest";
import type { FeedItem } from "#/lib/feed-assembler";
import { filterResults, sortResults } from "#/lib/search-filters";

const mockItems: FeedItem[] = [
	{
		tmdbId: 1,
		mediaType: "movie",
		title: "Batman Begins",
		posterPath: "/a.jpg",
		overview: "Origin story",
		year: "2005",
		rating: 8.2,
		voteCount: 15000,
		popularity: 80,
		genreIds: [28, 80],
		isTrending: false,
	},
	{
		tmdbId: 2,
		mediaType: "tv",
		title: "Batman: Caped Crusader",
		posterPath: "/b.jpg",
		overview: "Animated series",
		year: "2024",
		rating: 8.1,
		voteCount: 500,
		popularity: 60,
		genreIds: [16, 28],
		isTrending: false,
	},
	{
		tmdbId: 3,
		mediaType: "movie",
		title: "The Dark Knight",
		posterPath: "/c.jpg",
		overview: "Joker chaos",
		year: "2008",
		rating: 9.0,
		voteCount: 25000,
		popularity: 120,
		genreIds: [28, 18],
		isTrending: false,
	},
];

describe("filterResults", () => {
	it("filters by media type 'movie'", () => {
		const result = filterResults(mockItems, { type: "movie" });
		expect(result).toHaveLength(2);
		expect(result.every((r) => r.mediaType === "movie")).toBe(true);
	});

	it("filters by media type 'tv'", () => {
		const result = filterResults(mockItems, { type: "tv" });
		expect(result).toHaveLength(1);
		expect(result[0].tmdbId).toBe(2);
	});

	it("returns all when type is 'all'", () => {
		const result = filterResults(mockItems, { type: "all" });
		expect(result).toHaveLength(3);
	});

	it("filters by genre (unified genre ID mapped to TMDB IDs)", () => {
		// Unified genre 5 = Crime, movieGenreId = 80
		const result = filterResults(mockItems, { type: "all", genre: 5 });
		expect(result).toHaveLength(1);
		expect(result[0].tmdbId).toBe(1);
	});

	it("filters by year range", () => {
		const result = filterResults(mockItems, { type: "all", yearMin: 2008 });
		expect(result).toHaveLength(2);
	});

	it("filters by minimum rating", () => {
		const result = filterResults(mockItems, { type: "all", rating: 8.5 });
		expect(result).toHaveLength(1);
		expect(result[0].tmdbId).toBe(3);
	});

	it("combines multiple filters", () => {
		const result = filterResults(mockItems, {
			type: "movie",
			yearMin: 2006,
			rating: 8.5,
		});
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("The Dark Knight");
	});
});

describe("sortResults", () => {
	it("sorts by weighted rating descending", () => {
		const result = sortResults(mockItems, "rating");
		expect(result[0].tmdbId).toBe(3); // 9.0 with 25k votes
		expect(result[2].tmdbId).toBe(2); // 8.1 with 500 votes
	});

	it("penalises low-vote-count titles in rating sort", () => {
		const items: FeedItem[] = [
			{
				tmdbId: 10,
				mediaType: "movie",
				title: "Obscure Film",
				posterPath: null,
				overview: "",
				year: "2020",
				rating: 10,
				voteCount: 2,
				popularity: 1,
				genreIds: [],
				isTrending: false,
			},
			{
				tmdbId: 11,
				mediaType: "movie",
				title: "Popular Film",
				posterPath: null,
				overview: "",
				year: "2020",
				rating: 8.5,
				voteCount: 10000,
				popularity: 200,
				genreIds: [],
				isTrending: false,
			},
		];
		const result = sortResults(items, "rating");
		// Popular Film should beat Obscure Film despite lower raw rating
		expect(result[0].tmdbId).toBe(11);
	});

	it("sorts by popularity descending", () => {
		const result = sortResults(mockItems, "popularity");
		expect(result[0].tmdbId).toBe(3); // popularity 120
		expect(result[1].tmdbId).toBe(1); // popularity 80
		expect(result[2].tmdbId).toBe(2); // popularity 60
	});

	it("sorts by newest first", () => {
		const result = sortResults(mockItems, "newest");
		expect(result[0].year).toBe("2024");
		expect(result[2].year).toBe("2005");
	});

	it("sorts by oldest first", () => {
		const result = sortResults(mockItems, "oldest");
		expect(result[0].year).toBe("2005");
		expect(result[2].year).toBe("2024");
	});

	it("boosts exact title matches for relevance", () => {
		const items: FeedItem[] = [
			{
				tmdbId: 20,
				mediaType: "movie",
				title: "Sex Toy Stories",
				posterPath: null,
				overview: "",
				year: "2020",
				rating: 10,
				voteCount: 1,
				popularity: 1,
				genreIds: [],
				isTrending: false,
			},
			{
				tmdbId: 21,
				mediaType: "movie",
				title: "Toy Story",
				posterPath: null,
				overview: "",
				year: "1995",
				rating: 8.3,
				voteCount: 15000,
				popularity: 100,
				genreIds: [],
				isTrending: false,
			},
		];
		const result = sortResults(items, "relevance", "toy story");
		expect(result[0].tmdbId).toBe(21); // exact match boosted
	});
});
