import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useTRPC } from "#/integrations/trpc/react";
import { cn } from "#/lib/utils";

const BULBS = Array.from({ length: 12 }, (_, i) => ({
	id: `mode-bulb-${i}`,
	leftPercent: `${(i / 11) * 100}%`,
	delay: i % 2 === 0 ? "0s" : "0.6s",
}));

function MiniBulbRow({ position }: { position: "top" | "bottom" }) {
	const posStyle = position === "top" ? { top: "-3px" } : { bottom: "-3px" };

	return (
		<>
			{BULBS.map((bulb) => (
				<div
					key={bulb.id + position}
					className="absolute rounded-full"
					style={{
						...posStyle,
						left: bulb.leftPercent,
						width: "4px",
						height: "4px",
						backgroundColor: "#FFB800",
						transform: "translateX(-50%)",
						animationName: "bulb-chase",
						animationDuration: "1.2s",
						animationTimingFunction: "ease-in-out",
						animationIterationCount: "infinite",
						animationDelay: bulb.delay,
					}}
				/>
			))}
		</>
	);
}

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
			{/* Marquee-style border with glow */}
			<div
				className="absolute"
				style={{
					inset: 0,
					border: "2px solid rgba(255,184,0,0.3)",
					borderRadius: "8px",
					boxShadow:
						"0 0 16px rgba(255,184,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
					pointerEvents: "none",
					background: "rgba(10,10,30,0.85)",
				}}
			/>

			{/* Mini chasing bulbs */}
			<MiniBulbRow position="top" />
			<MiniBulbRow position="bottom" />

			<div
				className={cn(
					"relative flex items-center gap-2 rounded-lg px-4 py-2",
					isLoading && "opacity-50",
				)}
			>
				<span
					className="font-mono-retro text-[9px] uppercase tracking-[2px] text-neon-amber/80"
					style={{ textShadow: "0 0 6px rgba(255,184,0,0.3)" }}
				>
					Shuffling
				</span>

				<div className="relative">
					<select
						value={currentWatchlistId ?? shuffleWatchlistId}
						onChange={(e) => onSelect(e.target.value)}
						disabled={isLoading}
						className="appearance-none rounded border-none bg-transparent pr-5 pl-1 font-mono-retro text-[11px] text-cream/90 outline-none disabled:opacity-50"
						style={{
							textShadow: "0 0 10px rgba(255,255,240,0.2)",
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
					<ChevronDown
						className="pointer-events-none absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2 text-neon-amber/60"
						style={{
							filter: "drop-shadow(0 0 4px rgba(255,184,0,0.3))",
						}}
					/>
				</div>
			</div>
		</div>
	);
}
