import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { z } from "zod";
import { Atmosphere } from "#/components/atmosphere";
import { InviteMemberModal } from "#/components/watchlist/invite-member-modal";
import { WatchlistDetailHeader } from "#/components/watchlist/watchlist-detail-header";
import { WatchlistFilters } from "#/components/watchlist/watchlist-filters";
import { WatchlistItemCard } from "#/components/watchlist/watchlist-item-card";
import { useTRPC } from "#/integrations/trpc/react";

const watchlistAtmosphere: React.ComponentProps<typeof Atmosphere> = {
	glowColor: "rgba(236,72,153,0.15)",
	glowHeight: "200px",
	fogHeights: ["120px", "100px", "80px"],
};

const searchSchema = z.object({
	sort: z
		.enum(["date-added", "title", "year", "rating", "recommender"])
		.default("date-added"),
	type: z.enum(["all", "movie", "tv"]).default("all"),
});

export const Route = createFileRoute("/app/watchlists/$watchlistId")({
	validateSearch: (search) => searchSchema.parse(search),
	component: WatchlistDetailPage,
});

function WatchlistDetailPage() {
	const { watchlistId } = Route.useParams();
	const { sort, type } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const [inviteOpen, setInviteOpen] = useState(false);

	const trpc = useTRPC();
	const { data: watchlist, isLoading } = useQuery(
		trpc.watchlist.get.queryOptions({ watchlistId }),
	);

	function handleSortChange(newSort: string) {
		navigate({
			search: (prev) => ({ ...prev, sort: newSort as typeof sort }),
		});
	}

	function handleTypeChange(newType: string) {
		navigate({
			search: (prev) => ({ ...prev, type: newType as typeof type }),
		});
	}

	// Client-side filtering and sorting
	const filteredItems = (() => {
		if (!watchlist) return [];

		let items = [...watchlist.items];

		// Filter by type
		if (type !== "all") {
			items = items.filter((item) => item.mediaType === type);
		}

		// Sort
		switch (sort) {
			case "date-added":
				items.sort(
					(a, b) =>
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
				);
				break;
			case "title":
				items.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
				break;
			case "year":
				// Placeholder: sort by tmdbId since we don't have TMDB year data yet
				items.sort((a, b) => b.tmdbId - a.tmdbId);
				break;
			case "rating":
				// Placeholder: sort by tmdbId since we don't have TMDB rating data yet
				items.sort((a, b) => b.tmdbId - a.tmdbId);
				break;
			case "recommender":
				items.sort((a, b) => {
					const aName = a.recommendedByUser?.username ?? "";
					const bName = b.recommendedByUser?.username ?? "";
					return aName.localeCompare(bName);
				});
				break;
		}

		return items;
	})();

	const isShared = (watchlist?.members.length ?? 0) > 1;

	if (isLoading) {
		return (
			<>
				<Atmosphere
					glowColor="rgba(236,72,153,0.15)"
					glowHeight="200px"
					fogHeights={["120px", "100px", "80px"]}
				/>
				<div
					className="relative mx-auto max-w-6xl 2xl:max-w-[1600px] px-4"
					style={{ zIndex: 2, paddingTop: "40px" }}
				>
					<div className="space-y-6">
						<div
							className="h-10 w-48 animate-pulse rounded-lg"
							style={{ background: "rgba(255,255,255,0.06)" }}
						/>
						<div
							className="h-8 w-96 animate-pulse rounded-lg"
							style={{ background: "rgba(255,255,255,0.04)" }}
						/>
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
							{Array.from({ length: 10 }, (_, i) => `skeleton-${i}`).map(
								(key) => (
									<div
										key={key}
										className="aspect-[2/3] animate-pulse rounded-xl"
										style={{
											background: "rgba(255,255,255,0.04)",
											border: "1px solid rgba(255,255,255,0.06)",
										}}
									/>
								),
							)}
						</div>
					</div>
				</div>
			</>
		);
	}

	if (!watchlist) {
		return (
			<>
				<Atmosphere
					glowColor="rgba(236,72,153,0.15)"
					glowHeight="200px"
					fogHeights={["120px", "100px", "80px"]}
				/>
				<div
					className="relative flex flex-col items-center justify-center py-32 text-center"
					style={{ zIndex: 2 }}
				>
					<p className="text-lg text-cream/50">Watchlist not found</p>
					<p className="mt-1 text-sm text-cream/30">
						It may have been deleted or you don't have access.
					</p>
				</div>
			</>
		);
	}

	return (
		<>
			<Atmosphere
				glowColor="rgba(236,72,153,0.15)"
				glowHeight="200px"
				fogHeights={["120px", "100px", "80px"]}
			/>

			<div className="relative" style={{ zIndex: 2, paddingTop: "40px" }}>
				<WatchlistDetailHeader
					watchlist={watchlist}
					userRole={watchlist.userRole}
					onInvite={() => setInviteOpen(true)}
				/>

				{/* Filters */}
				<div className="mx-auto mt-8 max-w-6xl 2xl:max-w-[1600px] px-4">
					<WatchlistFilters
						sort={sort}
						type={type}
						onSortChange={handleSortChange}
						onTypeChange={handleTypeChange}
					/>
				</div>

				{/* Item grid */}
				<div className="mx-auto mt-6 max-w-6xl 2xl:max-w-[1600px] px-4 pb-16">
					{filteredItems.length > 0 ? (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
							{filteredItems.map((item) => (
								<WatchlistItemCard
									key={`${item.tmdbId}-${item.mediaType}`}
									item={item}
									watchlistId={watchlistId}
									userRole={watchlist.userRole}
									isShared={isShared}
								/>
							))}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-20 text-center">
							<p className="text-lg text-cream/50">
								{watchlist.items.length === 0
									? "No items yet"
									: "No items match your filters"}
							</p>
							<p className="mt-1 text-sm text-cream/30">
								{watchlist.items.length === 0
									? "Add movies or TV shows from the search page"
									: "Try adjusting your filter or sort settings"}
							</p>
						</div>
					)}
				</div>
			</div>

			{watchlist && (
				<InviteMemberModal
					open={inviteOpen}
					onOpenChange={setInviteOpen}
					watchlistId={watchlistId}
					watchlistName={watchlist.name}
				/>
			)}
		</>
	);
}
