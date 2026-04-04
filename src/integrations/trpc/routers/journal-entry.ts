import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { journalEntry, userTitle } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";

export const journalEntryRouter = {
	create: protectedProcedure
		.input(
			z
				.object({
					tmdbId: z.number(),
					titleName: z.string(),
					scope: z.enum(["episode", "season", "show"]),
					seasonNumber: z.number().optional(),
					episodeNumber: z.number().optional(),
					note: z.string().min(1).max(2000),
					isPublic: z.boolean().default(false),
				})
				.superRefine((data, ctx) => {
					if (data.scope === "episode") {
						if (data.seasonNumber == null)
							ctx.addIssue({
								code: z.ZodIssueCode.custom,
								path: ["seasonNumber"],
								message: "seasonNumber is required for episode scope",
							});
						if (data.episodeNumber == null)
							ctx.addIssue({
								code: z.ZodIssueCode.custom,
								path: ["episodeNumber"],
								message: "episodeNumber is required for episode scope",
							});
					} else if (data.scope === "season") {
						if (data.seasonNumber == null)
							ctx.addIssue({
								code: z.ZodIssueCode.custom,
								path: ["seasonNumber"],
								message: "seasonNumber is required for season scope",
							});
					}
				}),
		)
		.mutation(async ({ input, ctx }) => {
			const title = await db.query.userTitle.findFirst({
				where: and(
					eq(userTitle.userId, ctx.userId),
					eq(userTitle.tmdbId, input.tmdbId),
					eq(userTitle.mediaType, "tv"),
				),
				columns: { currentWatchNumber: true },
			});
			const watchNum = title?.currentWatchNumber ?? 1;

			const [entry] = await db
				.insert(journalEntry)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					titleName: input.titleName,
					scope: input.scope,
					seasonNumber: input.seasonNumber ?? null,
					episodeNumber: input.episodeNumber ?? null,
					note: input.note,
					isPublic: input.isPublic,
					watchNumber: watchNum,
				})
				.returning();
			return entry;
		}),

	update: protectedProcedure
		.input(
			z
				.object({
					id: z.string(),
					note: z.string().min(1).max(2000).optional(),
					isPublic: z.boolean().optional(),
				})
				.refine(
					(data) => data.note !== undefined || data.isPublic !== undefined,
					{
						message: "At least one of 'note' or 'isPublic' must be provided",
					},
				),
		)
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.journalEntry.findFirst({
				where: and(
					eq(journalEntry.id, input.id),
					eq(journalEntry.userId, ctx.userId),
				),
			});
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
			const [updated] = await db
				.update(journalEntry)
				.set({
					...(input.note !== undefined && { note: input.note }),
					...(input.isPublic !== undefined && { isPublic: input.isPublic }),
				})
				.where(eq(journalEntry.id, input.id))
				.returning();
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.journalEntry.findFirst({
				where: and(
					eq(journalEntry.id, input.id),
					eq(journalEntry.userId, ctx.userId),
				),
			});
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
			await db.delete(journalEntry).where(eq(journalEntry.id, input.id));
			return { success: true };
		}),

	/** Get all journal entries for a specific show */
	getForShow: protectedProcedure
		.input(z.object({ tmdbId: z.number() }))
		.query(async ({ input, ctx }) => {
			return db.query.journalEntry.findMany({
				where: and(
					eq(journalEntry.userId, ctx.userId),
					eq(journalEntry.tmdbId, input.tmdbId),
				),
				orderBy: [desc(journalEntry.createdAt)],
			});
		}),

	/** Get all journal entries across all shows (for Journal tab) */
	getAll: protectedProcedure
		.input(
			z.object({
				userId: z.string().optional(),
				limit: z.number().min(1).max(50).default(20),
				cursor: z.string().optional(),
				tmdbId: z.number().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const targetUserId = input.userId ?? ctx.userId;
			const isSelf = targetUserId === ctx.userId;
			const cursorDate = input.cursor ? new Date(input.cursor) : undefined;
			const entries = await db.query.journalEntry.findMany({
				where: and(
					eq(journalEntry.userId, targetUserId),
					// Only show public entries when viewing someone else's profile
					...(!isSelf ? [eq(journalEntry.isPublic, true)] : []),
					...(input.tmdbId ? [eq(journalEntry.tmdbId, input.tmdbId)] : []),
					...(cursorDate
						? [sql`${journalEntry.createdAt} < ${cursorDate}`]
						: []),
				),
				orderBy: [desc(journalEntry.createdAt)],
				limit: input.limit + 1,
			});
			const hasMore = entries.length > input.limit;
			const items = hasMore ? entries.slice(0, input.limit) : entries;
			return {
				items,
				nextCursor: hasMore
					? items[items.length - 1]?.createdAt.toISOString()
					: undefined,
			};
		}),
} satisfies TRPCRouterRecord;
