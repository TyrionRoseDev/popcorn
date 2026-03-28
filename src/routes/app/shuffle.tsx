import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { CardStack } from "#/components/shuffle/card-stack";
import { ModeSwitcher } from "#/components/shuffle/mode-switcher";
import { useTRPC } from "#/integrations/trpc/react";

const shuffleSearchSchema = z.object({
	watchlistId: z.string().optional(),
});

export const Route = createFileRoute("/app/shuffle")({
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

	const resolvedWatchlistId =
		activeWatchlistId ?? shuffleWatchlist?.id ?? null;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-32">
				<p className="animate-pulse font-mono-retro text-xs text-cream/30">
					Setting up Showtime Shuffle...
				</p>
			</div>
		);
	}

	if (!resolvedWatchlistId) {
		return (
			<div className="flex items-center justify-center py-32">
				<p className="font-mono-retro text-xs text-cream/40">
					Unable to load shuffle. Please try again.
				</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-lg px-4 py-8">
			{/* Mode switcher */}
			<div className="mb-6 flex justify-center">
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
	);
}
