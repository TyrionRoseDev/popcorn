import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	BookOpen,
	CheckCheck,
	Loader2,
	Pen,
	Play,
	Star,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FilmStrip } from "#/components/film-strip";
import { SeasonRow } from "#/components/tracker/season-row";
import { WriteAboutModal } from "#/components/tracker/write-about-modal";
import { ReviewModal } from "#/components/watched/review-modal";
import { useTRPC } from "#/integrations/trpc/react";

export const Route = createFileRoute("/app/tracker/$tmdbId")({
	component: ShowTracker,
});

function ShowTracker() {
	const { tmdbId: tmdbIdRaw } = Route.useParams();
	const tmdbId = Number(tmdbIdRaw);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [reviewOpen, setReviewOpen] = useState(false);
	const [writeAboutOpen, setWriteAboutOpen] = useState(false);

	// Fetch show details
	const { data: titleData, isLoading: isLoadingTitle } = useQuery(
		trpc.title.details.queryOptions({ tmdbId, mediaType: "tv" }),
	);

	// Fetch watched episodes
	const { data: watchedRows, isLoading: isLoadingWatched } = useQuery(
		trpc.episodeTracker.getForShow.queryOptions({ tmdbId }),
	);

	// Fetch all season episodes from TMDB
	const { data: allEpisodes, isLoading: isLoadingEpisodes } = useQuery({
		...trpc.episodeTracker.getAllSeasonEpisodes.queryOptions({
			tmdbId,
			seasonList: titleData?.seasonList ?? [],
		}),
		enabled: !!titleData?.seasonList,
	});

	// Check if a full-show review already exists (scope: "show")
	const { data: existingWatchEvents } = useQuery(
		trpc.watchEvent.getForTitle.queryOptions({ tmdbId, mediaType: "tv" }),
	);
	const hasShowReview = (existingWatchEvents ?? []).some(
		(e) => e.scope === "show",
	);

	// Fetch journal entries for this show
	const { data: journalEntries } = useQuery(
		trpc.journalEntry.getForShow.queryOptions({ tmdbId }),
	);

	// Build watched set for quick lookup
	const watchedSet = useMemo(() => {
		const set = new Set<string>();
		for (const row of watchedRows ?? []) {
			set.add(`S${row.seasonNumber}E${row.episodeNumber}`);
		}
		return set;
	}, [watchedRows]);

	// Group episodes by season
	const seasonGroups = useMemo(() => {
		if (!allEpisodes || !titleData?.seasonList) return [];
		const map = new Map<
			number,
			{
				seasonNumber: number;
				seasonName: string;
				episodes: typeof allEpisodes;
			}
		>();
		for (const ep of allEpisodes) {
			if (!map.has(ep.seasonNumber)) {
				const info = titleData.seasonList.find(
					(s) => s.seasonNumber === ep.seasonNumber,
				);
				map.set(ep.seasonNumber, {
					seasonNumber: ep.seasonNumber,
					seasonName: info?.name ?? `Season ${ep.seasonNumber}`,
					episodes: [],
				});
			}
			map.get(ep.seasonNumber)?.episodes.push(ep);
		}
		// Sort by season number
		return Array.from(map.values()).sort(
			(a, b) => a.seasonNumber - b.seasonNumber,
		);
	}, [allEpisodes, titleData?.seasonList]);

	// Whether the show has ended/been canceled (needed in mutation callbacks)
	const isEnded =
		titleData?.status === "Ended" || titleData?.status === "Canceled";

	// Mutations
	const markEpisodes = useMutation(
		trpc.episodeTracker.markEpisodes.mutationOptions({
			onSuccess: async (_data, variables) => {
				await queryClient.invalidateQueries(
					trpc.episodeTracker.getForShow.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.episodeTracker.getTrackedShows.queryFilter(),
				);
				const count = variables.episodes.length;
				toast.success(
					`Marked ${count} episode${count > 1 ? "s" : ""} as watched`,
				);

				// Check for show completion by combining existing watched set
				// with the just-marked episodes (avoids stale cache issues)
				const newWatchedSet = new Set(watchedSet);
				for (const ep of variables.episodes) {
					newWatchedSet.add(`S${ep.seasonNumber}E${ep.episodeNumber}`);
				}
				const isNowComplete =
					isEnded &&
					allEpisodes != null &&
					allEpisodes.length > 0 &&
					allEpisodes.every((ep) =>
						newWatchedSet.has(`S${ep.seasonNumber}E${ep.episodeNumber}`),
					);
				if (isNowComplete && !hasShowReview) {
					setReviewOpen(true);
				}
			},
			onError: () => {
				toast.error("Failed to mark episodes");
			},
		}),
	);

	const unmarkEpisode = useMutation(
		trpc.episodeTracker.unmarkEpisode.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries(
					trpc.episodeTracker.getForShow.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.episodeTracker.getTrackedShows.queryFilter(),
				);
				toast.success(
					`Unmarked episode${data.runtime ? ` (-${data.runtime}m)` : ""}`,
				);
			},
			onError: () => {
				toast.error("Failed to unmark episode");
			},
		}),
	);

	function handleMark(
		episodes: Array<{
			seasonNumber: number;
			episodeNumber: number;
			runtime: number;
		}>,
	) {
		markEpisodes.mutate({ tmdbId, episodes });
	}

	function handleUnmark(episode: {
		seasonNumber: number;
		episodeNumber: number;
	}) {
		const row = watchedRows?.find(
			(r) =>
				r.seasonNumber === episode.seasonNumber &&
				r.episodeNumber === episode.episodeNumber,
		);
		const runtime = row?.runtime ?? 0;

		toast(`Unmark S${episode.seasonNumber}E${episode.episodeNumber}?`, {
			description: runtime
				? `Removes ${runtime}m from watch time`
				: "Remove this episode",
			action: {
				label: "Unmark",
				onClick: () => {
					unmarkEpisode.mutate({
						tmdbId,
						seasonNumber: episode.seasonNumber,
						episodeNumber: episode.episodeNumber,
					});
				},
			},
			duration: 5000,
		});
	}

	function handleMarkAll() {
		if (!allEpisodes) return;
		const unwatched = allEpisodes.filter(
			(ep) => !watchedSet.has(`S${ep.seasonNumber}E${ep.episodeNumber}`),
		);
		if (unwatched.length === 0) {
			toast.info("All episodes already marked!");
			return;
		}
		markEpisodes.mutate({
			tmdbId,
			episodes: unwatched.map((ep) => ({
				seasonNumber: ep.seasonNumber,
				episodeNumber: ep.episodeNumber,
				runtime: ep.runtime ?? 0,
			})),
		});
	}

	// Progress stats
	const totalEpisodes = allEpisodes?.length ?? 0;
	const watchedCount = watchedSet.size;
	const progressPct =
		totalEpisodes > 0
			? Math.min(100, Math.round((watchedCount / totalEpisodes) * 100))
			: 0;

	// Status
	const isComplete =
		isEnded && totalEpisodes > 0 && watchedCount >= totalEpisodes;
	const isCaughtUp =
		!isEnded && totalEpisodes > 0 && watchedCount >= totalEpisodes;

	let statusLabel: string;
	let statusColor: string;
	let statusGlow: string;
	if (isComplete) {
		statusLabel = "Completed";
		statusColor = "text-neon-amber";
		statusGlow = "rgba(255,184,0,0.35)";
	} else if (isCaughtUp) {
		statusLabel = "Caught Up";
		statusColor = "text-emerald-400";
		statusGlow = "rgba(52,211,153,0.35)";
	} else {
		statusLabel = "In Progress";
		statusColor = "text-neon-cyan";
		statusGlow = "rgba(0,229,255,0.35)";
	}

	// Find next unwatched episode for ongoing shows
	const nextEpisode = useMemo(() => {
		if (!allEpisodes || totalEpisodes === 0 || watchedCount >= totalEpisodes)
			return null;
		for (const ep of allEpisodes) {
			if (!watchedSet.has(`S${ep.seasonNumber}E${ep.episodeNumber}`)) {
				return ep;
			}
		}
		return null;
	}, [allEpisodes, watchedSet, totalEpisodes, watchedCount]);

	const isLoading = isLoadingTitle || isLoadingWatched || isLoadingEpisodes;

	return (
		<div className="relative mx-auto max-w-3xl px-4 pb-6">
			{/* ── Cinematic Backdrop Hero ── */}
			{titleData?.backdropPath && (
				<div
					className="absolute inset-x-0 top-0 h-[340px] z-0 overflow-hidden"
					aria-hidden="true"
				>
					<img
						src={`https://image.tmdb.org/t/p/w1280${titleData.backdropPath}`}
						alt=""
						className="h-full w-full object-cover object-top"
						loading="eager"
					/>
					{/* Dark vignette overlay */}
					<div
						className="absolute inset-0"
						style={{
							background: `
								linear-gradient(to bottom, rgba(5,5,8,0.2) 0%, rgba(5,5,8,0.55) 40%, rgba(5,5,8,0.92) 70%, #050508 100%),
								linear-gradient(to right, rgba(5,5,8,0.5) 0%, transparent 30%, transparent 70%, rgba(5,5,8,0.5) 100%)
							`,
						}}
					/>
					{/* VHS scan lines over backdrop */}
					<div
						className="absolute inset-0 opacity-[0.04]"
						style={{
							backgroundImage:
								"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,240,0.4) 2px, rgba(255,255,240,0.4) 4px)",
						}}
					/>
					{/* Status-tinted ambient glow */}
					<div
						className="absolute inset-0"
						style={{
							background: `radial-gradient(ellipse 600px 300px at 50% 80%, ${statusGlow.replace("0.35", "0.12")}, transparent 70%)`,
						}}
					/>
				</div>
			)}

			{/* Atmospheric background gradient (fallback if no backdrop) */}
			{!titleData?.backdropPath && (
				<div
					aria-hidden="true"
					className="pointer-events-none fixed inset-0 z-0"
					style={{
						background: `
							radial-gradient(ellipse 800px 500px at 30% 10%, ${statusGlow.replace("0.35", "0.04")}, transparent 70%),
							radial-gradient(ellipse 600px 400px at 80% 60%, rgba(255,45,120,0.015), transparent 60%)
						`,
					}}
				/>
			)}

			{/* Back link */}
			<Link
				to="/app/tracker"
				className="relative z-10 mb-5 inline-flex items-center gap-1.5 pt-6 text-xs font-mono-retro tracking-wider text-cream/30 no-underline transition-colors hover:text-cream/60"
			>
				<ArrowLeft className="h-3.5 w-3.5" />
				Tracker
			</Link>

			{isLoading ? (
				<div className="flex justify-center py-20">
					<Loader2 className="h-5 w-5 animate-spin text-cream/30" />
				</div>
			) : !titleData ? (
				<div className="py-20 text-center text-sm text-cream/30">
					Show not found
				</div>
			) : (
				<div className="relative z-10">
					{/* ── Show Header: Cinematic Hero Card ── */}
					<div
						className="relative mb-6 overflow-hidden rounded-xl border border-cream/8"
						style={{
							background:
								"linear-gradient(160deg, rgba(10,10,30,0.92) 0%, rgba(8,8,24,0.88) 40%, rgba(15,15,35,0.85) 100%)",
							boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 60px ${statusGlow.replace("0.35", "0.06")}`,
						}}
					>
						{/* Ambient status glow */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 rounded-xl"
							style={{
								background: `
									radial-gradient(ellipse at 15% 60%, ${statusGlow.replace("0.35", "0.1")}, transparent 55%),
									radial-gradient(ellipse at 85% 30%, rgba(255,45,120,0.025), transparent 50%)
								`,
							}}
						/>

						{/* VHS scan line overlay */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden opacity-[0.03]"
							style={{
								backgroundImage:
									"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,240,0.5) 2px, rgba(255,255,240,0.5) 4px)",
							}}
						/>

						<div className="relative z-10 flex gap-6 p-6">
							{/* Poster — larger, with film-frame border */}
							<div className="relative shrink-0">
								<div
									className="relative h-[180px] w-[120px] overflow-hidden rounded-lg bg-cream/5"
									style={{
										boxShadow: `0 6px 30px rgba(0,0,0,0.6), 0 0 30px ${statusGlow.replace("0.35", "0.1")}`,
									}}
								>
									{titleData.posterPath ? (
										<img
											src={`https://image.tmdb.org/t/p/w185${titleData.posterPath}`}
											alt=""
											className="h-full w-full object-cover"
											loading="lazy"
										/>
									) : (
										<div className="flex h-full w-full items-center justify-center text-cream/15 text-xs font-mono-retro">
											NO
											<br />
											IMG
										</div>
									)}
									{/* Inner film-frame glow */}
									<div
										aria-hidden="true"
										className="absolute inset-0 rounded-lg"
										style={{
											boxShadow:
												"inset 0 0 0 1px rgba(255,255,240,0.08), inset 0 0 20px rgba(0,0,0,0.3)",
										}}
									/>
								</div>
								{/* Film sprocket dots along poster sides */}
								<div
									aria-hidden="true"
									className="absolute -left-1.5 top-2 bottom-2 flex flex-col justify-evenly"
								>
									{Array.from({ length: 6 }).map((_, i) => (
										<span
											key={`l-${i.toString()}`}
											className="block h-1.5 w-1.5 rounded-full bg-cream/[0.07]"
										/>
									))}
								</div>
								<div
									aria-hidden="true"
									className="absolute -right-1.5 top-2 bottom-2 flex flex-col justify-evenly"
								>
									{Array.from({ length: 6 }).map((_, i) => (
										<span
											key={`r-${i.toString()}`}
											className="block h-1.5 w-1.5 rounded-full bg-cream/[0.07]"
										/>
									))}
								</div>
							</div>

							{/* Info column */}
							<div className="flex min-w-0 flex-1 flex-col justify-between">
								<div>
									{/* NOW SHOWING label */}
									<p
										className="font-mono-retro text-[9px] tracking-[3px] uppercase mb-1.5"
										style={{
											color: "#FFB800",
											opacity: 0.5,
											textShadow: "0 0 8px rgba(255,184,0,0.3)",
										}}
									>
										Now Showing
									</p>

									{/* Title */}
									<h1
										className="font-display text-2xl text-cream tracking-wide leading-tight pr-2"
										style={{
											textShadow:
												"0 0 30px rgba(255,255,240,0.15), 0 0 60px rgba(255,255,240,0.05)",
										}}
									>
										{titleData.title}
									</h1>

									{/* Status badge + next episode */}
									<div className="mt-3 flex items-center gap-3 flex-wrap">
										<span
											className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-mono-retro tracking-wider uppercase ${statusColor}`}
											style={{
												background: statusGlow.replace("0.35", "0.14"),
												textShadow: `0 0 12px ${statusGlow}`,
												boxShadow: `0 0 16px ${statusGlow.replace("0.35", "0.1")}, inset 0 0 8px ${statusGlow.replace("0.35", "0.05")}`,
											}}
										>
											<span
												className="inline-block h-1.5 w-1.5 rounded-full"
												style={{
													backgroundColor: "currentColor",
													boxShadow: "0 0 6px currentColor",
												}}
											/>
											{statusLabel}
										</span>

										{nextEpisode && (
											<span className="inline-flex items-center gap-1 text-[10px] font-mono-retro text-cream/30 tracking-wide">
												<Play
													className="h-2.5 w-2.5"
													style={{
														fill: "currentColor",
													}}
												/>
												Next: S{nextEpisode.seasonNumber}E
												{nextEpisode.episodeNumber}
											</span>
										)}
									</div>
								</div>

								{/* ── Hero Progress Bar ── */}
								<div className="mt-auto pt-4">
									<div className="flex items-baseline justify-between mb-2.5">
										<span className="text-xs font-mono-retro text-cream/50 tracking-wide">
											<span
												className="text-base font-display"
												style={{
													color: statusGlow.replace("0.35", "0.85"),
													textShadow: `0 0 10px ${statusGlow.replace("0.35", "0.4")}`,
												}}
											>
												{watchedCount}
											</span>
											<span className="text-cream/20 mx-1">/</span>
											<span className="text-cream/35">{totalEpisodes}</span>
											<span className="text-cream/20 ml-1.5 text-[10px]">
												episodes
											</span>
										</span>
										{totalEpisodes > 0 && (
											<span
												className="text-sm font-display tracking-wide"
												style={{
													color: statusGlow.replace("0.35", "0.8"),
													textShadow: `0 0 10px ${statusGlow.replace("0.35", "0.3")}`,
												}}
											>
												{progressPct}%
											</span>
										)}
									</div>
									{/* Chunky 10px progress bar with glow */}
									<div
										className="h-2.5 w-full overflow-hidden rounded-full"
										style={{
											background: "rgba(255,255,240,0.04)",
											boxShadow:
												"inset 0 2px 4px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,240,0.05)",
										}}
									>
										<div
											className="relative h-full rounded-full transition-all duration-700 ease-out"
											style={{
												width: `${progressPct}%`,
												background: isComplete
													? "linear-gradient(90deg, #ffb800, #ffd060, #ffb800)"
													: isCaughtUp
														? "linear-gradient(90deg, #34d399, #6ee7b7, #34d399)"
														: "linear-gradient(90deg, #00e5ff, #40c8e0, #00e5ff)",
												boxShadow: isComplete
													? "0 0 16px rgba(255,184,0,0.6), 0 0 4px rgba(255,184,0,0.3)"
													: isCaughtUp
														? "0 0 16px rgba(52,211,153,0.6), 0 0 4px rgba(52,211,153,0.3)"
														: "0 0 16px rgba(0,229,255,0.6), 0 0 4px rgba(0,229,255,0.3)",
											}}
										>
											{/* Shimmer on full bar */}
											{(isComplete || isCaughtUp) && (
												<div
													className="absolute inset-0 overflow-hidden rounded-full"
													aria-hidden="true"
												>
													<div
														className="absolute inset-0"
														style={{
															background:
																"linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)",
															animation:
																"shimmer-sweep 4s ease-in-out infinite",
														}}
													/>
												</div>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* ── Action Buttons — pill buttons with neon glow ── */}
						<div className="relative z-20 flex items-center justify-end gap-3 px-6 pb-5 -mt-1">
							<button
								type="button"
								onClick={() => setWriteAboutOpen(true)}
								className="group/btn flex items-center gap-2 rounded-full px-5 py-2 text-[11px] font-mono-retro tracking-wider uppercase text-neon-cyan transition-all duration-200 hover:bg-neon-cyan/12 hover:scale-[1.04] active:scale-[0.97]"
								style={{
									border: "1px solid rgba(0,229,255,0.25)",
									textShadow: "0 0 10px rgba(0,229,255,0.35)",
									boxShadow:
										"0 0 14px rgba(0,229,255,0.08), inset 0 1px 0 rgba(0,229,255,0.06)",
								}}
							>
								<Pen className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:rotate-[-8deg]" />
								Write
							</button>
							{totalEpisodes > 0 && watchedCount < totalEpisodes && (
								<button
									type="button"
									onClick={handleMarkAll}
									disabled={markEpisodes.isPending}
									className="group/btn flex items-center gap-2 rounded-full px-5 py-2 text-[11px] font-mono-retro tracking-wider uppercase text-neon-amber transition-all duration-200 hover:bg-neon-amber/12 hover:scale-[1.04] active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
									style={{
										border: "1px solid rgba(255,184,0,0.25)",
										textShadow: "0 0 10px rgba(255,184,0,0.35)",
										boxShadow:
											"0 0 14px rgba(255,184,0,0.08), inset 0 1px 0 rgba(255,184,0,0.06)",
									}}
								>
									<CheckCheck className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
									Mark All
								</button>
							)}
						</div>
					</div>

					{/* ── Film Strip Divider ── */}
					<div className="mb-10">
						<FilmStrip />
					</div>

					{/* Season rows */}
					<div className="space-y-12">
						{seasonGroups.map((group) => (
							<SeasonRow
								key={group.seasonNumber}
								tmdbId={tmdbId}
								seasonNumber={group.seasonNumber}
								seasonName={group.seasonName}
								episodes={group.episodes}
								watchedEpisodes={watchedSet}
								onMark={handleMark}
								onUnmark={handleUnmark}
							/>
						))}
					</div>

					{/* Empty state when no episodes fetched */}
					{seasonGroups.length === 0 && !isLoading && (
						<div className="py-16 text-center text-sm text-cream/25 font-mono-retro">
							No episode data available
						</div>
					)}

					{/* Notes & Reviews Section */}
					<NotesAndReviewsSection
						journalEntries={journalEntries ?? []}
						watchEvents={(existingWatchEvents ?? []).filter(
							(e) => e.rating != null || e.note,
						)}
					/>
				</div>
			)}

			{/* Completion review prompt */}
			{titleData && (
				<ReviewModal
					open={reviewOpen}
					onOpenChange={setReviewOpen}
					titleName={titleData.title}
					year={titleData.year || undefined}
					tmdbId={tmdbId}
					mediaType="tv"
					onEventCreated={() => setReviewOpen(false)}
				/>
			)}

			{/* Write About This modal */}
			{titleData && (
				<WriteAboutModal
					open={writeAboutOpen}
					onOpenChange={setWriteAboutOpen}
					tmdbId={tmdbId}
					titleName={titleData.title}
					year={titleData.year || ""}
					mediaType="tv"
					seasonList={(titleData.seasonList ?? []).map((s) => ({
						seasonNumber: s.seasonNumber,
						episodeCount: s.episodeCount,
						name: s.name,
					}))}
					watchedEpisodes={(watchedRows ?? []).map((r) => ({
						seasonNumber: r.seasonNumber,
						episodeNumber: r.episodeNumber,
					}))}
				/>
			)}
		</div>
	);
}

/* ─── Notes & Reviews Section ─── */

interface NotesAndReviewsSectionProps {
	journalEntries: Array<{
		id: string;
		scope: string;
		seasonNumber: number | null;
		episodeNumber: number | null;
		note: string;
		isPublic: boolean;
		createdAt: Date;
	}>;
	watchEvents: Array<{
		id: string;
		rating: number | null;
		note: string | null;
		scope: string | null;
		scopeSeasonNumber: number | null;
		scopeEpisodeNumber: number | null;
		watchedAt: Date;
		createdAt: Date;
	}>;
}

function formatScopeBadge(
	scope: string | null,
	seasonNumber: number | null,
	episodeNumber: number | null,
): string {
	if (scope === "episode" && seasonNumber != null && episodeNumber != null) {
		return `S${seasonNumber}E${episodeNumber}`;
	}
	if (scope === "season" && seasonNumber != null) {
		return `Season ${seasonNumber}`;
	}
	if (scope === "show") {
		return "General";
	}
	return "General";
}

function formatRelativeDate(date: Date): string {
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NotesAndReviewsSection({
	journalEntries,
	watchEvents,
}: NotesAndReviewsSectionProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const deleteJournalEntry = useMutation(
		trpc.journalEntry.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.journalEntry.getForShow.queryFilter(),
				);
				toast.success("Note deleted");
			},
			onError: () => {
				toast.error("Failed to delete note");
			},
		}),
	);

	const deleteWatchEvent = useMutation(
		trpc.watchEvent.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.watchEvent.getForTitle.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.watchEvent.getUserEvents.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.watchEvent.getLatestRating.queryFilter(),
				);
				toast.success("Review deleted");
			},
			onError: () => {
				toast.error("Failed to delete review");
			},
		}),
	);

	// Merge and sort entries chronologically (newest first)
	type TimelineItem =
		| {
				type: "note";
				data: NotesAndReviewsSectionProps["journalEntries"][number];
				timestamp: number;
		  }
		| {
				type: "review";
				data: NotesAndReviewsSectionProps["watchEvents"][number];
				timestamp: number;
		  };

	const timeline = useMemo(() => {
		const items: TimelineItem[] = [];

		for (const entry of journalEntries) {
			items.push({
				type: "note",
				data: entry,
				timestamp: entry.createdAt.getTime(),
			});
		}

		for (const event of watchEvents) {
			items.push({
				type: "review",
				data: event,
				timestamp: event.createdAt.getTime(),
			});
		}

		return items.sort((a, b) => b.timestamp - a.timestamp);
	}, [journalEntries, watchEvents]);

	if (timeline.length === 0) return null;

	function handleDeleteNote(id: string) {
		toast("Delete this note?", {
			action: {
				label: "Delete",
				onClick: () => deleteJournalEntry.mutate({ id }),
			},
			duration: 5000,
		});
	}

	function handleDeleteReview(id: string) {
		toast("Delete this review?", {
			action: {
				label: "Delete",
				onClick: () => deleteWatchEvent.mutate({ id }),
			},
			duration: 5000,
		});
	}

	return (
		<div className="mt-12">
			{/* Section header */}
			<div className="flex items-center gap-3 mb-6">
				<div
					className="h-px flex-1"
					style={{
						background:
							"linear-gradient(90deg, transparent, rgba(0,229,255,0.15) 30%, rgba(255,184,0,0.15) 70%, transparent)",
					}}
				/>
				<h2
					className="font-mono-retro text-[11px] tracking-[4px] uppercase text-cream/35"
					style={{
						textShadow:
							"0 0 12px rgba(0,229,255,0.1), 0 0 20px rgba(255,184,0,0.05)",
					}}
				>
					Notes & Reviews
				</h2>
				<div
					className="h-px flex-1"
					style={{
						background:
							"linear-gradient(90deg, transparent, rgba(255,184,0,0.15) 30%, rgba(0,229,255,0.15) 70%, transparent)",
					}}
				/>
			</div>

			<div className="space-y-3">
				{timeline.map((item) => {
					if (item.type === "note") {
						const entry = item.data;
						return (
							<div
								key={`note-${entry.id}`}
								className="group relative pl-4 py-3 pr-3 rounded-lg border border-cream/[0.06] overflow-hidden transition-colors duration-200 hover:border-neon-cyan/10"
								style={{
									background:
										"linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(0,229,255,0.02) 100%)",
									borderLeft: "2px solid rgba(0,229,255,0.25)",
								}}
							>
								{/* Top row: icon, scope badge, time, actions */}
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<BookOpen className="w-3 h-3 text-neon-cyan/40" />
										<span
											className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-cyan/[0.06] border border-neon-cyan/10 font-mono-retro text-[9px] tracking-wider text-neon-cyan/50"
											style={{
												textShadow: "0 0 6px rgba(0,229,255,0.15)",
											}}
										>
											{formatScopeBadge(
												entry.scope,
												entry.seasonNumber,
												entry.episodeNumber,
											)}
										</span>
										<span className="font-mono-retro text-[9px] text-cream/20">
											{formatRelativeDate(entry.createdAt)}
										</span>
									</div>
									<button
										type="button"
										onClick={() => handleDeleteNote(entry.id)}
										className="p-1 text-cream/10 opacity-0 group-hover:opacity-100 hover:text-red-400/60 transition-all duration-200"
									>
										<Trash2 className="w-3 h-3" />
									</button>
								</div>
								{/* Note text */}
								<p className="text-sm text-cream/55 leading-relaxed whitespace-pre-wrap">
									{entry.note}
								</p>
							</div>
						);
					}

					const event = item.data;
					return (
						<div
							key={`review-${event.id}`}
							className="group relative pl-4 py-3 pr-3 rounded-lg border border-cream/[0.06] overflow-hidden transition-colors duration-200 hover:border-neon-amber/10"
							style={{
								background:
									"linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(255,184,0,0.02) 100%)",
								borderLeft: "2px solid rgba(255,184,0,0.25)",
							}}
						>
							{/* Top row */}
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<Star className="w-3 h-3 text-neon-amber/40" />
									{event.rating != null && (
										<span className="flex items-center gap-0.5">
											{Array.from({ length: 5 }).map((_, i) => (
												<span
													key={`star-${event.id}-${i.toString()}`}
													className={`text-[10px] ${i < event.rating! ? "text-neon-amber" : "text-cream/10"}`}
													style={
														i < event.rating!
															? {
																	textShadow: "0 0 4px rgba(255,184,0,0.4)",
																}
															: undefined
													}
												>
													★
												</span>
											))}
										</span>
									)}
									<span
										className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-amber/[0.06] border border-neon-amber/10 font-mono-retro text-[9px] tracking-wider text-neon-amber/50"
										style={{
											textShadow: "0 0 6px rgba(255,184,0,0.15)",
										}}
									>
										{formatScopeBadge(
											event.scope,
											event.scopeSeasonNumber,
											event.scopeEpisodeNumber,
										)}
									</span>
									<span className="font-mono-retro text-[9px] text-cream/20">
										{formatRelativeDate(event.createdAt)}
									</span>
								</div>
								<button
									type="button"
									onClick={() => handleDeleteReview(event.id)}
									className="p-1 text-cream/10 opacity-0 group-hover:opacity-100 hover:text-red-400/60 transition-all duration-200"
								>
									<Trash2 className="w-3 h-3" />
								</button>
							</div>
							{/* Review text */}
							{event.note && (
								<p className="text-sm text-cream/55 leading-relaxed whitespace-pre-wrap">
									{event.note}
								</p>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
