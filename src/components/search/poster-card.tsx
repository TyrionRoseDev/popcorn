import { AddToWatchlistDropdown } from "#/components/watchlist/add-to-watchlist-dropdown";
import type { FeedItem } from "#/lib/feed-assembler";
import { getGenreNameByTmdbId } from "#/lib/genre-map";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface PosterCardProps {
	item: FeedItem;
}

export function PosterCard({ item }: PosterCardProps) {
	const posterUrl = getTmdbImageUrl(item.posterPath);

	return (
		<div className="group overflow-hidden rounded-xl border border-cream/8 bg-cream/[0.03] transition-all duration-200 hover:border-[#FF2D78]/30 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
			<div className="relative aspect-[2/3] overflow-hidden">
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={item.title}
						className="h-full w-full object-cover"
						loading="lazy"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-cream/5 text-cream/20 text-xs">
						No Image
					</div>
				)}
				<div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
					<AddToWatchlistDropdown
						tmdbId={item.tmdbId}
						mediaType={item.mediaType as "movie" | "tv"}
					/>
				</div>
				<div className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono-retro text-[9px] font-semibold uppercase tracking-wider text-cream/60">
					{item.mediaType === "tv" ? "TV" : "Film"}
				</div>
			</div>

			<div className="p-3">
				<div className="flex items-baseline justify-between gap-2">
					<h3 className="truncate text-sm font-bold text-cream">
						{item.title}
					</h3>
					<span className="shrink-0 text-xs text-cream/40">{item.year}</span>
				</div>
				<div className="mt-1 flex items-center gap-1.5">
					<span className="text-xs font-medium text-neon-amber">
						★ {item.rating.toFixed(1)}
					</span>
				</div>
				<div className="mt-2 flex flex-wrap gap-1">
					{item.genreIds.slice(0, 2).map((genreId) => (
						<span
							key={genreId}
							className="rounded-full bg-cream/[0.06] px-2 py-0.5 text-[10px] font-medium text-cream/40"
						>
							{getGenreNameByTmdbId(genreId)}
						</span>
					))}
				</div>
			</div>
		</div>
	);
}
