import { Check, Clock } from "lucide-react";

interface EpisodeCardProps {
	tmdbId: number;
	seasonNumber: number;
	episodeNumber: number;
	name: string;
	runtime: number | null;
	isWatched: boolean;
	onMark: (episode: {
		seasonNumber: number;
		episodeNumber: number;
		runtime: number;
	}) => void;
	onUnmark: (episode: { seasonNumber: number; episodeNumber: number }) => void;
}

export function EpisodeCard({
	seasonNumber,
	episodeNumber,
	name,
	runtime,
	isWatched,
	onMark,
	onUnmark,
}: EpisodeCardProps) {
	function handleClick() {
		if (isWatched) {
			onUnmark({ seasonNumber, episodeNumber });
		} else {
			onMark({ seasonNumber, episodeNumber, runtime: runtime ?? 0 });
		}
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			className={`group/card relative flex w-[136px] shrink-0 flex-col overflow-hidden rounded-lg text-left transition-all duration-300 ${
				isWatched
					? "border border-neon-cyan/35 hover:border-neon-cyan/55 hover:scale-[1.03]"
					: "border border-cream/[0.07] hover:border-cream/20 hover:scale-[1.04]"
			}`}
			style={{
				height: 116,
				background: isWatched
					? "linear-gradient(160deg, rgba(0,229,255,0.14) 0%, rgba(0,229,255,0.04) 50%, rgba(0,229,255,0.09) 100%)"
					: "linear-gradient(160deg, rgba(12,12,32,0.95) 0%, rgba(10,10,28,0.9) 60%, rgba(15,15,40,0.85) 100%)",
				boxShadow: isWatched
					? "0 0 22px rgba(0,229,255,0.14), 0 0 6px rgba(0,229,255,0.08), inset 0 1px 0 rgba(0,229,255,0.1)"
					: "0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,240,0.04)",
			}}
		>
			{/* Film-frame perforations for watched cards */}
			{isWatched && (
				<>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute left-0 top-0 bottom-0 w-[6px] flex flex-col justify-evenly items-center py-2"
					>
						{[0, 1, 2, 3].map((i) => (
							<span
								key={i}
								className="block h-[3px] w-[3px] rounded-full bg-neon-cyan/20"
							/>
						))}
					</div>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute right-0 top-0 bottom-0 w-[6px] flex flex-col justify-evenly items-center py-2"
					>
						{[0, 1, 2, 3].map((i) => (
							<span
								key={i}
								className="block h-[3px] w-[3px] rounded-full bg-neon-cyan/20"
							/>
						))}
					</div>
				</>
			)}

			{/* Shimmer effect on hover for unwatched cards */}
			{!isWatched && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"
					style={{
						background:
							"linear-gradient(105deg, transparent 40%, rgba(0,229,255,0.04) 45%, rgba(0,229,255,0.08) 50%, rgba(0,229,255,0.04) 55%, transparent 60%)",
						backgroundSize: "200% 100%",
						animation: "shimmer-sweep 3s ease-in-out infinite",
					}}
				/>
			)}

			{/* Content area */}
			<div
				className={`relative z-10 flex flex-col justify-between h-full ${isWatched ? "px-3.5 py-3" : "px-3 py-2.5"}`}
			>
				{/* Top row: episode badge + check/runtime */}
				<div className="flex items-center justify-between gap-1">
					{/* Episode number badge */}
					<span
						className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-mono-retro font-bold tracking-widest ${
							isWatched
								? "bg-neon-cyan/18 text-neon-cyan"
								: "bg-cream/[0.06] text-cream/50 group-hover/card:bg-cream/[0.1] group-hover/card:text-cream/65"
						}`}
						style={
							isWatched
								? {
										textShadow: "0 0 8px rgba(0,229,255,0.5)",
										boxShadow:
											"0 0 8px rgba(0,229,255,0.12), inset 0 0 4px rgba(0,229,255,0.06)",
									}
								: undefined
						}
					>
						E{episodeNumber}
					</span>

					{/* Watched: glowing check circle */}
					{isWatched && (
						<div
							className="flex items-center justify-center h-5 w-5 rounded-full bg-neon-cyan/18"
							style={{
								boxShadow:
									"0 0 10px rgba(0,229,255,0.35), 0 0 3px rgba(0,229,255,0.2)",
							}}
						>
							<Check
								className="h-3 w-3 text-neon-cyan"
								strokeWidth={3}
								style={{
									filter: "drop-shadow(0 0 4px rgba(0,229,255,0.7))",
								}}
							/>
						</div>
					)}

					{/* Unwatched: runtime */}
					{!isWatched && runtime != null && runtime > 0 && (
						<span className="flex items-center gap-0.5 text-cream/25 group-hover/card:text-cream/40 transition-colors">
							<Clock className="h-2.5 w-2.5 shrink-0" />
							<span className="text-[9px] font-mono-retro">{runtime}m</span>
						</span>
					)}
				</div>

				{/* Episode name — more readable */}
				<p
					className={`mt-1.5 flex-1 text-[11px] leading-[1.4] line-clamp-3 transition-colors duration-200 ${
						isWatched
							? "text-cream/70 font-medium"
							: "text-cream/40 group-hover/card:text-cream/60"
					}`}
				>
					{name}
				</p>

				{/* Bottom: runtime badge or hover hint */}
				{isWatched && runtime != null && runtime > 0 ? (
					<span
						className="mt-auto pt-1 text-[9px] font-mono-retro text-neon-cyan/35 tracking-wide"
						style={{ textShadow: "0 0 6px rgba(0,229,255,0.1)" }}
					>
						{runtime}m
					</span>
				) : (
					<span
						className={`mt-auto pt-1 text-[9px] font-mono-retro tracking-wider uppercase opacity-0 transition-all duration-200 group-hover/card:opacity-100 ${
							isWatched ? "text-cream/30" : "text-neon-cyan/45"
						}`}
						style={
							!isWatched
								? { textShadow: "0 0 6px rgba(0,229,255,0.2)" }
								: undefined
						}
					>
						{isWatched ? "undo" : "watch"}
					</span>
				)}
			</div>

			{/* Bottom accent bar */}
			<div
				className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${
					isWatched ? "h-[4px]" : "h-0 group-hover/card:h-[3px]"
				}`}
				style={{
					background: isWatched
						? "linear-gradient(90deg, #00e5ff, #40c8e0, #00e5ff)"
						: "linear-gradient(90deg, rgba(0,229,255,0.3), rgba(0,229,255,0.5), rgba(0,229,255,0.3))",
					boxShadow: isWatched
						? "0 0 12px rgba(0,229,255,0.5), 0 -8px 20px rgba(0,229,255,0.1)"
						: "0 0 6px rgba(0,229,255,0.2)",
				}}
			/>

			{/* Upward glow bleed from accent bar for watched cards */}
			{isWatched && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute bottom-0 left-0 right-0 h-10"
					style={{
						background:
							"linear-gradient(to top, rgba(0,229,255,0.07), transparent)",
					}}
				/>
			)}
		</button>
	);
}
