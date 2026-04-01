import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Send, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ArcadeButton } from "#/components/title/arcade-button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { RecommendModal } from "#/components/watched/recommend-modal";
import { ReviewModal } from "#/components/watched/review-modal";
import { CreateWatchlistDialog } from "#/components/watchlist/create-watchlist-dialog";
import { useTRPC } from "#/integrations/trpc/react";

interface TitleActionsProps {
	tmdbId: number;
	mediaType: "movie" | "tv";
	title: string;
	posterPath: string | null;
	runtime: number | null;
	year: string;
}

export function TitleActions({
	tmdbId,
	mediaType,
	title,
	posterPath,
	runtime,
	year,
}: TitleActionsProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [watchlistOpen, setWatchlistOpen] = useState(false);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [inviteOpen, setInviteOpen] = useState(false);
	const [reviewOpen, setReviewOpen] = useState(false);

	// Queries
	const { data: watchlists, isLoading: watchlistsLoading } = useQuery(
		trpc.watchlist.getForDropdown.queryOptions(),
	);

	const { data: isWatched } = useQuery(
		trpc.watchlist.isWatched.queryOptions({ tmdbId, mediaType }),
	);

	const { data: latestRating } = useQuery(
		trpc.watchEvent.getLatestRating.queryOptions({ tmdbId, mediaType }),
	);

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
						setReviewOpen(true);
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

	function handleWatched() {
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
							<ArcadeButton icon={Plus} label="Watchlist" color="pink" />
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
					active={isWatched === true}
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

			<CreateWatchlistDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				onCreated={handleCreatedWatchlist}
			/>

			<ReviewModal
				open={reviewOpen}
				onOpenChange={setReviewOpen}
				titleName={title}
				year={year}
				tmdbId={tmdbId}
				mediaType={mediaType}
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
