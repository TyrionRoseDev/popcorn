import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Loader2, Plus, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { CreateWatchlistDialog } from "#/components/watchlist/create-watchlist-dialog";
import { useTRPC } from "#/integrations/trpc/react";

interface AddToWatchlistDropdownProps {
	tmdbId: number;
	mediaType: "movie" | "tv";
	titleName?: string;
}

export function AddToWatchlistDropdown({
	tmdbId,
	mediaType,
	titleName,
}: AddToWatchlistDropdownProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	const { data: bookmarked } = useQuery(
		trpc.watchlist.isBookmarked.queryOptions({ tmdbId, mediaType }),
	);

	const { data: watchlists, isLoading } = useQuery(
		trpc.watchlist.getForDropdown.queryOptions(),
	);

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

	function handleCreatedWatchlist(watchlist: { id: string; name: string }) {
		addItemMutation.mutate(
			{ watchlistId: watchlist.id, tmdbId, mediaType, titleName },
			{
				onSuccess: () => {
					toast.success(`Added to ${watchlist.name}`);
					setOpen(false);
				},
			},
		);
	}

	function handleAddToWatchlist(watchlistId: string, watchlistName: string) {
		addItemMutation.mutate(
			{ watchlistId, tmdbId, mediaType, titleName },
			{
				onSuccess: () => {
					toast.success(`Added to ${watchlistName}`);
					setOpen(false);
				},
			},
		);
	}

	const isPending = addItemMutation.isPending;

	return (
		<>
		<Popover
			open={open}
			onOpenChange={setOpen}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={`rounded-full p-1.5 bg-black/60 transition-colors ${bookmarked ? "text-neon-amber" : "text-cream/70 hover:text-cream hover:bg-black/80"}`}
					title={bookmarked ? "In watchlist" : "Add to watchlist"}
				>
					<Bookmark className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"} />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={6}
				className="bg-drive-in-card border border-drive-in-border rounded-lg shadow-xl p-2 min-w-[200px] w-auto"
			>
				<p className="px-3 py-1.5 text-xs font-medium text-cream/40 uppercase tracking-wide">
					Add to Watchlist
				</p>

				{isLoading ? (
					<div className="flex items-center justify-center py-4">
						<Loader2 className="h-4 w-4 animate-spin text-cream/40" />
					</div>
				) : (
					<div className="flex flex-col">
						{watchlists?.map((wl) => (
							<button
								key={wl.id}
								type="button"
								disabled={isPending}
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

				{/* Divider */}
				<div className="my-1 h-px bg-cream/8" />

				<button
					type="button"
					onClick={() => {
						setOpen(false);
						setShowCreateDialog(true);
					}}
					className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-cream/5 text-sm text-cream/50 hover:text-cream cursor-pointer transition-colors"
				>
					<Plus className="h-3.5 w-3.5" />
					<span>Create New Watchlist</span>
				</button>
			</PopoverContent>
		</Popover>

		<CreateWatchlistDialog
			open={showCreateDialog}
			onOpenChange={setShowCreateDialog}
			onCreated={handleCreatedWatchlist}
		/>
		</>
	);
}
