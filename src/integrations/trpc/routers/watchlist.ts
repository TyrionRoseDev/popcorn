import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { user, watchlist, watchlistMember } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";

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
			orderBy: (wl, { desc }) => [desc(wl.isDefault), desc(wl.updatedAt)],
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
			columns: { id: true, name: true, isDefault: true },
			orderBy: (wl, { desc }) => [desc(wl.isDefault), desc(wl.updatedAt)],
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
} satisfies TRPCRouterRecord;
