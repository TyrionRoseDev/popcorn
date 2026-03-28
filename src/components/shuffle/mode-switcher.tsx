import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";

interface ModeSwitcherProps {
	currentWatchlistId: string | null;
	shuffleWatchlistId: string;
	onSelect: (watchlistId: string) => void;
}

export function ModeSwitcher({
	currentWatchlistId,
	shuffleWatchlistId,
	onSelect,
}: ModeSwitcherProps) {
	const trpc = useTRPC();
	const { data: watchlistOptions, isLoading } = useQuery(
		trpc.shuffle.getWatchlistOptions.queryOptions(),
	);

	// Group watchlists are custom type with multiple members
	const groupWatchlists =
		watchlistOptions?.filter(
			(wl) => wl.type === "custom" && wl.members.length > 1,
		) ?? [];

	return (
		<div className="flex items-center gap-2">
			<span className="font-mono-retro text-[10px] uppercase tracking-[2px] text-cream/40">
				Shuffling for
			</span>
			<select
				value={currentWatchlistId ?? shuffleWatchlistId}
				onChange={(e) => onSelect(e.target.value)}
				disabled={isLoading}
				className="rounded-md border border-cream/15 bg-drive-in-card px-2.5 py-1 font-mono-retro text-xs text-cream/80 outline-none transition focus:border-neon-amber/50 disabled:opacity-50"
			>
				{/* Solo option */}
				<option value={shuffleWatchlistId}>Just Me</option>

				{/* Group watchlists */}
				{groupWatchlists.map((wl) => (
					<option key={wl.id} value={wl.id}>
						{wl.name}
					</option>
				))}
			</select>
		</div>
	);
}
