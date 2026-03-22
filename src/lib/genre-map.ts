export interface UnifiedGenre {
	id: number;
	name: string;
	movieGenreId: number | null;
	tvGenreId: number | null;
}

/**
 * Static mapping of unified genres to TMDB movie and TV genre IDs.
 * TMDB uses different IDs/names for movie vs TV genres.
 * This table gives users a single coherent list.
 */
export const UNIFIED_GENRES: UnifiedGenre[] = [
	{ id: 1, name: "Action", movieGenreId: 28, tvGenreId: 10759 },
	{ id: 2, name: "Adventure", movieGenreId: 12, tvGenreId: 10759 },
	{ id: 3, name: "Animation", movieGenreId: 16, tvGenreId: 16 },
	{ id: 4, name: "Comedy", movieGenreId: 35, tvGenreId: 35 },
	{ id: 5, name: "Crime", movieGenreId: 80, tvGenreId: 80 },
	{ id: 6, name: "Documentary", movieGenreId: 99, tvGenreId: 99 },
	{ id: 7, name: "Drama", movieGenreId: 18, tvGenreId: 18 },
	{ id: 8, name: "Family", movieGenreId: 10751, tvGenreId: 10751 },
	{ id: 9, name: "Fantasy", movieGenreId: 14, tvGenreId: 10765 },
	{ id: 10, name: "Horror", movieGenreId: 27, tvGenreId: null },
	{ id: 11, name: "Mystery", movieGenreId: 9648, tvGenreId: 9648 },
	{ id: 12, name: "Romance", movieGenreId: 10749, tvGenreId: null },
	{ id: 13, name: "Sci-Fi", movieGenreId: 878, tvGenreId: 10765 },
	{ id: 14, name: "Thriller", movieGenreId: 53, tvGenreId: null },
	{ id: 15, name: "War", movieGenreId: 10752, tvGenreId: 10768 },
	{ id: 16, name: "Western", movieGenreId: 37, tvGenreId: 37 },
	{ id: 17, name: "Music", movieGenreId: 10402, tvGenreId: null },
	{ id: 18, name: "History", movieGenreId: 36, tvGenreId: null },
	{ id: 19, name: "Reality", movieGenreId: null, tvGenreId: 10764 },
];

const genreMap = new Map(UNIFIED_GENRES.map((g) => [g.id, g]));

export function getUnifiedGenreById(id: number): UnifiedGenre | undefined {
	return genreMap.get(id);
}

export function getMovieGenreId(unifiedId: number): number | null {
	return genreMap.get(unifiedId)?.movieGenreId ?? null;
}

export function getTvGenreId(unifiedId: number): number | null {
	return genreMap.get(unifiedId)?.tvGenreId ?? null;
}

/**
 * Reverse lookup: given a TMDB genre ID (from a movie or TV result),
 * return the unified genre name. Returns the raw ID as string if not found.
 */
const tmdbIdToName = new Map<number, string>();
for (const genre of UNIFIED_GENRES) {
	if (genre.movieGenreId !== null && !tmdbIdToName.has(genre.movieGenreId))
		tmdbIdToName.set(genre.movieGenreId, genre.name);
	if (genre.tvGenreId !== null && !tmdbIdToName.has(genre.tvGenreId))
		tmdbIdToName.set(genre.tvGenreId, genre.name);
}

export function getGenreNameByTmdbId(tmdbGenreId: number): string {
	return tmdbIdToName.get(tmdbGenreId) ?? String(tmdbGenreId);
}

/**
 * Reverse lookup: given a TMDB genre ID, return the unified genre ID.
 */
const tmdbIdToUnifiedId = new Map<number, number>();
for (const genre of UNIFIED_GENRES) {
	if (genre.movieGenreId !== null && !tmdbIdToUnifiedId.has(genre.movieGenreId))
		tmdbIdToUnifiedId.set(genre.movieGenreId, genre.id);
	if (genre.tvGenreId !== null && !tmdbIdToUnifiedId.has(genre.tvGenreId))
		tmdbIdToUnifiedId.set(genre.tvGenreId, genre.id);
}

export function getUnifiedIdByTmdbId(tmdbGenreId: number): number | null {
	return tmdbIdToUnifiedId.get(tmdbGenreId) ?? null;
}
