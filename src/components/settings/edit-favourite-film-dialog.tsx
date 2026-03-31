import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface EditFavouriteFilmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentTmdbId: number | null | undefined;
	currentTitle: string | null;
	currentPosterPath: string | null;
}

export function EditFavouriteFilmDialog({
	open,
	onOpenChange,
	currentTmdbId,
	currentTitle,
	currentPosterPath,
}: EditFavouriteFilmDialogProps) {
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [selectedFilm, setSelectedFilm] = useState<{
		tmdbId: number;
		title: string;
		posterPath: string | null;
		year: string;
	} | null>(
		currentTmdbId
			? {
					tmdbId: currentTmdbId,
					title: currentTitle ?? "",
					posterPath: currentPosterPath,
					year: "",
				}
			: null,
	);
	const [error, setError] = useState("");
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 300);
		return () => clearTimeout(timer);
	}, [query]);

	const searchResults = useQuery(
		trpc.tasteProfile.search.queryOptions(
			{ query: debouncedQuery },
			{ enabled: debouncedQuery.length >= 2 },
		),
	);

	const updateFilm = useMutation(
		trpc.tasteProfile.updateFavouriteFilm.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries();
				onOpenChange(false);
			},
			onError: () => setError("Something went wrong"),
		}),
	);

	function handleClose(nextOpen: boolean) {
		if (!nextOpen) {
			setQuery("");
			setDebouncedQuery("");
			setSelectedFilm(
				currentTmdbId
					? {
							tmdbId: currentTmdbId,
							title: currentTitle ?? "",
							posterPath: currentPosterPath,
							year: "",
						}
					: null,
			);
			setError("");
		}
		onOpenChange(nextOpen);
	}

	function handleSave() {
		setError("");
		updateFilm.mutate({ tmdbId: selectedFilm?.tmdbId ?? null });
	}

	const movies = (searchResults.data?.items ?? []).filter(
		(item) => item.mediaType === "movie",
	);

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Favorite Film
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						Search for a movie to set as your favorite.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{error && <p className="text-sm text-neon-pink">{error}</p>}

					{selectedFilm && (
						<div className="flex items-center gap-3 rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-2">
							{selectedFilm.posterPath && (
								<img
									src={getTmdbImageUrl(selectedFilm.posterPath, "w92")!}
									alt=""
									className="h-12 w-8 rounded object-cover"
								/>
							)}
							<span className="flex-1 text-sm text-cream truncate">
								{selectedFilm.title}
								{selectedFilm.year && (
									<span className="text-cream/40"> ({selectedFilm.year})</span>
								)}
							</span>
							<button
								type="button"
								onClick={() => setSelectedFilm(null)}
								className="text-cream/30 hover:text-cream/60"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					)}

					<div className="relative">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/30" />
						<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search movies..."
							autoFocus
							className="w-full rounded-lg border border-cream/12 bg-cream/6 pl-9 pr-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none"
						/>
					</div>

					{debouncedQuery.length >= 2 && (
						<div className="max-h-48 overflow-y-auto rounded-lg border border-cream/8">
							{searchResults.isLoading && (
								<div className="px-3 py-4 text-center text-sm text-cream/30">
									Searching...
								</div>
							)}
							{movies.length === 0 && !searchResults.isLoading && (
								<div className="px-3 py-4 text-center text-sm text-cream/30">
									No movies found
								</div>
							)}
							{movies.map((movie) => (
								<button
									key={movie.tmdbId}
									type="button"
									onClick={() => {
										setSelectedFilm({
											tmdbId: movie.tmdbId,
											title: movie.title,
											posterPath: movie.posterPath,
											year: movie.year,
										});
										setQuery("");
										setDebouncedQuery("");
									}}
									className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-cream/5"
								>
									{movie.posterPath ? (
										<img
											src={getTmdbImageUrl(movie.posterPath, "w92")!}
											alt=""
											className="h-10 w-7 rounded object-cover"
										/>
									) : (
										<div className="h-10 w-7 rounded bg-cream/10" />
									)}
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm text-cream">
											{movie.title}
										</div>
										{movie.year && (
											<div className="text-xs text-cream/40">{movie.year}</div>
										)}
									</div>
								</button>
							))}
						</div>
					)}
				</div>

				<DialogFooter>
					<button
						type="button"
						onClick={() => handleClose(false)}
						disabled={updateFilm.isPending}
						className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={updateFilm.isPending}
						className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/45 bg-neon-cyan/10 px-5 py-2 text-sm font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/18 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{updateFilm.isPending ? "Saving..." : "Save"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
