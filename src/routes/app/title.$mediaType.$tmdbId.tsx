import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ArcadeButton } from "#/components/title/arcade-button";
import { CarSilhouettes } from "#/components/title/car-silhouettes";
import { CastList } from "#/components/title/cast-list";
import { DriveInScreen } from "#/components/title/drive-in-screen";
import { NowShowingMarquee } from "#/components/title/now-showing-marquee";
import { PosterDisplayCase } from "#/components/title/poster-display-case";
import { SectionBoard } from "#/components/title/section-board";
import { Synopsis } from "#/components/title/synopsis";
import { TitleInfoBar } from "#/components/title/title-info-bar";
import { TitleMetadata } from "#/components/title/title-metadata";
import { TitlePageAtmosphere } from "#/components/title/title-page-atmosphere";
import { TitlePageSkeleton } from "#/components/title/title-page-skeleton";
import { useTRPC } from "#/integrations/trpc/react";

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

	return (
		<div className="relative z-10">
			<TitlePageAtmosphere />

			<DriveInScreen
				backdropPath={data.backdropPath}
				trailerKey={data.trailerKey}
			/>

			<CarSilhouettes />

			<NowShowingMarquee
				title={data.title}
				year={data.year}
				runtime={data.runtime}
				contentRating={data.contentRating}
			/>

			<div className="max-w-[1060px] mx-auto mt-12 px-8 pb-[120px] flex flex-col md:flex-row gap-12">
				{/* Left column */}
				<div className="w-full md:w-[280px] flex-shrink-0">
					<PosterDisplayCase
						posterPath={data.posterPath}
						title={data.title}
					/>
					<TitleInfoBar
						contentRating={data.contentRating}
						genres={data.genres}
						className="mt-5"
					/>
					<div className="flex gap-4 justify-center mt-6">
						<ArcadeButton icon="+" label="Watchlist" color="pink" />
						<ArcadeButton icon="✓" label="Watched" color="cyan" />
						<ArcadeButton icon="✉" label="Invite" color="amber" />
					</div>
				</div>

				{/* Right column */}
				<div className="flex-1 min-w-0">
					<SectionBoard icon="📋" title="Synopsis">
						<Synopsis
							overview={data.overview}
							tagline={data.tagline}
						/>
					</SectionBoard>

					<TitleMetadata
						director={data.director}
						rating={data.rating}
						contentRating={data.contentRating}
						runtime={data.runtime}
						seasons={data.seasons}
						episodes={data.episodes}
						status={data.status}
						className="mt-7"
					/>

					<SectionBoard icon="🎭" title="Cast" className="mt-7">
						<CastList cast={data.cast} />
					</SectionBoard>
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
