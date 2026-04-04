import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Film, Loader2, Trophy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { FeedAtmosphere } from "#/components/feed/feed-atmosphere";
import { CarSilhouettes } from "#/components/title/car-silhouettes";
import { FeedJournalCard } from "#/components/tracker/feed-journal-card";
import { ReviewModal } from "#/components/watched/review-modal";
import { WatchEventCard } from "#/components/watched/watch-event-card";
import type { Companion } from "#/components/watched/watched-with-modal";
import { NowShowingHeader } from "#/components/watchlist/now-showing-header";
import { useTRPC } from "#/integrations/trpc/react";
import { ACHIEVEMENTS_BY_ID } from "#/lib/achievements";

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
		<>
			<FeedAtmosphere />
			<div className="relative z-[2] mx-auto max-w-2xl px-4 py-8">
				{/* Car silhouettes + Marquee header */}
				<CarSilhouettes />
				<NowShowingHeader title="Feed" />

				{/* Filter */}
				<div className="flex justify-end mt-7 mb-6">
					<select
						value={filter}
						onChange={(e) => setFilter(e.target.value as "all" | "mine")}
						className="font-mono-retro text-xs tracking-wide text-neon-cyan bg-[rgba(0,229,255,0.06)] border border-[rgba(0,229,255,0.2)] rounded-md px-4 py-2 focus:outline-none focus:border-[rgba(0,229,255,0.35)] [color-scheme:dark] cursor-pointer"
						style={{
							textShadow: "0 0 6px rgba(0,229,255,0.2)",
							boxShadow: "0 0 12px rgba(0,229,255,0.05)",
						}}
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
					<div className="flex flex-col">
						{groupByDate(feedItems).map((group) => (
							<div key={group.label}>
								<DateHeader label={group.label} />
								<div className="flex flex-col">
									{group.items.map((item, idx) => {
										let card: ReactNode = null;

										if (item.type === "watch_event") {
											const event = item.data as {
												id: string;
												tmdbId: number;
												mediaType: string;
												title: string | null;
												userId: string;
												rating: number | null;
												note: string | null;
												watchedAt: Date | string;
												companions: Array<{
													friendId: string | null;
													name: string;
												}>;
												user: {
													id: string;
													username: string | null;
													avatarUrl: string | null;
												};
											};
											card = (
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
															titleName:
																event.title ?? `Title #${event.tmdbId}`,
															event: e,
														})
													}
												/>
											);
										} else if (item.type === "watchlist_created") {
											const wl = item.data as {
												id: string;
												name: string;
												ownerId: string;
												createdAt: Date;
												owner: {
													id: string;
													username: string | null;
													avatarUrl: string | null;
												};
												items: Array<{ id: string }>;
											};
											card = (
												<WatchlistCreatedCard
													key={`wl-${wl.id}`}
													watchlist={wl}
													isOwn={wl.ownerId === currentUserId}
												/>
											);
										} else if (item.type === "journal_entry") {
											const je = item.data as {
												id: string;
												userId: string;
												tmdbId: number;
												titleName: string;
												scope: string;
												seasonNumber: number | null;
												episodeNumber: number | null;
												note: string;
												isPublic: boolean;
												createdAt: Date;
												user: {
													id: string;
													username: string | null;
													avatarUrl: string | null;
												};
											};
											card = <FeedJournalCard key={`je-${je.id}`} entry={je} />;
										} else if (item.type === "achievement_earned") {
											const achievement = item.data as {
												id: string;
												achievementId: string;
												userId: string;
												earnedAt: Date | string;
												user: {
													id: string;
													username: string | null;
													avatarUrl: string | null;
												};
											};
											card = (
												<AchievementEarnedCard
													key={`ae-${achievement.id}`}
													achievement={achievement}
													isOwn={achievement.userId === currentUserId}
												/>
											);
										}

										return (
											<div
												key={`${item.type}-${(item.data as { id: string }).id}`}
											>
												{idx > 0 && <FilmDivider />}
												{card}
											</div>
										);
									})}
								</div>
							</div>
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
		</>
	);
}

