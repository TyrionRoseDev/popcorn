import { CheckCheck } from "lucide-react";
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
			{/* Season header */}
			<div className="flex items-center justify-between gap-3 px-1">
				<div className="flex items-baseline gap-2 min-w-0">
					<h3 className="text-sm font-mono-retro tracking-wider text-cream/80 shrink-0">
						{seasonName}
					</h3>
					<span className="text-[11px] font-mono-retro text-cream/25 tracking-wide">
						{watchedCount}/{totalCount} episodes
					</span>
				</div>
				{!allWatched && (
					<button
						type="button"
						onClick={handleMarkSeason}
						className="flex items-center gap-1.5 shrink-0 rounded-md px-2.5 py-1 text-[10px] font-mono-retro tracking-wider uppercase text-neon-cyan transition-all duration-200 hover:bg-neon-cyan/10"
						style={{
							border: "1px solid rgba(0,229,255,0.15)",
							textShadow: "0 0 6px rgba(0,229,255,0.25)",
						}}
					>
						<CheckCheck className="h-3 w-3" />
						Mark season
					</button>
				)}
				{allWatched && (
					<span
						className="flex items-center gap-1 text-[10px] font-mono-retro tracking-wider text-neon-cyan/60 uppercase"
						style={{ textShadow: "0 0 6px rgba(0,229,255,0.2)" }}
					>
						<CheckCheck className="h-3 w-3" />
						Complete
					</span>
				)}
			</div>

			{/* Season progress bar */}
			<div className="mx-1 h-[2px] w-full overflow-hidden rounded-full bg-cream/5">
				<div
					className="h-full rounded-full transition-all duration-500"
					style={{
						width: `${totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0}%`,
						background: allWatched
							? "linear-gradient(90deg, #00e5ff, #40c8e0)"
							: "linear-gradient(90deg, #00e5ff, #40c8e0)",
						boxShadow: "0 0 6px rgba(0,229,255,0.3)",
					}}
				/>
			</div>

			{/* Horizontally scrollable episode cards */}
			<div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
				<div className="flex gap-2.5 pb-2">
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
		</section>
	);
}
