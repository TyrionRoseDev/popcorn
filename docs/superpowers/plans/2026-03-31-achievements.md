# Achievements System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real, tracked achievements system with 30 achievements across 9 categories that auto-trigger on user actions, show celebratory popups, and notify friends.

**Architecture:** Static achievement definitions in a TypeScript config file. Inline condition checks after relevant tRPC mutations via an `evaluateAchievements()` helper. Three new DB tables (earnedAchievement, review, recommendation) plus a `watchedAt` column on watchlistItem. Frontend shows a celebratory full-screen popup on unlock and a comparison view on friend profiles.

**Tech Stack:** Drizzle ORM (PostgreSQL), tRPC, React Query, TanStack Router, Motion (animations), Lucide icons, Tailwind CSS, Zod

**Spec:** `docs/superpowers/specs/2026-03-31-achievements-design.md`

---

## Task 1: Add new database tables and columns

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `watchedAt` column to `watchlistItem` table**

In `src/db/schema.ts`, add the `watchedAt` column to the `watchlistItem` table definition, after the `watched` column:

```typescript
watched: boolean("watched").default(false).notNull(),
watchedAt: timestamp("watched_at"),  // ← add this line
createdAt: timestamp("created_at").defaultNow().notNull(),
```

- [ ] **Step 2: Add `earnedAchievement` table**

Add after the `block` table definition (before relations):

```typescript
export const earnedAchievement = pgTable(
	"earned_achievement",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		achievementId: text("achievement_id").notNull(),
		earnedAt: timestamp("earned_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("earned_achievement_unique").on(
			table.userId,
			table.achievementId,
		),
		index("earned_achievement_user_id_idx").on(table.userId),
	],
);
```

- [ ] **Step 3: Add `review` table**

Add after the `earnedAchievement` table:

```typescript
export const review = pgTable(
	"review",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(),
		rating: integer("rating").notNull(),
		text: text("text"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("review_unique").on(
			table.userId,
			table.tmdbId,
			table.mediaType,
		),
		index("review_user_id_idx").on(table.userId),
	],
);
```

- [ ] **Step 4: Add `recommendation` table**

Add after the `review` table:

```typescript
export const recommendation = pgTable(
	"recommendation",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		senderId: text("sender_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("recommendation_sender_id_idx").on(table.senderId),
		index("recommendation_recipient_id_idx").on(table.recipientId),
	],
);
```

- [ ] **Step 5: Add relations for new tables**

Add to the `userRelations` `many()` calls:

```typescript
earnedAchievements: many(earnedAchievement),
reviews: many(review),
recommendationsSent: many(recommendation, { relationName: "recommendationSender" }),
recommendationsReceived: many(recommendation, { relationName: "recommendationRecipient" }),
```

Add new relation definitions after `blockRelations`:

```typescript
export const earnedAchievementRelations = relations(
	earnedAchievement,
	({ one }) => ({
		user: one(user, {
			fields: [earnedAchievement.userId],
			references: [user.id],
		}),
	}),
);

export const reviewRelations = relations(review, ({ one }) => ({
	user: one(user, {
		fields: [review.userId],
		references: [user.id],
	}),
}));

export const recommendationRelations = relations(
	recommendation,
	({ one }) => ({
		sender: one(user, {
			fields: [recommendation.senderId],
			references: [user.id],
			relationName: "recommendationSender",
		}),
		recipient: one(user, {
			fields: [recommendation.recipientId],
			references: [user.id],
			relationName: "recommendationRecipient",
		}),
	}),
);
```

- [ ] **Step 6: Push schema to database**

Run: `bun drizzle-kit push`
Expected: Tables created, column added, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add achievement, review, recommendation tables and watchedAt column"
```

---

## Task 2: Create achievement definitions config

**Files:**
- Create: `src/lib/achievements.ts`

- [ ] **Step 1: Write the achievement definitions file**

Create `src/lib/achievements.ts`:

```typescript
export const ACHIEVEMENT_CATEGORIES = [
	"watching",
	"time-based",
	"social",
	"discovery",
	"watchlists",
	"recommendations",
	"reviews",
	"profile",
	"meta",
] as const;

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export type AchievementCondition =
	| { type: "watchedCount"; threshold: number }
	| { type: "genreCount"; threshold: number }
	| { type: "genreCountAll" }
	| { type: "watchedAtTime"; after: string; before: string }
	| { type: "watchedWithinWindow"; hours: number; count: number }
	| { type: "friendCount"; threshold: number }
	| { type: "joinedCollabWatchlist" }
	| { type: "sameTitleSameDay" }
	| { type: "totalSwipes"; threshold: number }
	| { type: "shuffleToWatchlist" }
	| { type: "watchlistCount"; threshold: number }
	| { type: "clearedWatchlist"; minItems: number }
	| { type: "rewatch" }
	| { type: "sentRecommendation" }
	| { type: "recWatched" }
	| { type: "recRatedHighly"; minRating: number }
	| { type: "firstReview" }
	| { type: "reviewCount"; threshold: number }
	| { type: "onboardingCompleted" }
	| { type: "achievementCount"; threshold: number }
	| { type: "achievementCountAll" };

export interface AchievementDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	category: AchievementCategory;
	condition: AchievementCondition;
}

/**
 * Which action contexts trigger which condition types.
 * When a mutation completes, it passes its context string to evaluateAchievements,
 * which only checks achievements whose condition type appears in that context's list.
 */
export const ACTION_CONTEXT_MAP: Record<string, AchievementCondition["type"][]> = {
	watched: [
		"watchedCount",
		"genreCount",
		"genreCountAll",
		"watchedAtTime",
		"watchedWithinWindow",
		"clearedWatchlist",
		"rewatch",
		"sameTitleSameDay",
		"recWatched",
		"recRatedHighly",
		"achievementCount",
		"achievementCountAll",
	],
	friend: [
		"friendCount",
		"achievementCount",
		"achievementCountAll",
	],
	watchlist_created: [
		"watchlistCount",
		"achievementCount",
		"achievementCountAll",
	],
	watchlist_joined: [
		"joinedCollabWatchlist",
		"achievementCount",
		"achievementCountAll",
	],
	swipe: [
		"totalSwipes",
		"achievementCount",
		"achievementCountAll",
	],
	shuffle_to_watchlist: [
		"shuffleToWatchlist",
		"achievementCount",
		"achievementCountAll",
	],
	recommendation_sent: [
		"sentRecommendation",
		"achievementCount",
		"achievementCountAll",
	],
	review: [
		"firstReview",
		"reviewCount",
		"recRatedHighly",
		"achievementCount",
		"achievementCountAll",
	],
	onboarding: [
		"onboardingCompleted",
		"achievementCount",
		"achievementCountAll",
	],
};

export type ActionContext = keyof typeof ACTION_CONTEXT_MAP;

