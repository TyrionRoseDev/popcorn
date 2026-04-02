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
			className={`group/card relative flex w-[130px] shrink-0 flex-col justify-between overflow-hidden rounded-lg p-3 text-left transition-all duration-200 ${
				isWatched
					? "border border-neon-cyan/25 hover:border-neon-cyan/40"
					: "border border-cream/8 hover:border-cream/18"
			}`}
			style={{
				height: 120,
				background: isWatched
					? "linear-gradient(160deg, rgba(0,229,255,0.10) 0%, rgba(0,229,255,0.03) 100%)"
					: "linear-gradient(160deg, rgba(10,10,30,0.95) 0%, rgba(12,12,28,0.85) 100%)",
				boxShadow: isWatched
					? "0 0 14px rgba(0,229,255,0.08), inset 0 1px 0 rgba(0,229,255,0.06)"
					: "0 0 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,240,0.02)",
			}}
		>
			{/* Top row: episode number + runtime */}
			<div className="flex items-center justify-between gap-1">
				<span
					className={`text-[11px] font-mono-retro tracking-wider ${
						isWatched ? "text-neon-cyan" : "text-cream/50"
					}`}
					style={
						isWatched
							? { textShadow: "0 0 8px rgba(0,229,255,0.4)" }
							: undefined
					}
				>
					E{episodeNumber}
					{runtime ? (
						<span className="text-cream/25"> · {runtime}m</span>
					) : null}
				</span>
				{isWatched && (
					<Check
						className="h-3 w-3 text-neon-cyan shrink-0"
						style={{
							filter: "drop-shadow(0 0 4px rgba(0,229,255,0.5))",
						}}
					/>
				)}
				{!isWatched && runtime && (
					<Clock className="h-2.5 w-2.5 text-cream/15 shrink-0" />
				)}
			</div>

			{/* Episode name */}
			<p
				className={`mt-1.5 flex-1 text-[11px] leading-[1.4] line-clamp-3 ${
					isWatched ? "text-cream/70" : "text-cream/40"
				}`}
			>
				{name}
			</p>

			{/* Hover hint */}
			<span
				className={`mt-auto pt-1 text-[9px] font-mono-retro tracking-wider uppercase opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 ${
					isWatched ? "text-cream/30" : "text-neon-cyan/50"
				}`}
			>
				{isWatched ? "unmark" : "mark"}
			</span>

			{/* Bottom accent bar when watched */}
			{isWatched && (
				<div
					className="absolute bottom-0 left-0 right-0 h-[3px]"
					style={{
						background: "linear-gradient(90deg, #00e5ff, #40c8e0, #00e5ff)",
						boxShadow: "0 0 8px rgba(0,229,255,0.35)",
					}}
				/>
			)}
		</button>
	);
}
