import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { CardStack } from "#/components/shuffle/card-stack";
import { ModeSwitcher } from "#/components/shuffle/mode-switcher";
import { ShuffleAtmosphere } from "#/components/shuffle/shuffle-atmosphere";
import { useTRPC } from "#/integrations/trpc/react";

const shuffleSearchSchema = z.object({
	watchlistId: z.string().optional(),
});

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

	const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(
		initialWatchlistId ?? null,
	);

	const resolvedWatchlistId = activeWatchlistId ?? shuffleWatchlist?.id ?? null;

	if (isLoading) {
		return (
			<>
				<ShuffleAtmosphere />
				<div
					className="relative flex h-[100dvh] items-center justify-center"
					style={{ zIndex: 2 }}
				>
					<p className="animate-pulse font-mono-retro text-xs text-cream/30">
						Setting up Showtime Shuffle...
					</p>
				</div>
			</>
		);
	}

	if (!resolvedWatchlistId) {
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

			{/* Full-screen immersive layout — card-dominant drive-in experience */}
			<div
				className="relative mx-auto flex h-[100dvh] max-w-md flex-col items-center px-4 pt-3 pb-4"
				style={{ zIndex: 2 }}
			>
				{/* TOP: Mode switcher — centered with breathing room */}
				<div className="shrink-0 flex justify-center">
					<ModeSwitcher
						currentWatchlistId={activeWatchlistId}
						shuffleWatchlistId={shuffleWatchlist?.id ?? resolvedWatchlistId}
						onSelect={setActiveWatchlistId}
					/>
				</div>

				{/* CENTER: Card stack — fills all remaining vertical space */}
				<div className="flex w-full flex-1 items-center justify-center py-3">
					<CardStack
						key={resolvedWatchlistId}
						watchlistId={resolvedWatchlistId}
					/>
				</div>
			</div>
		</>
	);
}
