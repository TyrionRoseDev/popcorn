import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSelect, mockInsert, mockDelete, mockUpdate } = vi.hoisted(() => ({
	mockSelect: vi.fn(),
	mockInsert: vi.fn(),
	mockDelete: vi.fn(),
	mockUpdate: vi.fn(),
}));

vi.mock("#/db", () => ({
	db: {
		select: mockSelect,
		insert: mockInsert,
		delete: mockDelete,
		update: mockUpdate,
		query: {
			friendship: { findFirst: vi.fn(), findMany: vi.fn() },
			block: { findFirst: vi.fn() },
			watchlist: { findFirst: vi.fn() },
			watchlistMember: { findFirst: vi.fn(), findMany: vi.fn() },
		},
		transaction: vi.fn(),
	},
}));

vi.mock("#/integrations/trpc/routers/notification", () => ({
	createNotification: vi.fn(),
}));

import { createTRPCRouter } from "#/integrations/trpc/init";
import { friendRouter } from "#/integrations/trpc/routers/friend";

const router = createTRPCRouter({ friend: friendRouter });

function createCaller(userId: string | null = "user-1") {
	return router.createCaller({ userId });
}

describe("friend router", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("list", () => {
		it("requires authentication", async () => {
			const caller = createCaller(null);
			await expect(caller.friend.list()).rejects.toThrow("UNAUTHORIZED");
		});
	});

	describe("pendingRequests", () => {
		it("requires authentication", async () => {
			const caller = createCaller(null);
			await expect(caller.friend.pendingRequests()).rejects.toThrow(
				"UNAUTHORIZED",
			);
		});
	});

	describe("sendRequest", () => {
		it("requires authentication", async () => {
			const caller = createCaller(null);
			await expect(
				caller.friend.sendRequest({ userId: "user-2" }),
			).rejects.toThrow("UNAUTHORIZED");
		});
	});

	describe("acceptRequest", () => {
		it("requires authentication", async () => {
			const caller = createCaller(null);
			await expect(
				caller.friend.acceptRequest({ friendshipId: "f-1" }),
			).rejects.toThrow("UNAUTHORIZED");
		});
	});
});
