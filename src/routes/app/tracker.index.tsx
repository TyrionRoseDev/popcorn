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
			status?: string;
			episodes?: number;
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
						"radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,229,255,0.06), transparent 60%), radial-gradient(ellipse 60% 40% at 80% 10%, rgba(255,45,120,0.03), transparent 50%)",
				}}
			/>

			<div className="relative z-10">
				{/* ── Marquee Header ─────────────────────────────────────────────── */}
				<div className="mb-8">
					<h1
						className="font-display text-3xl tracking-wide text-cream"
						style={{
							textShadow:
								"0 0 20px rgba(0,229,255,0.25), 0 0 60px rgba(0,229,255,0.08)",
							animation: "neon-flicker 4s ease-in-out infinite",
						}}
					>
						Tracker
					</h1>

					{/* Stats ribbon */}
					{!isLoadingShowsTab && totalShows > 0 && (
						<div className="mt-2.5 flex items-center gap-4">
							<span className="inline-flex items-center gap-1.5 text-xs font-mono-retro tracking-wide text-cream/30">
								<Film className="h-3 w-3 text-cream/20" />
								{totalShows} {totalShows === 1 ? "show" : "shows"}
							</span>
							{totalWatchtime > 0 && (
								<>
									<span className="text-cream/10">|</span>
									<span className="inline-flex items-center gap-1.5 text-xs font-mono-retro tracking-wide text-cream/30">
										<Clock className="h-3 w-3 text-cream/20" />
										{formatRuntime(totalWatchtime)} watched
									</span>
								</>
							)}
						</div>
					)}
				</div>

				{/* ── Tab Bar ────────────────────────────────────────────────────── */}
				<div
					className="mb-8 flex items-center gap-1 rounded-xl p-1"
					style={{
						background: "rgba(255,255,240,0.03)",
						border: "1px solid rgba(255,255,240,0.05)",
					}}
				>
					{tabs.map((tab) => {
						const isActive = activeTab === tab.id;
						const Icon = tab.icon;
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className="relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-mono-retro tracking-wider transition-all duration-300"
								style={{
									color: isActive
										? "rgba(0,229,255,1)"
										: "rgba(255,255,240,0.3)",
									background: isActive ? "rgba(0,229,255,0.08)" : "transparent",
									boxShadow: isActive
										? "0 0 16px rgba(0,229,255,0.08), inset 0 1px 0 rgba(0,229,255,0.1)"
										: "none",
									textShadow: isActive
										? "0 0 12px rgba(0,229,255,0.4)"
										: "none",
								}}
							>
								<Icon
									className="h-3.5 w-3.5"
									style={{ opacity: isActive ? 1 : 0.5 }}
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
								className="h-5 w-5 animate-spin text-neon-cyan/40"
								style={{
									filter: "drop-shadow(0 0 8px rgba(0,229,255,0.3))",
								}}
							/>
							<span className="mt-3 text-xs font-mono-retro text-cream/20 tracking-wider">
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
										"linear-gradient(145deg, rgba(0,229,255,0.06), rgba(0,229,255,0.01))",
									border: "1px solid rgba(0,229,255,0.1)",
									boxShadow:
										"0 0 40px rgba(0,229,255,0.05), inset 0 1px 0 rgba(0,229,255,0.08)",
								}}
							>
								<Tv
									className="h-8 w-8 text-neon-cyan/30"
									style={{
										filter: "drop-shadow(0 0 10px rgba(0,229,255,0.3))",
										animation: "neon-flicker 3s ease-in-out infinite",
									}}
								/>
								{/* Decorative scanlines */}
								<div
									aria-hidden="true"
									className="pointer-events-none absolute inset-0 rounded-2xl opacity-30"
									style={{
										backgroundImage:
											"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,229,255,0.03) 3px, rgba(0,229,255,0.03) 4px)",
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
								className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-mono-retro tracking-wider text-neon-cyan no-underline transition-all duration-300 hover:scale-[1.02]"
								style={{
									background:
										"linear-gradient(135deg, rgba(0,229,255,0.12), rgba(0,229,255,0.06))",
									border: "1px solid rgba(0,229,255,0.2)",
									boxShadow:
										"0 0 20px rgba(0,229,255,0.08), inset 0 1px 0 rgba(0,229,255,0.1)",
									textShadow: "0 0 10px rgba(0,229,255,0.4)",
								}}
							>
								<Search className="h-3 w-3" />
								Browse TV Shows
							</Link>
						</div>
					) : (
						<div className="space-y-10">
							{watching.length > 0 && (
								<section>
									{/* Section header */}
									<div className="mb-4 flex items-center gap-3">
										<div className="flex items-baseline gap-2">
											<h2
												className="text-[11px] font-mono-retro tracking-[3px] uppercase text-neon-cyan/60"
												style={{
													textShadow: "0 0 10px rgba(0,229,255,0.2)",
												}}
											>
												Watching
											</h2>
											<span
												className="rounded-full px-1.5 py-0.5 text-[10px] font-mono-retro text-neon-cyan/50"
												style={{
													background: "rgba(0,229,255,0.08)",
												}}
											>
												{watching.length}
											</span>
										</div>
										<div
											className="h-px flex-1"
											style={{
												background:
													"linear-gradient(90deg, rgba(0,229,255,0.15), rgba(0,229,255,0.04) 40%, transparent 80%)",
											}}
										/>
									</div>
									<div className="grid gap-3 sm:grid-cols-2">
										{watching.map((show) => (
											<TrackerShowCard
												key={show.tmdbId}
												tmdbId={show.tmdbId}
												title={show.details.title}
												posterPath={show.details.posterPath}
												episodeCount={show.episodeCount}
												totalEpisodes={show.details.episodes ?? 0}
												totalRuntime={show.totalRuntime}
												showStatus={show.details.status}
												rating={null}
												onRemove={handleRemoveShow}
											/>
										))}
									</div>
								</section>
							)}

							{completed.length > 0 && (
								<section>
									<div className="mb-4 flex items-center gap-3">
										<div className="flex items-baseline gap-2">
											<h2
												className="text-[11px] font-mono-retro tracking-[3px] uppercase text-neon-amber/60"
												style={{
													textShadow: "0 0 10px rgba(255,184,0,0.2)",
												}}
											>
												Completed
											</h2>
											<span
												className="rounded-full px-1.5 py-0.5 text-[10px] font-mono-retro text-neon-amber/50"
												style={{
													background: "rgba(255,184,0,0.08)",
												}}
											>
												{completed.length}
											</span>
										</div>
										<div
											className="h-px flex-1"
											style={{
												background:
													"linear-gradient(90deg, rgba(255,184,0,0.15), rgba(255,184,0,0.04) 40%, transparent 80%)",
											}}
										/>
									</div>
									<div className="grid gap-3 sm:grid-cols-2">
										{completed.map((show) => (
											<TrackerShowCard
												key={show.tmdbId}
												tmdbId={show.tmdbId}
												title={show.details.title}
												posterPath={show.details.posterPath}
												episodeCount={show.episodeCount}
												totalEpisodes={show.details.episodes ?? 0}
												totalRuntime={show.totalRuntime}
												showStatus={show.details.status}
												rating={null}
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
								className="h-5 w-5 animate-spin text-neon-cyan/40"
								style={{
									filter: "drop-shadow(0 0 8px rgba(0,229,255,0.3))",
								}}
							/>
							<span className="mt-3 text-xs font-mono-retro text-cream/20 tracking-wider">
								Loading journal...
							</span>
						</div>
					) : journalEntries.length === 0 ? (
						<div className="flex flex-col items-center py-20 text-center">
							<div
								className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
								style={{
									background:
										"linear-gradient(145deg, rgba(0,229,255,0.06), rgba(0,229,255,0.01))",
									border: "1px solid rgba(0,229,255,0.1)",
									boxShadow:
										"0 0 40px rgba(0,229,255,0.05), inset 0 1px 0 rgba(0,229,255,0.08)",
								}}
							>
								<BookOpen
									className="h-8 w-8 text-neon-cyan/30"
									style={{
										filter: "drop-shadow(0 0 10px rgba(0,229,255,0.3))",
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
										className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-mono-retro tracking-wider text-neon-cyan/70 transition-all duration-300 hover:text-neon-cyan disabled:opacity-40"
										style={{
											background: "rgba(0,229,255,0.06)",
											border: "1px solid rgba(0,229,255,0.1)",
											boxShadow: "0 0 12px rgba(0,229,255,0.04)",
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
