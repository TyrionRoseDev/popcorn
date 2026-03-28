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
					className="relative flex items-center justify-center py-32"
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
					className="relative flex items-center justify-center py-32"
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

			<div
				className="relative mx-auto flex max-w-md flex-col items-center px-4 pt-4 pb-6"
				style={{ zIndex: 2 }}
			>
				{/* Mode switcher */}
				<div className="mb-4 flex justify-center">
					<ModeSwitcher
						currentWatchlistId={activeWatchlistId}
						shuffleWatchlistId={shuffleWatchlist?.id ?? resolvedWatchlistId}
						onSelect={setActiveWatchlistId}
					/>
				</div>

				{/* Card stack keyed by active watchlist for fresh state on switch */}
				<CardStack
					key={resolvedWatchlistId}
					watchlistId={resolvedWatchlistId}
				/>
			</div>
		</>
	);
}
