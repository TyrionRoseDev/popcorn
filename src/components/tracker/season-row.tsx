import { CheckCheck, Trophy } from "lucide-react";
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
		<section className="space-y-4">
			{/* ── Season Header — Marquee Style ── */}
			<div
				className="relative mx-1 rounded-lg overflow-hidden px-4 py-3"
				style={{
					background: allWatched
						? "linear-gradient(135deg, rgba(255,184,0,0.06) 0%, rgba(255,184,0,0.02) 100%)"
						: "linear-gradient(135deg, rgba(10,10,30,0.6) 0%, rgba(15,15,35,0.4) 100%)",
					border: allWatched
						? "1px solid rgba(255,184,0,0.2)"
						: "1px solid rgba(255,255,240,0.05)",
					boxShadow: allWatched
						? "0 0 20px rgba(255,184,0,0.06), inset 0 1px 0 rgba(255,184,0,0.05)"
						: "0 2px 8px rgba(0,0,0,0.2)",
				}}
			>
				{/* Subtle amber border glow for completed seasons */}
				{allWatched && (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 rounded-lg"
						style={{
							boxShadow: "inset 0 0 30px rgba(255,184,0,0.04)",
						}}
					/>
				)}

				<div className="relative z-10 flex items-center justify-between gap-3">
					<div className="flex items-center gap-3 min-w-0">
						{/* Season name — large font-display */}
						<h3
							className="text-[17px] font-display tracking-wide text-cream/90 shrink-0"
							style={{
								textShadow: allWatched
									? "0 0 12px rgba(255,184,0,0.4), 0 0 30px rgba(255,184,0,0.15)"
									: "0 0 10px rgba(0,229,255,0.15), 0 0 25px rgba(0,229,255,0.06)",
							}}
						>
							{seasonName}
						</h3>

						{/* Episode count badge */}
						<span
							className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono-retro tracking-wider"
							style={{
								background: allWatched
									? "rgba(255,184,0,0.1)"
									: "rgba(255,255,240,0.04)",
								color: allWatched
									? "rgba(255,184,0,0.7)"
									: "rgba(255,255,240,0.3)",
								border: allWatched
									? "1px solid rgba(255,184,0,0.15)"
									: "1px solid rgba(255,255,240,0.06)",
							}}
						>
							{watchedCount}
							<span style={{ opacity: 0.4 }}>/</span>
							{totalCount}
						</span>
					</div>

					{/* Mark season button or complete badge */}
					{!allWatched && (
						<button
							type="button"
							onClick={handleMarkSeason}
							className="group/mark flex items-center gap-2 shrink-0 rounded-full px-4 py-1.5 text-[10px] font-mono-retro tracking-wider uppercase text-neon-cyan transition-all duration-250 hover:bg-neon-cyan/12 hover:scale-[1.03] active:scale-[0.97]"
							style={{
								border: "1px solid rgba(0,229,255,0.2)",
								textShadow: "0 0 8px rgba(0,229,255,0.3)",
								boxShadow:
									"0 0 10px rgba(0,229,255,0.06), inset 0 1px 0 rgba(0,229,255,0.04)",
							}}
						>
							<CheckCheck className="h-3.5 w-3.5 transition-transform duration-200 group-hover/mark:scale-110" />
							Mark Season
						</button>
					)}
					{allWatched && (
						<span
							className="flex items-center gap-2 text-[11px] font-mono-retro tracking-wider text-neon-amber uppercase"
							style={{
								textShadow:
									"0 0 10px rgba(255,184,0,0.4), 0 0 25px rgba(255,184,0,0.15)",
								animation: "neon-flicker 4s ease-in-out infinite",
							}}
						>
							<Trophy
								className="h-3.5 w-3.5"
								style={{
									filter: "drop-shadow(0 0 5px rgba(255,184,0,0.6))",
								}}
							/>
							Complete
						</span>
					)}
				</div>

				{/* ── Season progress bar — 5px with glow ── */}
				<div className="relative mt-3">
					<div
						className="h-[5px] w-full overflow-hidden rounded-full"
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
									? "0 0 12px rgba(255,184,0,0.5), 0 0 4px rgba(255,184,0,0.3)"
									: "0 0 12px rgba(0,229,255,0.4), 0 0 4px rgba(0,229,255,0.2)",
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
					{/* Percentage label */}
					{progressPct > 0 && progressPct < 100 && (
						<span
							className="absolute right-0 -top-4 text-[9px] font-mono-retro tracking-wide"
							style={{ color: "rgba(0,229,255,0.35)" }}
						>
							{progressPct}%
						</span>
					)}
				</div>
			</div>

			{/* ── Horizontally scrollable episode cards with fade edges ── */}
			<div className="relative">
				{/* Left fade hint */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 z-10"
					style={{
						background:
							"linear-gradient(to right, rgba(5,5,8,0.8), transparent)",
					}}
				/>
				{/* Right fade hint */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10"
					style={{
						background:
							"linear-gradient(to left, rgba(5,5,8,0.95), rgba(5,5,8,0.5) 40%, transparent)",
					}}
				/>

				<div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
					<div className="flex gap-3 pb-2 pr-8">
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
