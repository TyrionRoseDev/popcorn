import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { user, watchlist, watchlistItem, watchlistMember } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";

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

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				isPublic: z.boolean().optional().default(false),
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
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertMember(input.watchlistId, ctx.userId);
			await db
				.insert(watchlistItem)
				.values({
					watchlistId: input.watchlistId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					addedBy: ctx.userId,
				})
				.onConflictDoNothing();
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
			await db
				.insert(watchlistMember)
				.values({
					watchlistId: input.watchlistId,
					userId: input.userId,
					role: "member",
				})
				.onConflictDoNothing();
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
