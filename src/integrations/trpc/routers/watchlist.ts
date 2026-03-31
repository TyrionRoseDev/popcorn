import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	block,
	friendship,
	user,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { createNotification } from "./notification";

async function assertOwner(watchlistId: string, userId: string) {
	const membership = await db.query.watchlistMember.findFirst({
		where: and(
			eq(watchlistMember.watchlistId, watchlistId),
			eq(watchlistMember.userId, userId),
			eq(watchlistMember.role, "owner"),
		),
	});
	if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
}

async function assertMember(watchlistId: string, userId: string) {
	const membership = await db.query.watchlistMember.findFirst({
		where: and(
			eq(watchlistMember.watchlistId, watchlistId),
			eq(watchlistMember.userId, userId),
		),
	});
	if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
}

async function ensureAreFriends(userId: string, candidateIds: string[]) {
	if (candidateIds.length === 0) return;
	const friends = await db
		.select({ id: friendship.id })
		.from(friendship)
		.where(
			and(
				eq(friendship.status, "accepted"),
				or(
					and(
						eq(friendship.requesterId, userId),
						inArray(friendship.addresseeId, candidateIds),
					),
					and(
						eq(friendship.addresseeId, userId),
						inArray(friendship.requesterId, candidateIds),
					),
				),
			),
		);
	if (friends.length !== candidateIds.length) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You can only invite friends to watchlists",
		});
	}
}

