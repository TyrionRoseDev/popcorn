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
	genres,
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

	const displayGenres = genres.slice(0, 3);

	return (
		<Link
			to="/app/tracker/$tmdbId"
			params={{ tmdbId: String(tmdbId) }}
			className="group relative block overflow-hidden rounded-lg no-underline transition-all duration-300"
			style={{
				background: "#0a0a1e",
				border: "1px solid #1a1a2e",
				boxShadow: "0 2px 20px rgba(0,0,0,0.3)",
			}}
			onMouseEnter={(e) => {
				const el = e.currentTarget;
				el.style.borderColor = `rgba(${accentRgb},0.35)`;
				el.style.boxShadow = `0 6px 30px rgba(0,0,0,0.5), 0 0 20px rgba(${accentRgb},0.06)`;
				el.style.transform = "translateY(-2px)";
				// Boost backdrop opacity on hover
				const backdrop = el.querySelector(
					"[data-backdrop]",
				) as HTMLElement | null;
				if (backdrop) backdrop.style.opacity = "0.13";
			}}
			onMouseLeave={(e) => {
				const el = e.currentTarget;
				el.style.borderColor = "#1a1a2e";
				el.style.boxShadow = "0 2px 20px rgba(0,0,0,0.3)";
				el.style.transform = "translateY(0)";
				const backdrop = el.querySelector(
					"[data-backdrop]",
				) as HTMLElement | null;
				if (backdrop) backdrop.style.opacity = "0.07";
			}}
		>
			{/* Backdrop atmosphere overlay */}
			{backdropPath && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity duration-500"
					style={{ opacity: 0.07 }}
					data-backdrop=""
				>
					<img
						src={`https://image.tmdb.org/t/p/w780${backdropPath}`}
						alt=""
						className="h-full w-full object-cover"
						loading="lazy"
					/>
					{/* Gradient mask to fade edges */}
					<div
						className="absolute inset-0"
						style={{
							background:
								"linear-gradient(to right, #0a0a1e 0%, transparent 30%, transparent 70%, #0a0a1e 100%), linear-gradient(to bottom, transparent 0%, #0a0a1e 90%)",
						}}
					/>
				</div>
			)}

			{/* Top accent glow — tinted with show color */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 z-0"
				style={{
					height: "40px",
					background: `linear-gradient(to bottom, rgba(${accentRgb},0.06), transparent)`,
				}}
			/>

			{/* Card body — compact layout */}
			<div className="relative flex gap-3 p-3">
				{/* Ambient glow on hover */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
					style={{
						background: `radial-gradient(ellipse at 15% 40%, rgba(${accentRgb},0.05), transparent 60%)`,
					}}
				/>

				{/* Remove button */}
				{onRemove && (
					<button
						type="button"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onRemove(tmdbId);
						}}
						className="absolute top-2 right-2 z-20 flex h-5 w-5 items-center justify-center rounded-md opacity-0 transition-all duration-200 group-hover:opacity-100"
						style={{
							color: "rgba(255,255,240,0.2)",
							background: "rgba(255,255,240,0.03)",
						}}
						onMouseEnter={(e) => {
							const el = e.currentTarget;
							el.style.color = "rgba(255,45,120,0.7)";
							el.style.background = "rgba(255,45,120,0.1)";
						}}
						onMouseLeave={(e) => {
							const el = e.currentTarget;
							el.style.color = "rgba(255,255,240,0.2)";
							el.style.background = "rgba(255,255,240,0.03)";
						}}
						title="Remove from tracker"
					>
						<X className="h-3 w-3" />
					</button>
				)}

				{/* Poster — compact 72x108 */}
				<div
					className="relative shrink-0 overflow-hidden rounded-md"
					style={{
						width: 72,
						height: 108,
						boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 16px rgba(${accentRgb},0.08)`,
					}}
				>
					{posterPath ? (
						<img
							src={`https://image.tmdb.org/t/p/w185${posterPath}`}
							alt=""
							className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
							loading="lazy"
						/>
					) : (
						<div
							className="flex h-full w-full items-center justify-center font-mono-retro tracking-wider"
							style={{
								fontSize: "8px",
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
					{/* Poster shimmer overlay on hover */}
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
						style={{
							background:
								"linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)",
						}}
					/>
				</div>

				{/* Info — stacked tight */}
				<div className="relative z-10 flex min-w-0 flex-1 flex-col py-0">
					{/* Title + year */}
					<div className="flex items-baseline gap-1.5 min-w-0">
						<h3
							className="truncate font-display leading-tight text-cream/90 transition-colors duration-300 group-hover:text-cream"
							style={{ fontSize: "15px" }}
						>
							{title}
						</h3>
						{year && (
							<span
								className="shrink-0 font-mono-retro"
								style={{
									fontSize: "9px",
									color: "rgba(255,255,240,0.25)",
								}}
							>
								{year}
							</span>
						)}
					</div>

					{/* Status badge + content rating */}
					<div className="mt-1.5 flex items-center gap-2 flex-wrap">
						<span
							className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono-retro"
							style={{
								fontSize: "8px",
								letterSpacing: "1.5px",
								textTransform: "uppercase",
								color: statusColor,
								background: statusGlow.replace("0.35", "0.1"),
								textShadow: `0 0 8px ${statusGlow}`,
								boxShadow: `0 0 10px ${statusGlow.replace("0.35", "0.06")}`,
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

						{contentRating && contentRating !== "NR" && (
							<span
								className="rounded px-1.5 py-0.5 font-mono-retro tracking-wide"
								style={{
									fontSize: "8px",
									color: "rgba(255,255,240,0.3)",
									border: "1px solid rgba(255,255,240,0.1)",
								}}
							>
								{contentRating}
							</span>
						)}

						{/* Season/episode indicator */}
						{seasonLabel && (
							<span
								className="font-mono-retro tracking-wide"
								style={{
									fontSize: "9px",
									color: "rgba(255,255,240,0.35)",
								}}
							>
								{seasonLabel}
							</span>
						)}
					</div>

					{/* Genre pills */}
					{displayGenres.length > 0 && (
						<div className="mt-1.5 flex flex-wrap gap-1">
							{displayGenres.map((genre) => (
								<span
									key={genre}
									className="rounded-full px-2 py-px font-mono-retro"
									style={{
										fontSize: "9px",
										color: "#FF2D78",
										border: "1px solid rgba(255,45,120,0.3)",
										background: "rgba(255,45,120,0.04)",
									}}
								>
									{genre}
								</span>
							))}
						</div>
					)}

					{/* Watch time + contextual info */}
					<div className="mt-1.5 flex items-center gap-2">
						{totalRuntime > 0 && (
							<span
								className="inline-flex items-center gap-1 font-mono-retro tracking-wide"
								style={{
									fontSize: "9px",
									color: "rgba(255,255,240,0.25)",
								}}
							>
								<Clock className="h-2.5 w-2.5" />
								{formatRuntime(totalRuntime)}
							</span>
						)}

						{/* Star rating for completed shows */}
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

					{isCaughtUp && (
						<p
							className="mt-1 font-mono-retro tracking-wide"
							style={{
								fontSize: "9px",
								color: "rgba(255,255,240,0.3)",
								animation: "pulse-text 3s ease-in-out infinite",
							}}
						>
							More episodes coming soon
						</p>
					)}

					{/* Progress bar + episode count — anchored to bottom */}
					<div className="mt-auto pt-1.5">
						<div className="flex items-center justify-between mb-1">
							<span
								className="font-mono-retro tracking-wide"
								style={{ fontSize: "9px", color: "rgba(255,255,240,0.4)" }}
							>
								{episodeCount}
								<span style={{ color: "rgba(255,255,240,0.2)" }}>
									/{totalEpisodes > 0 ? totalEpisodes : "?"}
								</span>{" "}
								<span style={{ color: "rgba(255,255,240,0.2)" }}>ep</span>
							</span>
							{totalEpisodes > 0 && (
								<span
									className="font-mono-retro tracking-wider"
									style={{
										fontSize: "9px",
										color: `rgba(${accentRgb},0.5)`,
									}}
								>
									{progressPct}%
								</span>
							)}
						</div>

						{/* Progress bar track — 4px slim */}
						<div
							className="relative w-full overflow-hidden rounded-full"
							style={{
								height: "4px",
								background: "rgba(255,255,240,0.04)",
								boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
							}}
						>
							<div
								className="h-full rounded-full transition-all duration-700"
								style={{
									width: `${progressPct}%`,
									background: progressGradient,
									boxShadow: progressPct > 0 ? progressShadow : "none",
								}}
							/>
							{/* Animated shimmer sweep for in-progress shows */}
							{isInProgress && progressPct > 0 && progressPct < 100 && (
								<div
									aria-hidden="true"
									className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
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
				</div>
			</div>
		</Link>
	);
}
