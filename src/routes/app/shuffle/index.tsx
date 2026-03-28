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

const BULBS = Array.from({ length: 18 }, (_, i) => ({
	id: `shuffle-bulb-${i}`,
	leftPercent: `${(i / 17) * 100}%`,
	delay: i % 2 === 0 ? "0s" : "0.6s",
}));

function ChasingBulbs({ position }: { position: "top" | "bottom" }) {
	const posStyle = position === "top" ? { top: "-4px" } : { bottom: "-4px" };

	return (
		<>
			{BULBS.map((bulb) => (
				<div
					key={bulb.id + position}
					className="absolute rounded-full"
					style={{
						...posStyle,
						left: bulb.leftPercent,
						width: "5px",
						height: "5px",
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

function ShuffleHeader() {
	return (
		<div className="flex justify-center">
			<div
				className="relative text-center"
				style={{ maxWidth: "400px", padding: "16px 32px" }}
			>
				{/* Amber border */}
				<div
					className="absolute"
					style={{
						inset: 0,
						border: "2px solid rgba(255,184,0,0.3)",
						borderRadius: "8px",
						boxShadow: "0 0 20px rgba(255,184,0,0.08)",
						pointerEvents: "none",
					}}
				/>

				{/* Chasing bulbs */}
				<ChasingBulbs position="top" />
				<ChasingBulbs position="bottom" />

				{/* NOW SHUFFLING label */}
				<p
					className="font-mono-retro"
					style={{
						fontSize: "9px",
						letterSpacing: "4px",
						textTransform: "uppercase",
						color: "#FFB800",
						opacity: 0.7,
						margin: 0,
						marginBottom: "6px",
					}}
				>
					Now Shuffling
				</p>

				{/* Title */}
				<h1
					className="font-display"
					style={{
						fontSize: "24px",
						color: "#fffff0",
						margin: 0,
						textShadow:
							"0 0 30px rgba(255,255,240,0.2), 0 0 60px rgba(255,255,240,0.05)",
					}}
				>
					Showtime Shuffle
				</h1>
			</div>
		</div>
	);
}

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
				{/* Marquee header with chasing bulbs */}
				<div className="mb-4">
					<ShuffleHeader />
				</div>

				{/* Mode switcher */}
				<div className="mb-5 flex justify-center">
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
