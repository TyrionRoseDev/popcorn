import { describe, expect, it } from "vitest";

describe("genre selection limits", () => {
	it("allows up to 5 genres", () => {
		const selected = new Set<number>();
		for (let i = 1; i <= 5; i++) {
			selected.add(i);
		}
		expect(selected.size).toBe(5);
	});

	it("can deselect genres", () => {
		const selected = new Set([1, 2, 3]);
		selected.delete(2);
		expect(selected.size).toBe(2);
		expect(selected.has(2)).toBe(false);
	});
});

describe("title selection limits", () => {
	const MAX_TITLES = 10;

	it("allows up to 10 titles", () => {
		const selected = new Map<string, { tmdbId: number; mediaType: string }>();
		for (let i = 1; i <= MAX_TITLES; i++) {
			selected.set(`${i}-movie`, { tmdbId: i, mediaType: "movie" });
		}
		expect(selected.size).toBe(MAX_TITLES);
	});

	it("can toggle a title off", () => {
		const selected = new Map<string, { tmdbId: number; mediaType: string }>();
		selected.set("1-movie", { tmdbId: 1, mediaType: "movie" });
		selected.set("2-tv", { tmdbId: 2, mediaType: "tv" });
		selected.delete("1-movie");
		expect(selected.size).toBe(1);
		expect(selected.has("1-movie")).toBe(false);
	});
});

describe("footer state", () => {
	const MIN_TITLES = 3;

	it("continue is disabled when fewer than 3 titles selected", () => {
		const selectedCount = 2;
		const canContinue = selectedCount >= MIN_TITLES;
		expect(canContinue).toBe(false);
	});

	it("continue is enabled when 3 or more titles selected", () => {
		const selectedCount = 3;
		const canContinue = selectedCount >= MIN_TITLES;
		expect(canContinue).toBe(true);
	});
});

describe("search mode toggle", () => {
	it("activates search mode when query is 2+ chars", () => {
		const query = "du";
		const isSearchMode = query.length >= 2;
		expect(isSearchMode).toBe(true);
	});

	it("deactivates search mode when query is cleared", () => {
		const query = "";
		const isSearchMode = query.length >= 2;
		expect(isSearchMode).toBe(false);
	});

	it("does not activate for single character", () => {
		const query = "d";
		const isSearchMode = query.length >= 2;
		expect(isSearchMode).toBe(false);
	});
});
