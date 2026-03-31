import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTRPC } from "#/integrations/trpc/react";
import { PosterCard } from "./poster-card";

function LandingRow({
	title,
	badge,
	badgeClass,
	items,
	isLoading,
}: {
	title: string;
	badge: string;
	badgeClass: string;
	items: Array<import("#/lib/feed-assembler").FeedItem>;
	isLoading: boolean;
}) {
	return (
		<section className="mb-10" aria-busy={isLoading}>
			<div className="mb-4 flex items-center gap-2">
				<h2 className="font-display text-lg text-cream">{title}</h2>
				<span
					className={`font-mono-retro text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${badgeClass}`}
				>
					{badge}
				</span>
			</div>

			{isLoading ? (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
					{Array.from({ length: 6 }, (_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity
							key={i}
							className="overflow-hidden rounded-xl border border-cream/8 bg-cream/[0.03]"
						>
							<div className="aspect-[2/3] animate-pulse bg-cream/5" />
							<div className="p-3 space-y-2">
								<div className="h-3 w-3/4 animate-pulse rounded bg-cream/5" />
								<div className="h-2 w-1/4 animate-pulse rounded bg-cream/5" />
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
			)}
		</section>
	);
}

export function SearchLanding() {
	const trpc = useTRPC();

	const trending = useQuery(trpc.search.trending.queryOptions());
	const topRated = useQuery(trpc.search.topRated.queryOptions());
	const newReleases = useQuery(trpc.search.newReleases.queryOptions());

	return (
		<div>
			<LandingRow
				title="Trending Now"
				badge="Hot"
				badgeClass="bg-neon-pink/15 text-neon-pink"
				items={trending.data?.results ?? []}
				isLoading={trending.isLoading}
			/>
			<LandingRow
				title="Top Rated"
				badge="★"
				badgeClass="bg-neon-amber/15 text-neon-amber"
				items={topRated.data?.results ?? []}
				isLoading={topRated.isLoading}
			/>
			<LandingRow
				title="New Releases"
				badge="New"
				badgeClass="bg-neon-cyan/15 text-neon-cyan"
				items={newReleases.data?.results ?? []}
				isLoading={newReleases.isLoading}
			/>
		</div>
	);
}
