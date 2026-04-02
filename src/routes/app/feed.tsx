import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Film, Loader2 } from "lucide-react";
import { useState } from "react";
import { FeedJournalCard } from "#/components/tracker/feed-journal-card";
import { ReviewModal } from "#/components/watched/review-modal";
import { WatchEventCard } from "#/components/watched/watch-event-card";
import type { Companion } from "#/components/watched/watched-with-modal";
import { useTRPC } from "#/integrations/trpc/react";

export const Route = createFileRoute("/app/feed")({
	component: FeedPage,
});

function FeedPage() {
	const trpc = useTRPC();
	const [filter, setFilter] = useState<"all" | "mine">("all");
	const [editModal, setEditModal] = useState<{
		open: boolean;
		tmdbId: number;
		mediaType: "movie" | "tv";
		titleName: string;
		event?: {
			id: string;
			rating: number | null;
			note: string | null;
			watchedAt: string;
			companions: Companion[];
		};
	} | null>(null);

	const routeContext = Route.useRouteContext();
	const currentUserId = routeContext.user.id;

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery(
			trpc.watchEvent.getFeed.infiniteQueryOptions(
				{ filter, limit: 20 },
				{ getNextPageParam: (lastPage) => lastPage.nextCursor },
			),
		);

	const feedItems = data?.pages.flatMap((p) => p.items) ?? [];

	return (
		<div className="mx-auto max-w-2xl px-4 py-8">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<h1 className="font-display text-2xl text-cream tracking-wide">Feed</h1>
				<select
					value={filter}
					onChange={(e) => setFilter(e.target.value as "all" | "mine")}
					className="bg-drive-in-card border border-drive-in-border rounded-md px-3 py-1.5 text-xs font-mono-retro text-cream/60 focus:outline-none focus:border-neon-cyan/20 [color-scheme:dark]"
				>
					<option value="all">Everyone</option>
					<option value="mine">Just Me</option>
				</select>
			</div>

			{/* Feed */}
			{isLoading ? (
				<div className="flex justify-center py-12">
					<Loader2 className="h-5 w-5 animate-spin text-cream/30" />
				</div>
			) : feedItems.length === 0 ? (
				<div className="flex flex-col items-center py-12 text-center">
					<Film className="mb-3 h-8 w-8 text-cream/15" />
					<p className="text-sm text-cream/30">
						{filter === "mine"
							? "No activity yet. Mark something as watched!"
							: "No activity yet. Add some friends to see their activity here."}
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{feedItems.map((item) => {
						if (item.type === "watch_event") {
							const event = item.data;
							return (
								<WatchEventCard
									key={`we-${event.id}`}
									event={event}
									showTitle={{
										name: event.title ?? `Title #${event.tmdbId}`,
									}}
									actor={event.user}
									isOwn={event.userId === currentUserId}
									onEdit={(e) =>
										setEditModal({
											open: true,
											tmdbId: event.tmdbId,
											mediaType: event.mediaType as "movie" | "tv",
											titleName: event.title ?? `Title #${event.tmdbId}`,
											event: e,
										})
									}
								/>
							);
						}

						if (item.type === "watchlist_created") {
							const wl = item.data;
							return (
								<WatchlistCreatedCard
									key={`wl-${wl.id}`}
									watchlist={wl}
									isOwn={wl.ownerId === currentUserId}
								/>
							);
						}

						if (item.type === "journal_entry") {
							return (
								<FeedJournalCard key={`je-${item.data.id}`} entry={item.data} />
							);
						}

						return null;
					})}

					{hasNextPage && (
						<button
							type="button"
							onClick={() => fetchNextPage()}
							disabled={isFetchingNextPage}
							className="mx-auto py-2 px-6 text-xs font-mono-retro tracking-wider text-cream/30 hover:text-cream/60 transition-colors"
						>
							{isFetchingNextPage ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Load more"
							)}
						</button>
					)}
				</div>
			)}

			{editModal && (
				<ReviewModal
					open={editModal.open}
					onOpenChange={(open) => {
						if (!open) setEditModal(null);
					}}
					tmdbId={editModal.tmdbId}
					mediaType={editModal.mediaType}
					titleName={editModal.titleName}
					editEvent={editModal.event}
				/>
			)}
		</div>
	);
}

function WatchlistCreatedCard({
	watchlist,
	isOwn,
}: {
	watchlist: {
		id: string;
		name: string;
		ownerId: string;
		createdAt: Date;
		owner: { id: string; username: string | null; avatarUrl: string | null };
		items: Array<{ id: string }>;
	};
	isOwn: boolean;
}) {
	const actor = watchlist.owner;
	const itemCount = watchlist.items.length;

	return (
		<div className="rounded-lg border border-drive-in-border p-3 transition-colors hover:bg-cream/[0.03]">
			<div className="flex items-center gap-2 mb-2">
				<Link
					to="/app/profile/$userId"
					params={{ userId: actor.id }}
					className="flex items-center gap-2 no-underline"
				>
					<div className="w-7 h-7 rounded-full bg-cream/10 flex items-center justify-center text-xs font-medium text-cream/60 shrink-0">
						{actor.avatarUrl ? (
							<img
								src={actor.avatarUrl}
								alt=""
								className="w-7 h-7 rounded-full object-cover"
							/>
						) : (
							(actor.username?.charAt(0) ?? "?").toUpperCase()
						)}
					</div>
					<span className="text-xs font-semibold text-cream/80">
						{isOwn ? "You" : (actor.username ?? "Someone")}
					</span>
				</Link>
				<span className="text-xs text-cream/30">created a watchlist</span>
				<span className="text-[10px] text-cream/25 ml-auto">
					{formatTimeAgo(watchlist.createdAt)}
				</span>
			</div>

			<Link
				to="/app/watchlists/$watchlistId"
				params={{ watchlistId: watchlist.id }}
				search={{ sort: "date-added", type: "all" }}
				className="no-underline"
			>
				<div className="flex items-center gap-2 ml-9">
					<Bookmark className="h-3.5 w-3.5 text-neon-pink/60" />
					<span className="text-sm font-semibold text-cream/90 hover:text-cream">
						{watchlist.name}
					</span>
					<span className="text-[11px] text-cream/30">
						{itemCount} {itemCount === 1 ? "title" : "titles"}
					</span>
				</div>
			</Link>
		</div>
	);
}

function formatTimeAgo(date: Date | string): string {
	const now = new Date();
	const d = new Date(date);
	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "Just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay === 1) return "Yesterday";
	if (diffDay < 30) return `${diffDay}d ago`;
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