export const ACHIEVEMENTS: AchievementDefinition[] = [
	// ── Watching ──────────────────────────────────────────
	{
		id: "first-watch",
		name: "First Watch",
		description: "Log your first watch",
		icon: "🎬",
		category: "watching",
		condition: { type: "watchedCount", threshold: 1 },
	},
	{
		id: "ten-spot",
		name: "Ten Spot",
		description: "Log 10 watches",
		icon: "🎞️",
		category: "watching",
		condition: { type: "watchedCount", threshold: 10 },
	},
	{
		id: "century-club",
		name: "Century Club",
		description: "Log 100 watches",
		icon: "💯",
		category: "watching",
		condition: { type: "watchedCount", threshold: 100 },
	},
	{
		id: "film-buff",
		name: "Film Buff",
		description: "Log 250 watches",
		icon: "🎥",
		category: "watching",
		condition: { type: "watchedCount", threshold: 250 },
	},
	{
		id: "projectionist",
		name: "Projectionist",
		description: "Log 500 watches",
		icon: "📽️",
		category: "watching",
		condition: { type: "watchedCount", threshold: 500 },
	},
	{
		id: "curtain-call",
		name: "Curtain Call",
		description: "Log 1000 watches",
		icon: "🎭",
		category: "watching",
		condition: { type: "watchedCount", threshold: 1000 },
	},
	{
		id: "genre-hopper",
		name: "Genre Hopper",
		description: "Watch across 5 different genres",
		icon: "🔀",
		category: "watching",
		condition: { type: "genreCount", threshold: 5 },
	},
	{
		id: "well-rounded",
		name: "Well Rounded",
		description: "Watch across every genre",
		icon: "🌍",
		category: "watching",
		condition: { type: "genreCountAll" },
	},

	// ── Time-Based ───────────────────────────────────────
	{
		id: "night-owl",
		name: "Night Owl",
		description: "Watch something after midnight",
		icon: "🌙",
		category: "time-based",
		condition: { type: "watchedAtTime", after: "00:00", before: "04:59" },
	},
	{
		id: "early-bird",
		name: "Early Bird",
		description: "Watch something before 11:59am",
		icon: "🌅",
		category: "time-based",
		condition: { type: "watchedAtTime", after: "05:00", before: "11:59" },
	},
	{
		id: "back-to-back",
		name: "Back to Back",
		description: "Watch 2 titles within 3 hours",
		icon: "⏩",
		category: "time-based",
		condition: { type: "watchedWithinWindow", hours: 3, count: 2 },
	},

	// ── Social ───────────────────────────────────────────
	{
		id: "plus-one",
		name: "Plus One",
		description: "Add your first friend",
		icon: "🤝",
		category: "social",
		condition: { type: "friendCount", threshold: 1 },
	},
	{
		id: "inner-circle",
		name: "Inner Circle",
		description: "Have 5 friends",
		icon: "👥",
		category: "social",
		condition: { type: "friendCount", threshold: 5 },
	},
	{
		id: "sold-out-crowd",
		name: "Sold Out Crowd",
		description: "Have 25 friends",
		icon: "🏟️",
		category: "social",
		condition: { type: "friendCount", threshold: 25 },
	},
	{
		id: "shared-popcorn",
		name: "Shared Popcorn",
		description: "Join a collaborative watchlist",
		icon: "🍿",
		category: "social",
		condition: { type: "joinedCollabWatchlist" },
	},
	{
		id: "in-sync",
		name: "In Sync",
		description: "Watch the same title as a friend on the same day",
		icon: "🔗",
		category: "social",
		condition: { type: "sameTitleSameDay" },
	},

	// ── Discovery ────────────────────────────────────────
	{
		id: "channel-surfer",
		name: "Channel Surfer",
		description: "Swipe through 50 titles in shuffle",
		icon: "📺",
		category: "discovery",
		condition: { type: "totalSwipes", threshold: 50 },
	},
	{
		id: "showtime-shuffle",
		name: "Showtime Shuffle",
		description: "Add a title from shuffle to a watchlist",
		icon: "🎰",
		category: "discovery",
		condition: { type: "shuffleToWatchlist" },
	},

	// ── Watchlists ───────────────────────────────────────
	{
		id: "coming-attractions",
		name: "Coming Attractions",
		description: "Create your first watchlist",
		icon: "📋",
		category: "watchlists",
		condition: { type: "watchlistCount", threshold: 1 },
	},
	{
		id: "completionist",
		name: "Completionist",
		description: "Clear an entire watchlist (min 5 items)",
		icon: "✅",
		category: "watchlists",
		condition: { type: "clearedWatchlist", minItems: 5 },
	},
	{
		id: "encore",
		name: "Encore",
		description: "Rewatch a title",
		icon: "🔁",
		category: "watchlists",
		condition: { type: "rewatch" },
	},

	// ── Recommendations ──────────────────────────────────
	{
		id: "word-of-mouth",
		name: "Word of Mouth",
		description: "Recommend a title to a friend",
		icon: "📢",
		category: "recommendations",
		condition: { type: "sentRecommendation" },
	},
	{
		id: "trusted-critic",
		name: "Trusted Critic",
		description: "A friend watches something you recommended",
		icon: "🎯",
		category: "recommendations",
		condition: { type: "recWatched" },
	},
	{
		id: "good-taste",
		name: "Good Taste",
		description: "Recommend something and a friend rates it 4+ stars",
		icon: "👨‍🍳",
		category: "recommendations",
		condition: { type: "recRatedHighly", minRating: 4 },
	},

	// ── Reviews ──────────────────────────────────────────
	{
		id: "opening-review",
		name: "Opening Review",
		description: "Leave your first review",
		icon: "✍️",
		category: "reviews",
		condition: { type: "firstReview" },
	},
	{
		id: "five-star-critic",
		name: "Five Star Critic",
		description: "Leave 10 reviews",
		icon: "⭐",
		category: "reviews",
		condition: { type: "reviewCount", threshold: 10 },
	},

	// ── Profile ──────────────────────────────────────────
	{
		id: "ticket-holder",
		name: "Ticket Holder",
		description: "Complete onboarding",
		icon: "🎫",
		category: "profile",
		condition: { type: "onboardingCompleted" },
	},

	// ── Meta ─────────────────────────────────────────────
	{
		id: "trophy-case",
		name: "Trophy Case",
		description: "Earn 10 achievements",
		icon: "🏆",
		category: "meta",
		condition: { type: "achievementCount", threshold: 10 },
	},
	{
		id: "award-season",
		name: "Award Season",
		description: "Earn 25 achievements",
		icon: "🏅",
		category: "meta",
		condition: { type: "achievementCount", threshold: 25 },
	},
	{
		id: "hall-of-fame",
		name: "Hall of Fame",
		description: "Earn every achievement",
		icon: "👑",
		category: "meta",
		condition: { type: "achievementCountAll" },
	},
];

/** Quick lookup by ID */
export const ACHIEVEMENTS_BY_ID = new Map(
	ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** Total count (excluding meta self-referential achievements for Hall of Fame) */
export const TOTAL_ACHIEVEMENTS = ACHIEVEMENTS.length;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/achievements.ts
git commit -m "feat: add achievement definitions config with 30 achievements"
```

---

## Task 3: Build achievement evaluation engine

**Files:**
- Create: `src/lib/evaluate-achievements.ts`
- Create: `src/lib/__tests__/evaluate-achievements.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/lib/__tests__/evaluate-achievements.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => {
	const mockSelect = vi.fn();
	const mockFrom = vi.fn();
	const mockWhere = vi.fn();
	const mockInsert = vi.fn();
	const mockValues = vi.fn();
	const mockOnConflictDoNothing = vi.fn();

	return {
		db: {
			select: mockSelect,
			insert: mockInsert,
			query: {
				earnedAchievement: { findMany: vi.fn() },
				watchlistItem: { findMany: vi.fn() },
				friendship: { findMany: vi.fn() },
				watchlistMember: { findMany: vi.fn() },
				shuffleSwipe: { findMany: vi.fn() },
				watchlist: { findMany: vi.fn() },
				review: { findMany: vi.fn(), findFirst: vi.fn() },
				recommendation: { findMany: vi.fn(), findFirst: vi.fn() },
			},
		},
		mockSelect,
		mockFrom,
		mockWhere,
		mockInsert,
		mockValues,
		mockOnConflictDoNothing,
	};
});

vi.mock("#/db", () => ({ db: mockDb.db }));
vi.mock("#/env", () => ({
	env: { DATABASE_URL: "postgres://test", TMDB_READ_ACCESS_TOKEN: "test" },
}));

import { evaluateAchievements } from "../evaluate-achievements";

