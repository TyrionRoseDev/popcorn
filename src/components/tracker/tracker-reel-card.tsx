import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface TrackerReelCardProps {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	episodeCount: number;
	totalEpisodes: number;
	showStatus: string | undefined;
	onRemove?: (tmdbId: number) => void;
}

export function TrackerReelCard({
	tmdbId,
	title,
	posterPath,
	episodeCount,
	totalEpisodes,
	showStatus,
	onRemove,
}: TrackerReelCardProps) {
	const isEnded = showStatus === "Ended" || showStatus === "Canceled";
	const isComplete =
		isEnded && totalEpisodes > 0 && episodeCount >= totalEpisodes;
	const isCaughtUp =
		!isEnded && totalEpisodes > 0 && episodeCount >= totalEpisodes;

	const progressPct =
		totalEpisodes > 0
			? Math.min(100, Math.round((episodeCount / totalEpisodes) * 100))
			: 0;

	let statusColor: string;
	let progressGradient: string;
	let accentRgb: string;

	if (isComplete) {
		statusColor = "#FFB800";
		progressGradient = "linear-gradient(90deg, #ffb800, #ffd060)";
		accentRgb = "255,184,0";
	} else if (isCaughtUp) {
		statusColor = "#34d399";
		progressGradient = "linear-gradient(90deg, #34d399, #6ee7b7)";
		accentRgb = "52,211,153";
	} else {
		statusColor = "#00e5ff";
		progressGradient = "linear-gradient(90deg, #00e5ff, #40c8e0)";
		accentRgb = "0,229,255";
	}

	const posterUrl = getTmdbImageUrl(posterPath, "w185");

	return (
		<div
			className="group/card relative flex-shrink-0"
			style={{ padding: "8px 6px", width: 127 }}
		>
			<Link
				to="/app/tracker/$tmdbId"
				params={{ tmdbId: String(tmdbId) }}
				className="block no-underline"
			>
				{/* Poster */}
				<div
					className="relative overflow-hidden"
					style={{
						width: 115,
						height: 165,
						borderRadius: 3,
					}}
				>
					{posterUrl ? (
						<img
							src={posterUrl}
							alt=""
							className="h-full w-full object-cover transition-[filter] duration-300 group-hover/card:brightness-110"
							loading="lazy"
						/>
					) : (
						<div
							className="flex h-full w-full items-center justify-center font-mono-retro"
							style={{
								fontSize: "9px",
								color: "rgba(255,255,240,0.15)",
								background:
									"linear-gradient(145deg, rgba(255,255,240,0.04), rgba(255,255,240,0.01))",
							}}
						>
							NO IMG
						</div>
					)}

					{/* Progress bar overlaid at bottom of poster */}
					<div
						className="absolute inset-x-0 bottom-0"
						style={{
							height: "4px",
							background: "rgba(0,0,0,0.6)",
						}}
					>
						<div
							className="h-full transition-all duration-700"
							style={{
								width: `${progressPct}%`,
								background: progressGradient,
								boxShadow:
									progressPct > 0
										? `0 0 8px rgba(${accentRgb},0.6), 0 0 16px rgba(${accentRgb},0.25)`
										: "none",
							}}
						/>
					</div>

					{/* Hover overlay gradient for readability */}
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
						style={{
							background:
								"linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)",
						}}
					/>
				</div>

				{/* Title + meta below poster */}
				<div className="mt-1.5" style={{ width: 115 }}>
					<p
						className="truncate font-display leading-tight text-cream/80 transition-colors duration-300 group-hover/card:text-cream"
						style={{ fontSize: "13px" }}
					>
						{title}
					</p>
					<div className="mt-0.5 flex items-center gap-1.5">
						{/* Status dot */}
						<span
							className="inline-block rounded-full"
							style={{
								width: "5px",
								height: "5px",
								backgroundColor: statusColor,
								boxShadow: `0 0 5px ${statusColor}`,
								flexShrink: 0,
							}}
						/>
						<span
							className="font-mono-retro tracking-wide"
							style={{
								fontSize: "9px",
								color: "rgba(255,255,240,0.35)",
							}}
						>
							{episodeCount}
							<span style={{ color: "rgba(255,255,240,0.2)" }}>
								/{totalEpisodes > 0 ? totalEpisodes : "?"}
							</span>{" "}
							<span style={{ color: "rgba(255,255,240,0.2)" }}>ep</span>
						</span>
					</div>
				</div>
			</Link>

			{/* Remove button — appears on hover */}
			{onRemove && (
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onRemove(tmdbId);
					}}
					className="absolute top-2 right-0 z-20 flex h-5 w-5 items-center justify-center rounded-md opacity-0 transition-all duration-200 group-hover/card:opacity-100"
					style={{
						color: "rgba(255,255,240,0.3)",
						background: "rgba(0,0,0,0.7)",
						border: "1px solid rgba(255,255,240,0.1)",
					}}
					onMouseEnter={(e) => {
						const el = e.currentTarget;
						el.style.color = "rgba(255,45,120,0.8)";
						el.style.background = "rgba(255,45,120,0.15)";
						el.style.borderColor = "rgba(255,45,120,0.3)";
					}}
					onMouseLeave={(e) => {
						const el = e.currentTarget;
						el.style.color = "rgba(255,255,240,0.3)";
						el.style.background = "rgba(0,0,0,0.7)";
						el.style.borderColor = "rgba(255,255,240,0.1)";
					}}
					title="Remove from tracker"
				>
					<X className="h-3 w-3" />
				</button>
			)}
		</div>
	);
}
