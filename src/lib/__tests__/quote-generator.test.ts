import { describe, expect, it, vi } from "vitest";

vi.mock("#/db", () => ({
	db: {
		query: {
			titleQuote: {
				findFirst: vi.fn(),
			},
		},
		insert: vi.fn(),
	},
}));

vi.mock("#/db/schema", () => ({
	titleQuote: {},
}));

import { __test } from "#/lib/quote-generator";

describe("parseFirstQuote", () => {
	it("prefers AFI-ranked quotes over other candidates", () => {
		const wikitext = `
==Buzz Lightyear==
* '''To infinity and beyond!'''
* Ranked #92 on AFI's 100 Years...100 Movie Quotes

==Woody==
* You are a toy!
`;

		expect(__test.parseFirstQuote(wikitext)).toEqual({
			quote: "To infinity and beyond!",
			character: "Buzz Lightyear",
		});
	});

	it("falls back to image captions when no AFI ranking exists", () => {
		const wikitext = `
==Buzz Lightyear==
[[File:Buzz.jpg|thumb|right|"To infinity and beyond!" — Buzz Lightyear]]
* Somewhere, in all that pad of stuffing, is a toy who taught me that life's only worth living if you're being loved by a kid.
`;

		expect(__test.parseFirstQuote(wikitext)).toEqual({
			quote: "To infinity and beyond!",
			character: "Buzz Lightyear",
		});
	});
});
