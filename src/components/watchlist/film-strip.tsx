import { useMemo } from "react";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface FilmStripProps {
	items: Array<{
		tmdbId: number;
		mediaType: string;
		posterPath: string | null;
	}>;
}

/** Palette of dark gradient backgrounds keyed by tmdbId. */
const POSTER_GRADIENTS = [
	"linear-gradient(135deg, #1a3a5c, #0d2240)",
	"linear-gradient(135deg, #3a1a4c, #1e0d30)",
	"linear-gradient(135deg, #1a4c3a, #0d3020)",
	"linear-gradient(135deg, #4c2a1a, #301a0d)",
	"linear-gradient(135deg, #1a2a4c, #0d1a30)",
	"linear-gradient(135deg, #4c1a3a, #300d20)",
	"linear-gradient(135deg, #2a4c1a, #1a300d)",
	"linear-gradient(135deg, #1a4c4c, #0d3030)",
];

function gradientForId(tmdbId: number) {
	return POSTER_GRADIENTS[tmdbId % POSTER_GRADIENTS.length];
}

const SPROCKETS_PER_SLOT = 5;

const SPROCKET_STYLE: React.CSSProperties = {
	width: 12,
	height: 8,
	borderRadius: 2,
	background: "#050508",
	border: "1px solid #1a1a2e",
	margin: "0 8px",
	flexShrink: 0,
};

/** Static sprocket row — purely decorative, never reorders. */
function SprocketRow({ count }: { count: number }) {
	const sprockets = Array.from({ length: count }, (_, i) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: decorative identical elements, never reorder
		<div key={i} style={SPROCKET_STYLE} />
	));
	return (
		<div
			className="flex items-center"
			style={{ height: 14, background: "#0a0a1e" }}
		>
			{sprockets}
		</div>
	);
}

export function FilmStrip({ items }: FilmStripProps) {
	const reelItems = useMemo(() => {
		if (items.length === 0) return [];
		// Repeat to fill at least 12 slots
		const repeated: Array<{
			tmdbId: number;
			mediaType: string;
			posterPath: string | null;
			key: string;
		}> = [];
		let cycle = 0;
		while (repeated.length < 12) {
			for (const item of items) {
				repeated.push({
					...item,
					key: `${item.tmdbId}-${item.mediaType}-${cycle}`,
				});
				if (repeated.length >= 12) break;
			}
			cycle++;
		}
		// Duplicate for seamless CSS loop (animation translates -50%)
		return [
			...repeated.map((r) => ({ ...r, key: `a-${r.key}` })),
			...repeated.map((r) => ({ ...r, key: `b-${r.key}` })),
		];
	}, [items]);

	if (reelItems.length === 0) {
		return (
			<div
				className="flex h-[207px] items-center justify-center text-xs text-cream/20"
				style={{ background: "#0a0a1e" }}
			>
				Empty watchlist
			</div>
		);
	}

	const sprocketTotal = reelItems.length * SPROCKETS_PER_SLOT;

	return (
		<div
			className="group/reel overflow-hidden"
			style={{
				maskImage:
					"linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)",
				WebkitMaskImage:
					"linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)",
			}}
		>
			<div className="flex w-max flex-col animate-[scroll-reel_45s_linear_infinite] group-hover/reel:[animation-play-state:paused]">
				{/* Top sprocket row */}
				<SprocketRow count={sprocketTotal} />

				{/* Top strip line */}
				<div style={{ height: 2, background: "#1a1a2e" }} />

				{/* Poster row */}
				<div className="flex" style={{ background: "#0a0a1e" }}>
					{reelItems.map((item, i) => {
						const posterUrl = getTmdbImageUrl(item.posterPath, "w185");
						return (
							<div
								key={item.key}
								className="relative flex-shrink-0"
								style={{ padding: "8px 6px" }}
							>
								{posterUrl ? (
									<img
										src={posterUrl}
										alt=""
										className="object-cover"
										style={{
											width: 115,
											height: 165,
											borderRadius: 3,
										}}
										loading="lazy"
									/>
								) : (
									<div
										style={{
											width: 115,
											height: 165,
											borderRadius: 3,
											background: gradientForId(item.tmdbId),
										}}
									/>
								)}
								{/* Thin divider between slots */}
								{i < reelItems.length - 1 && (
									<div
										className="absolute top-0 right-0 h-full"
										style={{
											width: 1,
											background: "rgba(255,255,240,0.04)",
										}}
									/>
								)}
							</div>
						);
					})}
				</div>

				{/* Bottom strip line */}
				<div style={{ height: 2, background: "#1a1a2e" }} />

				{/* Bottom sprocket row */}
				<SprocketRow count={sprocketTotal} />
			</div>
		</div>
	);
}
