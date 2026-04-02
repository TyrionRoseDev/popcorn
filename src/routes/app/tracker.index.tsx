import {
	useInfiniteQuery,
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Loader2, Tv } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { JournalEntryCard } from "#/components/tracker/journal-entry-card";
import { TrackerShowCard } from "#/components/tracker/tracker-show-card";
import { useTRPC } from "#/integrations/trpc/react";

export const Route = createFileRoute("/app/tracker/")({
	component: TrackerDashboard,
});

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

	return (
		<div className="mx-auto max-w-3xl px-4 py-8">
			{/* Header */}
			<div className="mb-6">
				<h1 className="font-display text-2xl text-cream tracking-wide">
					Tracker
				</h1>
			</div>

			{/* Tab bar */}
			<div className="mb-6 flex items-center gap-1 border-b border-cream/8">
				<button
					type="button"
					onClick={() => setActiveTab("shows")}
					className="relative px-4 py-2.5 text-sm font-mono-retro tracking-wider transition-colors"
					style={{
						color:
							activeTab === "shows"
								? "rgba(0,229,255,1)"
								: "rgba(255,255,240,0.3)",
					}}
				>
					My Shows
					{activeTab === "shows" && (
						<span
							className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-neon-cyan"
							style={{ boxShadow: "0 0 8px rgba(0,229,255,0.4)" }}
						/>
					)}
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("journal")}
					className="relative px-4 py-2.5 text-sm font-mono-retro tracking-wider transition-colors"
					style={{
						color:
							activeTab === "journal"
								? "rgba(0,229,255,1)"
								: "rgba(255,255,240,0.3)",
					}}
				>
					Journal
					{activeTab === "journal" && (
						<span
							className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-neon-cyan"
							style={{ boxShadow: "0 0 8px rgba(0,229,255,0.4)" }}
						/>
					)}
				</button>
			</div>

			{/* ── Shows Tab ────────────────────────────────────────────────────── */}
			{activeTab === "shows" &&
				(isLoadingShowsTab ? (
					<div className="flex justify-center py-16">
						<Loader2 className="h-5 w-5 animate-spin text-cream/30" />
					</div>
				) : showsWithDetails.length === 0 ? (
					<div className="flex flex-col items-center py-16 text-center">
						<div
							className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
							style={{
								background:
									"linear-gradient(145deg, rgba(0,229,255,0.08), rgba(0,229,255,0.02))",
								border: "1px solid rgba(0,229,255,0.1)",
							}}
						>
							<Tv className="h-7 w-7 text-neon-cyan/40" />
						</div>
						<p className="text-sm text-cream/40 font-medium mb-1">
							No shows tracked yet
						</p>
						<p className="text-xs text-cream/25 max-w-[280px]">
							Start tracking a TV show to see your episode progress here. Visit
							any show page to begin.
						</p>
						<Link
							to="/app/search"
							search={{ q: "", type: "tv", sort: "relevance", page: 1 }}
							className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-neon-cyan/10 px-4 py-2 text-xs font-mono-retro tracking-wider text-neon-cyan no-underline transition-colors hover:bg-neon-cyan/15"
							style={{ textShadow: "0 0 8px rgba(0,229,255,0.3)" }}
						>
							Browse TV Shows
						</Link>
					</div>
				) : (
					<div className="space-y-8">
						{watching.length > 0 && (
							<section>
								<div className="mb-3 flex items-center gap-2">
									<h2 className="text-xs font-mono-retro tracking-[2px] uppercase text-cream/35">
										Watching
									</h2>
									<span className="text-[10px] font-mono-retro text-cream/20">
										{watching.length}
									</span>
									<div
										className="ml-2 h-px flex-1"
										style={{
											background:
												"linear-gradient(90deg, rgba(255,255,240,0.06), transparent 60%)",
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
								<div className="mb-3 flex items-center gap-2">
									<h2 className="text-xs font-mono-retro tracking-[2px] uppercase text-neon-amber/50">
										Completed
									</h2>
									<span className="text-[10px] font-mono-retro text-cream/20">
										{completed.length}
									</span>
									<div
										className="ml-2 h-px flex-1"
										style={{
											background:
												"linear-gradient(90deg, rgba(255,184,0,0.1), transparent 60%)",
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
					<div className="flex justify-center py-16">
						<Loader2 className="h-5 w-5 animate-spin text-cream/30" />
					</div>
				) : journalEntries.length === 0 ? (
					<div className="flex flex-col items-center py-16 text-center">
						<div
							className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
							style={{
								background:
									"linear-gradient(145deg, rgba(0,229,255,0.08), rgba(0,229,255,0.02))",
								border: "1px solid rgba(0,229,255,0.1)",
							}}
						>
							<BookOpen className="h-7 w-7 text-neon-cyan/40" />
						</div>
						<p className="text-sm text-cream/40 font-medium mb-1">
							No journal entries yet
						</p>
						<p className="text-xs text-cream/25 max-w-[280px]">
							Write about episodes or seasons as you watch. Visit any show page
							to add your first entry.
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
							<div className="pt-2 flex justify-center">
								<button
									type="button"
									onClick={() => fetchNextPage()}
									disabled={isFetchingNextPage}
									className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan/8 px-5 py-2.5 text-xs font-mono-retro tracking-wider text-neon-cyan/70 transition-colors hover:bg-neon-cyan/12 hover:text-neon-cyan disabled:opacity-40"
								>
									{isFetchingNextPage ? (
										<>
											<Loader2 className="h-3 w-3 animate-spin" />
											Loading…
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
	);
}
