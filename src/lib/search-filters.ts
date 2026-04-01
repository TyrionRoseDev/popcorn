import type { FeedItem } from "#/lib/feed-assembler";
import { getMovieGenreId, getTvGenreId } from "#/lib/genre-map";

interface FilterOptions {
	type?: "all" | "movie" | "tv";
	genre?: number; // unified genre ID
	yearMin?: number;
	yearMax?: number;
	rating?: number; // minimum rating
}

export function filterResults(
	items: FeedItem[],
	options: FilterOptions,
): FeedItem[] {
	return items.filter((item) => {
		if (
			options.type &&
			options.type !== "all" &&
			item.mediaType !== options.type
		) {
			return false;
		}

		if (options.genre !== undefined) {
			const movieGenreId = getMovieGenreId(options.genre);
			const tvGenreId = getTvGenreId(options.genre);
			const matchesGenre = item.genreIds.some(
				(gid) => gid === movieGenreId || gid === tvGenreId,
			);
			if (!matchesGenre) return false;
		}

		const year = item.year ? Number.parseInt(item.year, 10) : null;
		if (
			options.yearMin !== undefined &&
			(year === null || year < options.yearMin)
		) {
			return false;
		}
		if (
			options.yearMax !== undefined &&
			(year === null || year > options.yearMax)
		) {
			return false;
		}

		if (options.rating !== undefined && item.rating < options.rating) {
			return false;
		}

		return true;
	});
}

type SortOption = "relevance" | "popularity" | "rating" | "newest" | "oldest";

export function sortResults(items: FeedItem[], sort: SortOption): FeedItem[] {
	const sorted = [...items];
	switch (sort) {
		case "rating":
			return sorted.sort((a, b) => b.rating - a.rating);
		case "newest":
			return sorted.sort((a, b) => (b.year || "").localeCompare(a.year || ""));
		case "oldest":
			return sorted.sort((a, b) => (a.year || "").localeCompare(b.year || ""));
		case "relevance":
		case "popularity":
			return sorted.sort((a, b) => b.rating - a.rating);
		default:
			return sorted;
	}
}
