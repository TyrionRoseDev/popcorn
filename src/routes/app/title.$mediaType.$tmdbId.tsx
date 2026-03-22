import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { CastList } from "#/components/title/cast-list";
import { HeroTrailer } from "#/components/title/hero-trailer";
import { SectionDivider } from "#/components/title/section-divider";
import { Synopsis } from "#/components/title/synopsis";
import { TitleInfoBar } from "#/components/title/title-info-bar";
import { TitleMetadata } from "#/components/title/title-metadata";
import { TitlePageSkeleton } from "#/components/title/title-page-skeleton";
import { useTRPC } from "#/integrations/trpc/react";
import { getTmdbImageUrl } from "#/lib/tmdb";

const paramsSchema = z.object({
	mediaType: z.enum(["movie", "tv"]),
	tmdbId: z.coerce.number(),
});

export const Route = createFileRoute("/app/title/$mediaType/$tmdbId")({
	params: {
		parse: (raw) => paramsSchema.parse(raw),
		stringify: (params) => ({
			mediaType: params.mediaType,
			tmdbId: String(params.tmdbId),
		}),
	},
	loader: async ({ context: { queryClient, trpc }, params }) => {
		await queryClient.ensureQueryData(
			trpc.title.details.queryOptions({
				mediaType: params.mediaType,
				tmdbId: params.tmdbId,
			}),
		);
	},
	pendingComponent: TitlePageSkeleton,
	errorComponent: TitleErrorPage,
	component: TitlePage,
});

function TitlePage() {
	const { mediaType, tmdbId } = Route.useParams();
	const trpc = useTRPC();
	const { data } = useQuery(
		trpc.title.details.queryOptions({ mediaType, tmdbId }),
	);

	if (!data) return <TitlePageSkeleton />;

	const posterUrl = getTmdbImageUrl(data.posterPath, "w500");

	return (
		<div>
			<HeroTrailer
				backdropPath={data.backdropPath}
				trailerKey={data.trailerKey}
			/>

			<div className="mx-auto max-w-[1400px] px-4 md:px-12 py-8 flex flex-col md:flex-row gap-9">
				{/* Poster sidebar */}
				<div className="flex flex-col items-center md:items-start gap-4 shrink-0">
					{posterUrl ? (
						<img
							src={posterUrl}
							alt={`${data.title} poster`}
							className="w-[160px] h-[240px] md:w-[220px] md:h-[330px] rounded-lg object-cover border border-neon-pink/20 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
						/>
					) : (
						<div className="w-[160px] h-[240px] md:w-[220px] md:h-[330px] rounded-lg bg-gradient-to-br from-[#2a1a4e] to-[#1a3a5e] border border-neon-pink/20 shadow-[0_4px_20px_rgba(0,0,0,0.4)]" />
					)}
					<button
						type="button"
						onClick={() => {
							// TODO: implement watchlist
						}}
						className="w-[160px] md:w-[220px] h-11 rounded-md bg-neon-pink/10 border border-neon-pink/30 text-neon-pink font-mono-retro text-xs tracking-wider uppercase hover:bg-neon-pink/20 hover:border-neon-pink/50 hover:shadow-[0_0_15px_rgba(255,45,120,0.2)] transition-all cursor-pointer"
					>
						+ Watchlist
					</button>
				</div>

				{/* Content area */}
				<div className="flex-1 min-w-0 space-y-5">
					{/* Title heading */}
					<div>
						<h1 className="font-display text-3xl md:text-4xl text-cream [text-shadow:0_0_30px_rgba(255,45,120,0.3),0_0_60px_rgba(255,45,120,0.15)]">
							{data.title}
						</h1>
						<p className="mt-1.5 text-sm text-cream/50 font-mono-retro tracking-wide">
							{[data.year, data.runtime, data.rating ? `${data.rating.toFixed(1)} / 10` : null]
								.filter(Boolean)
								.join(" \u00B7 ")}
						</p>
					</div>

					<TitleInfoBar
						contentRating={data.contentRating}
						genres={data.genres}
					/>

					<SectionDivider />

					<Synopsis overview={data.overview} />

					<SectionDivider />

					<TitleMetadata
						director={data.director}
						tagline={data.tagline}
						rating={data.rating}
						seasons={data.seasons}
						episodes={data.episodes}
						status={data.status}
					/>

					<SectionDivider />

					<CastList cast={data.cast} />
				</div>
			</div>
		</div>
	);
}

function TitleErrorPage({ error }: { error: unknown }) {
	const isNotFound =
		error &&
		typeof error === "object" &&
		"data" in error &&
		(error as { data?: { code?: string } }).data?.code === "NOT_FOUND";

	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
			{isNotFound ? (
				<>
					<div className="font-mono-retro text-[11px] text-neon-amber uppercase tracking-[3px] mb-3 [text-shadow:0_0_10px_rgba(255,184,0,0.3)]">
						404
					</div>
					<h1 className="font-display text-2xl md:text-3xl text-cream mb-2">
						Title not found
					</h1>
					<p className="text-cream/50 text-sm mb-6">
						The title you're looking for doesn't exist or has been removed.
					</p>
					<Link
						to="/app/search"
						search={{ q: "", type: "all", sort: "relevance", page: 1 }}
						className="px-5 py-2.5 rounded-md bg-neon-pink/10 border border-neon-pink/30 text-neon-pink font-mono-retro text-xs tracking-wider uppercase hover:bg-neon-pink/20 hover:border-neon-pink/50 transition-all no-underline"
					>
						Back to Search
					</Link>
				</>
			) : (
				<>
					<div className="font-mono-retro text-[11px] text-neon-pink uppercase tracking-[3px] mb-3 [text-shadow:0_0_10px_rgba(255,45,120,0.3)]">
						Error
					</div>
					<h1 className="font-display text-2xl md:text-3xl text-cream mb-2">
						Something went wrong
					</h1>
					<p className="text-cream/50 text-sm mb-6">
						We couldn't load this title. Please try again.
					</p>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="px-5 py-2.5 rounded-md bg-neon-pink/10 border border-neon-pink/30 text-neon-pink font-mono-retro text-xs tracking-wider uppercase hover:bg-neon-pink/20 hover:border-neon-pink/50 transition-all cursor-pointer"
						>
							Retry
						</button>
						<Link
							to="/app/search"
							search={{ q: "", type: "all", sort: "relevance", page: 1 }}
							className="px-5 py-2.5 rounded-md border border-cream/15 text-cream/60 font-mono-retro text-xs tracking-wider uppercase hover:border-cream/30 hover:text-cream/80 transition-all no-underline"
						>
							Back to Search
						</Link>
					</div>
				</>
			)}
		</div>
	);
}
