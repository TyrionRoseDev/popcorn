import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye } from "lucide-react";
import { ShuffleAtmosphere } from "#/components/shuffle/shuffle-atmosphere";
import { useTRPC } from "#/integrations/trpc/react";
import { getTmdbImageUrl } from "#/lib/tmdb";

export const Route = createFileRoute("/app/shuffle/hidden")({
	component: HiddenTitlesPage,
});

function HiddenTitlesPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: hiddenTitles, isLoading } = useQuery(
		trpc.shuffle.getHiddenTitles.queryOptions(),
	);

	const unhideMutation = useMutation({
		...trpc.shuffle.unhideTitle.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: trpc.shuffle.getHiddenTitles.queryKey(),
			});
		},
	});

	return (
		<>
			<ShuffleAtmosphere />

			<div
				className="relative mx-auto max-w-2xl px-4 pt-6 pb-12"
				style={{ zIndex: 2 }}
			>
				{/* Back link */}
				<Link
					to="/app/shuffle"
					className="mb-6 inline-flex items-center gap-1.5 font-mono-retro text-xs uppercase tracking-wider text-cream/40 no-underline transition-colors hover:text-cream/70"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Shuffle
				</Link>

				{/* Header */}
				<h1 className="mb-1 font-display text-2xl text-cream">Hidden Titles</h1>
				<p className="mb-8 font-mono-retro text-xs text-cream/40">
					Titles you've hidden from Showtime Shuffle. Unhide them to see them
					again.
				</p>

				{/* Content */}
				{isLoading ? (
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
						{Array.from({ length: 6 }, (_, i) => (
							<div
								key={`skeleton-${
									// biome-ignore lint/suspicious/noArrayIndexKey: skeleton items
									i
								}`}
								className="aspect-[2/3] animate-pulse rounded-xl bg-cream/5"
							/>
						))}
					</div>
				) : !hiddenTitles?.length ? (
					<div className="flex flex-col items-center py-20 text-center">
						<p className="text-lg text-cream/50">No hidden titles</p>
						<p className="mt-1 text-sm text-cream/30">
							When you hide titles during shuffle, they'll appear here.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
						{hiddenTitles.map((item) => (
							<HiddenTitleCard
								key={item.id}
								tmdbId={item.tmdbId}
								mediaType={item.mediaType}
								onUnhide={() =>
									unhideMutation.mutate({
										tmdbId: item.tmdbId,
										mediaType: item.mediaType as "movie" | "tv",
									})
								}
								isUnhiding={unhideMutation.isPending}
							/>
						))}
					</div>
				)}
			</div>
		</>
	);
}

function HiddenTitleCard({
	tmdbId,
	mediaType,
	onUnhide,
	isUnhiding,
}: {
	tmdbId: number;
	mediaType: string;
	onUnhide: () => void;
	isUnhiding: boolean;
}) {
	const trpc = useTRPC();

	// Fetch title details for display
	const { data: details } = useQuery(
		trpc.title.details.queryOptions({
			tmdbId,
			mediaType: mediaType as "movie" | "tv",
		}),
	);

	const posterUrl = details?.posterPath
		? getTmdbImageUrl(details.posterPath, "w342")
		: null;

	return (
		<div className="group relative overflow-hidden rounded-xl border border-cream/10 bg-drive-in-card">
			{/* Poster */}
			<div className="aspect-[2/3]">
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={details?.title ?? ""}
						className="h-full w-full object-cover"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-cream/5">
						<span className="font-mono-retro text-[10px] text-cream/20">
							No Poster
						</span>
					</div>
				)}
			</div>

			{/* Overlay with title + unhide */}
			<div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-3">
				<p className="text-sm font-semibold leading-tight text-cream">
					{details?.title ?? "Loading..."}
				</p>
				{details?.year && (
					<p className="mt-0.5 text-xs text-cream/50">{details.year}</p>
				)}
			</div>

			{/* Unhide button — visible on hover / always on mobile */}
			<button
				type="button"
				onClick={onUnhide}
				disabled={isUnhiding}
				className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-xs font-medium text-cream/70 opacity-0 backdrop-blur-sm transition-all hover:bg-black/90 hover:text-cream group-hover:opacity-100 max-sm:opacity-100"
			>
				<Eye className="h-3 w-3" />
				Unhide
			</button>
		</div>
	);
}