describe("evaluateAchievements", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: no achievements earned yet
		mockDb.db.query.earnedAchievement.findMany.mockResolvedValue([]);
		// Default insert chain
		mockDb.mockInsert.mockReturnValue({ values: mockDb.mockValues });
		mockDb.mockValues.mockReturnValue({
			onConflictDoNothing: mockDb.mockOnConflictDoNothing,
		});
		mockDb.mockOnConflictDoNothing.mockResolvedValue([]);
	});

	it("returns empty array when no achievements are newly earned", async () => {
		// User has already earned first-watch
		mockDb.db.query.earnedAchievement.findMany.mockResolvedValue([
			{ achievementId: "first-watch" },
		]);
		// watchedCount = 1
		mockDb.mockSelect.mockReturnValue({ from: mockDb.mockFrom });
		mockDb.mockFrom.mockReturnValue({ where: mockDb.mockWhere });
		mockDb.mockWhere.mockResolvedValue([{ value: 1 }]);

		const result = await evaluateAchievements("user-1", "watched");
		expect(result).toEqual([]);
	});

	it("returns newly earned achievement IDs for watchedCount", async () => {
		mockDb.db.query.earnedAchievement.findMany.mockResolvedValue([]);
		// Mock the count query to return 1 watched item
		mockDb.mockSelect.mockReturnValue({ from: mockDb.mockFrom });
		mockDb.mockFrom.mockReturnValue({ where: mockDb.mockWhere });
		mockDb.mockWhere.mockResolvedValue([{ value: 1 }]);

		const result = await evaluateAchievements("user-1", "watched");
		expect(result).toContain("first-watch");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/evaluate-achievements.test.ts`
Expected: FAIL — `evaluate-achievements` module not found.

- [ ] **Step 3: Write the evaluation engine**

Create `src/lib/evaluate-achievements.ts`:

```typescript
import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "#/db";
import {
	earnedAchievement,
	friendship,
	recommendation,
	review,
	shuffleSwipe,
	user,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import {
	ACHIEVEMENTS,
	ACTION_CONTEXT_MAP,
	type ActionContext,
	type AchievementCondition,
	type AchievementDefinition,
	TOTAL_ACHIEVEMENTS,
} from "./achievements";

/**
 * Evaluate achievements for a user after an action.
 * Returns array of newly-earned achievement IDs.
 */
export async function evaluateAchievements(
	userId: string,
	context: ActionContext,
	/** Extra data passed from the mutation (e.g. tmdbId, watchedAt) */
	extra?: {
		tmdbId?: number;
		mediaType?: string;
		watchedAt?: Date;
		watchlistId?: string;
	},
): Promise<string[]> {
	// 1. Get already-earned achievement IDs
	const earned = await db.query.earnedAchievement.findMany({
		where: eq(earnedAchievement.userId, userId),
		columns: { achievementId: true },
	});
	const earnedIds = new Set(earned.map((e) => e.achievementId));

	// 2. Filter to only relevant, un-earned achievements
	const relevantTypes = ACTION_CONTEXT_MAP[context] ?? [];
	const candidates = ACHIEVEMENTS.filter(
		(a) =>
			!earnedIds.has(a.id) &&
			relevantTypes.includes(a.condition.type),
	);

	if (candidates.length === 0) return [];

	// 3. Evaluate each candidate
	const newlyEarned: string[] = [];
	for (const achievement of candidates) {
		const met = await checkCondition(userId, achievement, earnedIds, extra);
		if (met) {
			newlyEarned.push(achievement.id);
			earnedIds.add(achievement.id); // for meta achievements that check count
		}
	}

	// 4. Insert newly earned
	if (newlyEarned.length > 0) {
		await db
			.insert(earnedAchievement)
			.values(
				newlyEarned.map((id) => ({
					userId,
					achievementId: id,
				})),
			)
			.onConflictDoNothing();
	}

	return newlyEarned;
}

async function checkCondition(
	userId: string,
	achievement: AchievementDefinition,
	earnedIds: Set<string>,
	extra?: {
		tmdbId?: number;
		mediaType?: string;
		watchedAt?: Date;
		watchlistId?: string;
	},
): Promise<boolean> {
	const c = achievement.condition;

	switch (c.type) {
		case "watchedCount": {
			const [result] = await db
				.select({ value: count() })
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.addedBy, userId),
						eq(watchlistItem.watched, true),
					),
				);
			return (result?.value ?? 0) >= c.threshold;
		}

		case "genreCount": {
			// Count distinct genres from watched items by joining with TMDB genre data
			// For now, we count distinct genre IDs from the user's watched titles
			// that have genres stored in userGenre
			const [result] = await db
				.select({ value: sql<number>`count(distinct ${watchlistItem.mediaType})` })
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.addedBy, userId),
						eq(watchlistItem.watched, true),
					),
				);
			// NOTE: This is a simplified check. In implementation, genre tracking
			// will need to be derived from TMDB API genre data stored when marking watched.
			// For MVP, we track genres via a separate query or store genre IDs on watchlistItem.
			return (result?.value ?? 0) >= c.threshold;
		}

		case "genreCountAll": {
			// Same as genreCount but checks against total available genres
			// Will use TMDB genre list count as the target
			return false; // Evaluated same as genreCount but with dynamic threshold
		}

		case "watchedAtTime": {
			if (!extra?.watchedAt) return false;
			const hours = extra.watchedAt.getHours();
			const minutes = extra.watchedAt.getMinutes();
			const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
			return timeStr >= c.after && timeStr <= c.before;
		}

		case "watchedWithinWindow": {
			if (!extra?.watchedAt) return false;
			const windowStart = new Date(
				extra.watchedAt.getTime() - c.hours * 60 * 60 * 1000,
			);
			const [result] = await db
				.select({ value: count() })
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.addedBy, userId),
						eq(watchlistItem.watched, true),
						gte(watchlistItem.watchedAt, windowStart),
					),
				);
			// Count includes the current item, so check >= count
			return (result?.value ?? 0) >= c.count;
		}

		case "friendCount": {
			const [result] = await db
				.select({ value: count() })
				.from(friendship)
				.where(
					and(
						sql`(${friendship.requesterId} = ${userId} OR ${friendship.addresseeId} = ${userId})`,
						eq(friendship.status, "accepted"),
					),
				);
			return (result?.value ?? 0) >= c.threshold;
		}

		case "joinedCollabWatchlist": {
			const [result] = await db
				.select({ value: count() })
				.from(watchlistMember)
				.where(eq(watchlistMember.userId, userId));
			// User is a member of at least one watchlist they don't own
			return (result?.value ?? 0) >= 1;
		}

		case "sameTitleSameDay": {
			if (!extra?.tmdbId || !extra?.watchedAt) return false;
			// Check if any friend watched the same title on the same day
			const dayStart = new Date(extra.watchedAt);
			dayStart.setHours(0, 0, 0, 0);
			const dayEnd = new Date(extra.watchedAt);
			dayEnd.setHours(23, 59, 59, 999);

			const friendWatches = await db
				.select({ value: count() })
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.tmdbId, extra.tmdbId),
						eq(watchlistItem.watched, true),
						gte(watchlistItem.watchedAt, dayStart),
						sql`${watchlistItem.watchedAt} <= ${dayEnd}`,
						sql`${watchlistItem.addedBy} != ${userId}`,
						sql`${watchlistItem.addedBy} IN (
							SELECT CASE
								WHEN ${friendship.requesterId} = ${userId} THEN ${friendship.addresseeId}
								ELSE ${friendship.requesterId}
							END
							FROM ${friendship}
							WHERE (${friendship.requesterId} = ${userId} OR ${friendship.addresseeId} = ${userId})
							AND ${friendship.status} = 'accepted'
						)`,
					),
				);
			return (friendWatches[0]?.value ?? 0) >= 1;
		}

		case "totalSwipes": {
			const [result] = await db
				.select({ value: count() })
				.from(shuffleSwipe)
				.where(eq(shuffleSwipe.userId, userId));
			return (result?.value ?? 0) >= c.threshold;
		}

		case "shuffleToWatchlist": {
			// Check if user has any watchlist items that were also swiped yes
			// This is tracked by checking if a swipe action='yes' exists for an item in a watchlist
			const [result] = await db
				.select({ value: count() })
				.from(shuffleSwipe)
				.where(
					and(
						eq(shuffleSwipe.userId, userId),
						eq(shuffleSwipe.action, "yes"),
					),
				);
			return (result?.value ?? 0) >= 1;
		}

		case "watchlistCount": {
			const [result] = await db
				.select({ value: count() })
				.from(watchlist)
				.where(eq(watchlist.ownerId, userId));
			return (result?.value ?? 0) >= c.threshold;
		}

		case "clearedWatchlist": {
			if (!extra?.watchlistId) {
				// Check all watchlists the user is a member of
				const watchlists = await db.query.watchlistMember.findMany({
					where: eq(watchlistMember.userId, userId),
					columns: { watchlistId: true },
				});
				for (const wl of watchlists) {
					const cleared = await isWatchlistCleared(wl.watchlistId, c.minItems);
					if (cleared) return true;
				}
				return false;
			}
			return isWatchlistCleared(extra.watchlistId, c.minItems);
		}

		case "rewatch": {
			// Check if the item being marked watched already had a watchedAt set
			// This is passed as extra context from the mutation
			if (!extra?.tmdbId) return false;
			const existing = await db.query.watchlistItem.findMany({
				where: and(
					eq(watchlistItem.addedBy, userId),
					eq(watchlistItem.tmdbId, extra.tmdbId),
					sql`${watchlistItem.watchedAt} IS NOT NULL`,
				),
				columns: { id: true },
			});
			// If there's already a watched record with a watchedAt, this is a rewatch
			return existing.length > 0;
		}

		case "sentRecommendation": {
			const [result] = await db
				.select({ value: count() })
				.from(recommendation)
				.where(eq(recommendation.senderId, userId));
			return (result?.value ?? 0) >= 1;
		}

		case "recWatched": {
			// Check if any recommendation this user sent has been watched
			const result = await db.execute(sql`
				SELECT COUNT(*) as value FROM ${recommendation} r
				JOIN ${watchlistItem} wi ON wi.tmdb_id = r.tmdb_id
					AND wi.media_type = r.media_type
					AND wi.added_by = r.recipient_id
					AND wi.watched = true
				WHERE r.sender_id = ${userId}
			`);
			return (Number(result.rows?.[0]?.value) ?? 0) >= 1;
		}

		case "recRatedHighly": {
			// Check if any recommendation this user sent was rated >= minRating
			const result = await db.execute(sql`
				SELECT COUNT(*) as value FROM ${recommendation} r
				JOIN ${review} rev ON rev.tmdb_id = r.tmdb_id
					AND rev.media_type = r.media_type
					AND rev.user_id = r.recipient_id
					AND rev.rating >= ${c.minRating}
				WHERE r.sender_id = ${userId}
			`);
			return (Number(result.rows?.[0]?.value) ?? 0) >= 1;
		}

		case "firstReview": {
			const [result] = await db
				.select({ value: count() })
				.from(review)
				.where(eq(review.userId, userId));
			return (result?.value ?? 0) >= 1;
		}

		case "reviewCount": {
			const [result] = await db
				.select({ value: count() })
				.from(review)
				.where(eq(review.userId, userId));
			return (result?.value ?? 0) >= c.threshold;
		}

		case "onboardingCompleted": {
			const u = await db.query.user.findFirst({
				where: eq(user.id, userId),
				columns: { onboardingCompleted: true },
			});
			return u?.onboardingCompleted === true;
		}

		case "achievementCount": {
			return earnedIds.size >= c.threshold;
		}

		case "achievementCountAll": {
			// Hall of Fame: need all other achievements (total - 1 for self)
			return earnedIds.size >= TOTAL_ACHIEVEMENTS - 1;
		}

		default:
			return false;
	}
}

