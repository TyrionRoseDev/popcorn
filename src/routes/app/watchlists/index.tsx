import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { NewWatchlistButton } from "#/components/watchlist/new-watchlist-button";
import { NowShowingHeader } from "#/components/watchlist/now-showing-header";
import { WatchlistAtmosphere } from "#/components/watchlist/watchlist-atmosphere";
import { WatchlistReel } from "#/components/watchlist/watchlist-reel";
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
				<div className="mt-10">
					{isLoading ? (
						<div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-16">
							{SKELETON_KEYS.map((key) => (
								<div
									key={key}
									className="h-[207px] w-full animate-pulse rounded-lg"
									style={{
										background: "rgba(255,255,255,0.04)",
										border: "1px solid rgba(255,255,255,0.06)",
									}}
								/>
							))}
						</div>
					) : watchlists && watchlists.length === 0 ? (
						<div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center">
							<p className="text-lg" style={{ color: "rgba(255,255,240,0.5)" }}>
								No watchlists yet
							</p>
							<p
								className="mt-1 text-sm"
								style={{ color: "rgba(255,255,240,0.3)" }}
							>
								Create your first one!
							</p>
						</div>
					) : (
						<div className="pt-4">
							{watchlists?.map((watchlist) => (
								<WatchlistReel key={watchlist.id} watchlist={watchlist} />
							))}
						</div>
					)}
				</div>
			</div>
		</>
	);
}