export const watchlistRouter = {
	list: protectedProcedure.query(async ({ ctx }) => {
		const memberships = await db
			.select({ watchlistId: watchlistMember.watchlistId })
			.from(watchlistMember)
			.where(eq(watchlistMember.userId, ctx.userId));

		const watchlistIds = memberships.map((m) => m.watchlistId);
		if (watchlistIds.length === 0) return [];

		const watchlists = await db.query.watchlist.findMany({
			where: (wl, { inArray }) => inArray(wl.id, watchlistIds),
			with: {
				items: { columns: { tmdbId: true, mediaType: true }, limit: 20 },
				members: {
					with: {
						user: { columns: { id: true, username: true, avatarUrl: true } },
					},
				},
			},
			orderBy: (wl, { desc }) => [
				sql`CASE ${wl.type} WHEN 'default' THEN 1 WHEN 'recommendations' THEN 2 WHEN 'custom' THEN 3 WHEN 'shuffle' THEN 4 ELSE 99 END`,
				desc(wl.updatedAt),
			],
		});

		return watchlists.map((wl) => ({
			...wl,
			itemCount: wl.items.length,
			memberCount: wl.members.length,
		}));
	}),

	get: protectedProcedure
		.input(z.object({ watchlistId: z.string() }))
		.query(async ({ input, ctx }) => {
			const membership = await db.query.watchlistMember.findFirst({
				where: and(
					eq(watchlistMember.watchlistId, input.watchlistId),
					eq(watchlistMember.userId, ctx.userId),
				),
			});

			const wl = await db.query.watchlist.findFirst({
				where: eq(watchlist.id, input.watchlistId),
				with: {
					items: {
						with: {
							addedByUser: {
								columns: { id: true, username: true, avatarUrl: true },
							},
							recommendedByUser: {
								columns: { id: true, username: true, avatarUrl: true },
							},
						},
						orderBy: (item, { desc }) => [desc(item.createdAt)],
					},
					members: {
						with: {
							user: {
								columns: { id: true, username: true, avatarUrl: true },
							},
						},
					},
				},
			});

			if (!wl) throw new TRPCError({ code: "NOT_FOUND" });
			if (!wl.isPublic && !membership) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			const userRole = membership?.role ?? null;
			return { ...wl, userRole };
		}),

	isBookmarked: protectedProcedure
		.input(z.object({ tmdbId: z.number(), mediaType: z.enum(["movie", "tv"]) }))
		.query(async ({ input, ctx }) => {
			const memberships = await db
				.select({ watchlistId: watchlistMember.watchlistId })
				.from(watchlistMember)
				.where(eq(watchlistMember.userId, ctx.userId));

			const watchlistIds = memberships.map((m) => m.watchlistId);
			if (watchlistIds.length === 0) return false;

			const item = await db.query.watchlistItem.findFirst({
				where: and(
					inArray(watchlistItem.watchlistId, watchlistIds),
					eq(watchlistItem.tmdbId, input.tmdbId),
					eq(watchlistItem.mediaType, input.mediaType),
				),
			});
			return !!item;
		}),

	getForDropdown: protectedProcedure.query(async ({ ctx }) => {
		const memberships = await db
			.select({
				watchlistId: watchlistMember.watchlistId,
				role: watchlistMember.role,
			})
			.from(watchlistMember)
			.where(eq(watchlistMember.userId, ctx.userId));

		const watchlistIds = memberships
			.filter((m) => m.role === "owner" || m.role === "member")
			.map((m) => m.watchlistId);

		if (watchlistIds.length === 0) return [];

		return db.query.watchlist.findMany({
			where: (wl, { inArray }) => inArray(wl.id, watchlistIds),
			columns: { id: true, name: true, type: true },
			orderBy: (wl, { desc }) => [
				sql`CASE ${wl.type} WHEN 'default' THEN 1 WHEN 'recommendations' THEN 2 WHEN 'custom' THEN 3 WHEN 'shuffle' THEN 4 ELSE 99 END`,
				desc(wl.updatedAt),
			],
		});
	}),

	searchUsers: protectedProcedure
		.input(z.object({ query: z.string().min(2) }))
		.query(async ({ input, ctx }) => {
			// Get blocked user IDs (both directions)
			const blockedIds = await db
				.select({ id: block.blockedId })
				.from(block)
				.where(eq(block.blockerId, ctx.userId));

			const blockerIds = await db
				.select({ id: block.blockerId })
				.from(block)
				.where(eq(block.blockedId, ctx.userId));

			const excludeIds = [
				ctx.userId,
				...blockedIds.map((b) => b.id),
				...blockerIds.map((b) => b.id),
			];

			return db
				.select({
					id: user.id,
					username: user.username,
					avatarUrl: user.avatarUrl,
				})
				.from(user)
				.where(
					and(
						ilike(user.username, `%${input.query}%`),
						notInArray(user.id, excludeIds),
					),
				)
				.limit(10);
		}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				isPublic: z.boolean().optional().default(false),
				memberIds: z.array(z.string()).optional().default([]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await ensureAreFriends(ctx.userId, input.memberIds);

			return db.transaction(async (tx) => {
				const [wl] = await tx
					.insert(watchlist)
					.values({
						name: input.name,
						ownerId: ctx.userId,
						isPublic: input.isPublic,
					})
					.returning();

				await tx.insert(watchlistMember).values({
					watchlistId: wl.id,
					userId: ctx.userId,
					role: "owner",
				});

				if (input.memberIds.length > 0) {
					await tx
						.insert(watchlistMember)
						.values(
							input.memberIds.map((userId) => ({
								watchlistId: wl.id,
								userId,
								role: "member",
							})),
						)
						.onConflictDoNothing();
				}

				return wl;
			});
		}),

	update: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				name: z.string().min(1).max(100).optional(),
				isPublic: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertOwner(input.watchlistId, ctx.userId);
			const { watchlistId, ...updates } = input;
			if (Object.keys(updates).length === 0) return;
			await db
				.update(watchlist)
				.set(updates)
				.where(eq(watchlist.id, watchlistId));
		}),

	delete: protectedProcedure
		.input(z.object({ watchlistId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			await assertOwner(input.watchlistId, ctx.userId);
			const wl = await db.query.watchlist.findFirst({
				where: eq(watchlist.id, input.watchlistId),
			});
			if (wl?.type === "default" || wl?.type === "recommendations") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot delete this watchlist",
				});
			}
			await db.delete(watchlist).where(eq(watchlist.id, input.watchlistId));
		}),

	addItem: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				titleName: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertMember(input.watchlistId, ctx.userId);
			const inserted = await db
				.insert(watchlistItem)
				.values({
					watchlistId: input.watchlistId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					addedBy: ctx.userId,
				})
				.onConflictDoNothing()
				.returning({ id: watchlistItem.id });

			if (inserted.length === 0) return; // Already existed, skip notifications

			// Notify other members
			const wl = await db.query.watchlist.findFirst({
				where: eq(watchlist.id, input.watchlistId),
				columns: { name: true },
			});
			const members = await db.query.watchlistMember.findMany({
				where: eq(watchlistMember.watchlistId, input.watchlistId),
				columns: { userId: true },
			});
			for (const member of members) {
				await createNotification({
					recipientId: member.userId,
					actorId: ctx.userId,
					type: "watchlist_item_added",
					data: {
						watchlistId: input.watchlistId,
						watchlistName: wl?.name ?? "",
						titleName: input.titleName ?? "",
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
					},
				});
			}
		}),

	removeItem: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertOwner(input.watchlistId, ctx.userId);
			await db
				.delete(watchlistItem)
				.where(
					and(
						eq(watchlistItem.watchlistId, input.watchlistId),
						eq(watchlistItem.tmdbId, input.tmdbId),
						eq(watchlistItem.mediaType, input.mediaType),
					),
				);
		}),

	markWatched: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				watched: z.boolean(),
				titleName: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertMember(input.watchlistId, ctx.userId);

			// Check current state to avoid no-op notifications
			const existing = await db.query.watchlistItem.findFirst({
				where: and(
					eq(watchlistItem.watchlistId, input.watchlistId),
					eq(watchlistItem.tmdbId, input.tmdbId),
					eq(watchlistItem.mediaType, input.mediaType),
				),
				columns: { watched: true },
			});

			if (!existing || existing.watched === input.watched) return;

			await db
				.update(watchlistItem)
				.set({ watched: input.watched })
				.where(
					and(
						eq(watchlistItem.watchlistId, input.watchlistId),
						eq(watchlistItem.tmdbId, input.tmdbId),
						eq(watchlistItem.mediaType, input.mediaType),
					),
				);

			// Only notify when marking as watched (not unmarking)
			if (input.watched) {
				const wl = await db.query.watchlist.findFirst({
					where: eq(watchlist.id, input.watchlistId),
					columns: { name: true, type: true },
				});
				const members = await db.query.watchlistMember.findMany({
					where: eq(watchlistMember.watchlistId, input.watchlistId),
					columns: { userId: true },
				});
				for (const member of members) {
					await createNotification({
						recipientId: member.userId,
						actorId: ctx.userId,
						type: "item_watched",
						data: {
							watchlistId: input.watchlistId,
							watchlistName: wl?.name ?? "",
							titleName: input.titleName ?? "",
							tmdbId: input.tmdbId,
							mediaType: input.mediaType,
						},
					});
				}

				// If recommended item was watched, notify the recommender
				if (wl?.type === "recommendations") {
					const item = await db.query.watchlistItem.findFirst({
						where: and(
							eq(watchlistItem.watchlistId, input.watchlistId),
							eq(watchlistItem.tmdbId, input.tmdbId),
							eq(watchlistItem.mediaType, input.mediaType),
						),
						columns: { recommendedBy: true },
					});

					if (item?.recommendedBy) {
						await createNotification({
							recipientId: item.recommendedBy,
							actorId: ctx.userId,
							type: "recommendation_reviewed",
							data: {
								titleName: input.titleName ?? "",
								tmdbId: input.tmdbId,
								mediaType: input.mediaType,
							},
						});
					}
				}
			}
		}),

	addMember: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				userId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertOwner(input.watchlistId, ctx.userId);
			const wl = await db.query.watchlist.findFirst({
				where: eq(watchlist.id, input.watchlistId),
				columns: { type: true, name: true },
			});
			if (wl?.type === "recommendations") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot invite members to the Recommendations watchlist",
				});
			}
			await ensureAreFriends(ctx.userId, [input.userId]);

			const inserted = await db
				.insert(watchlistMember)
				.values({
					watchlistId: input.watchlistId,
					userId: input.userId,
					role: "member",
				})
				.onConflictDoNothing()
				.returning({ id: watchlistMember.id });

			if (inserted.length === 0) return; // Already existed, skip notifications

			// Notify other members (including the new member)
			const members = await db.query.watchlistMember.findMany({
				where: eq(watchlistMember.watchlistId, input.watchlistId),
				columns: { userId: true },
			});
			for (const member of members) {
				await createNotification({
					recipientId: member.userId,
					actorId: ctx.userId,
					type: "watchlist_member_joined",
					data: {
						watchlistId: input.watchlistId,
						watchlistName: wl?.name ?? "",
					},
				});
			}
		}),

	removeMember: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				userId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertOwner(input.watchlistId, ctx.userId);
			if (input.userId === ctx.userId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot remove yourself as owner",
				});
			}
			await db
				.delete(watchlistMember)
				.where(
					and(
						eq(watchlistMember.watchlistId, input.watchlistId),
						eq(watchlistMember.userId, input.userId),
					),
				);
		}),
} satisfies TRPCRouterRecord;
