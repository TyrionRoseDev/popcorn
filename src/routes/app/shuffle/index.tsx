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
				{/* Marquee-style amber border with drive-in card bg */}
				<div
					className="absolute"
					style={{
						inset: 0,
						border: "2px solid rgba(255,184,0,0.3)",
						borderRadius: "8px",
						boxShadow:
							"0 0 24px rgba(255,184,0,0.1), inset 0 0 12px rgba(255,184,0,0.03)",
						background: "rgba(10,10,30,0.7)",
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
						margin: 0,
						marginBottom: "6px",
						textShadow: "0 0 8px rgba(255,184,0,0.4)",
						animationName: "marquee-pulse",
						animationDuration: "3s",
						animationTimingFunction: "ease-in-out",
						animationIterationCount: "infinite",
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
							"0 0 30px rgba(255,255,240,0.25), 0 0 60px rgba(255,255,240,0.08)",
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

			{/* Full-screen immersive layout — vertically centered drive-in experience */}
			<div
				className="relative mx-auto flex h-[100dvh] max-w-md flex-col items-center justify-between px-4 py-4"
				style={{ zIndex: 2 }}
			>
				{/* TOP: Marquee header — the sign above the screen */}
				<div className="shrink-0 pt-1">
					<ShuffleHeader />
					{/* Mode switcher tucked under the marquee */}
					<div className="mt-3 flex justify-center">
						<ModeSwitcher
							currentWatchlistId={activeWatchlistId}
							shuffleWatchlistId={shuffleWatchlist?.id ?? resolvedWatchlistId}
							onSelect={setActiveWatchlistId}
						/>
					</div>
				</div>

				{/* CENTER: Card stack — the movie screen itself */}
				<div className="flex w-full flex-1 items-center justify-center py-4">
					<CardStack
						key={resolvedWatchlistId}
						watchlistId={resolvedWatchlistId}
					/>
				</div>
			</div>
		</>
	);
}
