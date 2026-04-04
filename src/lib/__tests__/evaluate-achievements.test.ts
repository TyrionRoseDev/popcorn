import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock env first
vi.mock("#/env", () => ({
	env: {
		DATABASE_URL: "postgres://localhost:5432/test",
	},
}));

// ── Fake DB layer ──────────────────────────────────────────────────────
// Use vi.hoisted so mock variables are available inside vi.mock factories
const {
	mockWhere,
	mockFrom,
	mockSelect,
	mockSelectDistinct,
	mockOnConflictDoNothing,
	mockValues,
	mockInsert,
	mockExecute,
	mockQueryWatchlistItemFindMany,
} = vi.hoisted(() => {
	const mockWhere = vi.fn();
	const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
	const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
	const mockSelectDistinct = vi.fn().mockReturnValue({ from: mockFrom });
	const mockOnConflictDoNothing = vi.fn();
	const mockValues = vi
		.fn()
		.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
	const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
	const mockExecute = vi.fn();
	const mockQueryWatchlistItemFindMany = vi.fn();
	return {
		mockWhere,
		mockFrom,
		mockSelect,
		mockSelectDistinct,
		mockOnConflictDoNothing,
		mockValues,
		mockInsert,
		mockExecute,
		mockQueryWatchlistItemFindMany,
	};
});

vi.mock("#/db", () => ({
	db: {
		select: mockSelect,
		selectDistinct: mockSelectDistinct,
		insert: mockInsert,
		execute: mockExecute,
		query: {
			watchlistItem: {
				findMany: mockQueryWatchlistItemFindMany,
			},
		},
	},
}));

import { evaluateAchievements } from "../evaluate-achievements";

// ── Helpers ────────────────────────────────────────────────────────────

const USER_ID = "user-1";

function resetMocks() {
	mockWhere.mockReset();
	mockFrom.mockReset();
	mockSelect.mockReset();
	mockSelectDistinct.mockReset();
	mockOnConflictDoNothing.mockReset();
	mockValues.mockReset();
	mockInsert.mockReset();
	mockExecute.mockReset();
	mockQueryWatchlistItemFindMany.mockReset();

	// Restore default chain behaviors
	mockOnConflictDoNothing.mockResolvedValue(undefined);
	mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
	mockInsert.mockReturnValue({ values: mockValues });

	mockWhere.mockResolvedValue([]);
	mockFrom.mockReturnValue({ where: mockWhere });
	mockSelect.mockReturnValue({ from: mockFrom });
	mockSelectDistinct.mockReturnValue({ from: mockFrom });

	mockExecute.mockResolvedValue({ rows: [{ value: "0" }] });
	mockQueryWatchlistItemFindMany.mockResolvedValue([]);
}

