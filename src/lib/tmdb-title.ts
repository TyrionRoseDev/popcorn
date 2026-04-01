import { TRPCError } from "@trpc/server";
import { tmdbFetch } from "#/lib/tmdb";

// --- TMDB response types for detail endpoints ---

interface TmdbMovieDetail {
	id: number;
	title: string;
	tagline: string | null;
	overview: string;
	release_date: string;
	runtime: number | null;
	vote_average: number;
	genres: Array<{ id: number; name: string }>;
	poster_path: string | null;
	backdrop_path: string | null;
}

interface TmdbTvDetail {
	id: number;
	name: string;
	tagline: string | null;
	overview: string;
	first_air_date: string;
	vote_average: number;
	episode_run_time: number[]; // Often empty — TMDB is deprecating this field
	number_of_seasons: number;
	number_of_episodes: number;
	status: string;
	genres: Array<{ id: number; name: string }>;
	poster_path: string | null;
	backdrop_path: string | null;
	created_by: Array<{ name: string }>;
	seasons: Array<{
		season_number: number;
		episode_count: number;
		name: string;
	}>;
}

interface TmdbCreditsResponse {
	cast: Array<{
		id: number;
		name: string;
		character: string;
		profile_path: string | null;
		order: number;
	}>;
	crew: Array<{
		id: number;
		name: string;
		job: string;
	}>;
}

interface TmdbVideosResponse {
	results: Array<{
		key: string;
		site: string;
		type: string;
		official: boolean;
	}>;
}

interface TmdbMovieReleaseDatesResponse {
	results: Array<{
		iso_3166_1: string;
		release_dates: Array<{ certification: string }>;
	}>;
}

interface TmdbTvContentRatingsResponse {
	results: Array<{
		iso_3166_1: string;
		rating: string;
	}>;
}

// --- Return type ---

export interface TitleData {
	tmdbId: number;
	mediaType: "movie" | "tv";
	title: string;
	tagline: string | null;
	overview: string;
	year: string;
	runtime: string;
	runtimeMinutes: number | null;
	rating: number;
	contentRating: string;
	genres: string[];
	tmdbGenreIds: number[];
	posterPath: string | null;
	backdropPath: string | null;
	director: string | null;
	trailerKey: string | null;
	cast: Array<{
		id: number;
		name: string;
		character: string;
		profilePath: string | null;
	}>;
	seasons?: number;
	episodes?: number;
	status?: string;
	seasonList?: Array<{
		seasonNumber: number;
		episodeCount: number;
		name: string;
	}>;
}

// --- Helpers ---

function formatRuntime(minutes: number | null): string {
	if (!minutes) return "";
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function findTrailerKey(videos: TmdbVideosResponse): string | null {
	const trailer =
		videos.results.find(
			(v) => v.site === "YouTube" && v.type === "Trailer" && v.official,
		) ??
		videos.results.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
		videos.results.find((v) => v.site === "YouTube");
	return trailer?.key ?? null;
}

function findDirector(credits: TmdbCreditsResponse): string | null {
	const director = credits.crew.find((c) => c.job === "Director");
	return director?.name ?? null;
}

// --- Main fetch function ---

export async function fetchTitleDetails(
	mediaType: "movie" | "tv",
	tmdbId: number,
): Promise<TitleData> {
	const prefix = mediaType === "movie" ? "/movie" : "/tv";

	// Fetch main details first — if this fails with 404, throw NOT_FOUND
	let details: TmdbMovieDetail | TmdbTvDetail;
	try {
		details = await tmdbFetch<TmdbMovieDetail | TmdbTvDetail>(
			`${prefix}/${tmdbId}`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "";
		if (message.includes("404")) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Title not found" });
		}
		throw error;
	}

	// Fetch non-critical endpoints in parallel — failures return fallbacks
	const [credits, videos, ratings] = await Promise.all([
		tmdbFetch<TmdbCreditsResponse>(`${prefix}/${tmdbId}/credits`).catch(
			() => ({ cast: [], crew: [] }) as TmdbCreditsResponse,
		),
		tmdbFetch<TmdbVideosResponse>(`${prefix}/${tmdbId}/videos`).catch(
			() => ({ results: [] }) as TmdbVideosResponse,
		),
		mediaType === "movie"
			? tmdbFetch<TmdbMovieReleaseDatesResponse>(
					`/movie/${tmdbId}/release_dates`,
				).catch(() => null)
			: tmdbFetch<TmdbTvContentRatingsResponse>(
					`/tv/${tmdbId}/content_ratings`,
				).catch(() => null),
	]);

	// Extract content rating
	let contentRating = "NR";
	if (mediaType === "movie" && ratings) {
		const us = (ratings as TmdbMovieReleaseDatesResponse).results.find(
			(r) => r.iso_3166_1 === "US",
		);
		const cert = us?.release_dates.find(
			(rd) => rd.certification,
		)?.certification;
		if (cert) contentRating = cert;
	} else if (mediaType === "tv" && ratings) {
		const us = (ratings as TmdbTvContentRatingsResponse).results.find(
			(r) => r.iso_3166_1 === "US",
		);
		if (us?.rating) contentRating = us.rating;
	}

	// Build result based on media type
	if (mediaType === "movie") {
		const movie = details as TmdbMovieDetail;
		return {
			tmdbId,
			mediaType,
			title: movie.title,
			tagline: movie.tagline || null,
			overview: movie.overview,
			year: movie.release_date?.slice(0, 4) ?? "",
			runtime: formatRuntime(movie.runtime),
			runtimeMinutes: movie.runtime ?? null,
			rating: movie.vote_average,
			contentRating,
			genres: movie.genres.map((g) => g.name),
			tmdbGenreIds: movie.genres.map((g) => g.id),
			posterPath: movie.poster_path,
			backdropPath: movie.backdrop_path,
			director: findDirector(credits),
			trailerKey: findTrailerKey(videos),
			cast: credits.cast.slice(0, 12).map((c) => ({
				id: c.id,
				name: c.name,
				character: c.character,
				profilePath: c.profile_path,
			})),
		};
	}

	// TV show
	const tv = details as TmdbTvDetail;
	const episodeRuntime = tv.episode_run_time[0];
	return {
		tmdbId,
		mediaType,
		title: tv.name,
		tagline: tv.tagline || null,
		overview: tv.overview,
		year: tv.first_air_date?.slice(0, 4) ?? "",
		runtime: episodeRuntime ? `${episodeRuntime}m per episode` : "",
		runtimeMinutes: episodeRuntime ?? null,
		rating: tv.vote_average,
		contentRating,
		genres: tv.genres.map((g) => g.name),
		tmdbGenreIds: tv.genres.map((g) => g.id),
		posterPath: tv.poster_path,
		backdropPath: tv.backdrop_path,
		director: tv.created_by[0]?.name ?? null,
		trailerKey: findTrailerKey(videos),
		cast: credits.cast.slice(0, 12).map((c) => ({
			id: c.id,
			name: c.name,
			character: c.character,
			profilePath: c.profile_path,
		})),
		seasons: tv.number_of_seasons,
		episodes: tv.number_of_episodes,
		status: tv.status,
		seasonList: tv.seasons.map((s) => ({
			seasonNumber: s.season_number,
			episodeCount: s.episode_count,
			name: s.name,
		})),
	};
}
