import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { journalEntry } from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";

export const journalEntryRouter = {
	create: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				titleName: z.string(),
				scope: z.enum(["episode", "season", "show"]),
				seasonNumber: z.number().optional(),
				episodeNumber: z.number().optional(),
				note: z.string().min(1).max(2000),
				isPublic: z.boolean().default(false),
			}),
		)
		.mutation(async ({ input, ctx }) => {
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
				})
				.returning();
			return entry;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				note: z.string().min(1).max(2000).optional(),
				isPublic: z.boolean().optional(),
			}),
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
				limit: z.number().min(1).max(50).default(20),
				cursor: z.string().optional(),
				tmdbId: z.number().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const cursorDate = input.cursor ? new Date(input.cursor) : undefined;
			const entries = await db.query.journalEntry.findMany({
				where: and(
					eq(journalEntry.userId, ctx.userId),
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
