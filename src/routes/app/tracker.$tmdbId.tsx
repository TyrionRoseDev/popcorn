import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCheck, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { SeasonRow } from "#/components/tracker/season-row";
import { useTRPC } from "#/integrations/trpc/react";

export const Route = createFileRoute("/app/tracker/$tmdbId")({
	component: ShowTracker,
});

function ShowTracker() {
	const { tmdbId: tmdbIdRaw } = Route.useParams();
	const tmdbId = Number(tmdbIdRaw);
	const trpc = useTRPC();
	const queryClient = useQueryClient();

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

	// Mutations
	const markEpisodes = useMutation(
		trpc.episodeTracker.markEpisodes.mutationOptions({
			onSuccess: (_data, variables) => {
				queryClient.invalidateQueries(
					trpc.episodeTracker.getForShow.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.episodeTracker.getTrackedShows.queryFilter(),
				);
				const count = variables.episodes.length;
				toast.success(
					`Marked ${count} episode${count > 1 ? "s" : ""} as watched`,
				);
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
	const isEnded =
		titleData?.status === "Ended" || titleData?.status === "Canceled";
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

	const isLoading = isLoadingTitle || isLoadingWatched || isLoadingEpisodes;

	return (
		<div className="mx-auto max-w-3xl px-4 py-6">
			{/* Back link */}
			<Link
				to="/app/tracker"
				className="mb-5 inline-flex items-center gap-1.5 text-xs font-mono-retro tracking-wider text-cream/30 no-underline transition-colors hover:text-cream/60"
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
				<>
					{/* Show header */}
					<div
						className="relative mb-8 flex gap-5 rounded-xl border border-cream/8 p-4 overflow-hidden"
						style={{
							background:
								"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
							boxShadow: "0 0 20px rgba(0,0,0,0.35)",
						}}
					>
						{/* Ambient glow behind poster */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 rounded-xl"
							style={{
								background: `radial-gradient(ellipse at 15% 40%, ${statusGlow.replace("0.35", "0.06")}, transparent 55%)`,
							}}
						/>

						{/* Poster */}
						<div className="relative h-[140px] w-[93px] shrink-0 overflow-hidden rounded-lg bg-cream/5">
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
						</div>

						{/* Info */}
						<div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between">
							<div>
								<h1 className="font-display text-lg text-cream tracking-wide leading-tight">
									{titleData.title}
								</h1>

								{/* Status badge */}
								<div className="mt-2 flex items-center gap-2">
									<span
										className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono-retro tracking-wider uppercase ${statusColor}`}
										style={{
											background: statusGlow.replace("0.35", "0.1"),
											textShadow: `0 0 8px ${statusGlow}`,
										}}
									>
										<span
											className="inline-block h-1 w-1 rounded-full"
											style={{
												backgroundColor: "currentColor",
												boxShadow: "0 0 4px currentColor",
											}}
										/>
										{statusLabel}
									</span>
								</div>
							</div>

							{/* Progress bar */}
							<div className="mt-auto">
								<div className="flex items-center justify-between mb-1.5">
									<span className="text-[11px] font-mono-retro text-cream/40 tracking-wide">
										{watchedCount}/{totalEpisodes} episodes
									</span>
									{totalEpisodes > 0 && (
										<span className="text-[10px] font-mono-retro text-cream/25">
											{progressPct}%
										</span>
									)}
								</div>
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-cream/5">
									<div
										className="h-full rounded-full transition-all duration-500"
										style={{
											width: `${progressPct}%`,
											background: isComplete
												? "linear-gradient(90deg, #ffb800, #ffd060)"
												: isCaughtUp
													? "linear-gradient(90deg, #34d399, #6ee7b7)"
													: "linear-gradient(90deg, #00e5ff, #40c8e0)",
											boxShadow: isComplete
												? "0 0 8px rgba(255,184,0,0.4)"
												: isCaughtUp
													? "0 0 8px rgba(52,211,153,0.4)"
													: "0 0 8px rgba(0,229,255,0.4)",
										}}
									/>
								</div>
							</div>
						</div>

						{/* Mark all button */}
						{totalEpisodes > 0 && watchedCount < totalEpisodes && (
							<button
								type="button"
								onClick={handleMarkAll}
								disabled={markEpisodes.isPending}
								className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono-retro tracking-wider uppercase text-neon-cyan transition-all duration-200 hover:bg-neon-cyan/10 disabled:opacity-40"
								style={{
									border: "1px solid rgba(0,229,255,0.15)",
									textShadow: "0 0 6px rgba(0,229,255,0.25)",
								}}
							>
								<CheckCheck className="h-3 w-3" />
								Mark all
							</button>
						)}
					</div>

					{/* Season rows */}
					<div className="space-y-8">
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
				</>
			)}
		</div>
	);
}