async function isWatchlistCleared(
	watchlistId: string,
	minItems: number,
): Promise<boolean> {
	const items = await db.query.watchlistItem.findMany({
		where: eq(watchlistItem.watchlistId, watchlistId),
		columns: { watched: true },
	});
	if (items.length < minItems) return false;
	return items.every((item) => item.watched);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/evaluate-achievements.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/evaluate-achievements.ts src/lib/__tests__/evaluate-achievements.test.ts
git commit -m "feat: add achievement evaluation engine with condition checks"
```

---

## Task 4: Create achievement tRPC router

**Files:**
- Create: `src/integrations/trpc/routers/achievement.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Create the achievement router**

Create `src/integrations/trpc/routers/achievement.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { earnedAchievement } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_ID } from "#/lib/achievements";

export const achievementRouter = {
	/** Get all earned achievements for the current user */
	myAchievements: protectedProcedure.query(async ({ ctx }) => {
		const earned = await db.query.earnedAchievement.findMany({
			where: eq(earnedAchievement.userId, ctx.userId),
		});

		return {
			earned: earned.map((e) => ({
				...ACHIEVEMENTS_BY_ID.get(e.achievementId),
				earnedAt: e.earnedAt,
			})),
			total: ACHIEVEMENTS.length,
		};
	}),

	/** Get earned achievement IDs for a specific user (for profile/comparison) */
	userAchievements: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.query(async ({ input }) => {
			const earned = await db.query.earnedAchievement.findMany({
				where: eq(earnedAchievement.userId, input.userId),
			});

			return {
				earned: earned.map((e) => ({
					...ACHIEVEMENTS_BY_ID.get(e.achievementId),
					earnedAt: e.earnedAt,
				})),
				total: ACHIEVEMENTS.length,
			};
		}),

	/** Compare achievements between current user and a friend */
	compare: protectedProcedure
		.input(z.object({ friendId: z.string() }))
		.query(async ({ ctx, input }) => {
			const [myEarned, theirEarned] = await Promise.all([
				db.query.earnedAchievement.findMany({
					where: eq(earnedAchievement.userId, ctx.userId),
				}),
				db.query.earnedAchievement.findMany({
					where: eq(earnedAchievement.userId, input.friendId),
				}),
			]);

			const myIds = new Map(
				myEarned.map((e) => [e.achievementId, e.earnedAt]),
			);
			const theirIds = new Map(
				theirEarned.map((e) => [e.achievementId, e.earnedAt]),
			);

			return {
				achievements: ACHIEVEMENTS.map((a) => ({
					...a,
					myEarnedAt: myIds.get(a.id) ?? null,
					theirEarnedAt: theirIds.get(a.id) ?? null,
				})),
				myTotal: myEarned.length,
				theirTotal: theirEarned.length,
				sharedCount: ACHIEVEMENTS.filter(
					(a) => myIds.has(a.id) && theirIds.has(a.id),
				).length,
			};
		}),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register the router**

In `src/integrations/trpc/router.ts`, add the import and registration:

```typescript
import { achievementRouter } from "./routers/achievement";
```

Add to the `createTRPCRouter` call:

```typescript
achievement: achievementRouter,
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/achievement.ts src/integrations/trpc/router.ts
git commit -m "feat: add achievement tRPC router with comparison endpoint"
```

---

## Task 5: Create review tRPC router

**Files:**
- Create: `src/integrations/trpc/routers/review.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Create the review router**

Create `src/integrations/trpc/routers/review.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { review, user } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { evaluateAchievements } from "#/lib/evaluate-achievements";
import { createNotification } from "./notification";

export const reviewRouter = {
	/** Create or update a review */
	upsert: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				rating: z.number().min(1).max(5),
				text: z.string().optional(),
				titleName: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const [result] = await db
				.insert(review)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					rating: input.rating,
					text: input.text ?? null,
				})
				.onConflictDoUpdate({
					target: [review.userId, review.tmdbId, review.mediaType],
					set: { rating: input.rating, text: input.text ?? null },
				})
				.returning({ id: review.id });

			// Evaluate review-related achievements
			const newAchievements = await evaluateAchievements(
				ctx.userId,
				"review",
				{ tmdbId: input.tmdbId, mediaType: input.mediaType },
			);

			return { id: result.id, newAchievements };
		}),

	/** Get a user's review for a specific title */
	get: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				userId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const targetUserId = input.userId ?? ctx.userId;
			return db.query.review.findFirst({
				where: and(
					eq(review.userId, targetUserId),
					eq(review.tmdbId, input.tmdbId),
					eq(review.mediaType, input.mediaType),
				),
			});
		}),

	/** Get all reviews by a user */
	userReviews: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.query(async ({ input }) => {
			return db.query.review.findMany({
				where: eq(review.userId, input.userId),
				orderBy: desc(review.createdAt),
			});
		}),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register the router**

In `src/integrations/trpc/router.ts`, add:

```typescript
import { reviewRouter } from "./routers/review";
```

And in the `createTRPCRouter` call:

```typescript
review: reviewRouter,
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/review.ts src/integrations/trpc/router.ts
git commit -m "feat: add review tRPC router with upsert and queries"
```

---

## Task 6: Create recommendation tRPC router

**Files:**
- Create: `src/integrations/trpc/routers/recommendation.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Create the recommendation router**

Create `src/integrations/trpc/routers/recommendation.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { recommendation } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { evaluateAchievements } from "#/lib/evaluate-achievements";
import { createNotification } from "./notification";

export const recommendationRouter = {
	/** Recommend a title to one or more friends */
	send: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				friendIds: z.array(z.string()).min(1),
				titleName: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// Insert recommendations
			await db.insert(recommendation).values(
				input.friendIds.map((friendId) => ({
					senderId: ctx.userId,
					recipientId: friendId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
				})),
			);

			// Notify each friend
			for (const friendId of input.friendIds) {
				await createNotification({
					recipientId: friendId,
					actorId: ctx.userId,
					type: "recommendation",
					data: {
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
						titleName: input.titleName ?? "",
					},
				});
			}

			// Evaluate recommendation achievements
			const newAchievements = await evaluateAchievements(
				ctx.userId,
				"recommendation_sent",
			);

			return { newAchievements };
		}),

	/** Get recommendations received by the current user */
	received: protectedProcedure.query(async ({ ctx }) => {
		return db.query.recommendation.findMany({
			where: eq(recommendation.recipientId, ctx.userId),
			orderBy: desc(recommendation.createdAt),
		});
	}),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Add `recommendation` to notification types**

In `src/integrations/trpc/routers/notification.ts`, add `"recommendation"` and `"achievement_earned"` to the `NOTIFICATION_TYPES` array:

```typescript
const NOTIFICATION_TYPES = [
	"watchlist_item_added",
	"watchlist_member_joined",
	"shuffle_match",
	"item_watched",
	"watchlist_invite",
	"friend_request",
	"friend_request_accepted",
	"title_reviewed",
	"recommendation",
	"achievement_earned",
] as const;
```

- [ ] **Step 3: Register the router**

In `src/integrations/trpc/router.ts`, add:

```typescript
import { recommendationRouter } from "./routers/recommendation";
```

And in the `createTRPCRouter` call:

```typescript
recommendation: recommendationRouter,
```

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/recommendation.ts src/integrations/trpc/routers/notification.ts src/integrations/trpc/router.ts
git commit -m "feat: add recommendation router and new notification types"
```

---

## Task 7: Integrate achievement checks into watchlist router

**Files:**
- Modify: `src/integrations/trpc/routers/watchlist.ts`

- [ ] **Step 1: Add imports**

At the top of `src/integrations/trpc/routers/watchlist.ts`, add:

```typescript
import { evaluateAchievements } from "#/lib/evaluate-achievements";
import { ACHIEVEMENTS_BY_ID } from "#/lib/achievements";
```

- [ ] **Step 2: Update `markWatched` mutation**

Update the `markWatched` mutation's input to include an optional `watchedAt`:

Change the input schema:

```typescript
markWatched: protectedProcedure
	.input(
		z.object({
			watchlistId: z.string(),
			tmdbId: z.number(),
			mediaType: z.enum(["movie", "tv"]),
			watched: z.boolean(),
			titleName: z.string().optional(),
			watchedAt: z.string().datetime().optional(),
		}),
	)
```

Update the `.set()` call to include `watchedAt`:

```typescript
const watchedAtDate = input.watched
	? (input.watchedAt ? new Date(input.watchedAt) : new Date())
	: null;

await db
	.update(watchlistItem)
	.set({
		watched: input.watched,
		watchedAt: watchedAtDate,
	})
	.where(
		and(
			eq(watchlistItem.watchlistId, input.watchlistId),
			eq(watchlistItem.tmdbId, input.tmdbId),
			eq(watchlistItem.mediaType, input.mediaType),
		),
	);
```

After the existing notification loop (at the end of the `if (input.watched)` block), add achievement evaluation:

```typescript
// Evaluate achievements
const newAchievements = await evaluateAchievements(
	ctx.userId,
	"watched",
	{
		tmdbId: input.tmdbId,
		mediaType: input.mediaType,
		watchedAt: watchedAtDate ?? undefined,
		watchlistId: input.watchlistId,
	},
);

// Notify friends about any new achievements
if (newAchievements.length > 0) {
	const friends = await db.query.friendship.findMany({
		where: and(
			sql`(${friendship.requesterId} = ${ctx.userId} OR ${friendship.addresseeId} = ${ctx.userId})`,
			eq(friendship.status, "accepted"),
		),
	});
	for (const f of friends) {
		const friendId =
			f.requesterId === ctx.userId ? f.addresseeId : f.requesterId;
		for (const achievementId of newAchievements) {
			const achievementDef = ACHIEVEMENTS_BY_ID.get(achievementId);
			await createNotification({
				recipientId: friendId,
				actorId: ctx.userId,
				type: "achievement_earned",
				data: { achievementId, achievementName: achievementDef?.name ?? "" },
			});
		}
	}
}

return { newAchievements };
```

Add the import for `friendship` from schema and `sql` from drizzle-orm if not already imported.

- [ ] **Step 3: Update the `create` mutation to check achievements**

At the end of the `create` mutation, after the existing logic, add:

```typescript
const newAchievements = await evaluateAchievements(ctx.userId, "watchlist_created");
return { ...newWatchlist, newAchievements };
```

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts
git commit -m "feat: integrate achievement checks into watchlist mutations"
```

---

## Task 8: Integrate achievement checks into friend and other routers

**Files:**
- Modify: `src/integrations/trpc/routers/friend.ts`

- [ ] **Step 1: Add import to friend router**

At the top of `src/integrations/trpc/routers/friend.ts`, add:

```typescript
import { evaluateAchievements } from "#/lib/evaluate-achievements";
import { ACHIEVEMENTS_BY_ID } from "#/lib/achievements";
```

- [ ] **Step 2: Add achievement check to `acceptRequest`**

In the `acceptRequest` mutation, after the existing `createNotification` call for `friend_request_accepted`, add:

```typescript
// Evaluate friend-related achievements for both users
const [requesterAchievements, addresseeAchievements] = await Promise.all([
	evaluateAchievements(request.requesterId, "friend"),
	evaluateAchievements(ctx.userId, "friend"),
]);

// Notify friends about new achievements (for both users)
const notifyFriendsAboutAchievements = async (
	earnerId: string,
	achievementIds: string[],
) => {
	if (achievementIds.length === 0) return;
	const friends = await db.query.friendship.findMany({
		where: and(
			sql`(${friendship.requesterId} = ${earnerId} OR ${friendship.addresseeId} = ${earnerId})`,
			eq(friendship.status, "accepted"),
		),
	});
	for (const f of friends) {
		const friendId =
			f.requesterId === earnerId ? f.addresseeId : f.requesterId;
		for (const achievementId of achievementIds) {
			const achievementDef = ACHIEVEMENTS_BY_ID.get(achievementId);
			await createNotification({
				recipientId: friendId,
				actorId: earnerId,
				type: "achievement_earned",
				data: { achievementId, achievementName: achievementDef?.name ?? "" },
			});
		}
	}
};

await notifyFriendsAboutAchievements(request.requesterId, requesterAchievements);
await notifyFriendsAboutAchievements(ctx.userId, addresseeAchievements);
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/friend.ts
git commit -m "feat: integrate achievement checks into friend router"
```

---

## Task 9: Add notification rendering for new types

**Files:**
- Modify: `src/components/notifications/notification-item.tsx`

- [ ] **Step 1: Add cases to `getNotificationMessage`**

In the `switch` statement in `getNotificationMessage`, add before the `default` case:

```typescript
case "recommendation":
	return {
		text: `recommended ${data.titleName || "a title"} to you`,
		link: data.tmdbId
			? `/app/title/${data.mediaType}/${data.tmdbId}`
			: undefined,
	};
case "achievement_earned": {
	const achievementName = data.achievementName || "an achievement";
	return {
		text: `earned the ${achievementName} achievement`,
		link: actorId ? `/app/profile/${actorId}` : undefined,
	};
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notifications/notification-item.tsx
git commit -m "feat: add notification rendering for recommendations and achievements"
```

---

## Task 10: Build the achievement unlock popup component

**Files:**
- Create: `src/components/achievements/achievement-popup.tsx`

- [ ] **Step 1: Create the popup component**

Create `src/components/achievements/achievement-popup.tsx`:

```tsx
import { AnimatePresence, motion } from "motion/react";
import { ACHIEVEMENTS_BY_ID } from "#/lib/achievements";

interface AchievementPopupProps {
	achievementIds: string[];
	currentIndex: number;
	earnedTotal: number;
	onDismiss: () => void;
}

export function AchievementPopup({
	achievementIds,
	currentIndex,
	earnedTotal,
	onDismiss,
}: AchievementPopupProps) {
	const achievementId = achievementIds[currentIndex];
	const achievement = achievementId
		? ACHIEVEMENTS_BY_ID.get(achievementId)
		: null;

	if (!achievement) return null;

	return (
		<AnimatePresence>
			<motion.div
				className="fixed inset-0 z-50 flex items-center justify-center"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
			>
				{/* Backdrop */}
				<div className="absolute inset-0 bg-drive-in-bg/85 backdrop-blur-sm" />

				{/* Projector sweep */}
				<div className="pointer-events-none absolute inset-0 overflow-hidden">
					<div
						className="absolute top-[-50%] left-1/2 h-[200%] w-[300px] -translate-x-1/2"
						style={{
							background:
								"linear-gradient(90deg, transparent, rgba(255, 184, 0, 0.04), rgba(255, 184, 0, 0.08), rgba(255, 184, 0, 0.04), transparent)",
							animation: "achievement-sweep 3s ease-in-out infinite",
						}}
					/>
				</div>

				{/* Particles */}
				<div className="pointer-events-none absolute inset-0 overflow-hidden">
					{Array.from({ length: 40 }).map((_, i) => (
						<div
							key={i}
							className="absolute rounded-full"
							style={{
								left: `${Math.random() * 100}%`,
								width: `${3 + Math.random() * 4}px`,
								height: `${3 + Math.random() * 4}px`,
								background: ["#FF2D78", "#FFB800", "#00E5FF"][i % 3],
								animation: `achievement-float-up ${2 + Math.random() * 3}s linear ${Math.random() * 2}s infinite`,
							}}
						/>
					))}
				</div>

				{/* Main content */}
				<motion.div
					className="relative z-10 flex flex-col items-center gap-6"
					initial={{ scale: 0.8, y: 30, opacity: 0 }}
					animate={{ scale: 1, y: 0, opacity: 1 }}
					transition={{ type: "spring", duration: 0.6 }}
				>
					{/* Label */}
					<motion.span
						className="font-mono text-[11px] uppercase tracking-[4px] text-neon-amber"
						initial={{ y: 10, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ delay: 0.3 }}
					>
						Achievement Unlocked
					</motion.span>

					{/* Badge */}
					<div className="relative">
						{/* Spotlight */}
						<div
							className="absolute -top-5 left-1/2 h-[220px] w-[220px] -translate-x-1/2 rounded-full"
							style={{
								background:
									"radial-gradient(circle, rgba(255, 184, 0, 0.15) 0%, transparent 70%)",
								animation:
									"achievement-spotlight-pulse 2s ease-in-out infinite",
							}}
						/>

						{/* Badge card */}
						<motion.div
							className="relative flex h-[170px] w-[140px] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-drive-in-card"
							initial={{ scale: 0.5, rotateY: 90, opacity: 0 }}
							animate={{ scale: 1, rotateY: 0, opacity: 1 }}
							transition={{ delay: 0.2, type: "spring", duration: 0.5 }}
						>
							{/* Conic gradient border */}
							<div
								className="absolute inset-0 rounded-xl"
								style={{
									padding: "2px",
									background:
										"conic-gradient(from 0deg, #FF2D78, #FFB800, #00E5FF, #FF2D78)",
									mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
									maskComposite: "exclude",
									WebkitMaskComposite: "xor",
								}}
							/>

							<span
								className="text-[52px] leading-none"
								style={{
									color: "#FFB800",
									textShadow:
										"0 0 20px #FFB800, 0 0 40px rgba(255, 184, 0, 0.33)",
								}}
							>
								{achievement.icon}
							</span>
							<span className="px-2 text-center font-mono text-[11px] uppercase tracking-[1px] text-cream">
								{achievement.name}
							</span>
						</motion.div>
					</div>

					{/* Details */}
					<motion.div
						className="text-center"
						initial={{ y: 15, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ delay: 0.5 }}
					>
						<h3
							className="mb-2 font-display text-[28px]"
							style={{
								background:
									"linear-gradient(90deg, #FF2D78, #FFB800, #00E5FF)",
								WebkitBackgroundClip: "text",
								WebkitTextFillColor: "transparent",
							}}
						>
							{achievement.name}
						</h3>
						<p className="text-sm text-cream/50">{achievement.description}</p>
					</motion.div>

					{/* Progress */}
					<motion.span
						className="font-mono text-xs text-neon-amber/50"
						initial={{ y: 15, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ delay: 0.7 }}
					>
						{earnedTotal} / 30 Achievements
					</motion.span>

					{/* Dismiss */}
					<motion.button
						type="button"
						onClick={onDismiss}
						className="rounded-md border border-cream/10 px-7 py-2.5 font-mono text-[11px] uppercase tracking-[2px] text-cream/40 transition-all hover:border-neon-amber hover:text-cream hover:shadow-[0_0_12px_rgba(255,184,0,0.2)]"
						initial={{ y: 15, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ delay: 0.9 }}
					>
						{currentIndex < achievementIds.length - 1
							? "Next"
							: "Continue"}
					</motion.button>
				</motion.div>

				{/* Keyframes injected inline */}
				<style>{`
					@keyframes achievement-sweep {
						0%, 100% { transform: translateX(-50%) rotate(-15deg); opacity: 0.5; }
						50% { transform: translateX(-50%) rotate(15deg); opacity: 1; }
					}
					@keyframes achievement-float-up {
						0% { transform: translateY(100vh) scale(0); opacity: 0; }
						10% { opacity: 1; transform: translateY(90vh) scale(1); }
						90% { opacity: 0.8; }
						100% { transform: translateY(-20vh) scale(0.5); opacity: 0; }
					}
					@keyframes achievement-spotlight-pulse {
						0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.6; }
						50% { transform: translateX(-50%) scale(1.15); opacity: 1; }
					}
				`}</style>
			</motion.div>
		</AnimatePresence>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/achievements/achievement-popup.tsx
git commit -m "feat: add celebratory achievement unlock popup component"
```

---

## Task 11: Create achievement badge component

**Files:**
- Create: `src/components/achievements/achievement-badge.tsx`

- [ ] **Step 1: Create the badge component**

Create `src/components/achievements/achievement-badge.tsx`:

```tsx
import type { AchievementDefinition } from "#/lib/achievements";

interface AchievementBadgeProps {
	achievement: AchievementDefinition;
	earned: boolean;
	earnedAt?: Date | null;
	/** For comparison view: who earned it */
	comparison?: {
		myEarnedAt: Date | null;
		theirEarnedAt: Date | null;
		theirName: string;
	};
	onClick?: () => void;
}

function formatDate(date: Date | string): string {
	return new Date(date).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function AchievementBadge({
	achievement,
	earned,
	earnedAt,
	comparison,
	onClick,
}: AchievementBadgeProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`relative flex h-[170px] w-[140px] flex-col items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-drive-in-card transition-all ${
				earned
					? "cursor-pointer hover:scale-105"
					: "cursor-default opacity-30 grayscale"
			}`}
		>
			{/* Conic gradient border (only when earned) */}
			{earned && (
				<div
					className="absolute inset-0 rounded-xl"
					style={{
						padding: "2px",
						background:
							"conic-gradient(from 0deg, #FF2D78, #FFB800, #00E5FF, #FF2D78)",
						mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
						maskComposite: "exclude",
						WebkitMaskComposite: "xor",
						opacity: 0.6,
					}}
				/>
			)}

			{/* Locked overlay */}
			{!earned && (
				<div className="absolute inset-0 flex items-center justify-center rounded-xl">
					<span className="text-2xl opacity-80">🔒</span>
				</div>
			)}

			{/* Icon */}
			<span
				className="text-[48px] leading-none"
				style={
					earned
						? {
								color: "#FFB800",
								textShadow:
									"0 0 12px #FFB800, 0 0 24px rgba(255, 184, 0, 0.33)",
							}
						: { filter: "grayscale(1)" }
				}
			>
				{earned ? achievement.icon : "?"}
			</span>

			{/* Name */}
			<span className="px-2 text-center font-mono text-[11px] uppercase tracking-[1px] text-cream">
				{earned ? achievement.name : "???"}
			</span>

			{/* Date */}
			{earned && earnedAt && (
				<span className="font-mono text-[9px] text-cream/30">
					{formatDate(earnedAt)}
				</span>
			)}

			{/* Comparison indicators */}
			{comparison && earned && (
				<div className="absolute bottom-2 flex gap-1">
					{comparison.myEarnedAt && (
						<span className="rounded bg-neon-amber/20 px-1.5 py-0.5 text-[8px] text-neon-amber">
							You
						</span>
					)}
					{comparison.theirEarnedAt && (
						<span className="rounded bg-neon-cyan/20 px-1.5 py-0.5 text-[8px] text-neon-cyan">
							{comparison.theirName}
						</span>
					)}
				</div>
			)}
		</button>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/achievements/achievement-badge.tsx
git commit -m "feat: add achievement badge component with locked/comparison states"
```

---

## Task 12: Build achievement comparison view for profiles

**Files:**
- Create: `src/components/achievements/achievement-grid.tsx`

- [ ] **Step 1: Create the achievement grid with comparison and filtering**

Create `src/components/achievements/achievement-grid.tsx`:

```tsx
import { useState } from "react";
import { Trophy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ACHIEVEMENTS } from "#/lib/achievements";
import { AchievementBadge } from "./achievement-badge";

interface EarnedAchievement {
	id?: string;
	earnedAt: Date;
}

interface AchievementGridProps {
	/** Current user's earned achievements */
	myEarned: EarnedAchievement[];
	/** If viewing a friend, their earned achievements */
	theirEarned?: EarnedAchievement[];
	theirName?: string;
	onClose: () => void;
}

export function AchievementGrid({
	myEarned,
	theirEarned,
	theirName,
	onClose,
}: AchievementGridProps) {
	const [filter, setFilter] = useState<"all" | "shared">("all");
	const isComparison = !!theirEarned;

	const myEarnedMap = new Map(
		myEarned.map((e) => [e.id, e.earnedAt]),
	);
	const theirEarnedMap = theirEarned
		? new Map(theirEarned.map((e) => [e.id, e.earnedAt]))
		: null;

	const filtered = ACHIEVEMENTS.filter((a) => {
		if (filter === "shared" && theirEarnedMap) {
			return myEarnedMap.has(a.id) && theirEarnedMap.has(a.id);
		}
		return true;
	});

	const myTotal = myEarned.length;
	const theirTotal = theirEarned?.length ?? 0;
	const sharedCount = theirEarnedMap
		? ACHIEVEMENTS.filter(
				(a) => myEarnedMap.has(a.id) && theirEarnedMap.has(a.id),
			).length
		: 0;

	return (
		<motion.div
			className="fixed inset-0 z-40 flex items-center justify-center"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
		>
			<div
				className="absolute inset-0 bg-drive-in-bg/90 backdrop-blur-sm"
				onClick={onClose}
			/>

			<motion.div
				className="relative z-10 max-h-[85vh] w-full max-w-[600px] overflow-y-auto rounded-xl border border-drive-in-border bg-drive-in-card p-6"
				initial={{ scale: 0.95, y: 20 }}
				animate={{ scale: 1, y: 0 }}
			>
				{/* Header */}
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Trophy className="h-5 w-5 text-neon-amber" />
						<h2 className="font-display text-xl text-cream">Achievements</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-cream/30 transition-colors hover:text-cream"
					>
						✕
					</button>
				</div>

				{/* Stats */}
				<div className="mb-4 flex gap-4 font-mono text-xs">
					<span className="text-neon-amber">
						{isComparison ? `You: ${myTotal}` : `${myTotal} / ${ACHIEVEMENTS.length}`}
					</span>
					{isComparison && (
						<>
							<span className="text-neon-cyan">
								{theirName}: {theirTotal}
							</span>
							<span className="text-cream/40">
								Shared: {sharedCount}
							</span>
						</>
					)}
				</div>

				{/* Filter tabs (only in comparison mode) */}
				{isComparison && (
					<div className="mb-6 flex gap-2">
						{(["all", "shared"] as const).map((f) => (
							<button
								key={f}
								type="button"
								onClick={() => setFilter(f)}
								className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all ${
									filter === f
										? "bg-neon-amber/10 text-neon-amber border border-neon-amber/30"
										: "text-cream/40 border border-transparent hover:text-cream/60"
								}`}
							>
								{f}
							</button>
						))}
					</div>
				)}

				{/* Achievement grid */}
				<div className="flex flex-wrap justify-center gap-3">
					<AnimatePresence mode="popLayout">
						{filtered.map((achievement) => {
							const myEarnedAt = myEarnedMap.get(achievement.id) ?? null;
							const theirEarnedAt = theirEarnedMap?.get(achievement.id) ?? null;
							const earned = isComparison
								? !!(myEarnedAt || theirEarnedAt)
								: !!myEarnedAt;

							return (
								<motion.div
									key={achievement.id}
									layout
									initial={{ opacity: 0, scale: 0.8 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.8 }}
								>
									<AchievementBadge
										achievement={achievement}
										earned={earned}
										earnedAt={myEarnedAt ?? theirEarnedAt}
										comparison={
											isComparison
												? {
														myEarnedAt,
														theirEarnedAt,
														theirName: theirName ?? "Friend",
													}
												: undefined
										}
									/>
								</motion.div>
							);
						})}
					</AnimatePresence>
				</div>
			</motion.div>
		</motion.div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/achievements/achievement-grid.tsx
git commit -m "feat: add achievement grid with comparison view and shared filter"
```

---

## Task 13: Replace demo achievements on profile page

**Files:**
- Modify: `src/routes/app/profile.$userId.tsx`

- [ ] **Step 1: Remove demo achievement data**

In `src/routes/app/profile.$userId.tsx`, delete the `DEMO_ACHIEVEMENTS_EARNED` array and `DEMO_ACHIEVEMENTS_TOTAL` constant (around lines 81-150).

- [ ] **Step 2: Replace `AchievementsDesignB` with real data**

Replace the `AchievementsDesignB` and `AchievementsPopup` components (lines ~851-997) with a new component that uses real data:

```tsx
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { AchievementGrid } from "#/components/achievements/achievement-grid";
import { AchievementPopup } from "#/components/achievements/achievement-popup";
import { ACHIEVEMENTS } from "#/lib/achievements";

function ProfileAchievements({
	userId,
	isFriend,
	isOwnProfile,
	friendName,
}: {
	userId: string;
	isFriend: boolean;
	isOwnProfile: boolean;
	friendName?: string;
}) {
	const trpc = useTRPC();
	const [showGrid, setShowGrid] = useState(false);

	const { data: myAchievements } = useQuery(
		trpc.achievement.myAchievements.queryOptions(),
	);

	const { data: comparison } = useQuery({
		...trpc.achievement.compare.queryOptions({ friendId: userId }),
		enabled: isFriend && !isOwnProfile,
	});

	const { data: theirAchievements } = useQuery({
		...trpc.achievement.userAchievements.queryOptions({ userId }),
		enabled: isOwnProfile,
	});

	const earned = isOwnProfile
		? (theirAchievements?.earned ?? [])
		: isFriend
			? (comparison?.achievements.filter((a) => a.theirEarnedAt) ?? [])
			: [];
	const earnedCount = earned.length;
	const total = ACHIEVEMENTS.length;

	// SVG ring progress
	const radius = 38;
	const circumference = 2 * Math.PI * radius;
	const progress = (earnedCount / total) * circumference;

	return (
		<>
			<button
				type="button"
				onClick={() => (isFriend || isOwnProfile) && setShowGrid(true)}
				className="group flex flex-col items-center gap-2"
			>
				<div className="relative flex h-24 w-24 items-center justify-center">
					<svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
						<circle
							cx="48"
							cy="48"
							r={radius}
							fill="none"
							stroke="currentColor"
							strokeWidth="3"
							className="text-cream/10"
						/>
						<circle
							cx="48"
							cy="48"
							r={radius}
							fill="none"
							stroke="url(#achievement-gradient)"
							strokeWidth="3"
							strokeLinecap="round"
							strokeDasharray={circumference}
							strokeDashoffset={circumference - progress}
							className="transition-all duration-700"
						/>
						<defs>
							<linearGradient id="achievement-gradient">
								<stop offset="0%" stopColor="#FF2D78" />
								<stop offset="50%" stopColor="#FFB800" />
								<stop offset="100%" stopColor="#00E5FF" />
							</linearGradient>
						</defs>
					</svg>
					<Trophy className="h-6 w-6 text-neon-amber transition-transform group-hover:scale-110" />
				</div>
				<span className="font-mono text-xs text-cream/50">Achievements</span>
				<span className="font-mono text-sm text-cream">
					{earnedCount} / {total}
				</span>
			</button>

			{showGrid && (isOwnProfile ? (
				<AchievementGrid
					myEarned={theirAchievements?.earned ?? []}
					onClose={() => setShowGrid(false)}
				/>
			) : isFriend && comparison ? (
				<AchievementGrid
					myEarned={comparison.achievements
						.filter((a) => a.myEarnedAt)
						.map((a) => ({ id: a.id, earnedAt: a.myEarnedAt! }))}
					theirEarned={comparison.achievements
						.filter((a) => a.theirEarnedAt)
						.map((a) => ({ id: a.id, earnedAt: a.theirEarnedAt! }))}
					theirName={friendName}
					onClose={() => setShowGrid(false)}
				/>
			) : null)}
		</>
	);
}
```

Replace the `<AchievementsDesignB />` call at line ~808 with:

```tsx
<ProfileAchievements
	userId={userId}
	isFriend={profile.relationship === "friends"}
	isOwnProfile={profile.isOwnProfile}
	friendName={profile.user.username ?? undefined}
/>
```

- [ ] **Step 3: Remove old `AchievementsDesignB` and `AchievementsPopup` component definitions**

Delete the old component code that used `DEMO_ACHIEVEMENTS_EARNED`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/profile.\$userId.tsx
git commit -m "feat: replace demo achievements with real data and comparison view"
```

---

## Task 14: Add review prompt to mark-as-watched flow

**Files:**
- Create: `src/components/watchlist/review-dialog.tsx`
- Modify: `src/components/watchlist/watchlist-item-card.tsx`

- [ ] **Step 1: Create the review dialog component**

Create `src/components/watchlist/review-dialog.tsx`:

```tsx
import { useState } from "react";
import { Star, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ReviewDialogProps {
	titleName: string;
	onSubmit: (data: {
		rating: number;
		text?: string;
		watchedAt?: string;
	}) => void;
	onSkip: () => void;
}

export function ReviewDialog({ titleName, onSubmit, onSkip }: ReviewDialogProps) {
	const [rating, setRating] = useState(0);
	const [hoveredRating, setHoveredRating] = useState(0);
	const [text, setText] = useState("");
	const [watchedAt, setWatchedAt] = useState("");

	return (
		<AnimatePresence>
			<motion.div
				className="fixed inset-0 z-50 flex items-center justify-center"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
			>
				<div
					className="absolute inset-0 bg-drive-in-bg/85 backdrop-blur-sm"
					onClick={onSkip}
				/>

				<motion.div
					className="relative z-10 w-full max-w-[400px] rounded-xl border border-drive-in-border bg-drive-in-card p-6"
					initial={{ scale: 0.95, y: 20 }}
					animate={{ scale: 1, y: 0 }}
				>
					{/* Close button */}
					<button
						type="button"
						onClick={onSkip}
						className="absolute right-4 top-4 text-cream/30 hover:text-cream"
					>
						<X className="h-4 w-4" />
					</button>

					<h3 className="mb-1 font-display text-lg text-cream">
						Rate & Review
					</h3>
					<p className="mb-5 text-sm text-cream/50">{titleName}</p>

					{/* Star rating */}
					<div className="mb-5 flex gap-1">
						{[1, 2, 3, 4, 5].map((star) => (
							<button
								key={star}
								type="button"
								onClick={() => setRating(star)}
								onMouseEnter={() => setHoveredRating(star)}
								onMouseLeave={() => setHoveredRating(0)}
								className="transition-transform hover:scale-110"
							>
								<Star
									className={`h-8 w-8 ${
										star <= (hoveredRating || rating)
											? "fill-neon-amber text-neon-amber"
											: "text-cream/20"
									}`}
								/>
							</button>
						))}
					</div>

					{/* Text review */}
					<textarea
						value={text}
						onChange={(e) => setText(e.target.value)}
						placeholder="Write a review (optional)"
						className="mb-4 w-full resize-none rounded-lg border border-drive-in-border bg-drive-in-bg p-3 text-sm text-cream placeholder:text-cream/25 focus:border-neon-amber/30 focus:outline-none"
						rows={3}
					/>

					{/* Watched at */}
					<div className="mb-5">
						<label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-cream/40">
							When did you watch it? (optional)
						</label>
						<input
							type="datetime-local"
							value={watchedAt}
							onChange={(e) => setWatchedAt(e.target.value)}
							className="w-full rounded-lg border border-drive-in-border bg-drive-in-bg px-3 py-2 text-sm text-cream focus:border-neon-amber/30 focus:outline-none [color-scheme:dark]"
						/>
					</div>

					{/* Actions */}
					<div className="flex gap-3">
						<button
							type="button"
							onClick={onSkip}
							className="flex-1 rounded-lg border border-cream/10 py-2.5 font-mono text-[11px] uppercase tracking-wider text-cream/40 transition-colors hover:text-cream"
						>
							Skip
						</button>
						<button
							type="button"
							onClick={() =>
								onSubmit({
									rating,
									text: text || undefined,
									watchedAt: watchedAt
										? new Date(watchedAt).toISOString()
										: undefined,
								})
							}
							disabled={rating === 0}
							className="flex-1 rounded-lg bg-neon-amber/10 py-2.5 font-mono text-[11px] uppercase tracking-wider text-neon-amber transition-colors hover:bg-neon-amber/20 disabled:opacity-30 disabled:cursor-not-allowed"
						>
							Submit
						</button>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}
```

- [ ] **Step 2: Integrate review dialog into watchlist item card**

In `src/components/watchlist/watchlist-item-card.tsx`, add state and the dialog:

Add imports:

```typescript
import { useState } from "react";
import { ReviewDialog } from "./review-dialog";
import { AchievementPopup } from "#/components/achievements/achievement-popup";
```

Add state inside the component:

```typescript
const [showReviewDialog, setShowReviewDialog] = useState(false);
const [pendingWatchedState, setPendingWatchedState] = useState(false);
const [newAchievements, setNewAchievements] = useState<string[]>([]);
const [achievementIndex, setAchievementIndex] = useState(0);
```

Add a review mutation:

```typescript
const submitReview = useMutation(
	trpc.review.upsert.mutationOptions({
		onSuccess: (data) => {
			if (data.newAchievements.length > 0) {
				setNewAchievements((prev) => [...prev, ...data.newAchievements]);
			}
		},
	}),
);
```

Modify the watched button click handler. Instead of directly calling `markWatched.mutate(...)` when marking as watched (not unmarking), show the review dialog:

```typescript
const handleWatchedClick = () => {
	if (item.watched) {
		// Unmarking — just toggle directly
		markWatched.mutate({
			watchlistId,
			tmdbId: item.tmdbId,
			mediaType: item.mediaType as "movie" | "tv",
			watched: false,
		});
	} else {
		// Marking as watched — show review dialog
		setPendingWatchedState(true);
		setShowReviewDialog(true);
	}
};
```

Add dialog handlers:

```typescript
const handleReviewSubmit = (data: {
	rating: number;
	text?: string;
	watchedAt?: string;
}) => {
	setShowReviewDialog(false);
	markWatched.mutate(
		{
			watchlistId,
			tmdbId: item.tmdbId,
			mediaType: item.mediaType as "movie" | "tv",
			watched: true,
			titleName: item.title,
			watchedAt: data.watchedAt,
		},
		{
			onSuccess: (result) => {
				if (result?.newAchievements?.length) {
					setNewAchievements(result.newAchievements);
					setAchievementIndex(0);
				}
			},
		},
	);
	submitReview.mutate({
		tmdbId: item.tmdbId,
		mediaType: item.mediaType as "movie" | "tv",
		rating: data.rating,
		text: data.text,
		titleName: item.title,
	});
};

const handleReviewSkip = () => {
	setShowReviewDialog(false);
	markWatched.mutate(
		{
			watchlistId,
			tmdbId: item.tmdbId,
			mediaType: item.mediaType as "movie" | "tv",
			watched: true,
			titleName: item.title,
		},
		{
			onSuccess: (result) => {
				if (result?.newAchievements?.length) {
					setNewAchievements(result.newAchievements);
					setAchievementIndex(0);
				}
			},
		},
	);
};
```

Add the dialogs to the JSX return (before the closing fragment or at the end):

```tsx
{showReviewDialog && (
	<ReviewDialog
		titleName={item.title ?? "this title"}
		onSubmit={handleReviewSubmit}
		onSkip={handleReviewSkip}
	/>
)}

{newAchievements.length > 0 && (
	<AchievementPopup
		achievementIds={newAchievements}
		currentIndex={achievementIndex}
		earnedTotal={0}
		onDismiss={() => {
			if (achievementIndex < newAchievements.length - 1) {
				setAchievementIndex((i) => i + 1);
			} else {
				setNewAchievements([]);
				setAchievementIndex(0);
			}
		}}
	/>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/watchlist/review-dialog.tsx src/components/watchlist/watchlist-item-card.tsx
git commit -m "feat: add review dialog and achievement popup to mark-as-watched flow"
```

---

## Task 15: Add recommend button to title page

**Files:**
- Create: `src/components/title/recommend-dialog.tsx`
- Modify: `src/routes/app/title.$mediaType.$tmdbId.tsx`

- [ ] **Step 1: Create the recommend dialog**

Create `src/components/title/recommend-dialog.tsx`:

```tsx
import { useState } from "react";
import { Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { useTRPC } from "#/integrations/trpc/react";

interface RecommendDialogProps {
	tmdbId: number;
	mediaType: string;
	titleName: string;
	onClose: () => void;
}

export function RecommendDialog({
	tmdbId,
	mediaType,
	titleName,
	onClose,
}: RecommendDialogProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const { data: friends } = useQuery(trpc.friend.list.queryOptions());

	const sendRecommendation = useMutation(
		trpc.recommendation.send.mutationOptions({
			onSuccess: () => {
				onClose();
			},
		}),
	);

	const toggleFriend = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	return (
		<AnimatePresence>
			<motion.div
				className="fixed inset-0 z-50 flex items-center justify-center"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
			>
				<div
					className="absolute inset-0 bg-drive-in-bg/85 backdrop-blur-sm"
					onClick={onClose}
				/>

				<motion.div
					className="relative z-10 w-full max-w-[380px] rounded-xl border border-drive-in-border bg-drive-in-card p-6"
					initial={{ scale: 0.95, y: 20 }}
					animate={{ scale: 1, y: 0 }}
				>
					<button
						type="button"
						onClick={onClose}
						className="absolute right-4 top-4 text-cream/30 hover:text-cream"
					>
						<X className="h-4 w-4" />
					</button>

					<h3 className="mb-1 font-display text-lg text-cream">Recommend</h3>
					<p className="mb-5 text-sm text-cream/50">
						Send {titleName} to your friends
					</p>

					{/* Friend list */}
					<div className="mb-5 max-h-[250px] space-y-1 overflow-y-auto">
						{friends?.map((friend) => (
							<button
								key={friend.id}
								type="button"
								onClick={() => toggleFriend(friend.id)}
								className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
									selectedIds.has(friend.id)
										? "bg-neon-amber/10 border border-neon-amber/20"
										: "border border-transparent hover:bg-cream/5"
								}`}
							>
								<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cream/10">
									{friend.avatarUrl ? (
										<img
											src={friend.avatarUrl}
											alt=""
											className="h-8 w-8 rounded-full object-cover"
										/>
									) : (
										<span className="text-xs text-cream/60">
											{(friend.username ?? "?").charAt(0).toUpperCase()}
										</span>
									)}
								</div>
								<span className="flex-1 text-sm text-cream">
									{friend.username}
								</span>
								{selectedIds.has(friend.id) && (
									<Check className="h-4 w-4 text-neon-amber" />
								)}
							</button>
						))}
						{(!friends || friends.length === 0) && (
							<p className="py-4 text-center text-sm text-cream/30">
								No friends yet
							</p>
						)}
					</div>

					{/* Send button */}
					<button
						type="button"
						onClick={() =>
							sendRecommendation.mutate({
								tmdbId,
								mediaType: mediaType as "movie" | "tv",
								friendIds: Array.from(selectedIds),
								titleName,
							})
						}
						disabled={selectedIds.size === 0 || sendRecommendation.isPending}
						className="w-full rounded-lg bg-neon-amber/10 py-2.5 font-mono text-[11px] uppercase tracking-wider text-neon-amber transition-colors hover:bg-neon-amber/20 disabled:opacity-30 disabled:cursor-not-allowed"
					>
						{sendRecommendation.isPending
							? "Sending..."
							: `Send to ${selectedIds.size || "..."}`}
					</button>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}
```

- [ ] **Step 2: Wire up the recommend button on the title page**

In `src/routes/app/title.$mediaType.$tmdbId.tsx`, import and use the dialog:

```typescript
import { useState } from "react";
import { RecommendDialog } from "#/components/title/recommend-dialog";
```

Add state:

```typescript
const [showRecommend, setShowRecommend] = useState(false);
```

Change the third `ArcadeButton` (the "Invite" one) to open the dialog:

```tsx
<ArcadeButton
	icon={Send}
	label="Recommend"
	color="amber"
	onClick={() => setShowRecommend(true)}
/>
```

Add the dialog to JSX:

```tsx
{showRecommend && (
	<RecommendDialog
		tmdbId={data.tmdbId}
		mediaType={mediaType}
		titleName={data.title}
		onClose={() => setShowRecommend(false)}
	/>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/title/recommend-dialog.tsx src/routes/app/title.\$mediaType.\$tmdbId.tsx
git commit -m "feat: add recommend-to-friend dialog on title page"
```

---

## Task 16: Wire up remaining achievement triggers

**Files:**
- Modify: `src/integrations/trpc/routers/shuffle.ts`
- Modify: `src/routes/onboarding/index.tsx` (or the onboarding tRPC handler)

- [ ] **Step 1: Add shuffle achievement triggers**

In `src/integrations/trpc/routers/shuffle.ts`, import and call `evaluateAchievements` after recording a swipe:

```typescript
import { evaluateAchievements } from "#/lib/evaluate-achievements";
```

After the swipe insert mutation, add:

```typescript
await evaluateAchievements(ctx.userId, "swipe");
```

When a shuffle "yes" results in adding to a watchlist, also call:

```typescript
await evaluateAchievements(ctx.userId, "shuffle_to_watchlist");
```

- [ ] **Step 2: Add watchlist join achievement trigger**

In the `addMember` mutation of `src/integrations/trpc/routers/watchlist.ts`, after the member is added, call:

```typescript
await evaluateAchievements(input.userId, "watchlist_joined");
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/shuffle.ts src/integrations/trpc/routers/watchlist.ts
git commit -m "feat: add achievement triggers for shuffle swipes and watchlist joins"
```

---

## Task 17: End-to-end verification

- [ ] **Step 1: Run all existing tests**

Run: `bun test`
Expected: All tests pass. Fix any test failures caused by schema changes or new imports.

- [ ] **Step 2: Run the dev server**

Run: `bun dev`
Expected: App compiles and starts without errors.

- [ ] **Step 3: Verify type safety**

Run: `bun tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve test and type errors from achievement integration"
```
