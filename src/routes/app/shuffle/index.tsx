import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CardStack } from "#/components/shuffle/card-stack";
import { CountdownLoader } from "#/components/shuffle/countdown-loader";
import { ShuffleAtmosphere } from "#/components/shuffle/shuffle-atmosphere";
import { ShuffleMarquee } from "#/components/shuffle/shuffle-marquee";
import { useTRPC } from "#/integrations/trpc/react";

const shuffleSearchSchema = z.object({
	watchlistId: z.string().optional(),
});

let hasPlayedIntro = false;

export const Route = createFileRoute("/app/shuffle/")({
	validateSearch: (search) => shuffleSearchSchema.parse(search),
	component: ShufflePage,
});

function ShufflePage() {
	const { watchlistId: initialWatchlistId } = Route.useSearch();
	const trpc = useTRPC();

	const { data: shuffleWatchlist, isLoading } = useQuery(
		trpc.shuffle.getOrCreateShuffleWatchlist.queryOptions(),
	);

	const [activeWatchlistId, _setActiveWatchlistId] = useState<string | null>(
		initialWatchlistId ?? null,
	);
	useEffect(() => {
		if (!showIntro) return;
		const timer = setTimeout(() => {
			sessionStorage.setItem(SHUFFLE_INTRO_KEY, "true");
			setShowIntro(false);
		}, 1800);
		return () => clearTimeout(timer);
	}, [showIntro]);

	// Show countdown intro only on first visit per session
	const [showIntro, setShowIntro] = useState(!hasPlayedIntro);
	useEffect(() => {
		if (!showIntro) return;
		const timer = setTimeout(() => {
			hasPlayedIntro = true;
			setShowIntro(false);
		}, 1800);
		return () => clearTimeout(timer);
	}, [showIntro]);

	const resolvedWatchlistId = activeWatchlistId ?? shuffleWatchlist?.id ?? null;

	if (!resolvedWatchlistId && !isLoading) {
		return (
			<>
				<ShuffleAtmosphere />
				<div
					className="relative flex h-[100dvh] items-center justify-center"
					style={{ zIndex: 2 }}
				>
					<p className="font-mono-retro text-xs text-cream/40">
						Unable to load shuffle. Please try again.
					</p>
				</div>
			</>
		);
	}

	return (
		<>
			<ShuffleAtmosphere />

			{/* Full-screen immersive layout */}
			<div
				className="relative mx-auto flex h-[100dvh] max-w-[700px] flex-col items-center px-3 pt-8 pb-3"
				style={{ zIndex: 2 }}
			>
				{/* TOP: Theater marquee */}
				<div className="flex w-full shrink-0 justify-center">
					<ShuffleMarquee />
				</div>

				{/* CENTER: Card stack or countdown loader */}
				<div className="flex w-full max-w-md flex-1 items-center justify-center py-2">
					{showIntro || isLoading || !resolvedWatchlistId ? (
						<div
							className="w-full max-w-[360px]"
							style={{ aspectRatio: "2/3" }}
						>
							<CountdownLoader />
						</div>
					) : (
						<CardStack
							key={resolvedWatchlistId}
							watchlistId={resolvedWatchlistId}
						/>
					)}
				</div>
			</div>
		</>
	);
}
