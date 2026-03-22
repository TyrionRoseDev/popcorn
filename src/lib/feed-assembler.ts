export interface FeedItem {
	tmdbId: number;
	mediaType: "movie" | "tv";
	title: string;
	posterPath: string | null;
	overview: string;
	year: string;
	rating: number;
	genreIds: number[];
	isTrending: boolean;
}

export interface FeedCursor {
	genrePages: Record<string, number>; // e.g. "1_movie": 2, "1_tv": 1
	trendingPage: number;
}

export function parseCursor(cursor: string | undefined): FeedCursor {
	if (!cursor) {
		return { genrePages: {}, trendingPage: 1 };
	}
	try {
		return JSON.parse(cursor) as FeedCursor;
	} catch {
		return { genrePages: {}, trendingPage: 1 };
	}
}

export function serializeCursor(cursor: FeedCursor): string {
	return JSON.stringify(cursor);
}

export function deduplicateFeed(items: FeedItem[]): FeedItem[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = `${item.tmdbId}-${item.mediaType}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * Interleaves items from genre buckets with trending items.
 * Round-robins across genres for equal representation.
 * ~80% discover / ~20% trending — every 5th item is trending (if available).
 */
export function interleaveFeed(
	genreBuckets: Record<string, FeedItem[]>,
	trending: FeedItem[],
): FeedItem[] {
	const result: FeedItem[] = [];
	const bucketKeys = Object.keys(genreBuckets);
	if (bucketKeys.length === 0) return trending;

	// Create iterators for each bucket
	const iterators = bucketKeys.map((key) => ({
		key,
		items: [...genreBuckets[key]],
		index: 0,
	}));

	let trendingIndex = 0;
	let discoverCount = 0;

	// Keep going while any source has items
	const hasDiscoverItems = () =>
		iterators.some((it) => it.index < it.items.length);
	const hasTrendingItems = () => trendingIndex < trending.length;

	while (hasDiscoverItems() || hasTrendingItems()) {
		// Every 5th item: try to insert trending
		if (discoverCount > 0 && discoverCount % 4 === 0 && hasTrendingItems()) {
			result.push(trending[trendingIndex]);
			trendingIndex++;
			continue;
		}

		if (!hasDiscoverItems()) {
			// Out of discover items, drain trending
			if (hasTrendingItems()) {
				result.push(trending[trendingIndex]);
				trendingIndex++;
			}
			continue;
		}

		// Round-robin: pick next genre that has items
		let picked = false;
		for (let i = 0; i < iterators.length; i++) {
			const bucketIndex = (discoverCount + i) % iterators.length;
			const it = iterators[bucketIndex];
			if (it.index < it.items.length) {
				result.push(it.items[it.index]);
				it.index++;
				discoverCount++;
				picked = true;
				break;
			}
		}

		if (!picked) {
			// All discover exhausted, drain trending
			if (hasTrendingItems()) {
				result.push(trending[trendingIndex]);
				trendingIndex++;
			} else {
				break;
			}
		}
	}

	return result;
}
