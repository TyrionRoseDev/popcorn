import { Link } from "@tanstack/react-router";
import { Clock, Star, X } from "lucide-react";

interface TrackerShowCardProps {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	episodeCount: number;
	totalEpisodes: number;
	totalRuntime: number;
	showStatus: string | undefined;
	rating: number | null;
	onRemove?: (tmdbId: number) => void;
}

function formatRuntime(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const SPROCKET_STYLE: React.CSSProperties = {
	width: 8,
	height: 5,
	borderRadius: 1,
	background: "#050508",
	border: "1px solid #1a1a2e",
	margin: "0 6px",
	flexShrink: 0,
};

function MiniSprocketRow() {
	const sprockets = Array.from({ length: 24 }, (_, i) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: decorative identical elements
		<div key={i} style={SPROCKET_STYLE} />
	));
	return (
		<div
			className="flex items-center overflow-hidden"
			style={{ height: 10, background: "#0a0a1e" }}
		>
			{sprockets}
		</div>
	);
}

export function TrackerShowCard({
	tmdbId,
	title,
	posterPath,
	episodeCount,
	totalEpisodes,
	totalRuntime,
	showStatus,
	rating,
	onRemove,
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
				el.style.borderColor = "rgba(255,184,0,0.25)";
				el.style.boxShadow =
					"0 6px 30px rgba(0,0,0,0.5), 0 0 30px rgba(255,184,0,0.06)";
				el.style.transform = "translateY(-2px)";
			}}
			onMouseLeave={(e) => {
				const el = e.currentTarget;
				el.style.borderColor = "#1a1a2e";
				el.style.boxShadow = "0 2px 20px rgba(0,0,0,0.3)";
				el.style.transform = "translateY(0)";
			}}
		>
			{/* Top sprocket row */}
			<MiniSprocketRow />
			<div style={{ height: 1, background: "#1a1a2e" }} />

			{/* Card body */}
			<div className="relative flex gap-4 p-4">
				{/* Ambient glow on hover */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
					style={{
						background:
							"radial-gradient(ellipse at 15% 40%, rgba(255,184,0,0.05), transparent 60%)",
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
						className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-all duration-200 group-hover:opacity-100"
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

				{/* Poster */}
				<div
					className="relative shrink-0 overflow-hidden rounded-md"
					style={{
						width: 100,
						height: 150,
						boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 24px rgba(${accentRgb},0.08)`,
					}}
				>
					{posterPath ? (
						<img
							src={`https://image.tmdb.org/t/p/w185${posterPath}`}
							alt=""
							className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
							loading="lazy"
						/>
					) : (
						<div
							className="flex h-full w-full items-center justify-center font-mono-retro tracking-wider"
							style={{
								fontSize: "9px",
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

				{/* Info */}
				<div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between py-0.5">
					<div>
						{/* Title */}
						<h3
							className="truncate font-display leading-snug text-cream/90 transition-colors duration-300 group-hover:text-cream"
							style={{ fontSize: "18px" }}
						>
							{title}
						</h3>

						{/* Status + runtime row */}
						<div className="mt-2.5 flex items-center gap-2.5 flex-wrap">
							<span
								className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono-retro"
								style={{
									fontSize: "9px",
									letterSpacing: "2px",
									textTransform: "uppercase",
									color: statusColor,
									background: statusGlow.replace("0.35", "0.1"),
									textShadow: `0 0 8px ${statusGlow}`,
									boxShadow: `0 0 12px ${statusGlow.replace("0.35", "0.08")}, inset 0 0 8px ${statusGlow.replace("0.35", "0.05")}`,
								}}
							>
								<span
									className="inline-block rounded-full"
									style={{
										width: "5px",
										height: "5px",
										backgroundColor: statusColor,
										boxShadow: `0 0 6px ${statusColor}`,
									}}
								/>
								{statusLabel}
							</span>

							{totalRuntime > 0 && (
								<span
									className="inline-flex items-center gap-1 font-mono-retro tracking-wide"
									style={{
										fontSize: "10px",
										color: "rgba(255,255,240,0.25)",
									}}
								>
									<Clock className="h-3 w-3" />
									{formatRuntime(totalRuntime)}
								</span>
							)}
						</div>

						{isCaughtUp && (
							<p
								className="mt-2 font-mono-retro tracking-wide"
								style={{
									fontSize: "10px",
									color: "rgba(255,255,240,0.3)",
									animation: "pulse-text 3s ease-in-out infinite",
								}}
							>
								New episodes coming soon
							</p>
						)}
					</div>

					{/* Progress bar + episode count */}
					<div className="mt-auto pt-2">
						<div className="flex items-center justify-between mb-2">
							<span
								className="font-mono-retro tracking-wide"
								style={{ fontSize: "11px", color: "rgba(255,255,240,0.4)" }}
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
										fontSize: "10px",
										color: `rgba(${accentRgb},0.5)`,
									}}
								>
									{progressPct}%
								</span>
							)}
						</div>

						{/* Progress bar track — 6px chunky */}
						<div
							className="relative w-full overflow-hidden rounded-full"
							style={{
								height: "6px",
								background: "rgba(255,255,240,0.04)",
								boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
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
							{/* Shimmer sweep on the progress bar */}
							{progressPct > 0 && progressPct < 100 && (
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

						{/* Star rating for completed shows */}
						{isComplete && rating && (
							<div className="flex items-center gap-0.5 mt-2.5">
								{[1, 2, 3, 4, 5].map((s) => (
									<Star
										key={s}
										className={`h-3.5 w-3.5 ${
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

			{/* Bottom strip line + sprocket row */}
			<div style={{ height: 1, background: "#1a1a2e" }} />
			<MiniSprocketRow />
		</Link>
	);
}
