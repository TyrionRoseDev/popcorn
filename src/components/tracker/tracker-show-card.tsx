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
		statusColor = "text-neon-amber";
		statusGlow = "rgba(255,184,0,0.35)";
		accentRgb = "255,184,0";
	} else if (isCaughtUp) {
		statusLabel = "Caught Up";
		statusColor = "text-emerald-400";
		statusGlow = "rgba(52,211,153,0.35)";
		accentRgb = "52,211,153";
	} else {
		statusLabel = "In Progress";
		statusColor = "text-neon-cyan";
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
			className="group relative flex gap-3.5 rounded-xl border p-3 no-underline transition-all duration-300"
			style={{
				background:
					"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(12,12,28,0.85) 100%)",
				borderColor: "rgba(255,255,240,0.06)",
				boxShadow: `0 2px 20px rgba(0,0,0,0.3), 0 0 1px rgba(${accentRgb},0.1)`,
			}}
			onMouseEnter={(e) => {
				const el = e.currentTarget;
				el.style.borderColor = `rgba(${accentRgb},0.2)`;
				el.style.boxShadow = `0 4px 30px rgba(0,0,0,0.4), 0 0 30px rgba(${accentRgb},0.06), 0 0 1px rgba(${accentRgb},0.15)`;
				el.style.transform = "translateY(-1px)";
			}}
			onMouseLeave={(e) => {
				const el = e.currentTarget;
				el.style.borderColor = "rgba(255,255,240,0.06)";
				el.style.boxShadow = `0 2px 20px rgba(0,0,0,0.3), 0 0 1px rgba(${accentRgb},0.1)`;
				el.style.transform = "translateY(0)";
			}}
		>
			{/* Ambient glow on hover */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
				style={{
					background: `radial-gradient(ellipse at 20% 30%, rgba(${accentRgb},0.06), transparent 60%)`,
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
					className="absolute top-2.5 right-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-all duration-200 group-hover:opacity-100"
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
				className="relative h-[120px] w-[80px] shrink-0 overflow-hidden rounded-lg"
				style={{
					boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 20px rgba(${accentRgb},0.08)`,
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
						className="flex h-full w-full items-center justify-center text-cream/15 text-[10px] font-mono-retro tracking-wider"
						style={{
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
					<h3 className="truncate font-display text-[15px] leading-snug text-cream/90 transition-colors duration-300 group-hover:text-cream">
						{title}
					</h3>

					{/* Status + runtime row */}
					<div className="mt-2 flex items-center gap-2 flex-wrap">
						<span
							className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono-retro tracking-wider uppercase ${statusColor}`}
							style={{
								background: statusGlow.replace("0.35", "0.1"),
								textShadow: `0 0 8px ${statusGlow}`,
							}}
						>
							<span
								className="inline-block h-1 w-1 rounded-full"
								style={{
									backgroundColor: "currentColor",
									boxShadow: "0 0 4px currentColor",
								}}
							/>
							{statusLabel}
						</span>

						{totalRuntime > 0 && (
							<span className="inline-flex items-center gap-1 text-[10px] font-mono-retro text-cream/25 tracking-wide">
								<Clock className="h-2.5 w-2.5" />
								{formatRuntime(totalRuntime)}
							</span>
						)}
					</div>

					{isCaughtUp && (
						<p
							className="mt-1.5 text-[10px] text-cream/30 font-mono-retro tracking-wide"
							style={{
								animation: "pulse-text 3s ease-in-out infinite",
							}}
						>
							New episodes coming soon
						</p>
					)}
				</div>

				{/* Progress bar + episode count */}
				<div className="mt-auto pt-1">
					<div className="flex items-center justify-between mb-1.5">
						<span className="text-[11px] font-mono-retro text-cream/40 tracking-wide">
							{episodeCount}
							<span className="text-cream/20">
								/{totalEpisodes > 0 ? totalEpisodes : "?"}
							</span>{" "}
							<span className="text-cream/20">ep</span>
						</span>
						{totalEpisodes > 0 && (
							<span
								className="text-[10px] font-mono-retro tracking-wider"
								style={{
									color: `rgba(${accentRgb},0.5)`,
								}}
							>
								{progressPct}%
							</span>
						)}
					</div>

					{/* Progress bar track */}
					<div
						className="relative h-1.5 w-full overflow-hidden rounded-full"
						style={{
							background: "rgba(255,255,240,0.04)",
							boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
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
						<div className="flex items-center gap-0.5 mt-2">
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
