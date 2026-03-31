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

export async function evaluateAchievements(
	userId: string,
	context: ActionContext,
	extra?: {
		tmdbId?: number;
		mediaType?: string;
		watchedAt?: Date;
		watchlistId?: string;
	},
): Promise<string[]> {
	// 1. Query already-earned achievement IDs
	const earned = await db
		.select({ achievementId: earnedAchievement.achievementId })
		.from(earnedAchievement)
		.where(eq(earnedAchievement.userId, userId));

	const earnedIds = new Set(earned.map((e) => e.achievementId));

	// 2. Filter to un-earned achievements whose condition type appears in the action context
	const contextConditionTypes = ACTION_CONTEXT_MAP[context];
	const candidates = ACHIEVEMENTS.filter(
		(a) =>
			!earnedIds.has(a.id) &&
			contextConditionTypes.includes(a.condition.type),
	);

	// 3. Evaluate each candidate
	const newlyEarned: string[] = [];

	for (const achievement of candidates) {
		const met = await checkCondition(
			achievement,
			userId,
			earnedIds,
			extra,
		);

		if (met) {
			// 4. Insert into earnedAchievement table
			await db
				.insert(earnedAchievement)
				.values({
					userId,
					achievementId: achievement.id,
				})
				.onConflictDoNothing();

			earnedIds.add(achievement.id);
			newlyEarned.push(achievement.id);
		}
	}

	// 5. Return newly-earned IDs
	return newlyEarned;
}

