import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/env", () => ({
	env: {
		DATABASE_URL: "postgres://localhost:5432/test",
		TMDB_READ_ACCESS_TOKEN: "test-api-key",
	},
}));

const { mockSelect, mockWhere, mockInsert, mockUpdate, mockDelete, query } =
	vi.hoisted(() => ({
		mockSelect: vi.fn(),
		mockWhere: vi.fn(),
		mockInsert: vi.fn(),
		mockUpdate: vi.fn(),
		mockDelete: vi.fn(),
		query: {
			watchEvent: { findFirst: vi.fn() },
			watchEventCompanion: { findMany: vi.fn() },
			userTitle: { findFirst: vi.fn() },
			user: { findFirst: vi.fn() },
		},
	}));

vi.mock("#/db", () => ({
	db: {
		select: mockSelect,
		insert: mockInsert,
		update: mockUpdate,
		delete: mockDelete,
		query,
	},
}));

vi.mock("#/integrations/trpc/routers/notification", () => ({
	createNotification: vi.fn(),
}));

vi.mock("#/lib/evaluate-achievements", () => ({
	evaluateAchievements: vi.fn().mockResolvedValue([]),
}));

vi.mock("#/lib/tmdb-title", () => ({
	fetchTitleDetails: vi.fn().mockResolvedValue({ tmdbGenreIds: [] }),
}));

import { createTRPCRouter } from "#/integrations/trpc/init";
import { createNotification } from "#/integrations/trpc/routers/notification";
import { watchEventRouter } from "#/integrations/trpc/routers/watch-event";

const router = createTRPCRouter({ watchEvent: watchEventRouter });
const caller = router.createCaller({ userId: "user-1" });

async function expectForbidden(promise: Promise<unknown>) {
	try {
		await promise;
		expect.unreachable("Should have thrown");
	} catch (e) {
		expect(e).toBeInstanceOf(TRPCError);
		expect((e as TRPCError).code).toBe("FORBIDDEN");
	}
}

function expectNothingWritten() {
	expect(mockInsert).not.toHaveBeenCalled();
	expect(mockUpdate).not.toHaveBeenCalled();
	expect(mockDelete).not.toHaveBeenCalled();
	expect(createNotification).not.toHaveBeenCalled();
}

describe("watchEvent companions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSelect.mockReturnValue({ from: () => ({ where: mockWhere }) });
		mockWhere.mockResolvedValue([]);
	});

	it("create rejects a companion who is not an accepted friend", async () => {
		await expectForbidden(
			caller.watchEvent.create({
				tmdbId: 550,
				mediaType: "movie",
				titleName: "Fight Club",
				companions: [{ friendId: "stranger", name: "Stranger" }],
			}),
		);
		expectNothingWritten();
	});

	it("update rejects a newly added companion who is not an accepted friend", async () => {
		query.watchEvent.findFirst.mockResolvedValue({
			id: "event-1",
			userId: "user-1",
			tmdbId: 550,
			mediaType: "movie",
			watchNumber: 1,
		});
		query.watchEventCompanion.findMany.mockResolvedValue([]);

		await expectForbidden(
			caller.watchEvent.update({
				id: "event-1",
				companions: [{ friendId: "stranger", name: "Stranger" }],
			}),
		);
		expectNothingWritten();
	});
});
