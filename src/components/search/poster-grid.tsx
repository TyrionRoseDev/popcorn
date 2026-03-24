import { Link } from "@tanstack/react-router";
import type { FeedItem } from "#/lib/feed-assembler";
import { PosterCard } from "./poster-card";

interface PosterGridProps {
	items: FeedItem[];
}

export function PosterGrid({ items }: PosterGridProps) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{items.map((item) => (
				<Link
					key={`${item.tmdbId}-${item.mediaType}`}
					to="/app/title/$mediaType/$tmdbId"
					params={{
						mediaType: item.mediaType,
						tmdbId: item.tmdbId,
					}}
					className="block"
				>
					<PosterCard item={item} />
				</Link>
			))}
		</div>
	);
}

export function PosterGridSkeleton({ count = 8 }: { count?: number }) {
	return (
		<div
			className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
			aria-busy="true"
		>
			{Array.from({ length: count }, (_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no identity or state
					key={i}
					className="overflow-hidden rounded-xl border border-cream/8 bg-cream/[0.03]"
				>
					<div className="aspect-[2/3] animate-pulse bg-cream/5" />
					<div className="p-3 space-y-2">
						<div className="h-4 w-3/4 animate-pulse rounded bg-cream/5" />
						<div className="h-3 w-1/4 animate-pulse rounded bg-cream/5" />
					</div>
				</div>
			))}
		</div>
	);
}