async function checkCondition(
	achievement: AchievementDefinition,
	userId: string,
	earnedIds: Set<string>,
	extra?: {
		tmdbId?: number;
		mediaType?: string;
		watchedAt?: Date;
		watchlistId?: string;
	},
): Promise<boolean> {
	const condition: AchievementCondition = achievement.condition;

	switch (condition.type) {
		case "watchedCount": {
			const result = await db
				.select({ value: count() })
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.addedBy, userId),
						eq(watchlistItem.watched, true),
					),
				);
			return (result[0]?.value ?? 0) >= condition.threshold;
		}

		case "genreCount": {
			// Simplified placeholder: count distinct mediaType values from watched items
			const result = await db
				.selectDistinct({ mediaType: watchlistItem.mediaType })
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.addedBy, userId),
						eq(watchlistItem.watched, true),
					),
				);
			return result.length >= condition.threshold;
		}

		case "genreCountAll": {
			// Placeholder — real genre tracking needs TMDB data
			return false;
		}

		case "watchedAtTime": {
			if (!extra?.watchedAt) return false;
			const date = extra.watchedAt;
			const hours = date.getHours();
			const minutes = date.getMinutes();
			const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
			return timeStr >= condition.after && timeStr <= condition.before;
		}

		case "watchedWithinWindow": {
			if (!extra?.watchedAt) return false;
			const windowStart = new Date(
				extra.watchedAt.getTime() - condition.hours * 60 * 60 * 1000,
			);
			const result = await db
				.select({ value: count() })
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.addedBy, userId),
						eq(watchlistItem.watched, true),
						gte(watchlistItem.watchedAt, windowStart),
					),
				);
			return (result[0]?.value ?? 0) >= condition.count;
		}

		case "friendCount": {
			const result = await db
				.select({ value: count() })
				.from(friendship)
				.where(
					sql`(${friendship.requesterId} = ${userId} OR ${friendship.addresseeId} = ${userId}) AND ${friendship.status} = 'accepted'`,
				);
			return (result[0]?.value ?? 0) >= condition.threshold;
		}

		case "joinedCollabWatchlist": {
			const result = await db
				.select({ value: count() })
				.from(watchlistMember)
				.where(eq(watchlistMember.userId, userId));
			return (result[0]?.value ?? 0) >= 1;
		}

		case "sameTitleSameDay": {
			if (!extra?.tmdbId || !extra?.watchedAt) return false;
			const watchedDay = extra.watchedAt.toISOString().slice(0, 10);

			// Get friend IDs
			const friends = await db
				.select({
					friendId: sql<string>`CASE WHEN ${friendship.requesterId} = ${userId} THEN ${friendship.addresseeId} ELSE ${friendship.requesterId} END`,
				})
				.from(friendship)
				.where(
					sql`(${friendship.requesterId} = ${userId} OR ${friendship.addresseeId} = ${userId}) AND ${friendship.status} = 'accepted'`,
				);

			if (friends.length === 0) return false;

			const friendIds = friends.map((f) => f.friendId);

			// Check if any friend watched the same title on the same day
			const result = await db
				.select({ value: count() })
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.tmdbId, extra.tmdbId),
						eq(watchlistItem.watched, true),
						sql`${watchlistItem.addedBy} = ANY(ARRAY[${sql.join(friendIds.map((id) => sql`${id}`), sql`, `)}]::text[])`,
						sql`DATE(${watchlistItem.watchedAt}) = ${watchedDay}`,
					),
				);
			return (result[0]?.value ?? 0) >= 1;
		}

		case "totalSwipes": {
			const result = await db
				.select({ value: count() })
				.from(shuffleSwipe)
				.where(eq(shuffleSwipe.userId, userId));
			return (result[0]?.value ?? 0) >= condition.threshold;
		}

		case "shuffleToWatchlist": {
			const result = await db
				.select({ value: count() })
				.from(shuffleSwipe)
				.where(
					and(
						eq(shuffleSwipe.userId, userId),
						eq(shuffleSwipe.action, "yes"),
					),
				);
			return (result[0]?.value ?? 0) >= 1;
		}

		case "watchlistCount": {
			const result = await db
				.select({ value: count() })
				.from(watchlist)
				.where(eq(watchlist.ownerId, userId));
			return (result[0]?.value ?? 0) >= condition.threshold;
		}

		case "clearedWatchlist": {
			if (extra?.watchlistId) {
				return isWatchlistCleared(extra.watchlistId, condition.minItems);
			}
			// Check all watchlists the user is a member of
			const memberships = await db
				.select({ watchlistId: watchlistMember.watchlistId })
				.from(watchlistMember)
				.where(eq(watchlistMember.userId, userId));

			for (const { watchlistId } of memberships) {
				if (await isWatchlistCleared(watchlistId, condition.minItems)) {
					return true;
				}
			}
			return false;
		}

		case "rewatch": {
			if (!extra?.tmdbId || !extra?.mediaType) return false;
			// Check if the item already had a watchedAt set before this watch
			const result = await db
				.select({ watchedAt: watchlistItem.watchedAt })
				.from(watchlistItem)
				.where(
					and(
						eq(watchlistItem.addedBy, userId),
						eq(watchlistItem.tmdbId, extra.tmdbId),
						eq(watchlistItem.mediaType, extra.mediaType),
						eq(watchlistItem.watched, true),
					),
				);
			// If there's a record and it had a watchedAt, it was previously watched
			return result.some((item) => item.watchedAt !== null);
		}

		case "sentRecommendation": {
			const result = await db
				.select({ value: count() })
				.from(recommendation)
				.where(eq(recommendation.senderId, userId));
			return (result[0]?.value ?? 0) >= 1;
		}

		case "recWatched": {
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
			const result = await db.execute(sql`
				SELECT COUNT(*) as value FROM ${recommendation} r
				JOIN ${review} rv ON rv.tmdb_id = r.tmdb_id
					AND rv.media_type = r.media_type
					AND rv.user_id = r.recipient_id
					AND rv.rating >= ${condition.minRating}
				WHERE r.sender_id = ${userId}
			`);
			return (Number(result.rows?.[0]?.value) ?? 0) >= 1;
		}

		case "firstReview": {
			const result = await db
				.select({ value: count() })
				.from(review)
				.where(eq(review.userId, userId));
			return (result[0]?.value ?? 0) >= 1;
		}

		case "reviewCount": {
			const result = await db
				.select({ value: count() })
				.from(review)
				.where(eq(review.userId, userId));
			return (result[0]?.value ?? 0) >= condition.threshold;
		}

		case "onboardingCompleted": {
			const result = await db
				.select({ onboardingCompleted: user.onboardingCompleted })
				.from(user)
				.where(eq(user.id, userId));
			return result[0]?.onboardingCompleted === true;
		}

		case "achievementCount": {
			return earnedIds.size >= condition.threshold;
		}

		case "achievementCountAll": {
			return earnedIds.size >= TOTAL_ACHIEVEMENTS - 1;
		}

		default: {
			condition satisfies never;
			return false;
		}
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
