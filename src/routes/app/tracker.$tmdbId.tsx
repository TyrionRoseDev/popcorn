import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	BookOpen,
	Calendar,
	CheckCheck,
	Loader2,
	Pen,
	RotateCcw,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CompletionCelebration } from "#/components/tracker/completion-celebration";
import { RewatchConfirmModal } from "#/components/tracker/rewatch-confirm-modal";
import { SeasonSection } from "#/components/tracker/season-row";
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
	const [showCelebration, setShowCelebration] = useState(false);
	const [writeAboutOpen, setWriteAboutOpen] = useState(false);
	const [rewatchOpen, setRewatchOpen] = useState(false);
	const [selectedWatchNumber, setSelectedWatchNumber] = useState<number | null>(
		null,
	);

	// Fetch current watch number (needed before getForShow)
	const { data: watchNumberData } = useQuery(
		trpc.episodeTracker.getWatchNumber.queryOptions({ tmdbId }),
	);
	const currentWatchNumber = watchNumberData?.currentWatchNumber ?? 1;

	// Compute active watch number for the switcher
	const activeWatchNumber = selectedWatchNumber ?? currentWatchNumber;
	const isViewingOldWatch = activeWatchNumber < currentWatchNumber;

	// Fetch show details
	const { data: titleData, isLoading: isLoadingTitle } = useQuery(
		trpc.title.details.queryOptions({ tmdbId, mediaType: "tv" }),
	);

	// Fetch watched episodes
	const { data: watchedRows, isLoading: isLoadingWatched } = useQuery(
		trpc.episodeTracker.getForShow.queryOptions({
			tmdbId,
			watchNumber: activeWatchNumber,
		}),
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
					setShowCelebration(true);
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

	const createReminder = useMutation(
		trpc.watchEvent.create.mutationOptions({
			onError: () => {
				toast.error("Failed to set reminder");
			},
		}),
	);

	const startRewatchMut = useMutation(
		trpc.episodeTracker.startRewatch.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries(
					trpc.episodeTracker.getForShow.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.episodeTracker.getTrackedShows.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.episodeTracker.getWatchNumber.queryFilter(),
				);
				setRewatchOpen(false);
				setSelectedWatchNumber(null);
				toast.success(
					`Rewatch started — you're on Watch ${data.currentWatchNumber}`,
				);
			},
			onError: () => {
				toast.error("Failed to start rewatch");
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

	// Upcoming episodes (future air dates for "Returning Series")
	const upcomingEpisodes = useMemo(() => {
		if (titleData?.status !== "Returning Series" || !allEpisodes) return [];
		const today = new Date().toISOString().slice(0, 10);
		return allEpisodes.filter((ep) => ep.airDate != null && ep.airDate > today);
	}, [allEpisodes, titleData?.status]);

	// Aired episodes only (for progress and season display)
	const airedEpisodes = useMemo(() => {
		if (!allEpisodes) return [];
		if (titleData?.status !== "Returning Series") return allEpisodes;
		const today = new Date().toISOString().slice(0, 10);
		return allEpisodes.filter(
			(ep) => ep.airDate == null || ep.airDate <= today,
		);
	}, [allEpisodes, titleData?.status]);

	// Season groups for aired episodes only
	const airedSeasonGroups = useMemo(() => {
		if (airedEpisodes.length === 0 || !titleData?.seasonList)
			return seasonGroups;
		const map = new Map<
			number,
			{
				seasonNumber: number;
				seasonName: string;
				episodes: typeof airedEpisodes;
			}
		>();
		for (const ep of airedEpisodes) {
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
		return Array.from(map.values()).sort(
			(a, b) => a.seasonNumber - b.seasonNumber,
		);
	}, [airedEpisodes, titleData?.seasonList, seasonGroups]);

	// Metadata line
	const metaParts: string[] = [];
	if (titleData?.year) metaParts.push(titleData.year);
	if (titleData?.status) metaParts.push(titleData.status);
	if (titleData?.seasonList)
		metaParts.push(
			`${titleData.seasonList.length} season${titleData.seasonList.length !== 1 ? "s" : ""}`,
		);

	const isLoading = isLoadingTitle || isLoadingWatched || isLoadingEpisodes;

	return (
		<div className="mx-auto max-w-2xl px-4 pb-8">
			{/* Back link */}
			<Link
				to="/app/tracker"
				className="mb-6 inline-flex items-center gap-1.5 pt-6 text-xs font-mono-retro tracking-wider text-cream/30 no-underline transition-colors hover:text-cream/60"
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
				<div>
					{/* ── Header ── */}
					<div className="flex gap-5 mb-8">
						{/* Poster */}
						<div
							className="shrink-0 h-[135px] w-[90px] overflow-hidden rounded-lg bg-cream/5"
							style={{ border: "1px solid rgba(255,184,0,0.15)" }}
						>
							{titleData.posterPath ? (
								<img
									src={`https://image.tmdb.org/t/p/w185${titleData.posterPath}`}
									alt=""
									className="h-full w-full object-cover"
									loading="eager"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center text-cream/15 text-xs font-mono-retro">
									NO
									<br />
									IMG
								</div>
							)}
						</div>

						{/* Title + meta + progress */}
						<div className="flex flex-1 min-w-0 flex-col">
							<h1 className="font-display text-2xl text-cream tracking-wide leading-tight">
								{titleData.title}
							</h1>

							{/* Metadata */}
							{metaParts.length > 0 && (
								<p className="mt-1.5 font-mono-retro text-[11px] tracking-wider text-cream/30">
									{metaParts.join(" · ")}
								</p>
							)}

							{/* Progress section */}
							<div className="mt-auto pt-4">
								{/* Episode count + percentage */}
								<div className="flex items-baseline justify-between mb-2">
									<span className="font-mono-retro text-xs text-cream/40">
										<span className="text-cream/70 font-display text-base">
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
											className="font-display text-lg tracking-wide"
											style={{
												color: isComplete
													? "#FFB800"
													: isCaughtUp
														? "#34d399"
														: "#00E5FF",
											}}
										>
											{progressPct}%
										</span>
									)}
								</div>

								{/* Progress bar - 8px, clean */}
								<div
									className="h-2 w-full overflow-hidden rounded-full"
									style={{
										background: "rgba(255,255,240,0.04)",
									}}
								>
									<div
										className="h-full rounded-full transition-all duration-700 ease-out"
										style={{
											width: `${progressPct}%`,
											background: isComplete
												? "#FFB800"
												: isCaughtUp
													? "#34d399"
													: "#00E5FF",
										}}
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Action buttons */}
					{!isViewingOldWatch && (
						<div className="flex items-center gap-3 mb-10">
							<button
								type="button"
								onClick={() => setWriteAboutOpen(true)}
								className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-mono-retro tracking-wider uppercase text-neon-pink transition-colors hover:bg-neon-pink/10"
								style={{ border: "1px solid rgba(255,45,120,0.2)" }}
							>
								<Pen className="h-3.5 w-3.5" />
								Write
							</button>
							{totalEpisodes > 0 && watchedCount < totalEpisodes && (
								<button
									type="button"
									onClick={handleMarkAll}
									disabled={markEpisodes.isPending}
									className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-mono-retro tracking-wider uppercase text-neon-amber transition-colors hover:bg-neon-amber/10 disabled:opacity-40 disabled:pointer-events-none"
									style={{ border: "1px solid rgba(255,184,0,0.2)" }}
								>
									<CheckCheck className="h-3.5 w-3.5" />
									Mark All
								</button>
							)}
							<button
								type="button"
								onClick={() => setRewatchOpen(true)}
								className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-mono-retro tracking-wider uppercase text-neon-pink transition-colors hover:bg-neon-pink/10"
								style={{ border: "1px solid rgba(255,45,120,0.2)" }}
							>
								<RotateCcw className="h-3.5 w-3.5" />
								Rewatch
							</button>
						</div>
					)}

					{/* Watch-through switcher */}
					{currentWatchNumber > 1 && (
						<div className="mb-10">
							<div className="flex items-center gap-2 flex-wrap">
								{Array.from(
									{ length: currentWatchNumber },
									(_, i) => i + 1,
								).map((num) => {
									const isActive = num === activeWatchNumber;
									return (
										<button
											key={num}
											type="button"
											onClick={() =>
												setSelectedWatchNumber(
													num === currentWatchNumber ? null : num,
												)
											}
											className="rounded-full px-3 py-1 text-[10px] font-mono-retro tracking-wider uppercase transition-all duration-200"
											style={{
												color: isActive ? "#FF2D78" : "rgba(255,255,240,0.3)",
												background: isActive
													? "rgba(255,45,120,0.15)"
													: "transparent",
												border: isActive
													? "1px solid rgba(255,45,120,0.3)"
													: "1px solid rgba(255,255,240,0.1)",
												textShadow: isActive
													? "0 0 8px rgba(255,45,120,0.3)"
													: "none",
											}}
										>
											{num === 1 ? "Watch 1" : `Rewatch ${num}`}
										</button>
									);
								})}
							</div>
							{isViewingOldWatch && (
								<p className="mt-2 text-[10px] font-mono-retro tracking-wider text-cream/25">
									Viewing{" "}
									{activeWatchNumber === 1
										? "Watch 1"
										: `Rewatch ${activeWatchNumber}`}{" "}
									(read-only)
								</p>
							)}
						</div>
					)}

					{/* ── Episode List by Season ── */}
					<div className="space-y-10">
						{airedSeasonGroups.map((group) => (
							<SeasonSection
								key={group.seasonNumber}
								tmdbId={tmdbId}
								seasonNumber={group.seasonNumber}
								seasonName={group.seasonName}
								episodes={group.episodes}
								watchedEpisodes={watchedSet}
								onMark={handleMark}
								onUnmark={handleUnmark}
								readOnly={isViewingOldWatch}
							/>
						))}
					</div>

					{/* Empty state when no episodes fetched */}
					{seasonGroups.length === 0 && !isLoading && (
						<div className="py-16 text-center text-sm text-cream/25 font-mono-retro">
							No episode data available
						</div>
					)}

					{/* ── Coming Soon ── */}
					{upcomingEpisodes.length > 0 && (
						<div className="mt-12">
							<div
								className="flex items-center gap-3 mb-4 pb-2"
								style={{
									borderBottom: "1px solid rgba(255,184,0,0.12)",
								}}
							>
								<Calendar className="h-4 w-4 text-neon-amber/50" />
								<h2 className="font-display text-base tracking-wide text-neon-amber/70">
									Coming Soon
								</h2>
							</div>

							<div>
								{upcomingEpisodes.map((ep) => (
									<div
										key={`upcoming-S${ep.seasonNumber}E${ep.episodeNumber}`}
										className="flex items-center gap-3 px-2 py-2.5"
										style={{
											borderBottom: "1px solid rgba(255,255,240,0.03)",
										}}
									>
										<span className="shrink-0 font-mono-retro text-[11px] tracking-wider text-neon-amber/40">
											S{ep.seasonNumber}E{ep.episodeNumber}
										</span>
										<span className="text-cream/15 shrink-0">·</span>
										<span className="flex-1 truncate text-sm text-cream/30">
											{ep.name}
										</span>
										{ep.airDate && (
											<span className="shrink-0 font-mono-retro text-[10px] text-neon-amber/35">
												{new Date(`${ep.airDate}T00:00:00`).toLocaleDateString(
													"en-US",
													{
														month: "short",
														day: "numeric",
													},
												)}
											</span>
										)}
									</div>
								))}
							</div>
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

			{/* Completion celebration */}
			{titleData && (
				<CompletionCelebration
					open={showCelebration}
					onOpenChange={setShowCelebration}
					titleName={titleData.title}
					posterPath={titleData.posterPath ?? null}
					episodeCount={totalEpisodes}
					onReview={() => setReviewOpen(true)}
					onRemindLater={() => {
						createReminder.mutate({
							tmdbId,
							mediaType: "tv",
							titleName: titleData.title,
							posterPath: titleData.posterPath,
							remindMe: true,
							scope: "show",
						});
						toast.success("We'll remind you to review in 7 days");
					}}
				/>
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

			{/* Rewatch confirmation modal */}
			<RewatchConfirmModal
				open={rewatchOpen}
				onOpenChange={setRewatchOpen}
				titleName={titleData?.title ?? ""}
				isComplete={isComplete}
				watchedCount={watchedCount}
				totalEpisodes={totalEpisodes}
				currentWatchNumber={currentWatchNumber}
				onConfirm={() => {
					startRewatchMut.mutate({ tmdbId });
				}}
				isPending={startRewatchMut.isPending}
			/>
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
		watchNumber: number;
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
		watchNumber: number;
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
			<div
				className="flex items-center gap-3 mb-4 pb-2"
				style={{ borderBottom: "1px solid rgba(255,184,0,0.12)" }}
			>
				<BookOpen className="h-4 w-4 text-cream/30" />
				<h2 className="font-display text-base tracking-wide text-cream/50">
					Notes & Reviews
				</h2>
			</div>

			<div className="space-y-3">
				{timeline.map((item) => {
					if (item.type === "note") {
						const entry = item.data;
						return (
							<div
								key={`note-${entry.id}`}
								className="group relative pl-4 py-3 pr-3 rounded-lg transition-colors duration-200"
								style={{
									background: "rgba(0,229,255,0.02)",
									borderLeft: "2px solid rgba(0,229,255,0.2)",
								}}
							>
								{/* Top row: scope badge, time, actions */}
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-cyan/[0.06] font-mono-retro text-[9px] tracking-wider text-neon-cyan/50">
											{formatScopeBadge(
												entry.scope,
												entry.seasonNumber,
												entry.episodeNumber,
											)}
										</span>
										<span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-pink/[0.06] font-mono-retro text-[9px] tracking-wider text-neon-pink/40">
											{entry.watchNumber === 1
												? "Watch 1"
												: `Rewatch ${entry.watchNumber}`}
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
							className="group relative pl-4 py-3 pr-3 rounded-lg transition-colors duration-200"
							style={{
								background: "rgba(255,184,0,0.02)",
								borderLeft: "2px solid rgba(255,184,0,0.2)",
							}}
						>
							{/* Top row */}
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									{event.rating != null && (
										<span className="flex items-center gap-0.5">
											{Array.from({ length: 5 }).map((_, i) => (
												<span
													key={`star-${event.id}-${i.toString()}`}
													className={`text-[10px] ${event.rating != null && i < event.rating ? "text-neon-amber" : "text-cream/10"}`}
												>
													★
												</span>
											))}
										</span>
									)}
									<span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-amber/[0.06] font-mono-retro text-[9px] tracking-wider text-neon-amber/50">
										{formatScopeBadge(
											event.scope,
											event.scopeSeasonNumber,
											event.scopeEpisodeNumber,
										)}
									</span>
									<span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-pink/[0.06] font-mono-retro text-[9px] tracking-wider text-neon-pink/40">
										{event.watchNumber === 1
											? "Watch 1"
											: `Rewatch ${event.watchNumber}`}
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
