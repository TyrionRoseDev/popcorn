import { env } from "#/env";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export type ImageSize =
	| "w92"
	| "w154"
	| "w185"
	| "w342"
	| "w500"
	| "w780"
	| "w1280"
	| "original";

export function getTmdbImageUrl(
	posterPath: string | null,
	size: ImageSize = "w500",
): string | null {
	if (!posterPath) return null;
	return `${IMAGE_BASE_URL}/${size}${posterPath}`;
}

export async function tmdbFetch<T>(
	path: string,
	params: Record<string, string> = {},
): Promise<T> {
	const url = new URL(`${BASE_URL}${path}`);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}

	const response = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${env.TMDB_READ_ACCESS_TOKEN}` },
	});

	if (!response.ok) {
		throw new Error(`TMDB API error: ${response.status}`);
	}

	return response.json() as Promise<T>;
}

// --- Response types ---

export interface TmdbMovieResult {
	id: number;
	title: string;
	poster_path: string | null;
	overview: string;
	release_date: string;
	vote_average: number;
	genre_ids: number[];
}

export interface TmdbTvResult {
	id: number;
	name: string;
	poster_path: string | null;
	overview: string;
	first_air_date: string;
	vote_average: number;
	genre_ids: number[];
}

export interface TmdbTrendingResult {
	id: number;
	media_type: "movie" | "tv" | "person";
	title?: string;
	name?: string;
	poster_path: string | null;
	overview: string;
	release_date?: string;
	first_air_date?: string;
	vote_average: number;
	genre_ids: number[];
}

export type TmdbSearchResult = TmdbTrendingResult;

interface TmdbPagedResponse<T> {
	results: T[];
	page: number;
	total_pages: number;
	total_results: number;
}

// --- API functions ---

const QUALITY_FILTERS = {
	sort_by: "popularity.desc",
	"vote_count.gte": "200",
	"vote_average.gte": "6",
	include_adult: "false",
};

export async function discoverMovies(genreId: number, page: number) {
	return tmdbFetch<TmdbPagedResponse<TmdbMovieResult>>("/discover/movie", {
		with_genres: String(genreId),
		page: String(page),
		...QUALITY_FILTERS,
	});
}

export async function discoverTv(genreId: number, page: number) {
	return tmdbFetch<TmdbPagedResponse<TmdbTvResult>>("/discover/tv", {
		with_genres: String(genreId),
		page: String(page),
		...QUALITY_FILTERS,
	});
}

export async function fetchTrending(page: number) {
	return tmdbFetch<TmdbPagedResponse<TmdbTrendingResult>>(
		"/trending/all/week",
		{
			page: String(page),
			include_adult: "false",
		},
	);
}

export async function discoverMoviesWithParams(
	page: number,
	params: Record<string, string> = {},
) {
	return tmdbFetch<TmdbPagedResponse<TmdbMovieResult>>("/discover/movie", {
		page: String(page),
		...params,
		include_adult: "false",
	});
}

export async function discoverTvWithParams(
	page: number,
	params: Record<string, string> = {},
) {
	return tmdbFetch<TmdbPagedResponse<TmdbTvResult>>("/discover/tv", {
		page: String(page),
		...params,
		include_adult: "false",
	});
}

export async function searchMovies(query: string, page: number) {
	return tmdbFetch<TmdbPagedResponse<TmdbMovieResult>>("/search/movie", {
		query,
		page: String(page),
		include_adult: "false",
	});
}

export async function searchTvShows(query: string, page: number) {
	return tmdbFetch<TmdbPagedResponse<TmdbTvResult>>("/search/tv", {
		query,
		page: String(page),
		include_adult: "false",
	});
}

export async function searchMulti(query: string, page: number) {
	const res = await tmdbFetch<TmdbPagedResponse<TmdbTrendingResult>>(
		"/search/multi",
		{
			query,
			page: String(page),
			include_adult: "false",
		},
	);

	// Filter out "person" results — we only care about movies and TV shows
	const results: TmdbSearchResult[] = res.results.filter(
		(r): r is TmdbSearchResult =>
			r.media_type === "movie" || r.media_type === "tv",
	);

	return {
		results,
		page: res.page,
		total_pages: res.total_pages,
		total_results: res.total_results,
	} satisfies TmdbPagedResponse<TmdbSearchResult>;
}
