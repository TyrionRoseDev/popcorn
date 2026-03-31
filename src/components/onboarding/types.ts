export interface OnboardingState {
	favouriteFilmTmdbId: number | null;
	favouriteFilmMediaType: "movie" | "tv" | null;
	favouriteGenreId: number | null;
	bio: string | null;
}
