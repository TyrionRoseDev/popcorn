import type { TRPCRouterRecord } from "@trpc/server";
import { eq, or } from "drizzle-orm";
import { db } from "#/db";
import {
	block,
	friendship,
	user,
	userGenre,
	userTitle,
	watchlist,
	watchlistItem,
} from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { getUnifiedGenreById } from "#/lib/genre-map";

export const userRouter = {
	exportData: protectedProcedure.mutation(async ({ ctx }) => {
		const userId = ctx.userId;

		const [profile] = await db
			.select({
				username: user.username,
				email: user.email,
				bio: user.bio,
				favouriteFilmTmdbId: user.favouriteFilmTmdbId,
				favouriteGenreId: user.favouriteGenreId,
				avatarUrl: user.avatarUrl,
				createdAt: user.createdAt,
			})
			.from(user)
			.where(eq(user.id, userId));

		const genres = await db
			.select({ genreId: userGenre.genreId })
			.from(userGenre)
			.where(eq(userGenre.userId, userId));

		const titles = await db
			.select({
				tmdbId: userTitle.tmdbId,
				mediaType: userTitle.mediaType,
				createdAt: userTitle.createdAt,
			})
			.from(userTitle)
			.where(eq(userTitle.userId, userId));

		const watchlists = await db
			.select({
				id: watchlist.id,
				name: watchlist.name,
				type: watchlist.type,
				isPublic: watchlist.isPublic,
				createdAt: watchlist.createdAt,
			})
			.from(watchlist)
			.where(eq(watchlist.ownerId, userId));

		const watchlistIds = watchlists.map((w) => w.id);
		const items =
			watchlistIds.length > 0
				? await db
						.select({
							watchlistId: watchlistItem.watchlistId,
							tmdbId: watchlistItem.tmdbId,
							mediaType: watchlistItem.mediaType,
							title: watchlistItem.title,
							watched: watchlistItem.watched,
							createdAt: watchlistItem.createdAt,
						})
						.from(watchlistItem)
						.where(
							or(
								...watchlistIds.map((id) => eq(watchlistItem.watchlistId, id)),
							),
						)
				: [];

		const friends = await db
			.select({
				requesterId: friendship.requesterId,
				addresseeId: friendship.addresseeId,
				status: friendship.status,
				createdAt: friendship.createdAt,
			})
			.from(friendship)
			.where(
				or(
					eq(friendship.requesterId, userId),
					eq(friendship.addresseeId, userId),
				),
			);

		const blocks = await db
			.select({
				blockedId: block.blockedId,
				createdAt: block.createdAt,
			})
			.from(block)
			.where(eq(block.blockerId, userId));

		return {
			exportedAt: new Date().toISOString(),
			profile: {
				...profile,
				favouriteGenreName: profile.favouriteGenreId
					? (getUnifiedGenreById(profile.favouriteGenreId)?.name ?? null)
					: null,
			},
			genres: genres.map((g) => ({
				genreId: g.genreId,
				name: getUnifiedGenreById(g.genreId)?.name ?? "Unknown",
			})),
			titles,
			watchlists: watchlists.map((w) => ({
				...w,
				items: items.filter((i) => i.watchlistId === w.id),
			})),
			friends: friends.map((f) => ({
				friendUserId: f.requesterId === userId ? f.addresseeId : f.requesterId,
				status: f.status,
				createdAt: f.createdAt,
			})),
			blocks,
		};
	}),
} satisfies TRPCRouterRecord;
