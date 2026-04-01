import { createFileRoute } from "@tanstack/react-router";
import { and, isNotNull, lte } from "drizzle-orm";
import { db } from "#/db";
import { watchEvent } from "#/db/schema";
import { env } from "#/env";
import { createNotification } from "#/integrations/trpc/routers/notification";

export const Route = createFileRoute("/api/cron/review-reminders")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const authHeader = request.headers.get("authorization");
				if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
					return new Response("Unauthorized", { status: 401 });
				}

				const now = new Date();

				// Atomically claim due reminders by clearing reviewReminderAt and returning affected rows
				const claimed = await db
					.update(watchEvent)
					.set({ reviewReminderAt: null, updatedAt: new Date() })
					.where(
						and(
							isNotNull(watchEvent.reviewReminderAt),
							lte(watchEvent.reviewReminderAt, now),
						),
					)
					.returning({
						id: watchEvent.id,
						userId: watchEvent.userId,
						titleName: watchEvent.titleName,
						tmdbId: watchEvent.tmdbId,
						mediaType: watchEvent.mediaType,
					});

				let sent = 0;
				for (const event of claimed) {
					await createNotification({
						recipientId: event.userId,
						actorId: event.userId,
						type: "review_reminder",
						data: {
							titleName: event.titleName,
							tmdbId: event.tmdbId,
							mediaType: event.mediaType,
							watchEventId: event.id,
						},
					});

					sent++;
				}

				return Response.json({ ok: true, sent });
			},
		},
	},
});
