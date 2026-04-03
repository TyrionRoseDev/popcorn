import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import {
	and,
	eq,
	ilike,
	inArray,
	isNull,
	notInArray,
	or,
	sql,
} from "drizzle-orm";
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
import { ACHIEVEMENTS_BY_ID } from "#/lib/achievements";
import { evaluateAchievements } from "#/lib/evaluate-achievements";
import { tmdbFetch } from "#/lib/tmdb";
import { createNotification } from "./notification";

/** Fetch poster_path and title from TMDB for items missing that data, then update DB. */
async function backfillPosterData(
	items: Array<{
		tmdbId: number;
		mediaType: string;
		posterPath: string | null;
		title: string | null;
	}>,
) {
	const missing = items.filter((i) => i.posterPath === null);
	if (missing.length === 0) return;

	await Promise.allSettled(
		missing.map(async (item) => {
			try {
				const endpoint =
					item.mediaType === "tv"
						? `/tv/${item.tmdbId}`
						: `/movie/${item.tmdbId}`;
				const data = await tmdbFetch<{
					poster_path: string | null;
					title?: string;
					name?: string;
				}>(endpoint);
				const title = data.title ?? data.name ?? null;
				const posterPath = data.poster_path ?? null;
				item.posterPath = posterPath;
				item.title = item.title ?? title;
				await db
					.update(watchlistItem)
					.set({ posterPath, title: item.title })
					.where(
						and(
							eq(watchlistItem.tmdbId, item.tmdbId),
							eq(watchlistItem.mediaType, item.mediaType),
							isNull(watchlistItem.posterPath),
						),
					);
			} catch (err) {
				console.error(
					`[backfillPosterData] Failed for tmdbId=${item.tmdbId} mediaType=${item.mediaType}:`,
					err,
				);
			}
		}),
	);
}

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

