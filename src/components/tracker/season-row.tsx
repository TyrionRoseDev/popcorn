import { CheckCheck, Sparkles } from "lucide-react";
import { EpisodeCard } from "#/components/tracker/episode-card";

interface SeasonRowProps {
	tmdbId: number;
	seasonNumber: number;
	seasonName: string;
	episodes: Array<{
		episodeNumber: number;
		name: string;
		runtime: number | null;
		airDate: string | null;
		seasonNumber: number;
	}>;
	watchedEpisodes: Set<string>; // "S1E1" format
	onMark: (
		episodes: Array<{
			seasonNumber: number;
			episodeNumber: number;
			runtime: number;
		}>,
	) => void;
	onUnmark: (episode: { seasonNumber: number; episodeNumber: number }) => void;
}

export function SeasonRow({
	tmdbId,
	seasonNumber,
	seasonName,
	episodes,
	watchedEpisodes,
	onMark,
	onUnmark,
}: SeasonRowProps) {
	const watchedCount = episodes.filter((ep) =>
		watchedEpisodes.has(`S${seasonNumber}E${ep.episodeNumber}`),
	).length;
	const totalCount = episodes.length;
	const allWatched = totalCount > 0 && watchedCount === totalCount;
	const progressPct =
		totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;

	function handleMarkSeason() {
		const unwatched = episodes.filter(
			(ep) => !watchedEpisodes.has(`S${seasonNumber}E${ep.episodeNumber}`),
		);
		if (unwatched.length === 0) return;
		onMark(
			unwatched.map((ep) => ({
				seasonNumber: ep.seasonNumber,
				episodeNumber: ep.episodeNumber,
				runtime: ep.runtime ?? 0,
			})),
		);
	}

	return (
		<section className="space-y-3">
			{/* Season header — neon marquee style */}
			<div className="flex items-center justify-between gap-3 px-1">
				<div className="flex items-center gap-3 min-w-0">
					{/* Neon season name */}
					<h3
						className="text-sm font-display tracking-wide text-cream/90 shrink-0"
						style={{
							textShadow: allWatched
								? "0 0 10px rgba(255,184,0,0.4), 0 0 25px rgba(255,184,0,0.15)"
								: "0 0 8px rgba(0,229,255,0.2), 0 0 20px rgba(0,229,255,0.08)",
						}}
					>
						{seasonName}
					</h3>
					{/* Progress fraction */}
					<span className="text-[10px] font-mono-retro text-cream/25 tracking-wider">
						{watchedCount}
						<span className="text-cream/12">/</span>
						{totalCount}
					</span>
				</div>
				{!allWatched && (
					<button
						type="button"
						onClick={handleMarkSeason}
						className="group/mark flex items-center gap-1.5 shrink-0 rounded-md px-3 py-1.5 text-[10px] font-mono-retro tracking-wider uppercase text-neon-cyan transition-all duration-250 hover:bg-neon-cyan/12 hover:scale-[1.03] active:scale-[0.97]"
						style={{
							border: "1px solid rgba(0,229,255,0.2)",
							textShadow: "0 0 8px rgba(0,229,255,0.3)",
							boxShadow:
								"0 0 8px rgba(0,229,255,0.06), inset 0 1px 0 rgba(0,229,255,0.04)",
						}}
					>
						<CheckCheck className="h-3.5 w-3.5 transition-transform duration-200 group-hover/mark:scale-110" />
						Mark season
					</button>
				)}
				{allWatched && (
					<span
						className="flex items-center gap-1.5 text-[10px] font-mono-retro tracking-wider text-neon-amber uppercase"
						style={{
							textShadow:
								"0 0 8px rgba(255,184,0,0.35), 0 0 20px rgba(255,184,0,0.12)",
							animation: "neon-flicker 4s ease-in-out infinite",
						}}
					>
						<Sparkles
							className="h-3 w-3"
							style={{
								filter: "drop-shadow(0 0 4px rgba(255,184,0,0.5))",
							}}
						/>
						Complete
					</span>
				)}
			</div>

			{/* Season progress bar — thicker with glow */}
			<div className="relative mx-1">
				<div
					className="h-[4px] w-full overflow-hidden rounded-full"
					style={{
						background: "rgba(255,255,240,0.04)",
						boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
					}}
				>
					<div
						className="h-full rounded-full transition-all duration-700 ease-out relative"
						style={{
							width: `${progressPct}%`,
							background: allWatched
								? "linear-gradient(90deg, #ffb800, #ffd060, #ffb800)"
								: "linear-gradient(90deg, #00e5ff, #40c8e0, #00e5ff)",
							boxShadow: allWatched
								? "0 0 10px rgba(255,184,0,0.5), 0 0 3px rgba(255,184,0,0.3)"
								: "0 0 10px rgba(0,229,255,0.4), 0 0 3px rgba(0,229,255,0.2)",
						}}
					>
						{/* Shimmer sweep on the progress bar when complete */}
						{allWatched && (
							<div
								className="absolute inset-0 overflow-hidden rounded-full"
								aria-hidden="true"
							>
								<div
									className="absolute inset-0"
									style={{
										background:
											"linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)",
										animation: "shimmer-sweep 4s ease-in-out infinite",
									}}
								/>
							</div>
						)}
					</div>
				</div>
				{/* Percentage label at end of bar */}
				{progressPct > 0 && progressPct < 100 && (
					<span className="absolute right-0 -top-4 text-[8px] font-mono-retro text-cream/20">
						{progressPct}%
					</span>
				)}
			</div>

			{/* Horizontally scrollable episode cards with fade edges */}
			<div className="relative">
				{/* Left fade hint */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute left-0 top-0 bottom-0 w-3 z-10"
					style={{
						background:
							"linear-gradient(to right, rgba(5,5,8,0.7), transparent)",
					}}
				/>
				{/* Right fade hint — signals more content */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10"
					style={{
						background:
							"linear-gradient(to left, rgba(5,5,8,0.9), rgba(5,5,8,0.4) 40%, transparent)",
					}}
				/>

				<div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
					<div className="flex gap-2.5 pb-2 pr-6">
						{episodes.map((ep) => (
							<EpisodeCard
								key={`S${seasonNumber}E${ep.episodeNumber}`}
								tmdbId={tmdbId}
								seasonNumber={seasonNumber}
								episodeNumber={ep.episodeNumber}
								name={ep.name}
								runtime={ep.runtime}
								isWatched={watchedEpisodes.has(
									`S${seasonNumber}E${ep.episodeNumber}`,
								)}
								onMark={(e) => onMark([e])}
								onUnmark={onUnmark}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
