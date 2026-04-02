import {
	useInfiniteQuery,
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Clock, Film, Loader2, Search, Tv } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { JournalEntryCard } from "#/components/tracker/journal-entry-card";
import { TrackerShowCard } from "#/components/tracker/tracker-show-card";
import { NowShowingHeader } from "#/components/watchlist/now-showing-header";
import { useTRPC } from "#/integrations/trpc/react";

export const Route = createFileRoute("/app/tracker/")({
	component: TrackerDashboard,
});

function formatRuntime(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function TrackerDashboard() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState<"shows" | "journal">("shows");

	// ── Shows tab data ──────────────────────────────────────────────────────────
	const { data: trackedShows, isLoading: isLoadingShows } = useQuery(
		trpc.episodeTracker.getTrackedShows.queryOptions(),
	);

	const detailQueries = useQueries({
		queries: (trackedShows ?? []).map((show) => ({
			...trpc.title.details.queryOptions({
				tmdbId: show.tmdbId,
				mediaType: "tv" as const,
			}),
		})),
	});

	const isLoadingDetails =
		detailQueries.length > 0 && detailQueries.some((q) => q.isLoading);
	const isLoadingShowsTab = isLoadingShows || isLoadingDetails;

	const showsWithDetails = (trackedShows ?? [])
		.map((show, i) => {
			const details = detailQueries[i]?.data;
			if (!details) return null;
			return { ...show, details };
		})
		.filter(Boolean) as Array<{
		tmdbId: number;
		episodeCount: number;
		totalRuntime: number;
		lastWatchedAt: string;
		details: {
			title: string;
			posterPath: string | null;
			backdropPath: string | null;
			status?: string;
			episodes?: number;
			genres: string[];
			year: string;
			contentRating: string;
			seasonList?: Array<{
				seasonNumber: number;
				episodeCount: number;
				name: string;
			}>;
		};
	}>;

	const watching = showsWithDetails.filter((show) => {
		const isEnded =
			show.details.status === "Ended" || show.details.status === "Canceled";
		const totalEps = show.details.episodes ?? 0;
		const isComplete = isEnded && totalEps > 0 && show.episodeCount >= totalEps;
		return !isComplete;
	});

	const completed = showsWithDetails.filter((show) => {
		const isEnded =
			show.details.status === "Ended" || show.details.status === "Canceled";
		const totalEps = show.details.episodes ?? 0;
		return isEnded && totalEps > 0 && show.episodeCount >= totalEps;
	});

	// ── Stats ────────────────────────────────────────────────────────────────────
	const totalShows = showsWithDetails.length;
	const totalWatchtime = showsWithDetails.reduce(
		(acc, s) => acc + s.totalRuntime,
		0,
	);

	// ── Journal tab data ────────────────────────────────────────────────────────
	const {
		data: journalData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading: isLoadingJournal,
	} = useInfiniteQuery(
		trpc.journalEntry.getAll.infiniteQueryOptions(
			{ limit: 20 },
			{ getNextPageParam: (lastPage) => lastPage.nextCursor },
		),
	);

	const journalEntries = journalData?.pages.flatMap((p) => p.items) ?? [];

	const removeShow = useMutation(
		trpc.episodeTracker.removeShow.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.episodeTracker.getTrackedShows.queryFilter(),
				);
				queryClient.invalidateQueries(trpc.journalEntry.getAll.queryFilter());
				toast.success("Show removed from tracker");
			},
			onError: () => {
				toast.error("Failed to remove show");
			},
		}),
	);

	function handleRemoveShow(tmdbId: number) {
		const show = showsWithDetails.find((s) => s.tmdbId === tmdbId);
		toast(`Remove ${show?.details.title ?? "this show"} from tracker?`, {
			description: "All episode progress and notes will be deleted",
			action: {
				label: "Remove",
				onClick: () => removeShow.mutate({ tmdbId }),
			},
			duration: 5000,
		});
	}

	const tabs = [
		{ id: "shows" as const, label: "My Shows", icon: Tv },
		{ id: "journal" as const, label: "Journal", icon: BookOpen },
	] as const;

	return (
		<div className="relative mx-auto max-w-3xl px-4 pt-10 pb-16">
			{/* Atmospheric background glow */}
			<div
				aria-hidden="true"
				className="pointer-events-none fixed inset-0 z-0"
				style={{
					background:
						"radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,184,0,0.06), transparent 60%), radial-gradient(ellipse 60% 40% at 80% 10%, rgba(255,45,120,0.03), transparent 50%)",
				}}
			/>

			<div className="relative z-10">
				{/* ── Marquee Header ─────────────────────────────────────────────── */}
				<div className="mb-6">
					<NowShowingHeader title="Series Tracker" />

					{/* Stats ribbon */}
					{!isLoadingShowsTab && totalShows > 0 && (
						<div className="mt-4 flex items-center justify-center gap-4">
							<span
								className="inline-flex items-center gap-1.5 font-mono-retro tracking-wide"
								style={{
									fontSize: "10px",
									letterSpacing: "2px",
									color: "rgba(255,184,0,0.5)",
									textTransform: "uppercase",
								}}
							>
								<Film className="h-3 w-3" style={{ opacity: 0.6 }} />
								{totalShows} {totalShows === 1 ? "show" : "shows"}
							</span>
							{totalWatchtime > 0 && (
								<>
									<span
										style={{
											width: "3px",
											height: "3px",
											borderRadius: "50%",
											background: "rgba(255,184,0,0.2)",
										}}
									/>
									<span
										className="inline-flex items-center gap-1.5 font-mono-retro tracking-wide"
										style={{
											fontSize: "10px",
											letterSpacing: "2px",
											color: "rgba(255,184,0,0.5)",
											textTransform: "uppercase",
										}}
									>
										<Clock className="h-3 w-3" style={{ opacity: 0.6 }} />
										{formatRuntime(totalWatchtime)} watched
									</span>
								</>
							)}
						</div>
					)}
				</div>

				{/* ── Tab Bar ────────────────────────────────────────────────────── */}
				<div
					className="mx-auto mb-8 flex items-center gap-2"
					style={{ maxWidth: "320px" }}
				>
					{tabs.map((tab) => {
						const isActive = activeTab === tab.id;
						const Icon = tab.icon;
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className="relative flex flex-1 items-center justify-center gap-2 px-4 py-2.5 font-mono-retro tracking-wider transition-all duration-300"
								style={{
									fontSize: "10px",
									letterSpacing: "3px",
									textTransform: "uppercase",
									color: isActive ? "#FFB800" : "rgba(255,255,240,0.25)",
									background: isActive ? "rgba(255,184,0,0.06)" : "transparent",
									border: isActive
										? "1px solid rgba(255,184,0,0.3)"
										: "1px solid rgba(255,255,240,0.06)",
									borderRadius: "6px",
									boxShadow: isActive
										? "0 0 16px rgba(255,184,0,0.06), inset 0 1px 0 rgba(255,184,0,0.08)"
										: "none",
									textShadow: isActive
										? "0 0 12px rgba(255,184,0,0.4)"
										: "none",
								}}
							>
								<Icon
									className="h-3.5 w-3.5"
									style={{ opacity: isActive ? 0.9 : 0.4 }}
								/>
								{tab.label}
							</button>
						);
					})}
				</div>

				{/* ── Shows Tab ────────────────────────────────────────────────────── */}
				{activeTab === "shows" &&
					(isLoadingShowsTab ? (
						<div className="flex flex-col items-center justify-center py-20">
							<Loader2
								className="h-5 w-5 animate-spin"
								style={{
									color: "rgba(255,184,0,0.4)",
									filter: "drop-shadow(0 0 8px rgba(255,184,0,0.3))",
								}}
							/>
							<span
								className="mt-3 font-mono-retro tracking-wider"
								style={{
									fontSize: "10px",
									letterSpacing: "3px",
									color: "rgba(255,184,0,0.25)",
									textTransform: "uppercase",
								}}
							>
								Loading shows...
							</span>
						</div>
					) : showsWithDetails.length === 0 ? (
						/* ── Empty State ──────────────────────────────────────────── */
						<div className="flex flex-col items-center py-20 text-center">
							{/* TV static icon area */}
							<div
								className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
								style={{
									background:
										"linear-gradient(145deg, rgba(255,184,0,0.06), rgba(255,184,0,0.01))",
									border: "1px solid rgba(255,184,0,0.15)",
									boxShadow:
										"0 0 40px rgba(255,184,0,0.05), inset 0 1px 0 rgba(255,184,0,0.08)",
								}}
							>
								<Tv
									className="h-8 w-8"
									style={{
										color: "rgba(255,184,0,0.35)",
										filter: "drop-shadow(0 0 10px rgba(255,184,0,0.3))",
										animation: "neon-flicker 3s ease-in-out infinite",
									}}
								/>
								{/* Decorative scanlines */}
								<div
									aria-hidden="true"
									className="pointer-events-none absolute inset-0 rounded-2xl opacity-30"
									style={{
										backgroundImage:
											"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,184,0,0.03) 3px, rgba(255,184,0,0.03) 4px)",
									}}
								/>
							</div>
							<p className="font-display text-base text-cream/50 mb-1.5">
								No shows tracked yet
							</p>
							<p className="text-xs text-cream/25 max-w-[300px] leading-relaxed">
								Start tracking a TV show to see your episode progress here.
								Visit any show page to begin.
							</p>
							<Link
								to="/app/search"
								search={{ q: "", type: "tv", sort: "relevance", page: 1 }}
								className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-mono-retro tracking-wider no-underline transition-all duration-300 hover:scale-[1.02]"
								style={{
									fontSize: "10px",
									letterSpacing: "3px",
									textTransform: "uppercase",
									color: "#FFB800",
									background:
										"linear-gradient(135deg, rgba(255,184,0,0.12), rgba(255,184,0,0.06))",
									border: "1px solid rgba(255,184,0,0.25)",
									boxShadow:
										"0 0 20px rgba(255,184,0,0.08), inset 0 1px 0 rgba(255,184,0,0.1)",
									textShadow: "0 0 10px rgba(255,184,0,0.4)",
								}}
							>
								<Search className="h-3 w-3" />
								Browse TV Shows
							</Link>
						</div>
					) : (
						<div className="space-y-8">
							{watching.length > 0 && (
								<section>
									{/* Section header */}
									<div className="mb-4 flex items-center gap-3">
										<div className="flex items-baseline gap-2.5">
											<h2
												className="font-mono-retro"
												style={{
													fontSize: "11px",
													letterSpacing: "4px",
													textTransform: "uppercase",
													color: "#FFB800",
													opacity: 0.7,
													textShadow: "0 0 12px rgba(255,184,0,0.25)",
												}}
											>
												Watching
											</h2>
											<span
												className="font-mono-retro"
												style={{
													fontSize: "10px",
													color: "rgba(255,184,0,0.4)",
													background: "rgba(255,184,0,0.08)",
													borderRadius: "9999px",
													padding: "2px 7px",
												}}
											>
												{watching.length}
											</span>
										</div>
										<div
											className="h-px flex-1"
											style={{
												background:
													"linear-gradient(90deg, rgba(255,184,0,0.2), rgba(255,184,0,0.04) 50%, transparent 80%)",
											}}
										/>
									</div>

									<div
										className={`grid gap-3 ${watching.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"}`}
									>
										{watching.map((show) => (
											<TrackerShowCard
												key={show.tmdbId}
												tmdbId={show.tmdbId}
												title={show.details.title}
												posterPath={show.details.posterPath}
												backdropPath={show.details.backdropPath}
												episodeCount={show.episodeCount}
												totalEpisodes={show.details.episodes ?? 0}
												totalRuntime={show.totalRuntime}
												showStatus={show.details.status}
												rating={null}
												genres={show.details.genres}
												year={show.details.year}
												contentRating={show.details.contentRating}
												seasonList={show.details.seasonList}
												onRemove={handleRemoveShow}
											/>
										))}
									</div>
								</section>
							)}

							{completed.length > 0 && (
								<section>
									<div className="mb-5 flex items-center gap-3">
										<div className="flex items-baseline gap-2.5">
											<h2
												className="font-mono-retro"
												style={{
													fontSize: "11px",
													letterSpacing: "4px",
													textTransform: "uppercase",
													color: "#FFB800",
													opacity: 0.7,
													textShadow: "0 0 12px rgba(255,184,0,0.25)",
												}}
											>
												Completed
											</h2>
											<span
												className="font-mono-retro"
												style={{
													fontSize: "10px",
													color: "rgba(255,184,0,0.4)",
													background: "rgba(255,184,0,0.08)",
													borderRadius: "9999px",
													padding: "2px 7px",
												}}
											>
												{completed.length}
											</span>
										</div>
										<div
											className="h-px flex-1"
											style={{
												background:
													"linear-gradient(90deg, rgba(255,184,0,0.2), rgba(255,184,0,0.04) 50%, transparent 80%)",
											}}
										/>
									</div>
									<div
										className={`grid gap-3 ${completed.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"}`}
									>
										{completed.map((show) => (
											<TrackerShowCard
												key={show.tmdbId}
												tmdbId={show.tmdbId}
												title={show.details.title}
												posterPath={show.details.posterPath}
												backdropPath={show.details.backdropPath}
												episodeCount={show.episodeCount}
												totalEpisodes={show.details.episodes ?? 0}
												totalRuntime={show.totalRuntime}
												showStatus={show.details.status}
												rating={null}
												genres={show.details.genres}
												year={show.details.year}
												contentRating={show.details.contentRating}
												seasonList={show.details.seasonList}
												onRemove={handleRemoveShow}
											/>
										))}
									</div>
								</section>
							)}
						</div>
					))}

				{/* ── Journal Tab ──────────────────────────────────────────────────── */}
				{activeTab === "journal" &&
					(isLoadingJournal ? (
						<div className="flex flex-col items-center justify-center py-20">
							<Loader2
								className="h-5 w-5 animate-spin"
								style={{
									color: "rgba(255,184,0,0.4)",
									filter: "drop-shadow(0 0 8px rgba(255,184,0,0.3))",
								}}
							/>
							<span
								className="mt-3 font-mono-retro tracking-wider"
								style={{
									fontSize: "10px",
									letterSpacing: "3px",
									color: "rgba(255,184,0,0.25)",
									textTransform: "uppercase",
								}}
							>
								Loading journal...
							</span>
						</div>
					) : journalEntries.length === 0 ? (
						<div className="flex flex-col items-center py-20 text-center">
							<div
								className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
								style={{
									background:
										"linear-gradient(145deg, rgba(255,184,0,0.06), rgba(255,184,0,0.01))",
									border: "1px solid rgba(255,184,0,0.15)",
									boxShadow:
										"0 0 40px rgba(255,184,0,0.05), inset 0 1px 0 rgba(255,184,0,0.08)",
								}}
							>
								<BookOpen
									className="h-8 w-8"
									style={{
										color: "rgba(255,184,0,0.35)",
										filter: "drop-shadow(0 0 10px rgba(255,184,0,0.3))",
									}}
								/>
							</div>
							<p className="font-display text-base text-cream/50 mb-1.5">
								No journal entries yet
							</p>
							<p className="text-xs text-cream/25 max-w-[300px] leading-relaxed">
								Write about episodes or seasons as you watch. Visit any show
								page to add your first entry.
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							{journalEntries.map((entry) => (
								<JournalEntryCard
									key={entry.id}
									entry={{
										...entry,
										createdAt: new Date(entry.createdAt),
									}}
								/>
							))}

							{hasNextPage && (
								<div className="pt-4 flex justify-center">
									<button
										type="button"
										onClick={() => fetchNextPage()}
										disabled={isFetchingNextPage}
										className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-mono-retro tracking-wider transition-all duration-300 disabled:opacity-40"
										style={{
											fontSize: "10px",
											letterSpacing: "3px",
											textTransform: "uppercase",
											color: "rgba(255,184,0,0.6)",
											background: "rgba(255,184,0,0.06)",
											border: "1px solid rgba(255,184,0,0.15)",
											boxShadow: "0 0 12px rgba(255,184,0,0.04)",
										}}
									>
										{isFetchingNextPage ? (
											<>
												<Loader2 className="h-3 w-3 animate-spin" />
												Loading...
											</>
										) : (
											"Load more"
										)}
									</button>
								</div>
							)}
						</div>
					))}
			</div>
		</div>
	);
}
