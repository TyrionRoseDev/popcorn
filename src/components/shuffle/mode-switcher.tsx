import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";
import { cn } from "#/lib/utils";

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
		<div className="relative inline-block">
			{/* Amber border frame */}
			<div
				className="absolute"
				style={{
					inset: 0,
					border: "1.5px solid rgba(255,184,0,0.25)",
					borderRadius: "6px",
					boxShadow:
						"0 0 12px rgba(255,184,0,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
					pointerEvents: "none",
				}}
			/>

			<div
				className={cn(
					"relative flex items-center gap-2 rounded-md bg-drive-in-card px-3 py-1.5",
					isLoading && "opacity-50",
				)}
			>
				<span className="font-mono-retro text-[9px] uppercase tracking-[2px] text-neon-amber/70">
					Shuffling
				</span>

				<div className="relative">
					<select
						value={currentWatchlistId ?? shuffleWatchlistId}
						onChange={(e) => onSelect(e.target.value)}
						disabled={isLoading}
						className="appearance-none rounded border-none bg-transparent pr-5 pl-1 font-mono-retro text-[11px] text-cream/90 outline-none disabled:opacity-50"
						style={{
							textShadow: "0 0 8px rgba(255,255,240,0.15)",
						}}
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

					{/* Custom dropdown arrow */}
					<ChevronDown className="pointer-events-none absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2 text-neon-amber/60" />
				</div>
			</div>
		</div>
	);
}
