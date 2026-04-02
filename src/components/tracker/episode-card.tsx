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
			className={`group/card relative flex w-[126px] shrink-0 flex-col justify-between overflow-hidden rounded-lg text-left transition-all duration-300 ${
				isWatched
					? "border border-neon-cyan/30 hover:border-neon-cyan/50 hover:scale-[1.03]"
					: "border border-cream/8 hover:border-cream/20 hover:scale-[1.04]"
			}`}
			style={{
				height: 106,
				background: isWatched
					? "linear-gradient(160deg, rgba(0,229,255,0.13) 0%, rgba(0,229,255,0.04) 60%, rgba(0,229,255,0.08) 100%)"
					: "linear-gradient(160deg, rgba(10,10,30,0.95) 0%, rgba(12,12,28,0.85) 100%)",
				boxShadow: isWatched
					? "0 0 18px rgba(0,229,255,0.12), 0 0 4px rgba(0,229,255,0.06), inset 0 1px 0 rgba(0,229,255,0.08)"
					: "0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,240,0.03)",
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
								className="block h-[3px] w-[3px] rounded-full bg-neon-cyan/15"
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
								className="block h-[3px] w-[3px] rounded-full bg-neon-cyan/15"
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

			{/* Content area with padding that accounts for film perforations */}
			<div
				className={`relative z-10 flex flex-col justify-between h-full ${isWatched ? "px-3 py-2.5" : "p-2.5"}`}
			>
				{/* Top row: episode badge + runtime */}
				<div className="flex items-center justify-between gap-1">
					{/* Episode number as a stamp/badge */}
					<span
						className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-mono-retro font-bold tracking-widest ${
							isWatched
								? "bg-neon-cyan/15 text-neon-cyan"
								: "bg-cream/5 text-cream/45 group-hover/card:bg-cream/8 group-hover/card:text-cream/60"
						}`}
						style={
							isWatched
								? {
										textShadow: "0 0 8px rgba(0,229,255,0.5)",
										boxShadow:
											"0 0 6px rgba(0,229,255,0.1), inset 0 0 4px rgba(0,229,255,0.05)",
									}
								: undefined
						}
					>
						E{episodeNumber}
					</span>
					{isWatched && (
						<div
							className="flex items-center justify-center h-4 w-4 rounded-full bg-neon-cyan/15"
							style={{
								boxShadow: "0 0 8px rgba(0,229,255,0.3)",
							}}
						>
							<Check
								className="h-2.5 w-2.5 text-neon-cyan"
								strokeWidth={3}
								style={{
									filter: "drop-shadow(0 0 3px rgba(0,229,255,0.6))",
								}}
							/>
						</div>
					)}
					{!isWatched && runtime != null && runtime > 0 && (
						<span className="flex items-center gap-0.5 text-cream/20 group-hover/card:text-cream/35 transition-colors">
							<Clock className="h-2.5 w-2.5 shrink-0" />
							<span className="text-[9px] font-mono-retro">{runtime}m</span>
						</span>
					)}
				</div>

				{/* Episode name */}
				<p
					className={`mt-1 flex-1 text-[10.5px] leading-[1.35] line-clamp-3 transition-colors duration-200 ${
						isWatched
							? "text-cream/65"
							: "text-cream/35 group-hover/card:text-cream/55"
					}`}
				>
					{name}
				</p>

				{/* Watched runtime badge or hover hint */}
				{isWatched && runtime != null && runtime > 0 ? (
					<span className="mt-auto pt-0.5 text-[9px] font-mono-retro text-neon-cyan/30 tracking-wide">
						{runtime}m
					</span>
				) : (
					<span
						className={`mt-auto pt-0.5 text-[9px] font-mono-retro tracking-wider uppercase opacity-0 transition-all duration-200 group-hover/card:opacity-100 ${
							isWatched ? "text-cream/25" : "text-neon-cyan/40"
						}`}
					>
						{isWatched ? "undo" : "watch"}
					</span>
				)}
			</div>

			{/* Bottom accent bar: gradient bleeds upward */}
			<div
				className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${
					isWatched ? "h-[4px]" : "h-0 group-hover/card:h-[2px]"
				}`}
				style={{
					background: isWatched
						? "linear-gradient(90deg, #00e5ff, #40c8e0, #00e5ff)"
						: "linear-gradient(90deg, rgba(0,229,255,0.3), rgba(0,229,255,0.5), rgba(0,229,255,0.3))",
					boxShadow: isWatched
						? "0 0 10px rgba(0,229,255,0.4), 0 -6px 16px rgba(0,229,255,0.08)"
						: "0 0 6px rgba(0,229,255,0.2)",
				}}
			/>

			{/* Upward glow bleed from accent bar for watched cards */}
			{isWatched && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute bottom-0 left-0 right-0 h-8"
					style={{
						background:
							"linear-gradient(to top, rgba(0,229,255,0.06), transparent)",
					}}
				/>
			)}
		</button>
	);
}
