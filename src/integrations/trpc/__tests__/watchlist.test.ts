import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock env
vi.mock("#/env", () => ({
	env: {
		DATABASE_URL: "postgres://localhost:5432/test",
		TMDB_READ_ACCESS_TOKEN: "test-api-key",
	},
}));

// ── Fake DB layer ──────────────────────────────────────────────────────
// Use vi.hoisted so these are available inside vi.mock factories.

const {
	mockSelect,
	mockFrom,
	mockWhere,
	mockInsert,
	mockValues,
	mockReturning,
	mockOnConflictDoNothing,
	mockUpdate,
	mockSet,
	mockDelete,
	mockTransaction,
	mockQueryWatchlistMemberFindFirst,
	mockQueryWatchlistFindFirst,
	mockQueryWatchlistFindMany,
} = vi.hoisted(() => ({
	mockSelect: vi.fn(),
	mockFrom: vi.fn(),
	mockWhere: vi.fn(),
	mockInsert: vi.fn(),
	mockValues: vi.fn(),
	mockReturning: vi.fn(),
	mockOnConflictDoNothing: vi.fn(),
	mockUpdate: vi.fn(),
	mockSet: vi.fn(),
	mockDelete: vi.fn(),
	mockTransaction: vi.fn(),
	mockQueryWatchlistMemberFindFirst: vi.fn(),
	mockQueryWatchlistFindFirst: vi.fn(),
	mockQueryWatchlistFindMany: vi.fn(),
}));

vi.mock("#/db", () => ({
	db: {
		select: mockSelect,
		insert: mockInsert,
		update: mockUpdate,
		delete: mockDelete,
		transaction: mockTransaction,
		query: {
			watchlistMember: { findFirst: mockQueryWatchlistMemberFindFirst },
			watchlist: {
				findFirst: mockQueryWatchlistFindFirst,
				findMany: mockQueryWatchlistFindMany,
			},
		},
	},
}));

// ── Import router + create caller ──────────────────────────────────────
import { createTRPCRouter } from "../init";
import { watchlistRouter } from "../routers/watchlist";

const router = createTRPCRouter({ watchlist: watchlistRouter });

function createCaller(userId: string | null = "user-1") {
	return router.createCaller({ userId });
}

// ── Helpers ────────────────────────────────────────────────────────────
const OWNER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const WATCHLIST_ID = "wl-1";

function resetChainMocks() {
	mockSelect.mockReturnValue({ from: mockFrom });
	mockFrom.mockReturnValue({ where: mockWhere });
	mockInsert.mockReturnValue({ values: mockValues });
	mockValues.mockReturnValue({
		returning: mockReturning,
		onConflictDoNothing: mockOnConflictDoNothing,
	});
	mockUpdate.mockReturnValue({ set: mockSet });
	mockSet.mockReturnValue({ where: mockWhere });
	mockDelete.mockReturnValue({ where: mockWhere });
}

beforeEach(() => {
	vi.clearAllMocks();
	resetChainMocks();
});

