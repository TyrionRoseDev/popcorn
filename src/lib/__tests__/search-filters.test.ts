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
	it("sorts by rating descending", () => {
		const result = sortResults(mockItems, "rating");
		expect(result[0].tmdbId).toBe(3); // 9.0
		expect(result[2].tmdbId).toBe(2); // 8.1
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

	it("sorts by rating descending for 'relevance'", () => {
		const result = sortResults(mockItems, "relevance");
		expect(result[0].tmdbId).toBe(3); // 9.0
		expect(result[1].tmdbId).toBe(1); // 8.2
		expect(result[2].tmdbId).toBe(2); // 8.1
	});
});
