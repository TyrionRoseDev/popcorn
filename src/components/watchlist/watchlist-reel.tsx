import { Link } from "@tanstack/react-router";
import { FilmStrip } from "./film-strip";
import { WatchlistReelHeader } from "./watchlist-reel-header";

interface WatchlistReelProps {
	watchlist: {
		id: string;
		name: string;
		type: string;
		items: Array<{
			tmdbId: number;
			mediaType: string;
			posterPath: string | null;
		}>;
		members: Array<{
			user: {
				id: string;
				username: string | null;
				avatarUrl: string | null;
			};
		}>;
		itemCount: number;
	};
}

export function WatchlistReel({ watchlist }: WatchlistReelProps) {
	return (
		<div className="mb-12">
			<Link
				to="/app/watchlists/$watchlistId"
				params={{ watchlistId: watchlist.id }}
				search={{ sort: "date-added", type: "all" }}
				className="block no-underline"
			>
				<WatchlistReelHeader
					name={watchlist.name}
					itemCount={watchlist.itemCount}
					isDefault={watchlist.type === "default"}
					members={watchlist.members}
				/>

				<FilmStrip items={watchlist.items} />

				{/* Subtle glow line */}
				<div
					className="mt-0"
					style={{
						height: 1,
						background:
							"linear-gradient(to right, transparent, rgba(255,45,120,0.1), transparent)",
					}}
				/>
			</Link>
		</div>
	);
}
