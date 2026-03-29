import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { user, watchlist, watchlistItem, watchlistMember } from "#/db/schema";
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
			orderBy: (wl, { desc }) => [desc(wl.type), desc(wl.updatedAt)],
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
		.input(z.object({ tmdbId: z.number(), mediaType: z.string() }))
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
			orderBy: (wl, { desc }) => [desc(wl.type), desc(wl.updatedAt)],
		});
	}),

	searchUsers: protectedProcedure
		.input(z.object({ query: z.string().min(2) }))
		.query(async ({ input, ctx }) => {
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
						ne(user.id, ctx.userId),
					),
				)
				.limit(10);
		}),

	knownUsers: protectedProcedure.query(async ({ ctx }) => {
		// Get all watchlists the current user is a member of
		const myWatchlists = await db
			.select({ watchlistId: watchlistMember.watchlistId })
			.from(watchlistMember)
			.where(eq(watchlistMember.userId, ctx.userId));

		const watchlistIds = myWatchlists.map((m) => m.watchlistId);
		if (watchlistIds.length === 0) return [];

		// Get distinct co-members from those watchlists
		const coMembers = await db
			.selectDistinct({
				id: user.id,
				username: user.username,
				avatarUrl: user.avatarUrl,
			})
			.from(watchlistMember)
			.innerJoin(user, eq(watchlistMember.userId, user.id))
			.where(
				and(
					inArray(watchlistMember.watchlistId, watchlistIds),
					ne(watchlistMember.userId, ctx.userId),
				),
			)
			.limit(50);

		return coMembers;
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
			if (wl?.type === "default") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot delete the default watchlist",
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
