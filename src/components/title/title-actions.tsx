import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Plus, Send, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArcadeButton } from "#/components/title/arcade-button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { RecommendModal } from "#/components/watched/recommend-modal";
import { ReviewModal } from "#/components/watched/review-modal";
import { WatchEventCard } from "#/components/watched/watch-event-card";
import { CreateWatchlistDialog } from "#/components/watchlist/create-watchlist-dialog";
import { WatchlistRemovalDialog } from "#/components/watchlist/watchlist-removal-dialog";
import { useTRPC } from "#/integrations/trpc/react";

interface TitleActionsProps {
	tmdbId: number;
	mediaType: "movie" | "tv";
	title: string;
	posterPath: string | null;
	runtime: number | null;
	year: string;
	reviewEventId?: string;
	seasonList?: Array<{
		seasonNumber: number;
		episodeCount: number;
		name: string;
	}>;
	status?: string;
}

export function TitleActions({
	tmdbId,
	mediaType,
	title,
	posterPath,
	runtime,
	year,
	reviewEventId,
	status,
}: TitleActionsProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const navigate = useNavigate({
		from: "/app/title/$mediaType/$tmdbId",
	});

	const [watchlistOpen, setWatchlistOpen] = useState(false);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [inviteOpen, setInviteOpen] = useState(false);
	const [reviewOpen, setReviewOpen] = useState(false);
	const [removalDialogOpen, setRemovalDialogOpen] = useState(false);
	const [removalWatchlists, setRemovalWatchlists] = useState<
		Array<{
			watchlistId: string;
			watchlistName: string;
			watchlistType: string;
		}>
	>([]);
	const [editEvent, setEditEvent] = useState<
		| {
				id: string;
				rating: number | null;
				note: string | null;
				watchedAt: string;
				companions: Array<{ friendId?: string; name: string }>;
				visibility: "public" | "companion" | "private";
		  }
		| undefined
	>(undefined);
	const [pendingRemovalCheck, setPendingRemovalCheck] = useState(false);

	// Queries
	const { data: watchlists, isLoading: watchlistsLoading } = useQuery(
		trpc.watchlist.getForDropdown.queryOptions(),
	);

	const { data: isWatched } = useQuery(
		trpc.watchlist.isWatched.queryOptions({ tmdbId, mediaType }),
	);

	const { data: isBookmarked } = useQuery(
		trpc.watchlist.isBookmarked.queryOptions({ tmdbId, mediaType }),
	);

	const { data: latestRating } = useQuery(
		trpc.watchEvent.getLatestRating.queryOptions({ tmdbId, mediaType }),
	);

	const { data: watchEvents } = useQuery(
		trpc.watchEvent.getForTitle.queryOptions({ tmdbId, mediaType }),
	);

	// Auto-open review modal from reminder notification
	useEffect(() => {
		if (!reviewEventId || !watchEvents) return;
		const event = watchEvents.find((e) => e.id === reviewEventId);
		if (!event) return;

		setEditEvent({
			id: event.id,
			rating: event.rating,
			note: event.note,
			watchedAt: event.watchedAt ? new Date(event.watchedAt).toISOString() : "",
			companions: event.companions.map((c) => ({
				friendId: c.friendId ?? undefined,
				name: c.name,
			})),
			visibility: event.visibility ?? "public",
		});
		setReviewOpen(true);

		// Clear the search param
		navigate({
			search: (prev) => ({ ...prev, reviewEventId: undefined }),
			replace: true,
		});
	}, [reviewEventId, watchEvents, navigate]);

	// Mutations
	const addItemMutation = useMutation(
		trpc.watchlist.addItem.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.watchlist.getForDropdown.queryFilter(),
				);
				queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
				queryClient.invalidateQueries(
					trpc.watchlist.isBookmarked.queryFilter(),
				);
			},
		}),
	);

	const quickWatchedMutation = useMutation(
		trpc.watchlist.quickMarkWatched.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries(trpc.watchlist.isWatched.queryFilter());
				queryClient.invalidateQueries(
					trpc.watchlist.isBookmarked.queryFilter(),
				);
				queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
				queryClient.invalidateQueries(trpc.friend.profile.queryFilter());
				queryClient.invalidateQueries(
					trpc.watchEvent.getForTitle.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.watchEvent.getLatestRating.queryFilter(),
				);
				queryClient.invalidateQueries(trpc.watchEvent.getFeed.queryFilter());
				if (data.watched) {
					toast.success("Marked as watched");
					if (latestRating === null) {
						setPendingRemovalCheck(true);
						setReviewOpen(true);
					} else {
						triggerWatchlistRemoval();
					}
				} else {
					toast.success("Removed from watched");
				}
			},
			onError: () => {
				toast.error("Failed to update watched status");
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
		// Don't prompt removal for TV shows still airing
		if (
			mediaType === "tv" &&
			status &&
			status !== "Ended" &&
			status !== "Canceled"
		) {
			return;
		}

		const client = trpc.watchlist.getWatchlistsForTitle;
		queryClient
			.fetchQuery(client.queryOptions({ tmdbId, mediaType }))
			.then((wls) => {
				if (wls.length === 0) return;
				if (wls.length === 1) {
					// Auto-remove from the single watchlist
					removeItemMutation.mutate(
						{
							watchlistId: wls[0].watchlistId,
							tmdbId,
							mediaType,
						},
						{
							onSuccess: () =>
								toast.success(`Removed from ${wls[0].watchlistName}`),
						},
					);
				} else {
					// Multiple watchlists — show selection dialog
					setRemovalWatchlists(wls);
					setRemovalDialogOpen(true);
				}
			});
	}

	function handleAddToWatchlist(watchlistId: string, watchlistName: string) {
		addItemMutation.mutate(
			{ watchlistId, tmdbId, mediaType, titleName: title, posterPath },
			{
				onSuccess: () => {
					toast.success(`Added to ${watchlistName}`);
					setWatchlistOpen(false);
				},
			},
		);
	}

	function handleCreatedWatchlist(wl: { id: string; name: string }) {
		addItemMutation.mutate(
			{
				watchlistId: wl.id,
				tmdbId,
				mediaType,
				titleName: title,
				posterPath,
			},
			{
				onSuccess: () => {
					toast.success(`Added to ${wl.name}`);
					setWatchlistOpen(false);
				},
			},
		);
	}

	const addToTracker = useMutation(
		trpc.episodeTracker.addShow.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.episodeTracker.getTrackedShows.queryFilter(),
				);
			},
		}),
	);

	function handleWatched() {
		// For TV shows, add to tracker and redirect
		if (mediaType === "tv") {
			addToTracker.mutate(
				{ tmdbId },
				{
					onSuccess: () => {
						navigate({
							to: "/app/tracker/$tmdbId",
							params: { tmdbId: String(tmdbId) },
						});
					},
					onError: () => {
						toast.error("Failed to add show to tracker");
					},
				},
			);
			return;
		}

		// Movies: use existing quick toggle
		quickWatchedMutation.mutate({
			tmdbId,
			mediaType,
			titleName: title,
			posterPath,
			runtime: runtime ?? undefined,
		});
	}

	return (
		<>
			<div className="flex gap-4 justify-center mt-5">
				{/* Watchlist */}
				<Popover open={watchlistOpen} onOpenChange={setWatchlistOpen}>
					<PopoverTrigger asChild>
						<div>
							<ArcadeButton
								icon={Plus}
								label="Watchlist"
								color="pink"
								active={!!isBookmarked}
							/>
						</div>
					</PopoverTrigger>
					<PopoverContent
						align="center"
						sideOffset={8}
						className="bg-drive-in-card border border-drive-in-border rounded-lg shadow-xl p-2 min-w-[200px] w-auto"
					>
						<p className="px-3 py-1.5 text-xs font-medium text-cream/40 uppercase tracking-wide">
							Add to Watchlist
						</p>

						{watchlistsLoading ? (
							<div className="flex items-center justify-center py-4">
								<Loader2 className="h-4 w-4 animate-spin text-cream/40" />
							</div>
						) : (
							<div className="flex flex-col">
								{watchlists?.map((wl) => (
									<button
										key={wl.id}
										type="button"
										disabled={addItemMutation.isPending}
										onClick={() => handleAddToWatchlist(wl.id, wl.name)}
										className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-cream/5 text-sm text-cream/70 hover:text-cream cursor-pointer text-left transition-colors disabled:opacity-50"
									>
										{wl.type === "default" && (
											<Star className="h-3 w-3 text-neon-amber shrink-0" />
										)}
										<span className="truncate">{wl.name}</span>
									</button>
								))}
							</div>
						)}

						<div className="my-1 h-px bg-cream/8" />

						<button
							type="button"
							onClick={() => {
								setWatchlistOpen(false);
								setShowCreateDialog(true);
							}}
							className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-cream/5 text-sm text-cream/50 hover:text-cream cursor-pointer transition-colors"
						>
							<Plus className="h-3.5 w-3.5" />
							<span>Create New Watchlist</span>
						</button>
					</PopoverContent>
				</Popover>

				{/* Watched */}
				<ArcadeButton
					icon={Check}
					label="Watched"
					color="cyan"
					active={!!isWatched}
					onClick={handleWatched}
				/>

				{/* Invite */}
				<ArcadeButton
					icon={Send}
					label="Invite"
					color="amber"
					onClick={() => setInviteOpen(true)}
				/>
			</div>

			{watchEvents && watchEvents.length > 0 && (
				<div className="mt-6 mx-auto max-w-sm">
					<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-3 text-center">
						Your Watch History
					</div>
					<div className="relative">
						<div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto scrollbar-amber pr-2">
							{watchEvents.map((event) => (
								<WatchEventCard
									key={event.id}
									event={event}
									isOwn={true}
									onEdit={(e) => {
										setEditEvent(e);
										setReviewOpen(true);
									}}
								/>
							))}
						</div>
						{/* Bottom fade hint — always present, invisible when not scrollable */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 rounded-b-[10px]"
							style={{
								background:
									"linear-gradient(to bottom, transparent, rgba(5,5,8,0.9))",
							}}
						/>
					</div>
				</div>
			)}

			<CreateWatchlistDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				onCreated={handleCreatedWatchlist}
			/>

			<ReviewModal
				open={reviewOpen}
				onOpenChange={(open) => {
					setReviewOpen(open);
					if (!open) {
						setEditEvent(undefined);
						if (pendingRemovalCheck) {
							setPendingRemovalCheck(false);
							triggerWatchlistRemoval();
						}
					}
				}}
				titleName={title}
				year={year}
				tmdbId={tmdbId}
				mediaType={mediaType}
				editEvent={editEvent}
			/>

			<WatchlistRemovalDialog
				open={removalDialogOpen}
				onOpenChange={setRemovalDialogOpen}
				tmdbId={tmdbId}
				mediaType={mediaType}
				titleName={title}
				watchlists={removalWatchlists}
			/>

			<RecommendModal
				open={inviteOpen}
				onOpenChange={setInviteOpen}
				tmdbId={tmdbId}
				mediaType={mediaType}
				titleName={title}
			/>
		</>
	);
}