function AchievementEarnedCard({
	achievement,
	isOwn,
}: {
	achievement: {
		id: string;
		achievementId: string;
		userId: string;
		earnedAt: Date | string;
		user: { id: string; username: string | null; avatarUrl: string | null };
	};
	isOwn: boolean;
}) {
	const def = ACHIEVEMENTS_BY_ID.get(achievement.achievementId);
	const actor = achievement.user;

	return (
		<div
			className="relative rounded-[10px] border border-neon-amber/15 p-4 transition-all hover:border-neon-amber/25 hover:-translate-y-px"
			style={{
				background:
					"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(20,18,10,0.8) 100%)",
				boxShadow: "0 0 12px rgba(255,184,0,0.04), 0 4px 16px rgba(0,0,0,0.3)",
			}}
		>
			{/* Header row */}
			<div className="flex items-center gap-2 mb-2.5">
				<Link
					to="/app/profile/$userId"
					params={{ userId: actor.id }}
					className="flex items-center gap-2 no-underline"
				>
					<div className="w-7 h-7 rounded-full bg-neon-amber/15 border border-neon-amber/20 flex items-center justify-center text-[11px] font-medium text-neon-amber shrink-0">
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
					<span className="text-[13px] font-semibold text-cream/75">
						{isOwn ? "You" : (actor.username ?? "Someone")}
					</span>
				</Link>
				<span className="text-xs text-cream/30">earned an achievement</span>
				<span className="text-[10px] text-cream/20 ml-auto font-mono-retro">
					{formatTimeAgo(achievement.earnedAt)}
				</span>
			</div>

			{/* Achievement detail */}
			<div className="flex items-center gap-3">
				<div
					className="flex h-12 w-12 items-center justify-center rounded-lg border border-neon-amber/20 text-2xl"
					style={{
						background:
							"linear-gradient(135deg, rgba(255,184,0,0.1), rgba(255,184,0,0.03))",
					}}
				>
					{def?.icon ?? <Trophy className="h-5 w-5 text-neon-amber/60" />}
				</div>
				<div className="min-w-0 flex-1">
					<p
						className="text-[15px] font-bold text-neon-amber"
						style={{ textShadow: "0 0 8px rgba(255,184,0,0.15)" }}
					>
						{def?.name ?? "Achievement"}
					</p>
					<p className="text-[11px] text-cream/40 mt-0.5">
						{def?.description ?? ""}
					</p>
				</div>
			</div>
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
		<div
			className="relative rounded-[10px] border border-neon-pink/15 p-4 transition-all hover:border-neon-pink/25 hover:-translate-y-px"
			style={{
				background:
					"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
				boxShadow: "0 0 12px rgba(255,45,120,0.04), 0 4px 16px rgba(0,0,0,0.3)",
			}}
		>
			{/* Header row */}
			<div className="flex items-center gap-2 mb-2.5">
				<Link
					to="/app/profile/$userId"
					params={{ userId: actor.id }}
					className="flex items-center gap-2 no-underline"
				>
					<div className="w-7 h-7 rounded-full bg-neon-pink/15 border border-neon-pink/20 flex items-center justify-center text-[11px] font-medium text-neon-pink shrink-0">
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
					<span className="text-[13px] font-semibold text-cream/75">
						{isOwn ? "You" : (actor.username ?? "Someone")}
					</span>
				</Link>
				<span className="text-xs text-cream/30">created a watchlist</span>
				<span className="text-[10px] text-cream/20 ml-auto font-mono-retro">
					{formatTimeAgo(watchlist.createdAt)}
				</span>
			</div>

			{/* Main row */}
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<Link
						to="/app/watchlists/$watchlistId"
						params={{ watchlistId: watchlist.id }}
						search={{ sort: "date-added", type: "all" }}
						className="text-[15px] font-bold text-neon-pink no-underline hover:text-neon-pink/90"
						style={{ textShadow: "0 0 8px rgba(255,45,120,0.15)" }}
					>
						{watchlist.name}
					</Link>
					<span className="ml-2 text-[11px] font-mono-retro text-cream/35">
						{itemCount} {itemCount === 1 ? "title" : "titles"}
					</span>
				</div>
			</div>
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

function groupByDate(
	items: Array<{
		type: string;
		timestamp: Date;
		data: Record<string, unknown>;
	}>,
): Array<{ label: string; items: typeof items }> {
	const groups: Array<{ label: string; items: typeof items }> = [];
	let currentLabel = "";

	for (const item of items) {
		const date = new Date(item.timestamp);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

		let label: string;
		if (diffDays === 0) label = "Today";
		else if (diffDays === 1) label = "Yesterday";
		else if (diffDays < 7) label = `${diffDays} days ago`;
		else if (diffDays < 14) label = "Last week";
		else {
			label = date.toLocaleDateString("en-US", {
				month: "long",
				day: "numeric",
			});
		}

		if (label !== currentLabel) {
			groups.push({ label, items: [item] });
			currentLabel = label;
		} else {
			groups[groups.length - 1].items.push(item);
		}
	}

	return groups;
}

function DateHeader({ label }: { label: string }) {
	return (
		<div className="flex items-center gap-3 mt-7 mb-4">
			<span
				className="font-mono-retro text-[11px] tracking-[2px] uppercase whitespace-nowrap"
				style={{
					color: "rgba(255,184,0,0.6)",
					textShadow: "0 0 8px rgba(255,184,0,0.15)",
				}}
			>
				{label}
			</span>
			<div
				className="flex-1 h-px"
				style={{
					background:
						"linear-gradient(90deg, rgba(255,184,0,0.2), transparent)",
				}}
			/>
		</div>
	);
}

function FilmDivider() {
	return (
		<div className="flex items-center justify-center gap-1.5 py-2.5 opacity-50">
			{[0, 1, 2, 3, 4, 5, 6].map((i) => (
				<div
					key={i}
					className="h-1 w-1 rounded-full"
					style={{
						background:
							i % 2 === 0 ? "rgba(0,229,255,0.3)" : "rgba(255,45,120,0.3)",
					}}
				/>
			))}
		</div>
	);
}