async function getOrCreateDefaultWatchlist(userId: string) {
	const existing = await db.query.watchlist.findFirst({
		where: and(eq(watchlist.ownerId, userId), eq(watchlist.type, "default")),
		columns: { id: true },
	});
	if (existing) return existing;

	return db.transaction(async (tx) => {
		// Double-check inside transaction to avoid race conditions
		const check = await tx.query.watchlist.findFirst({
			where: and(eq(watchlist.ownerId, userId), eq(watchlist.type, "default")),
			columns: { id: true },
		});
		if (check) return check;

		const [wl] = await tx
			.insert(watchlist)
			.values({ name: "My Picks", ownerId: userId, type: "default" })
			.returning({ id: watchlist.id });

		await tx
			.insert(watchlistMember)
			.values({ watchlistId: wl.id, userId, role: "owner" });

		return wl;
	});
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
				items: {
					columns: {
						tmdbId: true,
						mediaType: true,
						posterPath: true,
						title: true,
					},
					limit: 20,
				},
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

		// Lazily backfill poster data for items added before the column existed (fire-and-forget)
		const allItems = watchlists.flatMap((wl) => wl.items);
		void backfillPosterData(allItems);

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

			void backfillPosterData(wl.items);

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

			return db
				.transaction(async (tx) => {
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
				})
				.then(async (wl) => {
					const newAchievements = await evaluateAchievements(
						ctx.userId,
						"watchlist_created",
					);
					return { ...wl, newAchievements };
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
			const wl = await db.query.watchlist.findFirst({
				where: eq(watchlist.id, input.watchlistId),
				columns: { type: true },
			});
			if (wl?.type === "recommendations") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot modify the Recommendations watchlist",
				});
			}
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
				posterPath: z.string().nullish(),
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
					title: input.titleName,
					posterPath: input.posterPath ?? null,
					addedBy: ctx.userId,
					titleName: input.titleName ?? null,
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
				watchedAt: z.string().datetime().optional(),
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

			const watchedAtDate = input.watched
				? input.watchedAt
					? new Date(input.watchedAt)
					: new Date()
				: null;

			await db
				.update(watchlistItem)
				.set({
					watched: input.watched,
					watchedAt: watchedAtDate,
					keptInWatchlist: false,
				})
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

				// Evaluate achievements
				const newAchievements = await evaluateAchievements(
					ctx.userId,
					"watched",
					{
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
						watchedAt: watchedAtDate ?? undefined,
						watchlistId: input.watchlistId,
					},
				);

				// Notify friends about any new achievements
				if (newAchievements.length > 0) {
					const friends = await db.query.friendship.findMany({
						where: and(
							sql`(${friendship.requesterId} = ${ctx.userId} OR ${friendship.addresseeId} = ${ctx.userId})`,
							eq(friendship.status, "accepted"),
						),
					});
					for (const f of friends) {
						const friendId =
							f.requesterId === ctx.userId ? f.addresseeId : f.requesterId;
						for (const achievementId of newAchievements) {
							const achievementDef = ACHIEVEMENTS_BY_ID.get(achievementId);
							await createNotification({
								recipientId: friendId,
								actorId: ctx.userId,
								type: "achievement_earned",
								data: {
									achievementId,
									achievementName: achievementDef?.name ?? "",
								},
							});
						}
					}
				}

				return { newAchievements };
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

			await evaluateAchievements(input.userId, "watchlist_joined");
		}),

	isWatched: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.query(async ({ input, ctx }) => {
			const defaultWl = await getOrCreateDefaultWatchlist(ctx.userId);

			const item = await db.query.watchlistItem.findFirst({
				where: and(
					eq(watchlistItem.watchlistId, defaultWl.id),
					eq(watchlistItem.tmdbId, input.tmdbId),
					eq(watchlistItem.mediaType, input.mediaType),
					eq(watchlistItem.watched, true),
				),
				columns: { watched: true, watchedSeasons: true },
			});

			if (!item) return null;
			return {
				watched: true,
				watchedSeasons: item.watchedSeasons as number[] | null,
			};
		}),

	quickMarkWatched: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				titleName: z.string().optional(),
				posterPath: z.string().nullish(),
				runtime: z.number().optional(),
				watchedSeasons: z.array(z.number()).optional(),
				seasonEpisodeCounts: z
					.array(
						z.object({
							seasonNumber: z.number(),
							episodeCount: z.number(),
						}),
					)
					.optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const defaultWl = await getOrCreateDefaultWatchlist(ctx.userId);

			// Add item if not already there
			await db
				.insert(watchlistItem)
				.values({
					watchlistId: defaultWl.id,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					title: input.titleName,
					posterPath: input.posterPath ?? null,
					addedBy: ctx.userId,
					runtime: input.runtime ?? null,
				})
				.onConflictDoNothing();

			// Get current watched state
			const item = await db.query.watchlistItem.findFirst({
				where: and(
					eq(watchlistItem.watchlistId, defaultWl.id),
					eq(watchlistItem.tmdbId, input.tmdbId),
					eq(watchlistItem.mediaType, input.mediaType),
				),
				columns: { watched: true },
			});

			// If already watched and seasons provided, update seasons (don't toggle)
			const isSeasonEdit =
				item?.watched &&
				input.watchedSeasons &&
				input.watchedSeasons.length > 0;
			const newWatched = isSeasonEdit ? true : !item?.watched;

			// Compute runtime for TV shows based on selected seasons
			let computedRuntime: number | null = input.runtime ?? null;
			if (
				newWatched &&
				input.watchedSeasons &&
				input.seasonEpisodeCounts &&
				input.runtime
			) {
				const selectedSet = new Set(input.watchedSeasons);
				const totalEpisodes = input.seasonEpisodeCounts
					.filter((s) => selectedSet.has(s.seasonNumber))
					.reduce((sum, s) => sum + s.episodeCount, 0);
				computedRuntime = input.runtime * totalEpisodes;
			}

			await db
				.update(watchlistItem)
				.set({
					watched: newWatched,
					keptInWatchlist: false,
					runtime: newWatched ? computedRuntime : null,
					watchedSeasons: newWatched ? (input.watchedSeasons ?? null) : null,
				})
				.where(
					and(
						eq(watchlistItem.watchlistId, defaultWl.id),
						eq(watchlistItem.tmdbId, input.tmdbId),
						eq(watchlistItem.mediaType, input.mediaType),
					),
				);

			return { watched: newWatched, defaultWatchlistId: defaultWl.id };
		}),

	keepInWatchlist: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const memberships = await db
				.select({ watchlistId: watchlistMember.watchlistId })
				.from(watchlistMember)
				.where(eq(watchlistMember.userId, ctx.userId));
			const wlIds = memberships.map((m) => m.watchlistId);
			if (wlIds.length === 0) return;

			await db
				.update(watchlistItem)
				.set({ keptInWatchlist: true })
				.where(
					and(
						inArray(watchlistItem.watchlistId, wlIds),
						eq(watchlistItem.tmdbId, input.tmdbId),
						eq(watchlistItem.mediaType, input.mediaType),
					),
				);
		}),

	recommendTitle: protectedProcedure
		.input(
			z.object({
				friendIds: z.array(z.string()).min(1),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				titleName: z.string().optional(),
				message: z.string().max(280).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await ensureAreFriends(ctx.userId, input.friendIds);

			for (const friendId of input.friendIds) {
				await createNotification({
					recipientId: friendId,
					actorId: ctx.userId,
					type: "recommendation_received",
					data: {
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
						titleName: input.titleName ?? "",
						message: input.message ?? "",
					},
				});
			}
		}),

	getWatchlistsForTitle: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.query(async ({ input, ctx }) => {
			const ownedWatchlists = await db
				.select({
					watchlistId: watchlistMember.watchlistId,
				})
				.from(watchlistMember)
				.where(
					and(
						eq(watchlistMember.userId, ctx.userId),
						eq(watchlistMember.role, "owner"),
					),
				);

			const wlIds = ownedWatchlists.map((m) => m.watchlistId);
			if (wlIds.length === 0) return [];

			const items = await db
				.select({
					watchlistId: watchlistItem.watchlistId,
					watchlistName: watchlist.name,
					watchlistType: watchlist.type,
				})
				.from(watchlistItem)
				.innerJoin(watchlist, eq(watchlist.id, watchlistItem.watchlistId))
				.where(
					and(
						inArray(watchlistItem.watchlistId, wlIds),
						eq(watchlistItem.tmdbId, input.tmdbId),
						eq(watchlistItem.mediaType, input.mediaType),
						eq(watchlistItem.watched, false),
					),
				);

			return items;
		}),

	removeFromMultipleWatchlists: protectedProcedure
		.input(
			z.object({
				watchlistIds: z.array(z.string()).min(1),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// Verify user owns all specified watchlists
			const ownedWatchlists = await db
				.select({ watchlistId: watchlistMember.watchlistId })
				.from(watchlistMember)
				.where(
					and(
						eq(watchlistMember.userId, ctx.userId),
						eq(watchlistMember.role, "owner"),
						inArray(watchlistMember.watchlistId, input.watchlistIds),
					),
				);

			const ownedIds = ownedWatchlists.map((m) => m.watchlistId);
			if (ownedIds.length === 0) return;

			await db
				.delete(watchlistItem)
				.where(
					and(
						inArray(watchlistItem.watchlistId, ownedIds),
						eq(watchlistItem.tmdbId, input.tmdbId),
						eq(watchlistItem.mediaType, input.mediaType),
					),
				);
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
