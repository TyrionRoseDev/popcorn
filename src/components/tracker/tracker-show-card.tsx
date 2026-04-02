import { Link } from "@tanstack/react-router";
import { Clock, Star, X } from "lucide-react";

interface TrackerShowCardProps {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	backdropPath: string | null;
	episodeCount: number;
	totalEpisodes: number;
	totalRuntime: number;
	showStatus: string | undefined;
	rating: number | null;
	genres: string[];
	year: string;
	contentRating: string;
	seasonList?: Array<{
		seasonNumber: number;
		episodeCount: number;
		name: string;
	}>;
	onRemove?: (tmdbId: number) => void;
}

function formatRuntime(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Determine which season the user is currently on based on cumulative episode counts.
 * Returns a label like "Season 1" or "S3 E7".
 */
function getCurrentSeasonLabel(
	episodeCount: number,
	seasonList: Array<{
		seasonNumber: number;
		episodeCount: number;
		name: string;
	}>,
): string | null {
	if (!seasonList.length || episodeCount <= 0) return null;

	// Sort seasons, exclude specials (season 0)
	const seasons = seasonList
		.filter((s) => s.seasonNumber > 0)
		.sort((a, b) => a.seasonNumber - b.seasonNumber);

	let remaining = episodeCount;
	for (const season of seasons) {
		if (remaining <= season.episodeCount) {
			// User is in this season
			if (seasons.length === 1) return `S${season.seasonNumber}`;
			return `S${season.seasonNumber} E${remaining}`;
		}
		remaining -= season.episodeCount;
	}

	// Watched everything
	const lastSeason = seasons[seasons.length - 1];
	return lastSeason ? `S${lastSeason.seasonNumber}` : null;
}

export function TrackerShowCard({
	tmdbId,
	title,
	posterPath,
	backdropPath,
	episodeCount,
	totalEpisodes,
	totalRuntime,
	showStatus,
	rating,
	genres: _genres,
	year,
	contentRating,
	seasonList,
	onRemove,
}: TrackerShowCardProps) {
	const isEnded = showStatus === "Ended" || showStatus === "Canceled";
	const isComplete =
		isEnded && totalEpisodes > 0 && episodeCount >= totalEpisodes;
	const isCaughtUp =
		!isEnded && totalEpisodes > 0 && episodeCount >= totalEpisodes;
	const isInProgress = !isComplete && !isCaughtUp;
	const progressPct =
		totalEpisodes > 0
			? Math.min(100, Math.round((episodeCount / totalEpisodes) * 100))
			: 0;

	let statusLabel: string;
	let statusColor: string;
	let statusGlow: string;
	let accentRgb: string;

	if (isComplete) {
		statusLabel = "Completed";
		statusColor = "#FFB800";
		statusGlow = "rgba(255,184,0,0.35)";
		accentRgb = "255,184,0";
	} else if (isCaughtUp) {
		statusLabel = "Caught Up";
		statusColor = "#34d399";
		statusGlow = "rgba(52,211,153,0.35)";
		accentRgb = "52,211,153";
	} else {
		statusLabel = "In Progress";
		statusColor = "#00E5FF";
		statusGlow = "rgba(0,229,255,0.35)";
		accentRgb = "0,229,255";
	}

	const progressGradient = isComplete
		? "linear-gradient(90deg, #ffb800, #ffd060)"
		: isCaughtUp
			? "linear-gradient(90deg, #34d399, #6ee7b7)"
			: "linear-gradient(90deg, #00e5ff, #40c8e0)";

	const progressShadow = `0 0 10px rgba(${accentRgb},0.5), 0 0 20px rgba(${accentRgb},0.2)`;

	const seasonLabel = seasonList
		? getCurrentSeasonLabel(episodeCount, seasonList)
		: null;

	return (
		<Link
			to="/app/tracker/$tmdbId"
			params={{ tmdbId: String(tmdbId) }}
			className="group relative block overflow-hidden rounded-lg no-underline transition-all duration-300"
			style={{
				border: "1px solid #1a1a2e",
				boxShadow: "0 2px 20px rgba(0,0,0,0.3)",
				minHeight: "220px",
			}}
			onMouseEnter={(e) => {
				const el = e.currentTarget;
				el.style.borderColor = `rgba(${accentRgb},0.35)`;
				el.style.boxShadow = `0 6px 30px rgba(0,0,0,0.5), 0 0 20px rgba(${accentRgb},0.06)`;
				el.style.transform = "translateY(-2px)";
				const img = el.querySelector(
					"[data-backdrop-img]",
				) as HTMLElement | null;
				if (img) img.style.filter = "brightness(1.2)";
			}}
			onMouseLeave={(e) => {
				const el = e.currentTarget;
				el.style.borderColor = "#1a1a2e";
				el.style.boxShadow = "0 2px 20px rgba(0,0,0,0.3)";
				el.style.transform = "translateY(0)";
				const img = el.querySelector(
					"[data-backdrop-img]",
				) as HTMLElement | null;
				if (img) img.style.filter = "brightness(1)";
			}}
		>
			{/* ── Backdrop image fills the entire card ────────────────────────── */}
			{backdropPath ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 z-0"
				>
					<img
						src={`https://image.tmdb.org/t/p/w780${backdropPath}`}
						alt=""
						className="h-full w-full object-cover transition-[filter] duration-500"
						style={{ filter: "brightness(1)" }}
						loading="lazy"
						data-backdrop-img=""
					/>
					{/* Dark overlay for readability across the whole image */}
					<div
						className="absolute inset-0"
						style={{ background: "rgba(5,5,8,0.45)" }}
					/>
					{/* Heavy gradient overlay: transparent top -> dark navy bottom */}
					<div
						className="absolute inset-0"
						style={{
							background:
								"linear-gradient(to bottom, transparent 20%, rgba(5,5,8,0.6) 50%, rgba(5,5,8,0.95) 80%)",
						}}
					/>
				</div>
			) : (
				/* Fallback: dark gradient with accent tint when no backdrop */
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 z-0"
					style={{
						background: `linear-gradient(145deg, rgba(${accentRgb},0.08), #050508 60%)`,
					}}
				/>
			)}

			{/* ── Remove button (top-right, appears on hover) ──────────────── */}
			{onRemove && (
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onRemove(tmdbId);
					}}
					className="absolute top-2 right-2 z-20 flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-all duration-200 group-hover:opacity-100"
					style={{
						color: "rgba(255,255,240,0.3)",
						background: "rgba(0,0,0,0.5)",
						backdropFilter: "blur(4px)",
					}}
					onMouseEnter={(e) => {
						const el = e.currentTarget;
						el.style.color = "rgba(255,45,120,0.8)";
						el.style.background = "rgba(255,45,120,0.15)";
					}}
					onMouseLeave={(e) => {
						const el = e.currentTarget;
						el.style.color = "rgba(255,255,240,0.3)";
						el.style.background = "rgba(0,0,0,0.5)";
					}}
					title="Remove from tracker"
				>
					<X className="h-3 w-3" />
				</button>
			)}

			{/* ── Content overlay at bottom of card ────────────────────────── */}
			<div className="relative z-10 flex h-full min-h-[220px] flex-col justify-end p-3 pb-0">
				<div className="flex items-end gap-2.5">
					{/* Mini poster thumbnail */}
					<div
						className="shrink-0 overflow-hidden rounded"
						style={{
							width: 50,
							height: 75,
							border: "1px solid rgba(255,255,240,0.1)",
							boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
						}}
					>
						{posterPath ? (
							<img
								src={`https://image.tmdb.org/t/p/w185${posterPath}`}
								alt=""
								className="h-full w-full object-cover"
								loading="lazy"
							/>
						) : (
							<div
								className="flex h-full w-full items-center justify-center font-mono-retro"
								style={{
									fontSize: "7px",
									color: "rgba(255,255,240,0.15)",
									background:
										"linear-gradient(145deg, rgba(255,255,240,0.04), rgba(255,255,240,0.01))",
								}}
							>
								NO
								<br />
								IMG
							</div>
						)}
					</div>

					{/* Title + metadata */}
					<div className="min-w-0 flex-1 pb-1">
						<div className="flex items-baseline gap-1.5 min-w-0">
							<h3
								className="truncate font-display leading-tight"
								style={{
									fontSize: "16px",
									color: "#fffff0",
									textShadow:
										"0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)",
								}}
							>
								{title}
							</h3>
							{year && (
								<span
									className="shrink-0 font-mono-retro"
									style={{
										fontSize: "9px",
										color: "rgba(255,255,240,0.3)",
										textShadow: "0 1px 3px rgba(0,0,0,0.6)",
									}}
								>
									{year}
								</span>
							)}
						</div>

						<div className="mt-1 flex flex-wrap items-center gap-2">
							{/* Status badge with neon glow */}
							<span
								className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono-retro"
								style={{
									fontSize: "8px",
									letterSpacing: "1.5px",
									textTransform: "uppercase",
									color: statusColor,
									background: statusGlow.replace("0.35", "0.12"),
									textShadow: `0 0 8px ${statusGlow}`,
									boxShadow: `0 0 10px ${statusGlow.replace("0.35", "0.08")}`,
								}}
							>
								<span
									className="inline-block rounded-full"
									style={{
										width: "4px",
										height: "4px",
										backgroundColor: statusColor,
										boxShadow: `0 0 5px ${statusColor}`,
									}}
								/>
								{statusLabel}
							</span>

							{seasonLabel && (
								<span
									className="font-mono-retro tracking-wide"
									style={{
										fontSize: "9px",
										color: "rgba(255,255,240,0.45)",
										textShadow: "0 1px 3px rgba(0,0,0,0.6)",
									}}
								>
									{seasonLabel}
								</span>
							)}

							{contentRating && contentRating !== "NR" && (
								<span
									className="rounded px-1.5 py-0.5 font-mono-retro tracking-wide"
									style={{
										fontSize: "8px",
										color: "rgba(255,255,240,0.35)",
										border: "1px solid rgba(255,255,240,0.12)",
										textShadow: "0 1px 3px rgba(0,0,0,0.6)",
									}}
								>
									{contentRating}
								</span>
							)}

							{totalRuntime > 0 && (
								<span
									className="inline-flex items-center gap-1 font-mono-retro tracking-wide"
									style={{
										fontSize: "9px",
										color: "rgba(255,255,240,0.3)",
										textShadow: "0 1px 3px rgba(0,0,0,0.6)",
									}}
								>
									<Clock className="h-2.5 w-2.5" />
									{formatRuntime(totalRuntime)}
								</span>
							)}

							{isComplete && rating && (
								<div className="flex items-center gap-0.5">
									{[1, 2, 3, 4, 5].map((s) => (
										<Star
											key={s}
											className={`h-2.5 w-2.5 ${
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
				</div>

				{/* Episode count text */}
				<div className="mt-2 flex items-center justify-between px-0.5">
					<span
						className="font-mono-retro tracking-wide"
						style={{
							fontSize: "9px",
							color: "rgba(255,255,240,0.45)",
							textShadow: "0 1px 3px rgba(0,0,0,0.6)",
						}}
					>
						{episodeCount}
						<span style={{ color: "rgba(255,255,240,0.25)" }}>
							/{totalEpisodes > 0 ? totalEpisodes : "?"}
						</span>{" "}
						<span style={{ color: "rgba(255,255,240,0.25)" }}>ep</span>
					</span>
					{totalEpisodes > 0 && (
						<span
							className="font-mono-retro tracking-wider"
							style={{
								fontSize: "9px",
								color: `rgba(${accentRgb},0.55)`,
								textShadow: `0 0 6px rgba(${accentRgb},0.3)`,
							}}
						>
							{progressPct}%
						</span>
					)}
				</div>

				{/* ── Progress bar — full width at the very bottom, 4px glowing ── */}
				<div
					className="relative mt-1 w-full overflow-hidden"
					style={{
						height: "4px",
						background: "rgba(255,255,240,0.04)",
						/* Flush to card bottom — negative margin to counteract parent padding */
						marginLeft: "-0.75rem",
						marginRight: "-0.75rem",
						width: "calc(100% + 1.5rem)",
						borderBottomLeftRadius: "0.5rem",
						borderBottomRightRadius: "0.5rem",
					}}
				>
					<div
						className="h-full transition-all duration-700"
						style={{
							width: `${progressPct}%`,
							background: progressGradient,
							boxShadow: progressPct > 0 ? progressShadow : "none",
						}}
					/>
					{/* Animated shimmer for in-progress shows */}
					{isInProgress && progressPct > 0 && progressPct < 100 && (
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 overflow-hidden"
						>
							<div
								className="absolute inset-0 h-full"
								style={{
									width: `${progressPct}%`,
									background:
										"linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
									animation: "shimmer-sweep 4s ease-in-out infinite",
								}}
							/>
						</div>
					)}
				</div>
			</div>
		</Link>
	);
}
