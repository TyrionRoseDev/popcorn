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

/**
 * Bayesian-weighted rating: prevents low-vote-count titles (e.g. 10/10 with
 * 1 vote) from dominating. Pulls ratings toward a prior mean unless backed
 * by enough votes.
 *   weightedRating = (v / (v + m)) * R + (m / (v + m)) * C
 * where v = vote count, m = minimum votes for full weight, R = raw rating,
 * C = prior mean (assumed ~6.5 across TMDB).
 */
function weightedRating(rating: number, voteCount: number): number {
	const m = 100; // minimum votes for full confidence
	const C = 6.5; // prior mean
	return (voteCount / (voteCount + m)) * rating + (m / (voteCount + m)) * C;
}

export function sortResults(
	items: FeedItem[],
	sort: SortOption,
	query?: string,
): FeedItem[] {
	const sorted = [...items];
	switch (sort) {
		case "rating":
			return sorted.sort(
				(a, b) =>
					weightedRating(b.rating, b.voteCount) -
					weightedRating(a.rating, a.voteCount),
			);
		case "newest":
			return sorted.sort((a, b) => (b.year || "").localeCompare(a.year || ""));
		case "oldest":
			return sorted.sort((a, b) => (a.year || "").localeCompare(b.year || ""));
		case "popularity":
			return sorted.sort((a, b) => b.popularity - a.popularity);
		case "relevance": {
			// Preserve TMDB's relevance ordering as the base, but boost titles
			// that closely match the query to the top.
			if (!query) return sorted;
			const q = query.toLowerCase().trim();
			return sorted.sort((a, b) => {
				const tierA = titleMatchTier(a.title, q);
				const tierB = titleMatchTier(b.title, q);
				if (tierA !== tierB) return tierA - tierB;
				// Within the same tier, preserve original TMDB order
				return 0;
			});
		}
		default:
			return sorted;
	}
}

/** Lower tier = better match. Stable sort preserves TMDB order within tiers. */
function titleMatchTier(title: string, query: string): number {
	const t = title.toLowerCase();
	if (t === query) return 0; // exact match
	if (t.startsWith(query)) return 1; // prefix match
	// Check for word-boundary match (query appears as a whole word/phrase)
	const wordBoundary = new RegExp(`\\b${escapeRegex(query)}\\b`);
	if (wordBoundary.test(t)) return 2;
	return 3; // substring / fuzzy
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
