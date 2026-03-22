import { Check } from "lucide-react";
import type { FeedItem } from "#/lib/feed-assembler";
import { getGenreNameByTmdbId, getUnifiedIdByTmdbId } from "#/lib/genre-map";
import { getTmdbImageUrl } from "#/lib/tmdb";

export interface GenreColorMap {
	[unifiedGenreId: number]: { bg: string; text: string };
}

interface TitleCardProps {
	item: FeedItem;
	isSelected: boolean;
	onToggle: () => void;
	selectionDisabled?: boolean;
	genreColors?: GenreColorMap;
}

export function TitleCard({
	item,
	isSelected,
	onToggle,
	selectionDisabled = false,
	genreColors = {},
}: TitleCardProps) {
	const posterUrl = getTmdbImageUrl(item.posterPath);
	const canSelect = !selectionDisabled || isSelected;

	return (
		<button
			type="button"
			onClick={canSelect ? onToggle : undefined}
			className={`group w-full overflow-hidden rounded-xl text-left transition-all duration-200 ${
				isSelected
					? "border-2 border-[#FF2D78] shadow-[0_0_20px_rgba(255,45,120,0.3)]"
					: "border border-cream/8 hover:border-cream/20"
			} ${!canSelect ? "cursor-not-allowed opacity-60" : "cursor-pointer"} bg-cream/[0.03]`}
		>
			{/* Poster */}
			<div className="relative aspect-[4/5] overflow-hidden">
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={item.title}
						className="h-full w-full object-cover"
						loading="lazy"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-cream/5 text-cream/20">
						No Image
					</div>
				)}
				{/* Checkmark overlay */}
				{isSelected && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/20">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF2D78]/90 shadow-[0_0_15px_rgba(255,45,120,0.5)]">
							<Check className="h-6 w-6 text-white" strokeWidth={3} />
						</div>
					</div>
				)}
				{/* Media type badge */}
				<div className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream/70">
					{item.mediaType === "tv" ? "TV" : "Film"}
				</div>
			</div>

			{/* Info */}
			<div className="p-3">
				<div className="flex items-baseline justify-between gap-2">
					<h3 className="truncate text-sm font-bold text-cream">
						{item.title}
					</h3>
					<span className="shrink-0 text-xs text-cream/40">{item.year}</span>
				</div>

				<div className="mt-1 flex items-center gap-1.5">
					<span className="text-xs font-medium text-[#FFB800]">
						★ {item.rating.toFixed(1)}
					</span>
				</div>

				<p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-cream/50">
					{item.overview}
				</p>

				<div className="mt-2 flex flex-wrap gap-1">
					{item.genreIds.slice(0, 3).map((genreId) => {
						const unifiedId = getUnifiedIdByTmdbId(genreId);
						const color =
							unifiedId !== null ? genreColors[unifiedId] : null;
						return (
							<span
								key={genreId}
								className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
									color
										? `${color.bg} ${color.text}`
										: "bg-cream/[0.06] text-cream/40"
								}`}
							>
								{getGenreNameByTmdbId(genreId)}
							</span>
						);
					})}
				</div>
			</div>
		</button>
	);
}
