import type { TRPCRouterRecord } from "@trpc/server";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { notification, user } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";

const NOTIFICATION_TYPES = [
	"watchlist_item_added",
	"watchlist_member_joined",
	"shuffle_match",
	"item_watched",
	"watchlist_invite",
	"friend_request",
	"friend_request_accepted",
	"title_reviewed",
	"recommendation_received",
	"recommendation_reviewed",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export async function createNotification(params: {
	recipientId: string;
	actorId: string;
	type: NotificationType;
	data: Record<string, unknown>;
}) {
	// Don't notify yourself
	if (params.recipientId === params.actorId) return;

	await db.insert(notification).values({
		recipientId: params.recipientId,
		actorId: params.actorId,
		type: params.type,
		data: params.data,
	});
}

function twentyDaysAgo() {
	const d = new Date();
	d.setDate(d.getDate() - 20);
	return d;
}

export const notificationRouter = {
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const rows = await db
			.select({
				id: notification.id,
				type: notification.type,
				data: notification.data,
				read: notification.read,
				actionTaken: notification.actionTaken,
				createdAt: notification.createdAt,
				actorId: notification.actorId,
				actorUsername: user.username,
				actorAvatarUrl: user.avatarUrl,
			})
			.from(notification)
			.leftJoin(user, eq(notification.actorId, user.id))
			.where(
				and(
					eq(notification.recipientId, ctx.userId),
					gte(notification.createdAt, twentyDaysAgo()),
				),
			)
			.orderBy(desc(notification.createdAt));

		return rows;
	}),

	getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
		const [result] = await db
			.select({ value: count() })
			.from(notification)
			.where(
				and(
					eq(notification.recipientId, ctx.userId),
					eq(notification.read, false),
					gte(notification.createdAt, twentyDaysAgo()),
				),
			);

		return result?.value ?? 0;
	}),

	markAsRead: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input, ctx }) => {
			await db
				.update(notification)
				.set({ read: true })
				.where(
					and(
						eq(notification.id, input.id),
						eq(notification.recipientId, ctx.userId),
					),
				);
		}),

	markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
		await db
			.update(notification)
			.set({ read: true })
			.where(
				and(
					eq(notification.recipientId, ctx.userId),
					eq(notification.read, false),
				),
			);
	}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input, ctx }) => {
			await db
				.delete(notification)
				.where(
					and(
						eq(notification.id, input.id),
						eq(notification.recipientId, ctx.userId),
					),
				);
		}),

	deleteAll: protectedProcedure.mutation(async ({ ctx }) => {
		await db
			.delete(notification)
			.where(eq(notification.recipientId, ctx.userId));
	}),
} satisfies TRPCRouterRecord;
