import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "#/db";
import { episodeWatch, watchlistItem } from "#/db/schema";
import { fetchSeasonDetails } from "#/lib/tmdb-title";

async function migrateWatchedSeasons() {
	console.log("Starting watchedSeasons migration...");

	// Find all TV watchlist items with watchedSeasons data
	const tvItems = await db.query.watchlistItem.findMany({
		where: and(
			eq(watchlistItem.mediaType, "tv"),
			isNotNull(watchlistItem.watchedSeasons),
		),
		with: {
			watchlist: {
				with: { owner: { columns: { id: true } } },
			},
		},
	});

	console.log(`Found ${tvItems.length} TV items with watchedSeasons`);

	for (const item of tvItems) {
		const userId = item.watchlist.owner.id;
		const seasons = item.watchedSeasons as number[];

		if (!seasons || seasons.length === 0) continue;

		console.log(
			`Migrating tmdbId=${item.tmdbId} for user=${userId}, seasons=${seasons.join(",")}`,
		);

		for (const seasonNum of seasons) {
			try {
				const episodes = await fetchSeasonDetails(item.tmdbId, seasonNum);

				const values = episodes.map((ep) => ({
					userId,
					tmdbId: item.tmdbId,
					seasonNumber: ep.seasonNumber,
					episodeNumber: ep.episodeNumber,
					runtime: ep.runtime ?? 0,
				}));

				if (values.length > 0) {
					await db.insert(episodeWatch).values(values).onConflictDoNothing();
				}
			} catch (error) {
				console.error(
					`Failed to fetch season ${seasonNum} for tmdbId=${item.tmdbId}:`,
					error,
				);
			}
		}

		// Clear old watchedSeasons and TV runtime from watchlist item
		await db
			.update(watchlistItem)
			.set({ watchedSeasons: null, runtime: null })
			.where(eq(watchlistItem.id, item.id));
	}

	console.log("Migration complete.");
}

migrateWatchedSeasons()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Migration failed:", err);
		process.exit(1);
	});
