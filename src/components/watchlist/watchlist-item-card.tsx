import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff, Trash2 } from "lucide-react";
import { useTRPC } from "#/integrations/trpc/react";

const POSTER_GRADIENTS = [
	"linear-gradient(135deg, #1a3a5c, #0d2240)",
	"linear-gradient(135deg, #3a1a4c, #1e0d30)",
	"linear-gradient(135deg, #1a4c3a, #0d3020)",
	"linear-gradient(135deg, #4c2a1a, #301a0d)",
	"linear-gradient(135deg, #1a2a4c, #0d1a30)",
	"linear-gradient(135deg, #4c1a3a, #300d20)",
	"linear-gradient(135deg, #2a4c1a, #1a300d)",
	"linear-gradient(135deg, #1a4c4c, #0d3030)",
];

function gradientForId(tmdbId: number) {
	return POSTER_GRADIENTS[tmdbId % POSTER_GRADIENTS.length];
}

interface WatchlistItemCardProps {
	item: {
		tmdbId: number;
		mediaType: string;
		watched: boolean;
		createdAt: Date | string;
		addedByUser: {
			id: string;
			username: string | null;
			avatarUrl: string | null;
		};
		recommendedBy?: string | null;
		recommendationMessage?: string | null;
		recommendedByUser?: {
			id: string;
			username: string | null;
			avatarUrl: string | null;
		} | null;
	};
	watchlistId: string;
	userRole: string | null;
	isShared: boolean;
}

export function WatchlistItemCard({
	item,
	watchlistId,
	userRole,
	isShared,
}: WatchlistItemCardProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const markWatched = useMutation(
		trpc.watchlist.markWatched.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.watchlist.get.queryFilter({ watchlistId }),
				);
			},
		}),
	);

	const removeItem = useMutation(
		trpc.watchlist.removeItem.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.watchlist.get.queryFilter({ watchlistId }),
				);
			},
		}),
	);

	const canToggleWatched = userRole === "owner" || userRole === "member";
	const canRemove = userRole === "owner";

	return (
		<div className="group/card flex flex-col">
			<div className="overflow-hidden rounded-xl border border-cream/8 bg-cream/[0.03] transition-all duration-200 hover:border-[#FF2D78]/30 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
				{/* Poster area */}
				<div className="relative aspect-[2/3] overflow-hidden">
					<div
						className="h-full w-full"
						style={{ background: gradientForId(item.tmdbId) }}
					/>

					{/* Media type badge */}
					<div className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono-retro text-[9px] font-semibold uppercase tracking-wider text-cream/60">
						{item.mediaType === "tv" ? "TV" : "Film"}
					</div>

					{/* Watched overlay */}
					{item.watched && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/50">
							<div className="rounded-full bg-neon-cyan/20 p-3">
								<Check className="h-8 w-8 text-neon-cyan" />
							</div>
						</div>
					)}
				</div>

				{/* Info & actions */}
				<div className="p-3">
					<h3
						className={`truncate text-sm font-bold ${item.watched ? "text-cream/40" : "text-cream"}`}
					>
						Title #{item.tmdbId}
					</h3>

					{/* Action buttons */}
					<div className="mt-2 flex items-center gap-1.5">
						{canToggleWatched && (
							<button
								type="button"
								onClick={() =>
									markWatched.mutate({
										watchlistId,
										tmdbId: item.tmdbId,
										mediaType: item.mediaType as "movie" | "tv",
										watched: !item.watched,
									})
								}
								disabled={markWatched.isPending}
								className={`rounded-lg p-1.5 transition-colors ${
									item.watched
										? "text-neon-cyan/70 hover:text-neon-cyan hover:bg-neon-cyan/10"
										: "text-cream/40 hover:text-cream hover:bg-cream/8"
								}`}
								title={item.watched ? "Mark unwatched" : "Mark watched"}
							>
								{item.watched ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
							</button>
						)}

						{canRemove && (
							<button
								type="button"
								onClick={() =>
									removeItem.mutate({
										watchlistId,
										tmdbId: item.tmdbId,
										mediaType: item.mediaType as "movie" | "tv",
									})
								}
								disabled={removeItem.isPending}
								className="rounded-lg p-1.5 text-cream/30 transition-colors hover:text-red-400 hover:bg-red-400/10"
								title="Remove from watchlist"
							>
								<Trash2 className="h-4 w-4" />
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Attribution */}
			{item.recommendedByUser?.username ? (
				<p className="mt-1.5 truncate text-[11px] text-neon-amber/50">
					Recommended by @{item.recommendedByUser.username}
				</p>
			) : isShared && item.addedByUser.username ? (
				<p className="mt-1.5 truncate text-[11px] text-cream/30">
					Added by @{item.addedByUser.username}
				</p>
			) : null}
		</div>
	);
}
