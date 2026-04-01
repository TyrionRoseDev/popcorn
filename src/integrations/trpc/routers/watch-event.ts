import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	friendship,
	watchEvent,
	watchEventCompanion,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { createNotification } from "./notification";

const companionSchema = z.object({
	friendId: z.string().optional(),
	name: z.string().min(1).max(100),
});

export const watchEventRouter = {
	create: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				rating: z.number().min(1).max(5).optional(),
				note: z.string().max(1000).optional(),
				watchedAt: z.string().datetime().optional(),
				companions: z.array(companionSchema).optional(),
				titleName: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const [event] = await db
				.insert(watchEvent)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					rating: input.rating ?? null,
					note: input.note ?? null,
					watchedAt: input.watchedAt ? new Date(input.watchedAt) : new Date(),
				})
				.returning();

			if (input.companions && input.companions.length > 0) {
				await db.insert(watchEventCompanion).values(
					input.companions.map((c) => ({
						watchEventId: event.id,
						friendId: c.friendId ?? null,
						name: c.name,
					})),
				);

				for (const c of input.companions) {
					if (c.friendId) {
						await createNotification({
							recipientId: c.friendId,
							actorId: ctx.userId,
							type: "watched_with",
							data: {
								tmdbId: input.tmdbId,
								mediaType: input.mediaType,
								titleName: input.titleName ?? "",
								watchEventId: event.id,
							},
						});
					}
				}
			}

			const userMemberships = await db.query.watchlistMember.findMany({
				where: eq(watchlistMember.userId, ctx.userId),
				columns: { watchlistId: true },
			});
			for (const membership of userMemberships) {
				const item = await db.query.watchlistItem.findFirst({
					where: and(
						eq(watchlistItem.watchlistId, membership.watchlistId),
						eq(watchlistItem.tmdbId, input.tmdbId),
						eq(watchlistItem.mediaType, input.mediaType),
					),
				});
				if (!item) continue;
				const wl = await db.query.watchlist.findFirst({
					where: eq(watchlist.id, membership.watchlistId),
					columns: { name: true },
				});
				const members = await db.query.watchlistMember.findMany({
					where: eq(watchlistMember.watchlistId, membership.watchlistId),
					columns: { userId: true },
				});
				for (const member of members) {
					await createNotification({
						recipientId: member.userId,
						actorId: ctx.userId,
						type: "item_watched",
						data: {
							watchlistId: membership.watchlistId,
							watchlistName: wl?.name ?? "",
							titleName: input.titleName ?? "",
							tmdbId: input.tmdbId,
							mediaType: input.mediaType,
						},
					});
				}
			}

			return event;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				rating: z.number().min(1).max(5).optional().nullable(),
				note: z.string().max(1000).optional().nullable(),
				watchedAt: z.string().datetime().optional(),
				companions: z.array(companionSchema).optional(),
				titleName: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.id, input.id),
					eq(watchEvent.userId, ctx.userId),
				),
			});
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const [updated] = await db
				.update(watchEvent)
				.set({
					...(input.rating !== undefined ? { rating: input.rating } : {}),
					...(input.note !== undefined ? { note: input.note } : {}),
					...(input.watchedAt ? { watchedAt: new Date(input.watchedAt) } : {}),
				})
				.where(eq(watchEvent.id, input.id))
				.returning();

			if (input.companions !== undefined) {
				await db
					.delete(watchEventCompanion)
					.where(eq(watchEventCompanion.watchEventId, input.id));

				if (input.companions.length > 0) {
					await db.insert(watchEventCompanion).values(
						input.companions.map((c) => ({
							watchEventId: input.id,
							friendId: c.friendId ?? null,
							name: c.name,
						})),
					);

					for (const c of input.companions) {
						if (c.friendId) {
							await createNotification({
								recipientId: c.friendId,
								actorId: ctx.userId,
								type: "watched_with",
								data: {
									tmdbId: existing.tmdbId,
									mediaType: existing.mediaType,
									titleName: input.titleName ?? "",
									watchEventId: input.id,
								},
							});
						}
					}
				}
			}

			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.id, input.id),
					eq(watchEvent.userId, ctx.userId),
				),
			});
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			await db.delete(watchEvent).where(eq(watchEvent.id, input.id));

			const remaining = await db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.userId, ctx.userId),
					eq(watchEvent.tmdbId, existing.tmdbId),
					eq(watchEvent.mediaType, existing.mediaType),
				),
			});

			if (!remaining) {
				const memberships = await db.query.watchlistMember.findMany({
					where: eq(watchlistMember.userId, ctx.userId),
					columns: { watchlistId: true },
				});
				const wlIds = memberships.map((m) => m.watchlistId);

				if (wlIds.length > 0) {
					await db
						.update(watchlistItem)
						.set({ watched: false })
						.where(
							and(
								inArray(watchlistItem.watchlistId, wlIds),
								eq(watchlistItem.tmdbId, existing.tmdbId),
								eq(watchlistItem.mediaType, existing.mediaType),
							),
						);
				}
			}

			return { deleted: true };
		}),

	getForTitle: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				userId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const targetUserId = input.userId ?? ctx.userId;
			const events = await db.query.watchEvent.findMany({
				where: and(
					eq(watchEvent.userId, targetUserId),
					eq(watchEvent.tmdbId, input.tmdbId),
					eq(watchEvent.mediaType, input.mediaType),
				),
				with: {
					companions: true,
				},
				orderBy: (e, { desc }) => [desc(e.watchedAt)],
			});
			return events;
		}),

	getUserEvents: protectedProcedure
		.input(
			z.object({
				userId: z.string(),
				limit: z.number().min(1).max(50).optional().default(20),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			const events = await db.query.watchEvent.findMany({
				where: and(
					eq(watchEvent.userId, input.userId),
					...(input.cursor
						? [
								sql`${watchEvent.watchedAt} < (SELECT watched_at FROM watch_event WHERE id = ${input.cursor})`,
							]
						: []),
				),
				with: {
					companions: true,
				},
				orderBy: (e, { desc }) => [desc(e.watchedAt)],
				limit: input.limit + 1,
			});

			const hasMore = events.length > input.limit;
			const items = hasMore ? events.slice(0, input.limit) : events;

			return {
				items,
				nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
			};
		}),

	getLatestRating: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.query(async ({ input, ctx }) => {
			const event = await db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.userId, ctx.userId),
					eq(watchEvent.tmdbId, input.tmdbId),
					eq(watchEvent.mediaType, input.mediaType),
					sql`${watchEvent.rating} IS NOT NULL`,
				),
				orderBy: (e, { desc }) => [desc(e.watchedAt)],
				columns: { rating: true },
			});
			return event?.rating ?? null;
		}),

	getFeed: protectedProcedure
		.input(
			z.object({
				filter: z.enum(["all", "mine"]).optional().default("all"),
				limit: z.number().min(1).max(50).optional().default(20),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			let userIds: string[];

			if (input.filter === "mine") {
				userIds = [ctx.userId];
			} else {
				const friendships = await db.query.friendship.findMany({
					where: and(
						or(
							eq(friendship.requesterId, ctx.userId),
							eq(friendship.addresseeId, ctx.userId),
						),
						eq(friendship.status, "accepted"),
					),
				});
				const friendIds = friendships.map((f) =>
					f.requesterId === ctx.userId ? f.addresseeId : f.requesterId,
				);
				userIds = [ctx.userId, ...friendIds];
			}

			const events = await db.query.watchEvent.findMany({
				where: and(
					inArray(watchEvent.userId, userIds),
					...(input.cursor
						? [
								sql`${watchEvent.watchedAt} < (SELECT watched_at FROM watch_event WHERE id = ${input.cursor})`,
							]
						: []),
				),
				with: {
					companions: true,
					user: {
						columns: {
							id: true,
							username: true,
							avatarUrl: true,
						},
					},
				},
				orderBy: (e, { desc }) => [desc(e.watchedAt)],
				limit: input.limit + 1,
			});

			const hasMore = events.length > input.limit;
			const items = hasMore ? events.slice(0, input.limit) : events;

			return {
				items,
				nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
			};
		}),
} satisfies TRPCRouterRecord;