// ── create ─────────────────────────────────────────────────────────────
describe("watchlist.create", () => {
	it("creates a watchlist and adds owner as member", async () => {
		const newWatchlist = {
			id: WATCHLIST_ID,
			name: "My List",
			ownerId: OWNER_ID,
			isPublic: false,
			isDefault: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		// transaction receives a callback; we execute it with a fake tx
		mockTransaction.mockImplementation(
			async (cb: (tx: unknown) => Promise<unknown>) => {
				const txInsert = vi.fn();
				const txValues = vi.fn();
				const txReturning = vi.fn();

				txInsert.mockReturnValue({ values: txValues });
				// First call: insert watchlist -> returning
				txValues.mockReturnValueOnce({ returning: txReturning });
				txReturning.mockResolvedValueOnce([newWatchlist]);
				// Second call: insert member
				txValues.mockReturnValueOnce({
					returning: vi.fn(),
					onConflictDoNothing: vi.fn(),
				});

				const tx = { insert: txInsert };
				return cb(tx);
			},
		);

		const caller = createCaller(OWNER_ID);
		const result = await caller.watchlist.create({ name: "My List" });

		expect(result).toEqual(newWatchlist);
		expect(mockTransaction).toHaveBeenCalledTimes(1);
	});

	it("validates name (min 1 char)", async () => {
		const caller = createCaller(OWNER_ID);
		await expect(caller.watchlist.create({ name: "" })).rejects.toThrow();
	});
});

// ── list ───────────────────────────────────────────────────────────────
describe("watchlist.list", () => {
	it("returns watchlists the user is a member of", async () => {
		// select().from().where() returns membership rows
		mockWhere.mockResolvedValueOnce([{ watchlistId: WATCHLIST_ID }]);

		// query.watchlist.findMany returns watchlists with items/members
		mockQueryWatchlistFindMany.mockResolvedValueOnce([
			{
				id: WATCHLIST_ID,
				name: "My List",
				ownerId: OWNER_ID,
				isPublic: false,
				isDefault: false,
				items: [{ tmdbId: 550, mediaType: "movie" }],
				members: [
					{
						user: {
							id: OWNER_ID,
							username: "alice",
							avatarUrl: null,
						},
					},
				],
			},
		]);

		const caller = createCaller(OWNER_ID);
		const result = await caller.watchlist.list();

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(WATCHLIST_ID);
		expect(result[0].itemCount).toBe(1);
		expect(result[0].memberCount).toBe(1);
	});

	it("returns empty array when user has no watchlists", async () => {
		// No memberships found
		mockWhere.mockResolvedValueOnce([]);

		const caller = createCaller(OWNER_ID);
		const result = await caller.watchlist.list();

		expect(result).toEqual([]);
	});
});

// ── get ────────────────────────────────────────────────────────────────
describe("watchlist.get", () => {
	it("returns watchlist with items and members", async () => {
		// query.watchlistMember.findFirst — membership check
		mockQueryWatchlistMemberFindFirst.mockResolvedValueOnce({
			watchlistId: WATCHLIST_ID,
			userId: OWNER_ID,
			role: "owner",
		});

		// query.watchlist.findFirst — full watchlist
		mockQueryWatchlistFindFirst.mockResolvedValueOnce({
			id: WATCHLIST_ID,
			name: "My List",
			ownerId: OWNER_ID,
			isPublic: false,
			isDefault: false,
			items: [
				{
					tmdbId: 550,
					mediaType: "movie",
					addedByUser: {
						id: OWNER_ID,
						username: "alice",
						avatarUrl: null,
					},
				},
			],
			members: [
				{
					user: { id: OWNER_ID, username: "alice", avatarUrl: null },
					role: "owner",
				},
			],
		});

		const caller = createCaller(OWNER_ID);
		const result = await caller.watchlist.get({
			watchlistId: WATCHLIST_ID,
		});

		expect(result.id).toBe(WATCHLIST_ID);
		expect(result.items).toHaveLength(1);
		expect(result.members).toHaveLength(1);
		expect(result.userRole).toBe("owner");
	});

	it("throws FORBIDDEN for non-members on private watchlist", async () => {
		// No membership found
		mockQueryWatchlistMemberFindFirst.mockResolvedValueOnce(null);

		// Watchlist exists but is private
		mockQueryWatchlistFindFirst.mockResolvedValueOnce({
			id: WATCHLIST_ID,
			name: "Private List",
			ownerId: OWNER_ID,
			isPublic: false,
			isDefault: false,
			items: [],
			members: [],
		});

		const caller = createCaller(OTHER_USER_ID);

		try {
			await caller.watchlist.get({ watchlistId: WATCHLIST_ID });
			expect.unreachable("Should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCError);
			expect((e as TRPCError).code).toBe("FORBIDDEN");
		}
	});
});

// ── delete ─────────────────────────────────────────────────────────────
describe("watchlist.delete", () => {
	it("throws BAD_REQUEST for default watchlist", async () => {
		// assertOwner: membership found with owner role
		mockQueryWatchlistMemberFindFirst.mockResolvedValueOnce({
			watchlistId: WATCHLIST_ID,
			userId: OWNER_ID,
			role: "owner",
		});

		// query.watchlist.findFirst — default watchlist
		mockQueryWatchlistFindFirst.mockResolvedValueOnce({
			id: WATCHLIST_ID,
			name: "Default",
			ownerId: OWNER_ID,
			isPublic: false,
			isDefault: true,
		});

		const caller = createCaller(OWNER_ID);

		try {
			await caller.watchlist.delete({ watchlistId: WATCHLIST_ID });
			expect.unreachable("Should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCError);
			expect((e as TRPCError).code).toBe("BAD_REQUEST");
		}
	});

	it("throws FORBIDDEN for non-owners", async () => {
		// assertOwner: no owner membership
		mockQueryWatchlistMemberFindFirst.mockResolvedValueOnce(null);

		const caller = createCaller(OTHER_USER_ID);

		try {
			await caller.watchlist.delete({ watchlistId: WATCHLIST_ID });
			expect.unreachable("Should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCError);
			expect((e as TRPCError).code).toBe("FORBIDDEN");
		}
	});
});

// ── addItem ────────────────────────────────────────────────────────────
describe("watchlist.addItem", () => {
	it("adds an item, idempotent on conflict", async () => {
		// assertMember: membership exists
		mockQueryWatchlistMemberFindFirst.mockResolvedValueOnce({
			watchlistId: WATCHLIST_ID,
			userId: OWNER_ID,
			role: "owner",
		});

		// insert().values().onConflictDoNothing()
		mockOnConflictDoNothing.mockResolvedValueOnce(undefined);

		const caller = createCaller(OWNER_ID);

		// Should not throw even on conflict
		await expect(
			caller.watchlist.addItem({
				watchlistId: WATCHLIST_ID,
				tmdbId: 550,
				mediaType: "movie",
			}),
		).resolves.not.toThrow();

		expect(mockInsert).toHaveBeenCalledTimes(1);
		expect(mockOnConflictDoNothing).toHaveBeenCalledTimes(1);
	});
});

// ── removeItem ─────────────────────────────────────────────────────────
describe("watchlist.removeItem", () => {
	it("throws FORBIDDEN for non-owners", async () => {
		// assertOwner: no owner membership
		mockQueryWatchlistMemberFindFirst.mockResolvedValueOnce(null);

		const caller = createCaller(OTHER_USER_ID);

		try {
			await caller.watchlist.removeItem({
				watchlistId: WATCHLIST_ID,
				tmdbId: 550,
				mediaType: "movie",
			});
			expect.unreachable("Should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCError);
			expect((e as TRPCError).code).toBe("FORBIDDEN");
		}
	});
});

// ── markWatched ────────────────────────────────────────────────────────
describe("watchlist.markWatched", () => {
	it("toggles watched status", async () => {
		// assertMember: membership found
		mockQueryWatchlistMemberFindFirst.mockResolvedValueOnce({
			watchlistId: WATCHLIST_ID,
			userId: OWNER_ID,
			role: "owner",
		});

		// update().set().where() resolves
		mockWhere.mockResolvedValueOnce(undefined);

		const caller = createCaller(OWNER_ID);

		await expect(
			caller.watchlist.markWatched({
				watchlistId: WATCHLIST_ID,
				tmdbId: 550,
				mediaType: "movie",
				watched: true,
			}),
		).resolves.not.toThrow();

		expect(mockUpdate).toHaveBeenCalledTimes(1);
		expect(mockSet).toHaveBeenCalledTimes(1);
	});
});

// ── addMember ──────────────────────────────────────────────────────────
describe("watchlist.addMember", () => {
	it("adds a member, idempotent on conflict", async () => {
		// assertOwner: owner membership found
		mockQueryWatchlistMemberFindFirst.mockResolvedValueOnce({
			watchlistId: WATCHLIST_ID,
			userId: OWNER_ID,
			role: "owner",
		});

		// insert().values().onConflictDoNothing()
		mockOnConflictDoNothing.mockResolvedValueOnce(undefined);

		const caller = createCaller(OWNER_ID);

		await expect(
			caller.watchlist.addMember({
				watchlistId: WATCHLIST_ID,
				userId: OTHER_USER_ID,
			}),
		).resolves.not.toThrow();

		expect(mockInsert).toHaveBeenCalledTimes(1);
		expect(mockOnConflictDoNothing).toHaveBeenCalledTimes(1);
	});

	it("throws FORBIDDEN for non-owners", async () => {
		// assertOwner: no owner membership
		mockQueryWatchlistMemberFindFirst.mockResolvedValueOnce(null);

		const caller = createCaller(OTHER_USER_ID);

		try {
			await caller.watchlist.addMember({
				watchlistId: WATCHLIST_ID,
				userId: "user-3",
			});
			expect.unreachable("Should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCError);
			expect((e as TRPCError).code).toBe("FORBIDDEN");
		}
	});
});

// ── removeMember ───────────────────────────────────────────────────────
describe("watchlist.removeMember", () => {
	it("throws BAD_REQUEST when removing self as owner", async () => {
		// assertOwner: owner membership found
		mockQueryWatchlistMemberFindFirst.mockResolvedValueOnce({
			watchlistId: WATCHLIST_ID,
			userId: OWNER_ID,
			role: "owner",
		});

		const caller = createCaller(OWNER_ID);

		try {
			await caller.watchlist.removeMember({
				watchlistId: WATCHLIST_ID,
				userId: OWNER_ID,
			});
			expect.unreachable("Should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCError);
			expect((e as TRPCError).code).toBe("BAD_REQUEST");
		}
	});
});
