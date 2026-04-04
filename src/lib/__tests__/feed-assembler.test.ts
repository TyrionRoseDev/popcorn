import { describe, expect, it } from "vitest";
import type { FeedItem } from "../feed-assembler";
import {
	deduplicateFeed,
	interleaveFeed,
	parseCursor,
	serializeCursor,
} from "../feed-assembler";

describe("parseCursor / serializeCursor", () => {
	it("round-trips a cursor", () => {
		const cursor = { genrePages: { "1_movie": 2, "1_tv": 1 }, trendingPage: 3 };
		const serialized = serializeCursor(cursor);
		expect(parseCursor(serialized)).toEqual(cursor);
	});

	it("returns default cursor for undefined input", () => {
		const cursor = parseCursor(undefined);
		expect(cursor.genrePages).toEqual({});
		expect(cursor.trendingPage).toBe(1);
	});
});

describe("deduplicateFeed", () => {
	it("removes duplicate items by tmdbId + mediaType", () => {
		const items: FeedItem[] = [
			{
				tmdbId: 1,
				mediaType: "movie",
				title: "A",
				posterPath: null,
				overview: "",
				year: "2024",
				rating: 7,
				genreIds: [1],
				voteCount: 1000,
				popularity: 50,
				isTrending: false,
			},
			{
				tmdbId: 1,
				mediaType: "movie",
				title: "A dupe",
				posterPath: null,
				overview: "",
				year: "2024",
				rating: 7,
				genreIds: [2],
				voteCount: 1000,
				popularity: 50,
				isTrending: false,
			},
			{
				tmdbId: 1,
				mediaType: "tv",
				title: "A TV",
				posterPath: null,
				overview: "",
				year: "2024",
				rating: 7,
				genreIds: [1],
				voteCount: 1000,
				popularity: 50,
				isTrending: false,
			},
			{
				tmdbId: 2,
				mediaType: "movie",
				title: "B",
				posterPath: null,
				overview: "",
				year: "2024",
				rating: 8,
				genreIds: [1],
				voteCount: 1000,
				popularity: 50,
				isTrending: false,
			},
		];

		const result = deduplicateFeed(items);
		expect(result).toHaveLength(3);
		expect(result[0].title).toBe("A");
		expect(result[1].title).toBe("A TV"); // same tmdbId but different mediaType
		expect(result[2].title).toBe("B");
	});
});

describe("interleaveFeed", () => {
	it("round-robins items across genre buckets", () => {
		const buckets: Record<string, FeedItem[]> = {
			genre_1: [
				{
					tmdbId: 1,
					mediaType: "movie",
					title: "Action 1",
					posterPath: null,
					overview: "",
					year: "2024",
					rating: 7,
					genreIds: [1],
					voteCount: 1000,
					popularity: 50,
					isTrending: false,
				},
				{
					tmdbId: 2,
					mediaType: "movie",
					title: "Action 2",
					posterPath: null,
					overview: "",
					year: "2024",
					rating: 7,
					genreIds: [1],
					voteCount: 1000,
					popularity: 50,
					isTrending: false,
				},
			],
			genre_2: [
				{
					tmdbId: 3,
					mediaType: "movie",
					title: "Comedy 1",
					posterPath: null,
					overview: "",
					year: "2024",
					rating: 7,
					genreIds: [2],
					voteCount: 1000,
					popularity: 50,
					isTrending: false,
				},
				{
					tmdbId: 4,
					mediaType: "movie",
					title: "Comedy 2",
					posterPath: null,
					overview: "",
					year: "2024",
					rating: 7,
					genreIds: [2],
					voteCount: 1000,
					popularity: 50,
					isTrending: false,
				},
			],
		};

		const trending: FeedItem[] = [
			{
				tmdbId: 5,
				mediaType: "movie",
				title: "Trending 1",
				posterPath: null,
				overview: "",
				year: "2024",
				rating: 9,
				genreIds: [1],
				voteCount: 1000,
				popularity: 50,
				isTrending: true,
			},
		];

		const result = interleaveFeed(buckets, trending);

		// Should alternate genres and sprinkle trending
		expect(result.length).toBe(5);
		// First items should alternate between genres
		const genreOfFirst = result[0].genreIds[0];
		const genreOfSecond = result[1].genreIds[0];
		// They should be from different genres (round-robin)
		if (result[0].isTrending === false && result[1].isTrending === false) {
			expect(genreOfFirst).not.toBe(genreOfSecond);
		}
	});

	it("handles empty trending gracefully", () => {
		const buckets: Record<string, FeedItem[]> = {
			genre_1: [
				{
					tmdbId: 1,
					mediaType: "movie",
					title: "A",
					posterPath: null,
					overview: "",
					year: "2024",
					rating: 7,
					genreIds: [1],
					voteCount: 1000,
					popularity: 50,
					isTrending: false,
				},
			],
		};

		const result = interleaveFeed(buckets, []);
		expect(result).toHaveLength(1);
		expect(result[0].isTrending).toBe(false);
	});
});
