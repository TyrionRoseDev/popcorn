import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "#/integrations/trpc/react";
import type { FeedItem } from "#/lib/feed-assembler";
import { GenrePills } from "./genre-pills";
import { SearchBar } from "./search-bar";
import { SelectionFooter } from "./selection-footer";
import { TitleGrid } from "./title-grid";

const MIN_GENRES = 3;
const MAX_TITLES = 10;

function titleKey(item: FeedItem) {
	return `${item.tmdbId}-${item.mediaType}`;
}

export function TasteProfileStep({ onNext }: { onNext: () => void }) {
	const [selectedGenres, setSelectedGenres] = useState<Set<number>>(new Set());
	const [selectedTitles, setSelectedTitles] = useState<Map<string, FeedItem>>(
		new Map(),
	);
	const [searchQuery, setSearchQuery] = useState("");

	const trpc = useTRPC();
	const isSearchMode = searchQuery.length >= 2;
	const hasEnoughGenres = selectedGenres.size >= MIN_GENRES;

	// --- Queries ---

	const genresQuery = useQuery(trpc.tasteProfile.getGenres.queryOptions());

	const genreIdsArray = useMemo(
		() => Array.from(selectedGenres),
		[selectedGenres],
	);

	const feedQuery = useInfiniteQuery(
		trpc.tasteProfile.getFeed.infiniteQueryOptions(
			{ genreIds: genreIdsArray },
			{
				getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
				enabled: hasEnoughGenres && !isSearchMode,
			},
		),
	);

	const searchQueryResult = useInfiniteQuery(
		trpc.tasteProfile.search.infiniteQueryOptions(
			{ query: searchQuery },
			{
				getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
				enabled: isSearchMode,
			},
		),
	);

	const saveMutation = useMutation(
		trpc.tasteProfile.saveTasteProfile.mutationOptions({
			onSuccess: () => onNext(),
			onError: (error) => {
				toast.error(error.message || "Failed to save. Please try again.");
			},
		}),
	);

	// --- Derived data ---

	const activeQuery = isSearchMode ? searchQueryResult : feedQuery;
	const items = useMemo(
		() => activeQuery.data?.pages.flatMap((page) => page.items) ?? [],
		[activeQuery.data],
	);

	// --- Handlers ---

	const handleGenreToggle = useCallback((genreId: number) => {
		setSelectedGenres((prev) => {
			const next = new Set(prev);
			if (next.has(genreId)) {
				next.delete(genreId);
			} else {
				next.add(genreId);
			}
			return next;
		});
	}, []);

	const handleTitleToggle = useCallback((item: FeedItem) => {
		setSelectedTitles((prev) => {
			const key = titleKey(item);
			const next = new Map(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				if (next.size >= MAX_TITLES) {
					toast("Maximum 10 titles selected");
					return prev;
				}
				next.set(key, item);
			}
			return next;
		});
	}, []);

	const handleDeselect = useCallback((key: string) => {
		setSelectedTitles((prev) => {
			const next = new Map(prev);
			next.delete(key);
			return next;
		});
	}, []);

	const handleContinue = useCallback(() => {
		saveMutation.mutate({
			genreIds: Array.from(selectedGenres),
			titles: Array.from(selectedTitles.values()).map((item) => ({
				tmdbId: item.tmdbId,
				mediaType: item.mediaType,
			})),
		});
	}, [selectedGenres, selectedTitles, saveMutation]);

	// --- Empty states ---

	const emptyMessage = !hasEnoughGenres
		? `Pick at least ${MIN_GENRES} genres to see suggestions`
		: null;

	return (
		<div className="pb-24">
			<h2 className="mb-1.5 font-display text-2xl text-cream">
				What do you love watching?
			</h2>
			<p className="mb-6 text-sm text-cream/50">
				Pick 3-5 genres, then choose 3-10 movies or shows you love
			</p>

			{/* Search */}
			<div className="mb-4">
				<SearchBar value={searchQuery} onChange={setSearchQuery} />
			</div>

			{/* Genre pills */}
			<div
				className={`mb-6 ${isSearchMode ? "opacity-40 pointer-events-none" : ""}`}
			>
				{genresQuery.data ? (
					<GenrePills
						genres={genresQuery.data}
						selected={selectedGenres}
						onToggle={handleGenreToggle}
						disabled={isSearchMode}
					/>
				) : (
					<div className="flex flex-wrap gap-2">
						{[
							"s1",
							"s2",
							"s3",
							"s4",
							"s5",
							"s6",
							"s7",
							"s8",
							"s9",
							"s10",
							"s11",
							"s12",
						].map((id) => (
							<div
								key={id}
								className="h-9 w-20 animate-pulse rounded-full bg-cream/5"
							/>
						))}
					</div>
				)}
			</div>

			{/* Empty state or grid */}
			{emptyMessage && !isSearchMode ? (
				<div className="py-16 text-center text-cream/30">{emptyMessage}</div>
			) : (
				<TitleGrid
					items={items}
					selectedTitles={selectedTitles}
					onToggleTitle={handleTitleToggle}
					maxTitles={MAX_TITLES}
					hasNextPage={activeQuery.hasNextPage ?? false}
					isFetchingNextPage={activeQuery.isFetchingNextPage}
					fetchNextPage={() => activeQuery.fetchNextPage()}
					isLoading={activeQuery.isLoading}
				/>
			)}

			{/* Search empty state */}
			{isSearchMode && !searchQueryResult.isLoading && items.length === 0 && (
				<div className="py-16 text-center text-cream/30">
					No results for &ldquo;{searchQuery}&rdquo;
				</div>
			)}

			{/* Error state */}
			{activeQuery.isError && (
				<div className="py-8 text-center">
					<p className="mb-3 text-sm text-red-400">
						Failed to load content. Please try again.
					</p>
					<button
						type="button"
						onClick={() => activeQuery.refetch()}
						className="rounded-lg border border-cream/20 px-4 py-2 text-sm text-cream/60 hover:text-cream"
					>
						Retry
					</button>
				</div>
			)}

			{/* Selection footer */}
			<SelectionFooter
				selectedTitles={selectedTitles}
				onDeselect={handleDeselect}
				onContinue={handleContinue}
				isSaving={saveMutation.isPending}
			/>
		</div>
	);
}
