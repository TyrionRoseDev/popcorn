import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { NewWatchlistButton } from "#/components/watchlist/new-watchlist-button";
import { NowShowingHeader } from "#/components/watchlist/now-showing-header";
import { WatchlistAtmosphere } from "#/components/watchlist/watchlist-atmosphere";
import { useTRPC } from "#/integrations/trpc/react";

const SKELETON_KEYS = ["skeleton-a", "skeleton-b", "skeleton-c"];

export const Route = createFileRoute("/app/watchlists/")({
	component: WatchlistsPage,
});

function WatchlistsPage() {
	const trpc = useTRPC();
	const { data: watchlists, isLoading } = useQuery(
		trpc.watchlist.list.queryOptions(),
	);

	return (
		<>
			<WatchlistAtmosphere />

			<div className="relative" style={{ zIndex: 2, paddingTop: "40px" }}>
				<NowShowingHeader title="My Watchlists" />

				<NewWatchlistButton
					onClick={() => {
						console.log("New watchlist clicked — dialog comes in Task 9");
					}}
				/>

				{/* Watchlist content */}
				<div className="mx-auto mt-10 max-w-4xl px-4">
					{isLoading ? (
						<div className="flex flex-col items-center gap-4 py-16">
							{SKELETON_KEYS.map((key) => (
								<div
									key={key}
									className="h-24 w-full animate-pulse rounded-lg"
									style={{
										background: "rgba(255,255,255,0.04)",
										border: "1px solid rgba(255,255,255,0.06)",
									}}
								/>
							))}
						</div>
					) : watchlists && watchlists.length === 0 ? (
						<div className="flex flex-col items-center py-20 text-center">
							<p className="text-lg" style={{ color: "rgba(255,255,240,0.5)" }}>
								No watchlists yet
							</p>
							<p
								className="mt-1 text-sm"
								style={{ color: "rgba(255,255,240,0.3)" }}
							>
								Create your first watchlist to start tracking films.
							</p>
						</div>
					) : (
						<div
							className="py-8 text-center"
							style={{ color: "rgba(255,255,240,0.3)" }}
						>
							Film reels coming in Task 7
						</div>
					)}
				</div>
			</div>
		</>
	);
}