beforeEach(() => {
	resetMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────

describe("evaluateAchievements", () => {
	describe("already-earned achievements", () => {
		it("returns empty array when user already has the achievement", async () => {
			// Simulate earnedAchievement query returning the achievement already earned
			mockWhere.mockResolvedValueOnce([{ achievementId: "first-watch" }]);
			// All subsequent count queries return threshold values — but achievement is already earned
			mockWhere.mockResolvedValue([{ value: 5 }]);

			const result = await evaluateAchievements(USER_ID, "watched", {
				watchedAt: new Date(),
			});

			expect(result).not.toContain("first-watch");
		});

		it("returns empty array when no conditions are met", async () => {
			// No earned achievements
			mockWhere.mockResolvedValueOnce([]);
			// All subsequent counts return 0
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "watched", {
				watchedAt: new Date("2024-01-01T14:00:00"),
			});

			expect(result).toEqual([]);
		});
	});

	describe("watchedCount condition", () => {
		it("returns first-watch achievement when watchedCount threshold is met", async () => {
			// earnedAchievement query: no achievements yet
			mockWhere.mockResolvedValueOnce([]);

			// For each achievement in context "watched", checkCondition runs queries.
			// first-watch: watchedCount query => 1 (threshold met)
			mockWhere.mockResolvedValueOnce([{ value: 1 }]);
			// All remaining queries return 0 / empty
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "watched", {
				watchedAt: new Date("2024-01-01T14:00:00"),
			});

			expect(result).toContain("first-watch");
		});

		it("does not return first-watch when count is 0", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "watched", {
				watchedAt: new Date("2024-01-01T14:00:00"),
			});

			expect(result).not.toContain("first-watch");
		});
	});

	describe("watchedAtTime condition", () => {
		it("returns night-owl when watched between 00:00 and 04:59", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			// 01:30 local time
			const midnightWatch = new Date("2024-01-02T01:30:00");
			const result = await evaluateAchievements(USER_ID, "watched", {
				watchedAt: midnightWatch,
			});

			expect(result).toContain("night-owl");
		});

		it("does not return night-owl when watched in the afternoon", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const afternoonWatch = new Date("2024-01-01T15:00:00");
			const result = await evaluateAchievements(USER_ID, "watched", {
				watchedAt: afternoonWatch,
			});

			expect(result).not.toContain("night-owl");
		});

		it("returns early-bird when watched between 05:00 and 11:59", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const morningWatch = new Date("2024-01-01T08:00:00");
			const result = await evaluateAchievements(USER_ID, "watched", {
				watchedAt: morningWatch,
			});

			expect(result).toContain("early-bird");
		});
	});

	describe("friendCount condition", () => {
		it("returns plus-one when user gains their first friend", async () => {
			mockWhere.mockResolvedValueOnce([]);
			// friendCount query returns 1
			mockWhere.mockResolvedValueOnce([{ value: 1 }]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "friend");

			expect(result).toContain("plus-one");
		});

		it("does not return plus-one when user has no friends", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "friend");

			expect(result).not.toContain("plus-one");
		});
	});

	describe("onboardingCompleted condition", () => {
		it("returns ticket-holder when onboarding is completed", async () => {
			mockWhere.mockResolvedValueOnce([]);
			// onboardingCompleted query
			mockWhere.mockResolvedValueOnce([{ onboardingCompleted: true }]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "onboarding");

			expect(result).toContain("ticket-holder");
		});

		it("does not return ticket-holder when onboarding is not done", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValueOnce([{ onboardingCompleted: false }]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "onboarding");

			expect(result).not.toContain("ticket-holder");
		});
	});

	describe("sentRecommendation condition", () => {
		it("returns word-of-mouth when user has sent a recommendation", async () => {
			mockWhere.mockResolvedValueOnce([]);
			// sentRecommendation count returns 1
			mockWhere.mockResolvedValueOnce([{ value: 1 }]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "recommendation_sent");

			expect(result).toContain("word-of-mouth");
		});
	});

	describe("firstReview condition", () => {
		it("returns opening-review when user leaves their first review", async () => {
			mockWhere.mockResolvedValueOnce([]);
			// firstReview count returns 1
			mockWhere.mockResolvedValueOnce([{ value: 1 }]);
			// reviewCount (threshold 10) also returns 1 — not met
			mockWhere.mockResolvedValueOnce([{ value: 1 }]);
			// achievementCount
			mockWhere.mockResolvedValue([{ value: 0 }]);
			mockExecute.mockResolvedValue({ rows: [{ value: "0" }] });

			const result = await evaluateAchievements(USER_ID, "review");

			expect(result).toContain("opening-review");
		});

		it("does not return five-star-critic when only 1 review exists", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValueOnce([{ value: 1 }]); // firstReview
			mockWhere.mockResolvedValueOnce([{ value: 1 }]); // reviewCount (< 10)
			mockWhere.mockResolvedValue([{ value: 0 }]);
			mockExecute.mockResolvedValue({ rows: [{ value: "0" }] });

			const result = await evaluateAchievements(USER_ID, "review");

			expect(result).not.toContain("five-star-critic");
		});
	});

	describe("watchlistCount condition", () => {
		it("returns coming-attractions when first watchlist is created", async () => {
			mockWhere.mockResolvedValueOnce([]);
			// watchlistCount returns 1
			mockWhere.mockResolvedValueOnce([{ value: 1 }]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "watchlist_created");

			expect(result).toContain("coming-attractions");
		});
	});

	describe("joinedCollabWatchlist condition", () => {
		it("returns shared-popcorn when user joins a watchlist", async () => {
			mockWhere.mockResolvedValueOnce([]);
			// watchlistMember count returns 1
			mockWhere.mockResolvedValueOnce([{ value: 1 }]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "watchlist_joined");

			expect(result).toContain("shared-popcorn");
		});
	});

	describe("totalSwipes condition", () => {
		it("returns channel-surfer when 50 swipes are reached", async () => {
			mockWhere.mockResolvedValueOnce([]);
			// totalSwipes returns 50
			mockWhere.mockResolvedValueOnce([{ value: 50 }]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "swipe");

			expect(result).toContain("channel-surfer");
		});

		it("does not return channel-surfer with fewer than 50 swipes", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValueOnce([{ value: 49 }]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(USER_ID, "swipe");

			expect(result).not.toContain("channel-surfer");
		});
	});

	describe("shuffleToWatchlist condition", () => {
		it("returns showtime-shuffle when a title is swiped yes", async () => {
			mockWhere.mockResolvedValueOnce([]);
			// shuffleToWatchlist (action=yes) count returns 1
			mockWhere.mockResolvedValueOnce([{ value: 1 }]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			const result = await evaluateAchievements(
				USER_ID,
				"shuffle_to_watchlist",
			);

			expect(result).toContain("showtime-shuffle");
		});
	});

	describe("clearedWatchlist condition", () => {
		it("returns completionist when specific watchlist is fully watched (5+ items)", async () => {
			mockWhere.mockResolvedValueOnce([]);
			// All count queries (watchedCount etc.) return 0
			mockWhere.mockResolvedValue([{ value: 0 }]);
			// isWatchlistCleared: findMany returns 5 watched items
			mockQueryWatchlistItemFindMany.mockResolvedValueOnce([
				{ watched: true },
				{ watched: true },
				{ watched: true },
				{ watched: true },
				{ watched: true },
			]);

			const result = await evaluateAchievements(USER_ID, "watched", {
				watchedAt: new Date("2024-01-01T14:00:00"),
				watchlistId: "watchlist-abc",
			});

			expect(result).toContain("completionist");
		});

		it("does not return completionist when watchlist has fewer than 5 items", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValue([{ value: 0 }]);
			// Only 3 items — below minItems of 5
			mockQueryWatchlistItemFindMany.mockResolvedValueOnce([
				{ watched: true },
				{ watched: true },
				{ watched: true },
			]);

			const result = await evaluateAchievements(USER_ID, "watched", {
				watchedAt: new Date("2024-01-01T14:00:00"),
				watchlistId: "watchlist-abc",
			});

			expect(result).not.toContain("completionist");
		});

		it("does not return completionist when not all items are watched", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValue([{ value: 0 }]);
			// 5 items but one is not watched
			mockQueryWatchlistItemFindMany.mockResolvedValueOnce([
				{ watched: true },
				{ watched: true },
				{ watched: true },
				{ watched: true },
				{ watched: false },
			]);

			const result = await evaluateAchievements(USER_ID, "watched", {
				watchedAt: new Date("2024-01-01T14:00:00"),
				watchlistId: "watchlist-abc",
			});

			expect(result).not.toContain("completionist");
		});
	});

	describe("insert is called for newly earned achievements", () => {
		it("calls db.insert with earnedAchievement data when condition is met", async () => {
			mockWhere.mockResolvedValueOnce([]);
			// watchlistCount returns 1
			mockWhere.mockResolvedValueOnce([{ value: 1 }]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			await evaluateAchievements(USER_ID, "watchlist_created");

			expect(mockInsert).toHaveBeenCalled();
			expect(mockValues).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: USER_ID,
					achievementId: "coming-attractions",
				}),
			);
			expect(mockOnConflictDoNothing).toHaveBeenCalled();
		});

		it("does not call db.insert when no conditions are met", async () => {
			mockWhere.mockResolvedValueOnce([]);
			mockWhere.mockResolvedValue([{ value: 0 }]);

			await evaluateAchievements(USER_ID, "watchlist_created");

			expect(mockInsert).not.toHaveBeenCalled();
		});
	});
});
