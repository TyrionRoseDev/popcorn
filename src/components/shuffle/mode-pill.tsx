import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useTRPC } from "#/integrations/trpc/react";
import { cn } from "#/lib/utils";

interface ModePillProps {
	currentWatchlistId: string | null;
	shuffleWatchlistId: string;
	onSelect: (watchlistId: string) => void;
}

export function ModePill({
	currentWatchlistId,
	shuffleWatchlistId,
	onSelect,
}: ModePillProps) {
	const trpc = useTRPC();
	const { data: watchlistOptions, isLoading } = useQuery(
		trpc.shuffle.getWatchlistOptions.queryOptions(),
	);

	const groupWatchlists =
		watchlistOptions?.filter(
			(wl) => wl.type === "custom" && wl.members.length > 1,
		) ?? [];

	return (
		<div
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border border-cream/10 bg-cream/[0.04] px-3.5 py-1",
				isLoading && "opacity-50",
			)}
		>
			<div className="relative">
				<select
					value={currentWatchlistId ?? shuffleWatchlistId}
					onChange={(e) => onSelect(e.target.value)}
					disabled={isLoading}
					className="appearance-none bg-transparent pr-4 pl-0.5 font-mono-retro text-[10px] tracking-wider text-cream/50 outline-none disabled:opacity-50"
				>
					<option value={shuffleWatchlistId}>Just Me</option>
					{groupWatchlists.map((wl) => (
						<option key={wl.id} value={wl.id}>
							{wl.name}
						</option>
					))}
				</select>
				<ChevronDown className="pointer-events-none absolute top-1/2 right-0 size-3 -translate-y-1/2 text-cream/30" />
			</div>
		</div>
	);
}
