import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	earnedAchievement,
	friendship,
	journalEntry,
	user,
	userTitle,
	watchEvent,
	watchEventCompanion,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { fetchTitleDetails } from "#/lib/tmdb-title";
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
				watchedAt: z
					.string()
					.datetime()
					.refine((d) => new Date(d) <= new Date(), {
						message: "Watch date cannot be in the future",
					})
					.optional(),
				companions: z.array(companionSchema).optional(),
				visibility: z
					.enum(["public", "companion", "private"])
					.optional()
					.default("public"),
				titleName: z.string().optional(),
				posterPath: z.string().nullish(),
				remindMe: z.boolean().optional(),
				scope: z.enum(["episode", "season", "show"]).optional(),
				scopeSeasonNumber: z.number().optional(),
				scopeEpisodeNumber: z.number().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// Get current watch number for TV shows
			let watchNum = 1;
			if (input.mediaType === "tv") {
				const title = await db.query.userTitle.findFirst({
					where: and(
						eq(userTitle.userId, ctx.userId),
						eq(userTitle.tmdbId, input.tmdbId),
						eq(userTitle.mediaType, "tv"),
					),
					columns: { currentWatchNumber: true },
				});
				watchNum = title?.currentWatchNumber ?? 1;
			}

			let genreIds: number[] | null = null;
			try {
				const details = await fetchTitleDetails(input.mediaType, input.tmdbId);
				genreIds = details.tmdbGenreIds;
			} catch {
				// Non-critical — event still gets created without genres
			}

			// Upgrade: if user has a reciprocal event for this title+scope, delete it
			const existingReciprocal = await db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.userId, ctx.userId),
					eq(watchEvent.tmdbId, input.tmdbId),
					sql`${watchEvent.originEventId} IS NOT NULL`,
					...(input.scope
						? [
								eq(watchEvent.scope, input.scope),
								...(input.scopeSeasonNumber != null
									? [eq(watchEvent.scopeSeasonNumber, input.scopeSeasonNumber)]
									: []),
								...(input.scopeEpisodeNumber != null
									? [
											eq(
												watchEvent.scopeEpisodeNumber,
												input.scopeEpisodeNumber,
											),
										]
									: []),
							]
						: [sql`${watchEvent.scope} IS NULL`]),
					eq(watchEvent.watchNumber, watchNum),
				),
			});

			if (existingReciprocal) {
				await db
					.delete(watchEvent)
					.where(eq(watchEvent.id, existingReciprocal.id));
			}

			const [event] = await db
				.insert(watchEvent)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					titleName: input.titleName ?? "",
					rating: input.rating ?? null,
					note: input.note ?? null,
					title: input.titleName ?? null,
					posterPath: input.posterPath ?? null,
					watchedAt: input.watchedAt ? new Date(input.watchedAt) : null,
					reviewReminderAt: input.remindMe
						? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
						: null,
					genreIds,
					visibility: input.visibility,
					scope: input.scope ?? null,
					scopeSeasonNumber: input.scopeSeasonNumber ?? null,
					scopeEpisodeNumber: input.scopeEpisodeNumber ?? null,
					watchNumber: watchNum,
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

				const hasReview = !!(input.rating || input.note);
				const creator = await db.query.user.findFirst({
					where: eq(user.id, ctx.userId),
					columns: { username: true },
				});

				for (const c of input.companions) {
					if (!c.friendId) continue;

					// Dedup: skip if companion already has a watch event for this title+scope
					const existing = await db.query.watchEvent.findFirst({
						where: and(
							eq(watchEvent.userId, c.friendId),
							eq(watchEvent.tmdbId, input.tmdbId),
							...(input.scope
								? [
										eq(watchEvent.scope, input.scope),
										...(input.scopeSeasonNumber != null
											? [
													eq(
														watchEvent.scopeSeasonNumber,
														input.scopeSeasonNumber,
													),
												]
											: []),
										...(input.scopeEpisodeNumber != null
											? [
													eq(
														watchEvent.scopeEpisodeNumber,
														input.scopeEpisodeNumber,
													),
												]
											: []),
									]
								: [sql`${watchEvent.scope} IS NULL`]),
							eq(watchEvent.watchNumber, watchNum),
						),
					});

					if (!existing) {
						// Create reciprocal event
						const [reciprocal] = await db
							.insert(watchEvent)
							.values({
								userId: c.friendId,
								tmdbId: input.tmdbId,
								mediaType: input.mediaType,
								titleName: input.titleName ?? "",
								rating: null,
								note: null,
								title: input.titleName ?? null,
								posterPath: input.posterPath ?? null,
								watchedAt: input.watchedAt ? new Date(input.watchedAt) : null,
								genreIds,
								scope: input.scope ?? null,
								scopeSeasonNumber: input.scopeSeasonNumber ?? null,
								scopeEpisodeNumber: input.scopeEpisodeNumber ?? null,
								watchNumber: watchNum,
								originEventId: event.id,
								visibility: input.visibility ?? "public",
							})
							.returning();

						// Add companion link on the reciprocal event (pointing back to the creator)
						await db.insert(watchEventCompanion).values({
							watchEventId: reciprocal.id,
							friendId: ctx.userId,
							name: creator?.username ?? "",
						});
					}

					// Send notification
					await createNotification({
						recipientId: c.friendId,
						actorId: ctx.userId,
						type: hasReview ? "companion_reviewed" : "watched_with",
						data: {
							tmdbId: input.tmdbId,
							mediaType: input.mediaType,
							titleName: input.titleName ?? "",
							watchEventId: event.id,
							scope: input.scope ?? null,
							scopeSeasonNumber: input.scopeSeasonNumber ?? null,
							scopeEpisodeNumber: input.scopeEpisodeNumber ?? null,
						},
					});
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
				watchedAt: z
					.string()
					.datetime()
					.refine((d) => new Date(d) <= new Date(), {
						message: "Watch date cannot be in the future",
					})
					.optional()
					.nullable(),
				companions: z.array(companionSchema).optional(),
				visibility: z.enum(["public", "companion", "private"]).optional(),
				titleName: z.string().optional(),
				scope: z.enum(["episode", "season", "show"]).optional().nullable(),
				scopeSeasonNumber: z.number().optional().nullable(),
				scopeEpisodeNumber: z.number().optional().nullable(),
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
					...(input.watchedAt !== undefined
						? { watchedAt: input.watchedAt ? new Date(input.watchedAt) : null }
						: {}),
					...(input.scope !== undefined ? { scope: input.scope } : {}),
					...(input.scopeSeasonNumber !== undefined
						? { scopeSeasonNumber: input.scopeSeasonNumber }
						: {}),
					...(input.scopeEpisodeNumber !== undefined
						? { scopeEpisodeNumber: input.scopeEpisodeNumber }
						: {}),
					...(input.visibility !== undefined
						? { visibility: input.visibility }
						: {}),
				})
				.where(eq(watchEvent.id, input.id))
				.returning();

			if (input.companions !== undefined) {
				// Get old companions before deleting
				const oldCompanions = await db.query.watchEventCompanion.findMany({
					where: eq(watchEventCompanion.watchEventId, input.id),
				});
				const oldFriendIds = new Set(
					oldCompanions
						.filter((c) => c.friendId)
						.map((c) => c.friendId as string),
				);

				// Replace companions
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
				}

				const newFriendIds = new Set(
					input.companions
						.filter((c) => c.friendId)
						.map((c) => c.friendId as string),
				);

				// Delete reciprocal events for removed companions
				for (const oldId of oldFriendIds) {
					if (!newFriendIds.has(oldId)) {
						await db
							.delete(watchEvent)
							.where(
								and(
									eq(watchEvent.userId, oldId),
									eq(watchEvent.originEventId, input.id),
								),
							);
					}
				}

				// Create reciprocal events for newly added companions
				const creator = await db.query.user.findFirst({
					where: eq(user.id, ctx.userId),
					columns: { username: true },
				});

				for (const c of input.companions) {
					if (!c.friendId || oldFriendIds.has(c.friendId)) continue;

					// Dedup check
					const existingEvent = await db.query.watchEvent.findFirst({
						where: and(
							eq(watchEvent.userId, c.friendId),
							eq(watchEvent.tmdbId, existing.tmdbId),
							eq(watchEvent.watchNumber, existing.watchNumber),
							...(existing.scope
								? [
										eq(watchEvent.scope, existing.scope),
										...(existing.scopeSeasonNumber != null
											? [
													eq(
														watchEvent.scopeSeasonNumber,
														existing.scopeSeasonNumber,
													),
												]
											: []),
										...(existing.scopeEpisodeNumber != null
											? [
													eq(
														watchEvent.scopeEpisodeNumber,
														existing.scopeEpisodeNumber,
													),
												]
											: []),
									]
								: [sql`${watchEvent.scope} IS NULL`]),
						),
					});

					if (!existingEvent) {
						const [reciprocal] = await db
							.insert(watchEvent)
							.values({
								userId: c.friendId,
								tmdbId: existing.tmdbId,
								mediaType: existing.mediaType,
								titleName: input.titleName ?? existing.titleName,
								rating: null,
								note: null,
								title: input.titleName ?? existing.title,
								posterPath: existing.posterPath,
								watchedAt: existing.watchedAt,
								genreIds: existing.genreIds,
								scope: existing.scope,
								scopeSeasonNumber: existing.scopeSeasonNumber,
								scopeEpisodeNumber: existing.scopeEpisodeNumber,
								watchNumber: existing.watchNumber,
								originEventId: input.id,
								visibility: input.visibility ?? existing.visibility ?? "public",
							})
							.returning();

						await db.insert(watchEventCompanion).values({
							watchEventId: reciprocal.id,
							friendId: ctx.userId,
							name: creator?.username ?? "",
						});
					}

					// Notify new companion
					const hasReview = !!(
						existing.rating ||
						existing.note ||
						input.rating ||
						input.note
					);
					await createNotification({
						recipientId: c.friendId,
						actorId: ctx.userId,
						type: hasReview ? "companion_reviewed" : "watched_with",
						data: {
							tmdbId: existing.tmdbId,
							mediaType: existing.mediaType,
							titleName: input.titleName ?? existing.titleName,
							watchEventId: input.id,
							scope: existing.scope ?? null,
							scopeSeasonNumber: existing.scopeSeasonNumber ?? null,
							scopeEpisodeNumber: existing.scopeEpisodeNumber ?? null,
						},
					});
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
						.set({ watched: false, keptInWatchlist: false })
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
			const isOwnProfile = targetUserId === ctx.userId;

			const events = await db.query.watchEvent.findMany({
				where: and(
					eq(watchEvent.userId, targetUserId),
					eq(watchEvent.tmdbId, input.tmdbId),
					eq(watchEvent.mediaType, input.mediaType),
					...(!isOwnProfile
						? [
								or(
									eq(watchEvent.visibility, "public"),
									sql`(${watchEvent.visibility} = 'companion' AND EXISTS (
								SELECT 1 FROM watch_event_companion
								WHERE watch_event_companion.watch_event_id = ${watchEvent.id}
								AND watch_event_companion.friend_id = ${ctx.userId}
							))`,
								),
							]
						: []),
				),
				with: {
					companions: true,
					originEvent: {
						with: {
							user: { columns: { id: true, username: true, avatarUrl: true } },
						},
						columns: {
							id: true,
							rating: true,
							note: true,
							visibility: true,
							userId: true,
						},
					},
				},
				orderBy: (e, { desc }) => [
					desc(sql`COALESCE(${e.watchedAt}, ${e.createdAt})`),
				],
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
		.query(async ({ input, ctx }) => {
			const isOwnProfile = input.userId === ctx.userId;

			const events = await db.query.watchEvent.findMany({
				where: and(
					eq(watchEvent.userId, input.userId),
					...(input.cursor
						? [
								sql`COALESCE(${watchEvent.watchedAt}, ${watchEvent.createdAt}) < (SELECT COALESCE(watched_at, created_at) FROM watch_event WHERE id = ${input.cursor})`,
							]
						: []),
					...(!isOwnProfile
						? [
								or(
									eq(watchEvent.visibility, "public"),
									sql`(${watchEvent.visibility} = 'companion' AND EXISTS (
								SELECT 1 FROM watch_event_companion
								WHERE watch_event_companion.watch_event_id = ${watchEvent.id}
								AND watch_event_companion.friend_id = ${ctx.userId}
							))`,
								),
							]
						: []),
				),
				with: {
					companions: true,
					originEvent: {
						with: {
							user: { columns: { id: true, username: true, avatarUrl: true } },
						},
						columns: {
							id: true,
							rating: true,
							note: true,
							visibility: true,
							userId: true,
						},
					},
				},
				orderBy: (e, { desc }) => [
					desc(sql`COALESCE(${e.watchedAt}, ${e.createdAt})`),
				],
				limit: input.limit + 1,
			});

			const hasMore = events.length > input.limit;
			const raw = hasMore ? events.slice(0, input.limit) : events;
			const items = raw.map((event) => {
				if (event.userId === ctx.userId) return event;
				if (event.visibility === "public") return event;
				if (event.visibility === "companion") {
					const isCompanion = event.companions.some(
						(c) => c.friendId === ctx.userId,
					);
					if (isCompanion) return event;
				}
				return { ...event, rating: null, note: null };
			});

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
				orderBy: (e, { desc }) => [
					desc(sql`COALESCE(${e.watchedAt}, ${e.createdAt})`),
				],
				columns: { rating: true },
			});
			return event?.rating ?? null;
		}),

	getFeed: protectedProcedure
		.input(
			z.object({
				filter: z.enum(["all", "mine"]).optional().default("all"),
				userId: z.string().optional(),
				limit: z.number().min(1).max(50).optional().default(20),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			let userIds: string[];

			if (input.userId) {
				userIds = [input.userId];
			} else if (input.filter === "mine") {
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

			const cursorDate = input.cursor ? new Date(input.cursor) : undefined;

			// Fetch watch events
			const watchEvents = await db.query.watchEvent.findMany({
				where: and(
					inArray(watchEvent.userId, userIds),
					...(cursorDate ? [sql`${watchEvent.createdAt} < ${cursorDate}`] : []),
					or(
						eq(watchEvent.userId, ctx.userId),
						eq(watchEvent.visibility, "public"),
						sql`(${watchEvent.visibility} = 'companion' AND EXISTS (
							SELECT 1 FROM watch_event_companion
							WHERE watch_event_companion.watch_event_id = ${watchEvent.id}
							AND watch_event_companion.friend_id = ${ctx.userId}
						))`,
					),
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
					originEvent: {
						with: {
							user: { columns: { id: true, username: true, avatarUrl: true } },
						},
						columns: {
							id: true,
							rating: true,
							note: true,
							visibility: true,
							userId: true,
						},
					},
				},
				orderBy: (e, { desc }) => [desc(e.createdAt)],
				limit: input.limit + 1,
			});

			// Filter review content based on visibility
			const filteredWatchEvents = watchEvents.map((event) => {
				if (event.userId === ctx.userId) return event;
				if (event.visibility === "public") return event;
				if (event.visibility === "companion") {
					const isCompanion = event.companions.some(
						(c) => c.friendId === ctx.userId,
					);
					if (isCompanion) return event;
				}
				return { ...event, rating: null, note: null };
			});

			// Fetch public watchlist creations
			const watchlistCreations = await db.query.watchlist.findMany({
				where: and(
					inArray(watchlist.ownerId, userIds),
					eq(watchlist.isPublic, true),
					...(cursorDate ? [sql`${watchlist.createdAt} < ${cursorDate}`] : []),
				),
				with: {
					owner: {
						columns: {
							id: true,
							username: true,
							avatarUrl: true,
						},
					},
					items: {
						columns: { id: true },
					},
				},
				orderBy: (wl, { desc }) => [desc(wl.createdAt)],
				limit: input.limit + 1,
			});

			// Fetch public journal entries from user + friends
			const journalEntries = await db.query.journalEntry.findMany({
				where: and(
					inArray(journalEntry.userId, userIds),
					eq(journalEntry.isPublic, true),
					...(cursorDate
						? [sql`${journalEntry.createdAt} < ${cursorDate}`]
						: []),
				),
				with: {
					user: {
						columns: { id: true, username: true, avatarUrl: true },
					},
				},
				orderBy: (e, { desc }) => [desc(e.createdAt)],
				limit: input.limit + 1,
			});

			// Fetch earned achievements
			const achievements = await db.query.earnedAchievement.findMany({
				where: and(
					inArray(earnedAchievement.userId, userIds),
					...(cursorDate
						? [sql`${earnedAchievement.earnedAt} < ${cursorDate}`]
						: []),
				),
				with: {
					user: {
						columns: { id: true, username: true, avatarUrl: true },
					},
				},
				orderBy: (e, { desc }) => [desc(e.earnedAt)],
				limit: input.limit + 1,
			});

			// Merge and sort by timestamp
			type FeedItem =
				| {
						type: "watch_event";
						timestamp: Date;
						data: (typeof watchEvents)[number];
				  }
				| {
						type: "watchlist_created";
						timestamp: Date;
						data: (typeof watchlistCreations)[number];
				  }
				| {
						type: "journal_entry";
						timestamp: Date;
						data: (typeof journalEntries)[number];
				  }
				| {
						type: "achievement_earned";
						timestamp: Date;
						data: (typeof achievements)[number];
				  };

			const merged: FeedItem[] = [
				...filteredWatchEvents.map((e) => ({
					type: "watch_event" as const,
					timestamp: new Date(e.createdAt),
					data: e,
				})),
				...watchlistCreations.map((wl) => ({
					type: "watchlist_created" as const,
					timestamp: new Date(wl.createdAt),
					data: wl,
				})),
				...journalEntries.map((je) => ({
					type: "journal_entry" as const,
					timestamp: new Date(je.createdAt),
					data: je,
				})),
				...achievements.map((a) => ({
					type: "achievement_earned" as const,
					timestamp: new Date(a.earnedAt),
					data: a,
				})),
			].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

			const hasMore = merged.length > input.limit;
			const items = hasMore ? merged.slice(0, input.limit) : merged;

			return {
				items,
				nextCursor: hasMore
					? items[items.length - 1]?.timestamp.toISOString()
					: undefined,
			};
		}),
	backfillGenres: protectedProcedure.mutation(async ({ ctx }) => {
		const events = await db
			.select({
				id: watchEvent.id,
				tmdbId: watchEvent.tmdbId,
				mediaType: watchEvent.mediaType,
			})
			.from(watchEvent)
			.where(
				and(
					eq(watchEvent.userId, ctx.userId),
					sql`${watchEvent.genreIds} IS NULL`,
				),
			);

		let updated = 0;
		for (const event of events) {
			try {
				const details = await fetchTitleDetails(
					event.mediaType as "movie" | "tv",
					event.tmdbId,
				);
				await db
					.update(watchEvent)
					.set({ genreIds: details.tmdbGenreIds })
					.where(eq(watchEvent.id, event.id));
				updated++;
			} catch {
				// Skip events where TMDB lookup fails
			}
		}
		return { updated, total: events.length };
	}),
} satisfies TRPCRouterRecord;
