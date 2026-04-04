import { Check, CheckCheck, ChevronDown, Circle, Trophy } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface SeasonSectionProps {
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
	watchedEpisodes: Set<string>;
	onMark: (
		episodes: Array<{
			seasonNumber: number;
			episodeNumber: number;
			runtime: number;
		}>,
	) => void;
	onUnmark: (episode: { seasonNumber: number; episodeNumber: number }) => void;
	readOnly?: boolean;
}

export function SeasonSection({
	seasonNumber,
	seasonName,
	episodes,
	watchedEpisodes,
	onMark,
	onUnmark,
	readOnly,
}: SeasonSectionProps) {
	const [collapsed, setCollapsed] = useState(false);
	const [justMarked, setJustMarked] = useState<Set<string>>(new Set());
	const justMarkedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);

	const markWithAnimation = useCallback((keys: string[]) => {
		setJustMarked((prev) => {
			const next = new Set(prev);
			for (const k of keys) next.add(k);
			return next;
		});
		for (const key of keys) {
			// Clear any existing timer for this key
			const existing = justMarkedTimers.current.get(key);
			if (existing) clearTimeout(existing);
			const timer = setTimeout(() => {
				setJustMarked((prev) => {
					const next = new Set(prev);
					next.delete(key);
					return next;
				});
				justMarkedTimers.current.delete(key);
			}, 500);
			justMarkedTimers.current.set(key, timer);
		}
	}, []);

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
		markWithAnimation(
			unwatched.map((ep) => `S${seasonNumber}E${ep.episodeNumber}`),
		);
		onMark(
			unwatched.map((ep) => ({
				seasonNumber: ep.seasonNumber,
				episodeNumber: ep.episodeNumber,
				runtime: ep.runtime ?? 0,
			})),
		);
	}

	function handleEpisodeClick(ep: (typeof episodes)[number]) {
		if (readOnly) return;
		const key = `S${seasonNumber}E${ep.episodeNumber}`;
		if (watchedEpisodes.has(key)) {
			onUnmark({ seasonNumber, episodeNumber: ep.episodeNumber });
		} else {
			markWithAnimation([key]);
			onMark([
				{
					seasonNumber: ep.seasonNumber,
					episodeNumber: ep.episodeNumber,
					runtime: ep.runtime ?? 0,
				},
			]);
		}
	}

	return (
		<section>
			{/* Season header */}
			<div
				className="flex w-full items-center justify-between gap-3 pb-3"
				style={{ borderBottom: "1px solid rgba(255,184,0,0.12)" }}
			>
				<button
					type="button"
					onClick={() => setCollapsed((c) => !c)}
					className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
				>
					<h3 className="text-base font-display tracking-wide text-cream/90">
						{seasonName}
					</h3>
					<span className="font-mono-retro text-[10px] tracking-wider text-cream/30">
						{watchedCount}/{totalCount}
					</span>
					{allWatched && <Trophy className="h-3.5 w-3.5 text-neon-amber/60" />}
				</button>
				<div className="flex items-center gap-2">
					{!allWatched && !readOnly && (
						<button
							type="button"
							onClick={handleMarkSeason}
							className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-mono-retro tracking-wider uppercase text-neon-amber/70 hover:text-neon-amber hover:bg-neon-amber/8 transition-colors"
							style={{ border: "1px solid rgba(255,184,0,0.15)" }}
						>
							<CheckCheck className="h-3 w-3" />
							Mark All
						</button>
					)}
					<button
						type="button"
						onClick={() => setCollapsed((c) => !c)}
						className="cursor-pointer"
						aria-label={collapsed ? "Expand season" : "Collapse season"}
					>
						<ChevronDown
							className={`h-4 w-4 text-cream/25 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
						/>
					</button>
				</div>
			</div>

			{/* Episode list */}
			{!collapsed && (
				<div className="mt-1">
					{episodes.map((ep) => {
						const key = `S${seasonNumber}E${ep.episodeNumber}`;
						const isWatched = watchedEpisodes.has(key);
						const isJustMarked = justMarked.has(key);

						return (
							<button
								key={key}
								type="button"
								onClick={() => handleEpisodeClick(ep)}
								className={`flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors duration-150 hover:bg-cream/[0.03] rounded${isJustMarked ? " episode-row-flash" : ""}`}
								style={{
									borderBottom: "1px solid rgba(255,255,240,0.03)",
									background: isWatched
										? "rgba(0,229,255,0.03)"
										: "transparent",
								}}
							>
								{/* Watch indicator */}
								{isWatched ? (
									<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon-cyan/15">
										<Check
											className={`h-3 w-3 text-neon-cyan${isJustMarked ? " episode-check-bounce" : ""}`}
											strokeWidth={3}
										/>
									</div>
								) : (
									<Circle className="h-5 w-5 shrink-0 text-cream/15" />
								)}

								{/* Episode number */}
								<span
									className={`shrink-0 font-mono-retro text-[11px] tracking-wider ${
										isWatched ? "text-neon-cyan/70" : "text-cream/35"
									}`}
									style={{ width: "28px" }}
								>
									E{ep.episodeNumber}
								</span>

								{/* Dot separator */}
								<span className="text-cream/15 shrink-0">·</span>

								{/* Episode name */}
								<span
									className={`flex-1 truncate text-sm ${
										isWatched ? "text-cream/70" : "text-cream/45"
									}`}
								>
									{ep.name}
								</span>

								{/* Runtime */}
								{ep.runtime != null && ep.runtime > 0 && (
									<span className="shrink-0 font-mono-retro text-[10px] text-cream/20">
										{ep.runtime}m
									</span>
								)}
							</button>
						);
					})}
				</div>
			)}
		</section>
	);
}
