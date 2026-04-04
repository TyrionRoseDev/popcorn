import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	BookOpen,
	Calendar,
	Check,
	CheckCheck,
	ChevronDown,
	Loader2,
	Pen,
	RotateCcw,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CompletionCelebration } from "#/components/tracker/completion-celebration";
import { RewatchConfirmModal } from "#/components/tracker/rewatch-confirm-modal";
import { WriteAboutModal } from "#/components/tracker/write-about-modal";
import { ReviewModal } from "#/components/watched/review-modal";
import { WatchlistRemovalDialog } from "#/components/watchlist/watchlist-removal-dialog";
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
	const [selectedSeason, setSelectedSeason] = useState(1);
	const [selectedWatchNumber, setSelectedWatchNumber] = useState<number | null>(
		null,
	);
	const [removalDialogOpen, setRemovalDialogOpen] = useState(false);
	const [removalWatchlists, setRemovalWatchlists] = useState<
		Array<{
			watchlistId: string;
			watchlistName: string;
			watchlistType: string;
		}>
	>([]);
	const [reviewPromptEpisode, setReviewPromptEpisode] = useState<{
		seasonNumber: number;
		episodeNumber: number;
	} | null>(null);
	const [reviewModalOpen, setReviewModalOpen] = useState(false);

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
		(e) => e.scope === "show" && e.watchNumber === currentWatchNumber,
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

				// Prompt for episode review (last episode in batch)
				if (variables.episodes.length === 1) {
					const ep = variables.episodes[0];
					setReviewPromptEpisode({
						seasonNumber: ep.seasonNumber,
						episodeNumber: ep.episodeNumber,
					});
				} else if (variables.episodes.length > 1) {
					const lastEp = variables.episodes[variables.episodes.length - 1];
					setReviewPromptEpisode({
						seasonNumber: lastEp.seasonNumber,
						episodeNumber: lastEp.episodeNumber,
					});
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

	const removeItemMutation = useMutation(
		trpc.watchlist.removeItem.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
				queryClient.invalidateQueries(trpc.watchlist.get.queryFilter());
				queryClient.invalidateQueries(
					trpc.watchlist.isBookmarked.queryFilter(),
				);
			},
		}),
	);

	function triggerWatchlistRemoval() {
		queryClient
			.fetchQuery(
				trpc.watchlist.getWatchlistsForTitle.queryOptions({
					tmdbId,
					mediaType: "tv",
				}),
			)
			.then((wls) => {
				if (wls.length === 0) return;
				if (wls.length === 1) {
					removeItemMutation.mutate(
						{
							watchlistId: wls[0].watchlistId,
							tmdbId,
							mediaType: "tv",
						},
						{
							onSuccess: () =>
								toast.success(`Removed from ${wls[0].watchlistName}`),
						},
					);
				} else {
					setRemovalWatchlists(wls);
					setRemovalDialogOpen(true);
				}
			});
	}

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

	useEffect(() => {
		if (reviewPromptEpisode && !reviewModalOpen) {
			const timer = setTimeout(() => setReviewPromptEpisode(null), 8000);
			return () => clearTimeout(timer);
		}
	}, [reviewPromptEpisode, reviewModalOpen]);

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

	function handleMarkAll() {
		if (!airedEpisodes.length) return;
		const unwatched = airedEpisodes.filter(
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

	// Progress stats (based on aired episodes only)
	const totalEpisodes = airedEpisodes.length;
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

	// Selected season data
	const selectedSeasonGroup = airedSeasonGroups.find(
		(g) => g.seasonNumber === selectedSeason,
	);
	const selectedSeasonEpisodes = selectedSeasonGroup?.episodes ?? [];
	const selectedSeasonWatched = selectedSeasonEpisodes.filter((ep) =>
		watchedSet.has(`S${ep.seasonNumber}E${ep.episodeNumber}`),
	).length;

	function handleMarkSeason() {
		const unwatched = selectedSeasonEpisodes.filter(
			(ep) => !watchedSet.has(`S${ep.seasonNumber}E${ep.episodeNumber}`),
		);
		if (unwatched.length === 0) return;
		handleMark(
			unwatched.map((ep) => ({
				seasonNumber: ep.seasonNumber,
				episodeNumber: ep.episodeNumber,
				runtime: ep.runtime ?? 0,
			})),
		);
	}

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
					{/* ── Drive-In Screen Header ── */}
					<div
						className="relative overflow-hidden rounded-md"
						style={{
							aspectRatio: "16/9",
							background: "#0a0a1e",
							border: "3px solid #1a1a2e",
							boxShadow:
								"0 0 60px rgba(255,184,0,0.06), 0 20px 60px rgba(0,0,0,0.5), inset 0 0 80px rgba(0,0,0,0.4)",
						}}
					>
						{/* Backdrop image */}
						{titleData.backdropPath ? (
							<img
								src={`https://image.tmdb.org/t/p/w780${titleData.backdropPath}`}
								alt=""
								className="absolute inset-0 h-full w-full object-cover"
								loading="eager"
							/>
						) : (
							<div
								className="absolute inset-0"
								style={{
									background:
										"linear-gradient(135deg, #1a1028, #0f1a2e, #0a0a1e)",
								}}
							/>
						)}

						{/* Scanline overlay */}
						<div
							className="pointer-events-none absolute inset-0"
							style={{
								background:
									"repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,240,0.008) 2px, rgba(255,255,240,0.008) 4px)",
								zIndex: 3,
							}}
						/>

						{/* Dark gradient overlay */}
						<div
							className="absolute inset-0"
							style={{
								background:
									"linear-gradient(to bottom, transparent 20%, rgba(5,5,8,0.3) 50%, rgba(5,5,8,0.85) 85%)",
								zIndex: 1,
							}}
						/>

						{/* Poster + title overlaid at bottom */}
						<div
							className="absolute bottom-0 left-0 right-0 flex items-end gap-3.5 p-5"
							style={{ zIndex: 2 }}
						>
							{/* Poster thumbnail */}
							<div
								className="shrink-0 overflow-hidden rounded"
								style={{
									width: 65,
									height: 97,
									border: "1px solid rgba(255,184,0,0.25)",
									boxShadow:
										"0 4px 20px rgba(0,0,0,0.5), 0 0 15px rgba(255,184,0,0.08)",
								}}
							>
								{titleData.posterPath ? (
									<img
										src={`https://image.tmdb.org/t/p/w185${titleData.posterPath}`}
										alt=""
										className="h-full w-full object-cover"
										loading="eager"
									/>
								) : (
									<div
										className="flex h-full w-full items-center justify-center text-[7px] text-cream/15"
										style={{
											background: "linear-gradient(145deg, #2a1540, #1a0a30)",
										}}
									>
										NO IMG
									</div>
								)}
							</div>

							{/* Title + meta */}
							<div className="flex-1 min-w-0">
								<h1
									className="font-display text-[22px] font-bold leading-tight text-cream"
									style={{
										textShadow: "0 2px 12px rgba(0,0,0,0.8)",
									}}
								>
									{titleData.title}
								</h1>
								{metaParts.length > 0 && (
									<p
										className="mt-1 text-[8px] tracking-[2px] uppercase"
										style={{ color: "rgba(255,255,240,0.5)" }}
									>
										{metaParts.join(" \u00B7 ")}
									</p>
								)}
							</div>
						</div>
					</div>

					{/* Speaker posts */}
					<div className="flex justify-between px-[30px] -mt-0.5 mb-4">
						{[0, 1, 2, 3, 4].map((i) => (
							<div
								key={i}
								className="rounded-b-sm"
								style={{
									width: 2,
									height: 18,
									background:
										"linear-gradient(180deg, #1a1a2e, rgba(255,184,0,0.15))",
								}}
							/>
						))}
					</div>

					{/* ── Progress Marquee ── */}
					<div
						className="relative overflow-hidden rounded-lg mb-5"
						style={{
							background: "rgba(5,5,12,0.8)",
							border: "1px solid rgba(255,184,0,0.12)",
							padding: "14px 18px",
						}}
					>
						<div className="flex items-center justify-between mb-2.5">
							<div>
								<div
									className="text-[8px] tracking-[3px] uppercase"
									style={{ color: "rgba(255,184,0,0.65)" }}
								>
									Progress
								</div>
								<div className="font-display">
									<span
										className="text-lg"
										style={{ color: "rgba(255,255,240,0.85)" }}
									>
										{watchedCount}
									</span>
									<span
										className="text-sm mx-0.5"
										style={{ color: "rgba(255,255,240,0.15)" }}
									>
										/
									</span>
									<span
										className="text-sm"
										style={{ color: "rgba(255,255,240,0.45)" }}
									>
										{totalEpisodes}
									</span>
								</div>
							</div>
							{totalEpisodes > 0 && (
								<span
									className="font-display text-xl"
									style={{
										color: isComplete
											? "#FFB800"
											: isCaughtUp
												? "#34d399"
												: "#00E5FF",
										textShadow: `0 0 12px ${
											isComplete
												? "rgba(255,184,0,0.4)"
												: isCaughtUp
													? "rgba(52,211,153,0.4)"
													: "rgba(0,229,255,0.4)"
										}`,
									}}
								>
									{progressPct}%
								</span>
							)}
						</div>
						<div
							className="overflow-hidden rounded-sm"
							style={{
								height: 6,
								background: "rgba(255,255,240,0.04)",
							}}
						>
							<div
								className="h-full rounded-sm transition-all duration-700 ease-out"
								style={{
									width: `${progressPct}%`,
									background: isComplete
										? "#FFB800"
										: isCaughtUp
											? "#34d399"
											: "linear-gradient(90deg, #00e5ff, #40c8e0)",
									boxShadow: `0 0 8px ${
										isComplete
											? "rgba(255,184,0,0.4)"
											: isCaughtUp
												? "rgba(52,211,153,0.4)"
												: "rgba(0,229,255,0.4)"
									}, 0 0 16px ${
										isComplete
											? "rgba(255,184,0,0.15)"
											: isCaughtUp
												? "rgba(52,211,153,0.15)"
												: "rgba(0,229,255,0.15)"
									}`,
								}}
							/>
						</div>
					</div>

					{/* ── Action Strip ── */}
					{!isViewingOldWatch && (
						<div className="flex gap-2 mb-7">
							{/* Write */}
							<button
								type="button"
								onClick={() => setWriteAboutOpen(true)}
								className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2.5 px-3 transition-all duration-200 hover:bg-neon-pink/[0.06]"
								style={{
									background: "rgba(12,12,28,0.5)",
									border: "1px solid rgba(255,45,120,0.1)",
								}}
							>
								<Pen
									className="h-4 w-4"
									style={{ color: "#FF2D78", opacity: 0.9 }}
								/>
								<span
									className="text-[7px] tracking-[2px] uppercase"
									style={{ color: "rgba(255,45,120,0.75)" }}
								>
									Write
								</span>
							</button>

							{/* Mark All */}
							<button
								type="button"
								onClick={handleMarkAll}
								disabled={
									markEpisodes.isPending ||
									(totalEpisodes > 0 && watchedCount >= totalEpisodes)
								}
								className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2.5 px-3 transition-all duration-200 hover:bg-neon-amber/[0.06] disabled:opacity-30 disabled:pointer-events-none"
								style={{
									background: "rgba(12,12,28,0.5)",
									border: "1px solid rgba(255,184,0,0.1)",
								}}
							>
								<CheckCheck
									className="h-4 w-4"
									style={{ color: "#FFB800", opacity: 0.9 }}
								/>
								<span
									className="text-[7px] tracking-[2px] uppercase"
									style={{ color: "rgba(255,184,0,0.75)" }}
								>
									Mark All
								</span>
							</button>

							{/* Rewatch */}
							<button
								type="button"
								onClick={() => setRewatchOpen(true)}
								className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2.5 px-3 transition-all duration-200 hover:bg-neon-cyan/[0.06]"
								style={{
									background: "rgba(12,12,28,0.5)",
									border: "1px solid rgba(0,229,255,0.1)",
								}}
							>
								<RotateCcw
									className="h-4 w-4"
									style={{ color: "#00e5ff", opacity: 0.9 }}
								/>
								<span
									className="text-[7px] tracking-[2px] uppercase"
									style={{ color: "rgba(0,229,255,0.75)" }}
								>
									Rewatch
								</span>
							</button>
						</div>
					)}

					{/* ── Film-Strip Divider ── */}
					<div className="flex items-center my-5 px-1">
						<span
							className="block h-[5px] w-[5px] shrink-0 rounded-full"
							style={{ background: "rgba(255,184,0,0.2)" }}
						/>
						<span
							className="block h-[5px] w-[5px] shrink-0 rounded-full"
							style={{ background: "rgba(0,229,255,0.12)" }}
						/>
						<span
							className="block h-[5px] w-[5px] shrink-0 rounded-full"
							style={{ background: "rgba(255,45,120,0.12)" }}
						/>
						<div
							className="flex-1 ml-1.5 mr-1.5"
							style={{
								height: 1,
								background:
									"linear-gradient(90deg, rgba(255,184,0,0.1), rgba(0,229,255,0.06), rgba(255,45,120,0.06), transparent)",
							}}
						/>
					</div>

					{/* Watch-through switcher */}
					{currentWatchNumber > 1 && (
						<div className="mb-6">
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

					{/* ── Season Dropdown Selector ── */}
					{airedSeasonGroups.length > 0 && (
						<div className="mb-2">
							<div
								className="flex items-center gap-3 pb-2.5"
								style={{
									borderBottom: "1px solid rgba(255,184,0,0.08)",
								}}
							>
								{/* Season select */}
								<div className="relative">
									<select
										value={selectedSeason}
										onChange={(e) => setSelectedSeason(Number(e.target.value))}
										className="appearance-none rounded-md py-1.5 pl-3 pr-8 font-display text-base text-cream outline-none cursor-pointer"
										style={{
											background: "rgba(12,12,28,0.6)",
											border: "1px solid rgba(255,184,0,0.15)",
										}}
									>
										{airedSeasonGroups.map((g) => (
											<option
												key={g.seasonNumber}
												value={g.seasonNumber}
												style={{
													background: "#0a0a1e",
													color: "#fffff0",
												}}
											>
												{g.seasonName}
											</option>
										))}
									</select>
									<ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream/25" />
								</div>

								{/* Watched count for season */}
								<span className="font-mono-retro text-[9px] tracking-wider text-cream/40">
									{selectedSeasonWatched}/{selectedSeasonEpisodes.length}
								</span>

								{/* Mark All for this season */}
								{!isViewingOldWatch &&
									selectedSeasonWatched < selectedSeasonEpisodes.length && (
										<button
											type="button"
											onClick={handleMarkSeason}
											className="ml-auto text-[7px] tracking-[2px] uppercase rounded px-2.5 py-1 cursor-pointer transition-colors hover:bg-neon-amber/[0.06]"
											style={{
												color: "rgba(255,184,0,0.6)",
												border: "1px solid rgba(255,184,0,0.12)",
												background: "transparent",
											}}
										>
											Mark All
										</button>
									)}
							</div>
						</div>
					)}

					{/* ── Episode Rows ── */}
					<div>
						{selectedSeasonEpisodes.map((ep) => {
							const key = `S${ep.seasonNumber}E${ep.episodeNumber}`;
							const isWatched = watchedSet.has(key);

							return (
								<button
									key={key}
									type="button"
									onClick={() => {
										if (isViewingOldWatch) return;
										if (isWatched) {
											handleUnmark({
												seasonNumber: ep.seasonNumber,
												episodeNumber: ep.episodeNumber,
											});
										} else {
											handleMark([
												{
													seasonNumber: ep.seasonNumber,
													episodeNumber: ep.episodeNumber,
													runtime: ep.runtime ?? 0,
												},
											]);
										}
									}}
									className={`group/ep relative flex w-full items-stretch my-1.5 rounded-lg overflow-hidden transition-all duration-250 ease-out ${
										!isViewingOldWatch
											? "cursor-pointer hover:translate-x-1"
											: "cursor-default"
									}`}
									style={{
										border: isWatched
											? "1px solid rgba(0,229,255,0.2)"
											: "1px solid rgba(255,184,0,0.08)",
									}}
								>
									{/* Left accent strip */}
									<div
										className="w-1 shrink-0 transition-all duration-300"
										style={
											isWatched
												? {
														background:
															"linear-gradient(180deg, #00e5ff, #FF2D78)",
														boxShadow: "0 0 8px rgba(0,229,255,0.3)",
													}
												: {
														background: "rgba(255,184,0,0.08)",
													}
										}
									/>

									{/* Main body */}
									<div
										className="flex flex-1 items-center gap-3 py-3 px-3.5 transition-colors duration-200"
										style={{
											background: isWatched
												? "linear-gradient(90deg, rgba(0,229,255,0.06), rgba(0,229,255,0.015) 40%, transparent)"
												: "linear-gradient(90deg, rgba(255,184,0,0.02), transparent 40%)",
										}}
									>
										{/* Episode number */}
										<span
											className="shrink-0 font-display text-[15px] font-bold text-center transition-all duration-200"
											style={{
												width: 26,
												color: isWatched ? "#00e5ff" : "rgba(255,184,0,0.45)",
												textShadow: isWatched
													? "0 0 10px rgba(0,229,255,0.5)"
													: "none",
											}}
										>
											{ep.episodeNumber}
										</span>

										{/* Dot separator */}
										<span
											className="block shrink-0 rounded-full"
											style={{
												width: 3,
												height: 3,
												background: isWatched
													? "rgba(0,229,255,0.5)"
													: "rgba(255,184,0,0.2)",
												boxShadow: isWatched
													? "0 0 4px rgba(0,229,255,0.3)"
													: "none",
											}}
										/>

										{/* Episode info */}
										<div className="flex-1 min-w-0">
											<div
												className="text-sm truncate transition-colors duration-200"
												style={{
													color: isWatched
														? "rgba(255,255,240,0.9)"
														: "rgba(255,255,240,0.65)",
												}}
											>
												{ep.name}
											</div>
											{ep.runtime != null && ep.runtime > 0 && (
												<div
													className="text-[8px] tracking-[1px] mt-0.5"
													style={{
														color: isWatched
															? "rgba(0,229,255,0.4)"
															: "rgba(255,255,240,0.25)",
													}}
												>
													{ep.runtime} min
												</div>
											)}
										</div>

										{/* Hover hint */}
										{!isViewingOldWatch && (
											<span
												className="text-[7px] tracking-[2px] uppercase opacity-0 group-hover/ep:opacity-100 transition-opacity duration-200"
												style={{
													color: isWatched
														? "rgba(255,255,240,0.2)"
														: "rgba(0,229,255,0.35)",
												}}
											>
												{isWatched ? "undo" : "watch"}
											</span>
										)}
									</div>

									{/* Right status section */}
									<div
										className="flex w-9 shrink-0 items-center justify-center transition-all duration-200"
										style={{
											borderLeft: isWatched
												? "1px solid rgba(0,229,255,0.1)"
												: "1px solid rgba(255,255,240,0.03)",
											background: isWatched
												? "rgba(0,229,255,0.04)"
												: "transparent",
										}}
									>
										{isWatched ? (
											<div
												className="flex h-[18px] w-[18px] items-center justify-center rounded-full"
												style={{
													background: "rgba(0,229,255,0.15)",
													boxShadow: "0 0 8px rgba(0,229,255,0.25)",
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
										) : (
											<div
												className="h-[18px] w-[18px] rounded-full transition-all duration-200 group-hover/ep:border-[rgba(0,229,255,0.3)] group-hover/ep:bg-[rgba(0,229,255,0.05)]"
												style={{
													border: "1.5px solid rgba(255,184,0,0.15)",
												}}
											/>
										)}
									</div>
								</button>
							);
						})}
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
					onReview={() => {
						setReviewOpen(true);
					}}
					onRemindLater={() => {
						createReminder.mutate(
							{
								tmdbId,
								mediaType: "tv",
								titleName: titleData.title,
								posterPath: titleData.posterPath,
								remindMe: true,
								scope: "show",
							},
							{
								onSuccess: () => {
									toast.success("We'll remind you to review in 7 days");
									triggerWatchlistRemoval();
								},
								onError: () => {
									toast.error("Failed to set reminder");
								},
							},
						);
					}}
				/>
			)}

			{/* Completion review prompt */}
			{titleData && (
				<ReviewModal
					open={reviewOpen}
					onOpenChange={setReviewOpen}
					onEventCreated={() => {
						triggerWatchlistRemoval();
					}}
					titleName={titleData.title}
					year={titleData.year || undefined}
					tmdbId={tmdbId}
					mediaType="tv"
				/>
			)}

			{/* Watchlist removal dialog (after show completion) */}
			{titleData && (
				<WatchlistRemovalDialog
					open={removalDialogOpen}
					onOpenChange={setRemovalDialogOpen}
					tmdbId={tmdbId}
					mediaType="tv"
					titleName={titleData.title}
					watchlists={removalWatchlists}
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

			{/* Episode review prompt */}
			{reviewPromptEpisode && !reviewModalOpen && (
				<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[rgba(15,15,40,0.98)] border border-neon-amber/25 rounded-xl px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_16px_rgba(255,184,0,0.08)] text-center animate-in slide-in-from-bottom-4 duration-300">
					<div className="text-[13px] text-cream/70 mb-3">
						Add thoughts on{" "}
						<span className="text-neon-cyan font-semibold">
							S{reviewPromptEpisode.seasonNumber}E
							{reviewPromptEpisode.episodeNumber}
						</span>
						?
					</div>
					<div className="flex gap-2 justify-center">
						<button
							type="button"
							onClick={() => {
								setReviewModalOpen(true);
							}}
							className="px-4 py-1.5 bg-neon-amber/15 border border-neon-amber/30 rounded-md text-[12px] font-semibold text-neon-amber hover:bg-neon-amber/25 transition-colors"
						>
							Yes
						</button>
						<button
							type="button"
							onClick={() => setReviewPromptEpisode(null)}
							className="px-4 py-1.5 bg-transparent border border-cream/10 rounded-md text-[12px] text-cream/40 hover:text-cream/60 transition-colors"
						>
							Dismiss
						</button>
					</div>
				</div>
			)}

			{reviewModalOpen && reviewPromptEpisode && (
				<ReviewModal
					open={reviewModalOpen}
					onOpenChange={(open) => {
						setReviewModalOpen(open);
						if (!open) setReviewPromptEpisode(null);
					}}
					titleName={titleData?.title ?? ""}
					tmdbId={tmdbId}
					mediaType="tv"
					scope="episode"
					scopeSeasonNumber={reviewPromptEpisode.seasonNumber}
					scopeEpisodeNumber={reviewPromptEpisode.episodeNumber}
					onEventCreated={() => {
						setReviewPromptEpisode(null);
						setReviewModalOpen(false);
					}}
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
		watchNumber: number;
	}>;
	watchEvents: Array<{
		id: string;
		rating: number | null;
		note: string | null;
		scope: string | null;
		scopeSeasonNumber: number | null;
		scopeEpisodeNumber: number | null;
		watchedAt: Date | null;
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
				<BookOpen className="h-4 w-4 text-cream/50" />
				<h2 className="font-display text-base tracking-wide text-cream/70">
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
									background: "rgba(0,229,255,0.04)",
									borderLeft: "2px solid rgba(0,229,255,0.35)",
								}}
							>
								{/* Top row: scope badge, time, actions */}
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-cyan/[0.12] font-mono-retro text-[9px] tracking-wider text-neon-cyan/70">
											{formatScopeBadge(
												entry.scope,
												entry.seasonNumber,
												entry.episodeNumber,
											)}
										</span>
										<span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-pink/[0.12] font-mono-retro text-[9px] tracking-wider text-neon-pink/60">
											{entry.watchNumber === 1
												? "Watch 1"
												: `Rewatch ${entry.watchNumber}`}
										</span>
										<span className="font-mono-retro text-[9px] text-cream/35">
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
								<p className="text-sm text-cream/75 leading-relaxed whitespace-pre-wrap">
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
								background: "rgba(255,184,0,0.04)",
								borderLeft: "2px solid rgba(255,184,0,0.35)",
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
													className={`text-[10px] ${event.rating != null && i < event.rating ? "text-neon-amber" : "text-cream/15"}`}
												>
													★
												</span>
											))}
										</span>
									)}
									<span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-amber/[0.12] font-mono-retro text-[9px] tracking-wider text-neon-amber/70">
										{formatScopeBadge(
											event.scope,
											event.scopeSeasonNumber,
											event.scopeEpisodeNumber,
										)}
									</span>
									<span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-neon-pink/[0.12] font-mono-retro text-[9px] tracking-wider text-neon-pink/60">
										{event.watchNumber === 1
											? "Watch 1"
											: `Rewatch ${event.watchNumber}`}
									</span>
									<span className="font-mono-retro text-[9px] text-cream/35">
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
								<p className="text-sm text-cream/75 leading-relaxed whitespace-pre-wrap">
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
