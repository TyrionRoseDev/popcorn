import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ListX, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";

interface WatchlistEntry {
	watchlistId: string;
	watchlistName: string;
	watchlistType: string;
}

interface WatchlistRemovalDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	mediaType: "movie" | "tv";
	titleName: string;
	watchlists: WatchlistEntry[];
	/** Called after removal completes (or user decides to keep) */
	onDone?: () => void;
}

export function WatchlistRemovalDialog({
	open,
	onOpenChange,
	tmdbId,
	mediaType,
	titleName,
	watchlists,
	onDone,
}: WatchlistRemovalDialogProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const keepInWatchlist = useMutation(
		trpc.watchlist.keepInWatchlist.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
				queryClient.invalidateQueries(trpc.watchlist.get.queryFilter());
			},
		}),
	);

	const removeFromMultiple = useMutation(
		trpc.watchlist.removeFromMultipleWatchlists.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
				queryClient.invalidateQueries(trpc.watchlist.get.queryFilter());
				queryClient.invalidateQueries(
					trpc.watchlist.isBookmarked.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.watchlist.getWatchlistsForTitle.queryFilter(),
				);
			},
		}),
	);

	function toggleWatchlist(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function handleRemoveSelected() {
		if (selected.size === 0) return;
		removeFromMultiple.mutate(
			{ watchlistIds: Array.from(selected), tmdbId, mediaType },
			{
				onSuccess: () => {
					const remaining = watchlists.length - selected.size;
					if (remaining > 0) {
						keepInWatchlist.mutate(
							{ tmdbId, mediaType },
							{
								onSuccess: () => {
									toast.success(
										`Removed from ${selected.size} watchlist${selected.size > 1 ? "s" : ""}`,
									);
									setSelected(new Set());
									onOpenChange(false);
								},
								onError: () => {
									toast.error("Failed to keep in remaining watchlists");
								},
							},
						);
					} else {
						toast.success(
							`Removed from ${selected.size} watchlist${selected.size > 1 ? "s" : ""}`,
						);
						setSelected(new Set());
						onOpenChange(false);
					}
				},
			},
		);
	}

	function handleRemoveAll() {
		const allIds = watchlists.map((w) => w.watchlistId);
		removeFromMultiple.mutate(
			{ watchlistIds: allIds, tmdbId, mediaType },
			{
				onSuccess: () => {
					toast.success("Removed from all watchlists");
					setSelected(new Set());
					onOpenChange(false);
				},
			},
		);
	}

	function handleKeepAll() {
		keepInWatchlist.mutate(
			{ tmdbId, mediaType },
			{
				onSuccess: () => {
					setSelected(new Set());
					onOpenChange(false);
				},
				onError: () => {
					toast.error("Failed to keep in watchlists");
				},
			},
		);
	}

	const isPending = removeFromMultiple.isPending || keepInWatchlist.isPending;

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) {
					setSelected(new Set());
					onDone?.();
				}
				onOpenChange(v);
			}}
		>
			<DialogPortal>
				<DialogOverlay />
				<DialogPrimitive.Content
					asChild
					aria-describedby={undefined}
					aria-label={`Remove ${titleName} from watchlists`}
				>
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="w-full max-w-[360px] flex flex-col items-center">
							{/* Marquee header */}
							<div className="w-[calc(100%-16px)] border-2 border-neon-pink/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(255,45,120,0.08)] relative">
								<button
									type="button"
									onClick={handleKeepAll}
									className="absolute top-2.5 right-3 p-1 text-cream/25 hover:text-cream/60 transition-colors duration-200"
								>
									<X className="w-4 h-4" />
								</button>
								<div className="flex justify-center gap-3 mb-1.5">
									{Array.from({ length: 8 }).map((_, i) => (
										<div
											key={`dot-${i.toString()}`}
											className="w-1.5 h-1.5 rounded-full bg-neon-pink shadow-[0_0_4px_1px_rgba(255,45,120,0.6)] animate-[chase_1.2s_infinite]"
											style={{ animationDelay: `${i * 0.15}s` }}
										/>
									))}
								</div>
								<div className="font-display text-xl text-cream tracking-wide">
									Remove from Watchlists?
								</div>
								<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-neon-pink/55 mt-0.5 truncate">
									{titleName}
								</div>
							</div>

							{/* Card body */}
							<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
								<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-pink/80 to-transparent shadow-[0_0_10px_rgba(255,45,120,0.4)]" />

								<div className="p-5 flex flex-col gap-4 relative">
									<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-1">
										This film is in {watchlists.length} watchlists
									</div>

									{/* Watchlist list */}
									<div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto scrollbar-amber pr-1">
										{watchlists.map((wl) => {
											const isSelected = selected.has(wl.watchlistId);
											return (
												<button
													key={wl.watchlistId}
													type="button"
													onClick={() => toggleWatchlist(wl.watchlistId)}
													disabled={isPending}
													className={`flex items-center gap-3 px-3.5 py-2.5 rounded-md border transition-all duration-200 text-left ${
														isSelected
															? "border-neon-pink/40 bg-neon-pink/[0.08] shadow-[0_0_12px_rgba(255,45,120,0.06)]"
															: "border-cream/[0.06] bg-black/20 hover:border-cream/15"
													}`}
												>
													<div
														className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
															isSelected
																? "border-neon-pink bg-neon-pink/20"
																: "border-cream/20 bg-transparent"
														}`}
													>
														{isSelected && (
															<Check className="w-3 h-3 text-neon-pink" />
														)}
													</div>
													<span
														className={`text-sm font-semibold truncate transition-colors ${
															isSelected ? "text-cream" : "text-cream/60"
														}`}
													>
														{wl.watchlistName}
													</span>
													{wl.watchlistType === "default" && (
														<span className="ml-auto font-mono-retro text-[9px] tracking-wider uppercase text-neon-amber/40 shrink-0">
															default
														</span>
													)}
												</button>
											);
										})}
									</div>

									<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

									{/* Remove selected */}
									<button
										type="button"
										onClick={handleRemoveSelected}
										disabled={isPending || selected.size === 0}
										className="w-full py-2.5 px-5 bg-neon-pink/[0.08] border-2 border-neon-pink/35 rounded-lg font-display text-sm tracking-widest text-neon-pink text-center shadow-[0_4px_0_rgba(255,45,120,0.15),0_0_16px_rgba(255,45,120,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(255,45,120,0.15),0_0_24px_rgba(255,45,120,0.15)] transition-all duration-200 disabled:opacity-30 disabled:cursor-default disabled:hover:translate-y-0"
									>
										{selected.size > 0
											? `Remove from ${selected.size} selected`
											: "Select watchlists above"}
									</button>

									{/* Bottom actions */}
									<div className="flex justify-center items-center gap-3">
										<button
											type="button"
											onClick={handleRemoveAll}
											disabled={isPending}
											className="flex items-center gap-1.5 font-mono-retro text-[10px] tracking-[2px] uppercase text-neon-pink/40 hover:text-neon-pink/70 transition-colors duration-200 py-1.5"
										>
											<ListX className="w-3.5 h-3.5" />
											remove from all
										</button>
										<span className="text-cream/15 text-[10px]">·</span>
										<button
											type="button"
											onClick={handleKeepAll}
											disabled={isPending}
											className="font-mono-retro text-[10px] tracking-[2px] uppercase text-cream/25 hover:text-cream/50 transition-colors duration-200 py-1.5"
										>
											keep in all
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
}
