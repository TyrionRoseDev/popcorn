import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTRPC } from "#/integrations/trpc/react";
import type { OnboardingState } from "./types";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w92";

interface Props {
	onNext: () => void;
	onboardingState?: OnboardingState;
	setOnboardingState?: (state: Partial<OnboardingState>) => void;
}

export function FavouriteFilmStep({
	onNext,
	onboardingState,
	setOnboardingState,
}: Props) {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [selectedTmdbId, setSelectedTmdbId] = useState<number | null>(
		onboardingState?.favouriteFilmTmdbId ?? null,
	);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const trpc = useTRPC();

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			setDebouncedQuery(searchQuery);
		}, 300);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [searchQuery]);

	const searchResults = useQuery(
		trpc.tasteProfile.search.queryOptions(
			{ query: debouncedQuery },
			{ enabled: debouncedQuery.length >= 2 },
		),
	);

	function handleSelect(tmdbId: number) {
		setSelectedTmdbId((prev) => (prev === tmdbId ? null : tmdbId));
	}

	function handleContinue() {
		setOnboardingState?.({ favouriteFilmTmdbId: selectedTmdbId });
		onNext();
	}

	function handleSkip() {
		setOnboardingState?.({ favouriteFilmTmdbId: null });
		onNext();
	}

	const items = (searchResults.data?.items ?? []).filter(
		(item) => item.mediaType === "movie",
	);
	const showResults = debouncedQuery.length >= 2;

	return (
		<div>
			<h2 className="mb-1.5 font-display text-xl text-cream">
				Favourite film?
			</h2>
			<p className="mb-6 text-sm text-cream/50">
				Search for a movie or show you love most
			</p>

			<input
				type="text"
				value={searchQuery}
				onChange={(e) => setSearchQuery(e.target.value)}
				placeholder="Search movies & shows..."
				className="mb-4 w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none"
			/>

			{showResults && (
				<div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-drive-in-border">
					{searchResults.isLoading && (
						<div className="px-4 py-3 text-sm text-cream/40">Searching...</div>
					)}
					{!searchResults.isLoading && items.length === 0 && (
						<div className="px-4 py-3 text-sm text-cream/40">
							No results for &ldquo;{debouncedQuery}&rdquo;
						</div>
					)}
					{items.map((item) => {
						const isSelected = selectedTmdbId === item.tmdbId;
						return (
							<button
								key={`${item.tmdbId}-${item.mediaType}`}
								type="button"
								onClick={() => handleSelect(item.tmdbId)}
								className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-cream/5 ${
									isSelected ? "bg-neon-pink/10" : ""
								}`}
							>
								{item.posterPath ? (
									<img
										src={`${TMDB_IMAGE_BASE}${item.posterPath}`}
										alt={item.title}
										className="h-12 w-8 flex-shrink-0 rounded object-cover"
									/>
								) : (
									<div className="h-12 w-8 flex-shrink-0 rounded bg-cream/10" />
								)}
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm text-cream">{item.title}</p>
									<p className="text-xs text-cream/40">
										{item.year || "—"} &middot;{" "}
										{item.mediaType === "movie" ? "Movie" : "TV"}
									</p>
								</div>
								{isSelected && (
									<span className="flex-shrink-0 text-neon-pink">✓</span>
								)}
							</button>
						);
					})}
				</div>
			)}

			{selectedTmdbId !== null && !showResults && (
				<p className="mb-4 text-xs text-neon-pink/80">Film selected</p>
			)}

			<button
				type="button"
				onClick={handleContinue}
				className="w-full rounded-lg border-[1.5px] border-neon-cyan/50 bg-neon-cyan/8 py-3 font-display text-[15px] tracking-wide text-neon-cyan shadow-[0_0_15px_rgba(0,229,255,0.12)] transition-all duration-300 hover:bg-neon-cyan/15 hover:shadow-[0_0_25px_rgba(0,229,255,0.25)]"
				style={{ textShadow: "0 0 10px rgba(0,229,255,0.3)" }}
			>
				Continue
			</button>

			<button
				type="button"
				onClick={handleSkip}
				className="mt-3 block w-full text-sm text-cream/30 transition-colors hover:text-cream/50"
			>
				Skip for now
			</button>
		</div>
	);
}
