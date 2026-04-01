import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Film, Loader2 } from "lucide-react";
import { useState } from "react";
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

	const events = data?.pages.flatMap((p) => p.items) ?? [];

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
			) : events.length === 0 ? (
				<div className="flex flex-col items-center py-12 text-center">
					<Film className="mb-3 h-8 w-8 text-cream/15" />
					<p className="text-sm text-cream/30">
						{filter === "mine"
							? "No watch events yet. Mark something as watched!"
							: "No activity yet. Add some friends to see their watches here."}
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{events.map((event) => (
						<WatchEventCard
							key={event.id}
							event={event}
							showTitle={{
								name: (event as any).title ?? `Title #${event.tmdbId}`,
							}}
							actor={event.user}
							isOwn={event.userId === currentUserId}
							onEdit={(e) =>
								setEditModal({
									open: true,
									tmdbId: event.tmdbId,
									mediaType: event.mediaType as "movie" | "tv",
									titleName: (event as any).title ?? `Title #${event.tmdbId}`,
									event: e,
								})
							}
						/>
					))}

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
