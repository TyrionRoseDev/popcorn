import { deduplicateFeed, type FeedItem } from "./feed-assembler";

export interface ShuffleFeedCursor {
	tastePage: number;
	trendingPage: number;
	discoveryPage: number;
}

export function parseShuffleCursor(
	cursor: string | undefined,
): ShuffleFeedCursor {
	if (!cursor) return { tastePage: 1, trendingPage: 1, discoveryPage: 1 };
	try {
		return JSON.parse(cursor) as ShuffleFeedCursor;
	} catch {
		return { tastePage: 1, trendingPage: 1, discoveryPage: 1 };
	}
}

export function serializeShuffleCursor(cursor: ShuffleFeedCursor): string {
	return JSON.stringify(cursor);
}

export interface ShuffleFeedRatio {
	taste: number;
	trending: number;
	discovery: number;
}

export const SOLO_RATIO: ShuffleFeedRatio = {
	taste: 5,
	trending: 3,
	discovery: 2,
};
export const GROUP_RATIO: ShuffleFeedRatio = {
	taste: 3,
	trending: 4,
	discovery: 3,
};

export function interleaveShuffleFeed(
	taste: FeedItem[],
	trending: FeedItem[],
	discovery: FeedItem[],
	ratio: ShuffleFeedRatio = SOLO_RATIO,
): FeedItem[] {
	const result: FeedItem[] = [];
	let ti = 0,
		tri = 0,
		di = 0;

	const pattern: ("taste" | "trending" | "discovery")[] = [
		...Array(ratio.taste).fill("taste" as const),
		...Array(ratio.trending).fill("trending" as const),
		...Array(ratio.discovery).fill("discovery" as const),
	];

	let patternIdx = 0;

	while (ti < taste.length || tri < trending.length || di < discovery.length) {
		const source = pattern[patternIdx % pattern.length];
		patternIdx++;

		if (source === "taste" && ti < taste.length) {
			result.push(taste[ti++]);
		} else if (source === "trending" && tri < trending.length) {
			result.push(trending[tri++]);
		} else if (source === "discovery" && di < discovery.length) {
			result.push(discovery[di++]);
		} else {
			if (ti < taste.length) result.push(taste[ti++]);
			else if (tri < trending.length) result.push(trending[tri++]);
			else if (di < discovery.length) result.push(discovery[di++]);
		}
	}

	return deduplicateFeed(result);
}
