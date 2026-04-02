import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

interface TrackerShowCardProps {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	episodeCount: number;
	totalEpisodes: number;
	showStatus: string | undefined;
	rating: number | null;
}

export function TrackerShowCard({
	tmdbId,
	title,
	posterPath,
	episodeCount,
	totalEpisodes,
	showStatus,
	rating,
}: TrackerShowCardProps) {
	const isEnded = showStatus === "Ended" || showStatus === "Canceled";
	const isComplete =
		isEnded && totalEpisodes > 0 && episodeCount >= totalEpisodes;
	const isCaughtUp =
		!isEnded && totalEpisodes > 0 && episodeCount >= totalEpisodes;
	const progressPct =
		totalEpisodes > 0
			? Math.min(100, Math.round((episodeCount / totalEpisodes) * 100))
			: 0;

	let statusLabel: string;
	let statusColor: string;
	let statusGlow: string;

	if (isComplete) {
		statusLabel = "Completed";
		statusColor = "text-neon-amber";
		statusGlow = "rgba(255,184,0,0.35)";
	} else if (isCaughtUp) {
		statusLabel = "Caught Up";
		statusColor = "text-emerald-400";
		statusGlow = "rgba(52,211,153,0.35)";
	} else {
		statusLabel = "In Progress";
		statusColor = "text-neon-cyan";
		statusGlow = "rgba(0,229,255,0.35)";
	}

	return (
		<Link
			to="/app/title/$mediaType/$tmdbId"
			params={{ mediaType: "tv", tmdbId: tmdbId }}
			className="group relative flex gap-4 rounded-xl border border-cream/8 p-3 no-underline transition-all duration-300 hover:border-cream/15 hover:shadow-lg"
			style={{
				background:
					"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
				boxShadow: "0 0 16px rgba(0,0,0,0.3)",
			}}
		>
			{/* Subtle glow on hover */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				style={{
					background: `radial-gradient(ellipse at top left, ${statusGlow.replace("0.35", "0.06")}, transparent 60%)`,
				}}
			/>

			{/* Poster */}
			<div className="relative h-[108px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-cream/5">
				{posterPath ? (
					<img
						src={`https://image.tmdb.org/t/p/w154${posterPath}`}
						alt=""
						className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
						loading="lazy"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-cream/15 text-xs font-mono-retro">
						NO
						<br />
						IMG
					</div>
				)}
			</div>

			{/* Info */}
			<div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between py-0.5">
				<div>
					{/* Title */}
					<h3 className="truncate text-sm font-semibold text-cream/90 transition-colors group-hover:text-cream">
						{title}
					</h3>

					{/* Status badge */}
					<div className="mt-1.5 flex items-center gap-2">
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono-retro tracking-wider uppercase ${statusColor}`}
							style={{
								background: statusGlow.replace("0.35", "0.1"),
								textShadow: `0 0 8px ${statusGlow}`,
							}}
						>
							<span
								className="inline-block h-1 w-1 rounded-full"
								style={{
									backgroundColor: "currentColor",
									boxShadow: `0 0 4px currentColor`,
								}}
							/>
							{statusLabel}
						</span>
					</div>

					{isCaughtUp && (
						<p className="mt-1 text-[10px] text-cream/30 font-mono-retro tracking-wide">
							More episodes coming soon
						</p>
					)}
				</div>

				{/* Progress bar + episode count */}
				<div className="mt-auto">
					<div className="flex items-center justify-between mb-1">
						<span className="text-[11px] font-mono-retro text-cream/40 tracking-wide">
							{episodeCount}/{totalEpisodes > 0 ? totalEpisodes : "?"} episodes
						</span>
						{totalEpisodes > 0 && (
							<span className="text-[10px] font-mono-retro text-cream/25">
								{progressPct}%
							</span>
						)}
					</div>
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-cream/5">
						<div
							className="h-full rounded-full transition-all duration-500"
							style={{
								width: `${progressPct}%`,
								background: isComplete
									? "linear-gradient(90deg, #ffb800, #ffd060)"
									: isCaughtUp
										? "linear-gradient(90deg, #34d399, #6ee7b7)"
										: "linear-gradient(90deg, #00e5ff, #40c8e0)",
								boxShadow: isComplete
									? "0 0 8px rgba(255,184,0,0.4)"
									: isCaughtUp
										? "0 0 8px rgba(52,211,153,0.4)"
										: "0 0 8px rgba(0,229,255,0.4)",
							}}
						/>
					</div>

					{/* Star rating for completed shows */}
					{isComplete && rating && (
						<div className="flex items-center gap-0.5 mt-1.5">
							{[1, 2, 3, 4, 5].map((s) => (
								<Star
									key={s}
									className={`h-3 w-3 ${
										s <= rating
											? "text-neon-amber fill-neon-amber drop-shadow-[0_0_4px_rgba(255,184,0,0.5)]"
											: "text-cream/10"
									}`}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</Link>
	);
}
