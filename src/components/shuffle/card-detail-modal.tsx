import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import type { FeedItem } from "#/lib/feed-assembler";
import { getGenreNameByTmdbId } from "#/lib/genre-map";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface CardDetailModalProps {
	item: FeedItem | null;
	onClose: () => void;
}

export function CardDetailModal({ item, onClose }: CardDetailModalProps) {
	const posterUrl = item ? getTmdbImageUrl(item.posterPath, "w500") : null;

	return (
		<Dialog
			open={!!item}
			onOpenChange={(v) => {
				if (!v) onClose();
			}}
		>
			<DialogContent
				className="inset-x-0 bottom-0 top-auto max-w-lg max-h-[90dvh] translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl rounded-b-none border-t border-cream/10 bg-drive-in-bg p-0 gap-0"
				overlayClassName="bg-black/70 backdrop-blur-sm"
				showCloseButton={false}
				aria-describedby={undefined}
			>
				<DialogTitle className="sr-only">
					{item?.title ?? "Details"}
				</DialogTitle>
				{item && (
					<>
						{/* Drag handle */}
						<div className="flex justify-center pt-3 pb-1">
							<div className="h-1 w-10 rounded-full bg-cream/20" />
						</div>

						<div className="flex flex-col gap-5 p-5 pb-safe-bottom">
							{/* Poster + core info */}
							<div className="flex gap-4">
								{posterUrl ? (
									<img
										src={posterUrl}
										alt={item.title}
										className="h-40 w-[107px] shrink-0 rounded-xl object-cover shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
									/>
								) : (
									<div className="flex h-40 w-[107px] shrink-0 items-center justify-center rounded-xl bg-cream/5">
										<span className="font-mono-retro text-[10px] text-cream/20">
											No Poster
										</span>
									</div>
								)}

								<div className="flex flex-col justify-end gap-2 overflow-hidden">
									{/* Media type badge */}
									<span className="w-fit rounded-md bg-cream/10 px-2 py-0.5 font-mono-retro text-[10px] font-semibold uppercase tracking-wider text-cream/60">
										{item.mediaType === "tv" ? "TV Series" : "Film"}
									</span>

									{/* Title */}
									<h2 className="font-display text-xl leading-tight text-cream">
										{item.title}
									</h2>

									{/* Year */}
									{item.year && (
										<p className="font-mono-retro text-xs text-cream/50">
											{item.year}
										</p>
									)}

									{/* Rating */}
									<p className="text-sm font-semibold text-neon-amber">
										&#11088; {item.rating.toFixed(1)}
									</p>
								</div>
							</div>

							{/* Genre pills */}
							{item.genreIds.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{item.genreIds.map((genreId) => (
										<span
											key={genreId}
											className="rounded-full border border-cream/10 bg-cream/5 px-3 py-1 text-xs font-medium text-cream/70"
										>
											{getGenreNameByTmdbId(genreId)}
										</span>
									))}
								</div>
							)}

							{/* Synopsis */}
							{item.overview && (
								<div>
									<p className="mb-1.5 font-mono-retro text-[10px] uppercase tracking-widest text-cream/30">
										Synopsis
									</p>
									<p className="text-sm leading-relaxed text-cream/70">
										{item.overview}
									</p>
								</div>
							)}

							{/* Actions */}
							<div className="mt-1 flex flex-col gap-2">
								<Link
									to="/app/title/$mediaType/$tmdbId"
									params={{
										mediaType: item.mediaType,
										tmdbId: item.tmdbId,
									}}
									className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-neon-pink/45 bg-neon-pink/10 px-5 py-2 text-sm font-bold text-neon-pink no-underline transition-colors hover:bg-neon-pink/18"
									onClick={onClose}
								>
									View Full Details
								</Link>
								<button
									type="button"
									onClick={onClose}
									className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:bg-cream/5 hover:text-cream/80"
								>
									Close
								</button>
							</div>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
