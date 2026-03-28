import { describe, expect, it } from "vitest";
import type { FeedItem } from "../feed-assembler";
import { interleaveShuffleFeed, parseShuffleCursor, serializeShuffleCursor } from "../shuffle-feed";

function makeFeedItem(overrides: Partial<FeedItem> & { tmdbId: number }): FeedItem {
  return {
    mediaType: "movie",
    title: `Title ${overrides.tmdbId}`,
    posterPath: null,
    overview: "Synopsis",
    year: "2024",
    rating: 7,
    genreIds: [1],
    isTrending: false,
    ...overrides,
  };
}

describe("interleaveShuffleFeed", () => {
  it("interleaves three sources at 50/30/20 ratio", () => {
    const taste = Array.from({ length: 10 }, (_, i) => makeFeedItem({ tmdbId: i + 1 }));
    const trending = Array.from({ length: 6 }, (_, i) => makeFeedItem({ tmdbId: i + 100, isTrending: true }));
    const discovery = Array.from({ length: 4 }, (_, i) => makeFeedItem({ tmdbId: i + 200 }));

    const result = interleaveShuffleFeed(taste, trending, discovery);
    expect(result.length).toBe(20);

    const tasteCount = result.filter((item) => item.tmdbId < 100).length;
    const trendingCount = result.filter((item) => item.tmdbId >= 100 && item.tmdbId < 200).length;
    const discoveryCount = result.filter((item) => item.tmdbId >= 200).length;

    expect(tasteCount).toBe(10);
    expect(trendingCount).toBe(6);
    expect(discoveryCount).toBe(4);
  });

  it("handles empty sources gracefully", () => {
    const taste = Array.from({ length: 5 }, (_, i) => makeFeedItem({ tmdbId: i + 1 }));
    const result = interleaveShuffleFeed(taste, [], []);
    expect(result.length).toBe(5);
  });

  it("deduplicates across sources", () => {
    const taste = [makeFeedItem({ tmdbId: 1 })];
    const trending = [makeFeedItem({ tmdbId: 1, isTrending: true })];
    const discovery = [makeFeedItem({ tmdbId: 2 })];

    const result = interleaveShuffleFeed(taste, trending, discovery);
    const ids = result.map((r) => r.tmdbId);
    expect(ids.filter((id) => id === 1).length).toBe(1);
  });
});

describe("parseShuffleCursor / serializeShuffleCursor", () => {
  it("round-trips a cursor", () => {
    const cursor = { tastePage: 2, trendingPage: 3, discoveryPage: 1 };
    expect(parseShuffleCursor(serializeShuffleCursor(cursor))).toEqual(cursor);
  });

  it("returns default for undefined", () => {
    expect(parseShuffleCursor(undefined)).toEqual({
      tastePage: 1, trendingPage: 1, discoveryPage: 1,
    });
  });
});
