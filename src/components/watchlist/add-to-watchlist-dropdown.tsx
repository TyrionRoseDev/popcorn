import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Loader2, Plus, Star } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { useTRPC } from "#/integrations/trpc/react";

interface AddToWatchlistDropdownProps {
	tmdbId: number;
	mediaType: "movie" | "tv";
}

export function AddToWatchlistDropdown({
	tmdbId,
	mediaType,
}: AddToWatchlistDropdownProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [showCreateInput, setShowCreateInput] = useState(false);
	const [newName, setNewName] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

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
			},
		}),
	);

	const createMutation = useMutation(
		trpc.watchlist.create.mutationOptions({
			onSuccess: async (newWatchlist) => {
				await queryClient.invalidateQueries(
					trpc.watchlist.getForDropdown.queryFilter(),
				);
				await queryClient.invalidateQueries(
					trpc.watchlist.list.queryFilter(),
				);
				addItemMutation.mutate(
					{
						watchlistId: newWatchlist.id,
						tmdbId,
						mediaType,
					},
					{
						onSuccess: () => {
							toast.success(`Added to ${newWatchlist.name}`);
							setNewName("");
							setShowCreateInput(false);
							setOpen(false);
						},
					},
				);
			},
		}),
	);

	function handleAddToWatchlist(watchlistId: string, watchlistName: string) {
		addItemMutation.mutate(
			{ watchlistId, tmdbId, mediaType },
			{
				onSuccess: () => {
					toast.success(`Added to ${watchlistName}`);
					setOpen(false);
				},
			},
		);
	}

	function handleCreateAndAdd() {
		const trimmed = newName.trim();
		if (!trimmed) return;
		createMutation.mutate({ name: trimmed });
	}

	function handleCreateKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			handleCreateAndAdd();
		}
		if (e.key === "Escape") {
			e.preventDefault();
			setShowCreateInput(false);
			setNewName("");
		}
	}

	const isPending = addItemMutation.isPending || createMutation.isPending;

	return (
		<Popover
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) {
					setShowCreateInput(false);
					setNewName("");
				}
			}}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="rounded-full p-1.5 bg-black/60 text-cream/70 hover:text-cream hover:bg-black/80 transition-colors"
					title="Add to watchlist"
				>
					<Bookmark className="h-4 w-4" />
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
								{wl.isDefault && (
									<Star className="h-3 w-3 text-neon-amber shrink-0" />
								)}
								<span className="truncate">{wl.name}</span>
							</button>
						))}
					</div>
				)}

				{/* Divider */}
				<div className="my-1 h-px bg-cream/8" />

				{showCreateInput ? (
					<div className="px-2 py-1.5">
						<input
							ref={inputRef}
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							onKeyDown={handleCreateKeyDown}
							placeholder="Watchlist name..."
							disabled={isPending}
							autoFocus
							className="w-full bg-cream/5 border border-cream/12 rounded-md px-2 py-1 text-sm text-cream placeholder:text-cream/30 outline-none focus:border-neon-amber/40 disabled:opacity-50"
						/>
					</div>
				) : (
					<button
						type="button"
						onClick={() => {
							setShowCreateInput(true);
							setTimeout(() => inputRef.current?.focus(), 0);
						}}
						className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-cream/5 text-sm text-cream/50 hover:text-cream cursor-pointer transition-colors"
					>
						<Plus className="h-3.5 w-3.5" />
						<span>Create New Watchlist</span>
					</button>
				)}
			</PopoverContent>
		</Popover>
	);
}
