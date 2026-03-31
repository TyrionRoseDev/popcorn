import { createFileRoute } from "@tanstack/react-router";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "#/db";
import { watchEvent } from "#/db/schema";
import { createNotification } from "#/integrations/trpc/routers/notification";

export const Route = createFileRoute("/api/cron/review-reminders")({
	server: {
		handlers: {
			GET: async () => {
				const now = new Date();

				const dueReminders = await db.query.watchEvent.findMany({
					where: and(
						isNotNull(watchEvent.reviewReminderAt),
						lte(watchEvent.reviewReminderAt, now),
					),
				});

				let sent = 0;
				for (const event of dueReminders) {
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

					await db
						.update(watchEvent)
						.set({ reviewReminderAt: null, updatedAt: new Date() })
						.where(eq(watchEvent.id, event.id));

					sent++;
				}

				return Response.json({ ok: true, sent });
			},
		},
	},
});
