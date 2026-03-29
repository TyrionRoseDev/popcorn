import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "#/integrations/trpc/react";
import type { OnboardingState } from "./types";

interface Props {
	onNext: () => void;
	onboardingState?: OnboardingState;
	setOnboardingState?: (state: Partial<OnboardingState>) => void;
}

export function FavouriteGenreStep({
	onNext,
	onboardingState,
	setOnboardingState,
}: Props) {
	const [selectedGenreId, setSelectedGenreId] = useState<number | null>(
		onboardingState?.favouriteGenreId ?? null,
	);

	const trpc = useTRPC();
	const genresQuery = useQuery(trpc.tasteProfile.getGenres.queryOptions());
	const genres = genresQuery.data ?? [];

	function handleSelect(genreId: number) {
		setSelectedGenreId((prev) => (prev === genreId ? null : genreId));
	}

	function handleContinue() {
		setOnboardingState?.({ favouriteGenreId: selectedGenreId });
		onNext();
	}

	function handleSkip() {
		setOnboardingState?.({ favouriteGenreId: null });
		onNext();
	}

	return (
		<div>
			<h2 className="mb-1.5 font-display text-xl text-cream">
				Favourite genre?
			</h2>
			<p className="mb-6 text-sm text-cream/50">
				Pick the one genre you love most
			</p>

			<div className="mb-6 grid grid-cols-3 gap-2">
				{genres.map((genre) => {
					const isSelected = selectedGenreId === genre.id;
					return (
						<button
							key={genre.id}
							type="button"
							onClick={() => handleSelect(genre.id)}
							className={`rounded-lg border px-3 py-2.5 text-sm transition-all duration-200 ${
								isSelected
									? "border-neon-pink/60 bg-neon-pink/15 text-neon-pink shadow-[0_0_12px_rgba(255,45,120,0.2)]"
									: "border-cream/12 bg-cream/5 text-cream/70 hover:border-cream/25 hover:text-cream"
							}`}
						>
							{genre.name}
						</button>
					);
				})}
			</div>

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
