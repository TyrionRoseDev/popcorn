import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "#/db";
import { friendship, watchEvent } from "#/db/schema";

export async function ensureAreFriends(
	userId: string,
	candidateIds: string[],
	message: string,
) {
	const ids = [...new Set(candidateIds)];
	if (ids.length === 0) return;
	const friends = await db
		.select({ id: friendship.id })
		.from(friendship)
		.where(
			and(
				eq(friendship.status, "accepted"),
				or(
					and(
						eq(friendship.requesterId, userId),
						inArray(friendship.addresseeId, ids),
					),
					and(
						eq(friendship.addresseeId, userId),
						inArray(friendship.requesterId, ids),
					),
				),
			),
		);
	if (friends.length !== ids.length) {
		throw new TRPCError({ code: "FORBIDDEN", message });
	}
}

export function watchEventVisibleTo(viewerId: string) {
	return or(
		eq(watchEvent.userId, viewerId),
		eq(watchEvent.visibility, "public"),
		sql`(${watchEvent.visibility} = 'companion' AND EXISTS (
			SELECT 1 FROM watch_event_companion
			WHERE watch_event_companion.watch_event_id = ${watchEvent.id}
			AND watch_event_companion.friend_id = ${viewerId}
		))`,
	);
}
