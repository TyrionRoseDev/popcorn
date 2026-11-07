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

export async function hideInvisibleOrigins<
	E extends { originEventId: string | null; originEvent: unknown },
>(viewerId: string, events: E[]): Promise<E[]> {
	const originIds = [
		...new Set(
			events.flatMap((e) => (e.originEventId ? [e.originEventId] : [])),
		),
	];
	if (originIds.length === 0) return events;
	const visible = await db
		.select({ id: watchEvent.id })
		.from(watchEvent)
		.where(
			and(inArray(watchEvent.id, originIds), watchEventVisibleTo(viewerId)),
		);
	const visibleIds = new Set(visible.map((r) => r.id));
	return events.map((e) =>
		e.originEventId && !visibleIds.has(e.originEventId)
			? { ...e, originEvent: null }
			: e,
	);
}
