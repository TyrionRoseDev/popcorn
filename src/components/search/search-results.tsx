import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useTRPC } from "#/integrations/trpc/react";
import { FilterSidebarDesktop, FilterSidebarMobile } from "./filter-sidebar";
import { PosterGrid, PosterGridSkeleton } from "./poster-grid";
import { SearchPagination } from "./search-pagination";

interface SearchResultsProps {
	q: string;
	type: "all" | "movie" | "tv";
	genre?: number;
	yearMin?: number;
	yearMax?: number;
	rating?: number;
	sort: "relevance" | "popularity" | "rating" | "newest" | "oldest";
	page: number;
}

const SORT_OPTIONS = [
	{ value: "relevance", label: "Relevance" },
	{ value: "popularity", label: "Popularity" },
	{ value: "rating", label: "Rating" },
	{ value: "newest", label: "Newest" },
	{ value: "oldest", label: "Oldest" },
] as const;

export function SearchResults(props: SearchResultsProps) {
	const { q, type, genre, yearMin, yearMax, rating, sort, page } = props;
	const navigate = useNavigate();
	const trpc = useTRPC();

	const filterProps = { type, genre, yearMin, yearMax, rating };

	const { data, isLoading, isError } = useQuery({
		...trpc.search.results.queryOptions({
			q,
			type,
			genre,
			yearMin,
			yearMax,
			rating,
			sort,
			page,
		}),
		placeholderData: keepPreviousData,
	});

	// Show toast on error
	useEffect(() => {
		if (isError) {
			toast.error("Failed to load search results. Please try again.");
		}
	}, [isError]);

	return (
		<div>
			{/* Results info bar */}
			<div className="mb-5 flex items-center justify-between border-b border-cream/6 pb-3">
				<div className="text-sm text-cream/50" aria-live="polite">
					{isLoading && !data ? (
						<span className="animate-pulse">Searching...</span>
					) : data ? (
						<>
							Found{" "}
							<strong className="text-cream font-semibold">
								{data.totalResults} results
							</strong>{" "}
							for &ldquo;{q}&rdquo;
						</>
					) : null}
				</div>
				<select
					value={sort}
					onChange={(e) =>
						navigate({
							to: "/app/search",
							search: (prev) => ({
								...prev,
								sort: e.target.value as typeof sort,
								page: 1,
							}),
						})
					}
					className="rounded-lg border border-cream/12 bg-cream/6 px-3 py-1.5 text-xs text-cream outline-none cursor-pointer"
				>
					{SORT_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							Sort: {opt.label}
						</option>
					))}
				</select>
			</div>

			{/* Mobile filter trigger */}
			<FilterSidebarMobile {...filterProps} />

			{/* Desktop sidebar + Grid */}
			<div className="flex gap-7">
				<FilterSidebarDesktop {...filterProps} />

				<div className="flex-1 min-w-0" aria-busy={isLoading && !data}>
					{isLoading && !data ? (
						<PosterGridSkeleton />
					) : isError && !data ? (
						<div className="flex flex-col items-center justify-center py-20 text-center">
							<p className="text-cream/50 mb-4">
								Something went wrong. Please try again.
							</p>
							<button
								type="button"
								onClick={() => window.location.reload()}
								className="rounded-lg border border-neon-pink/30 bg-neon-pink/10 px-4 py-2 text-sm text-neon-pink hover:bg-neon-pink/20 transition-colors"
							>
								Retry
							</button>
						</div>
					) : data && data.results.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-20 text-center">
							<p className="text-cream/50 text-lg mb-2">No results found</p>
							<p className="text-cream/30 text-sm">
								Try adjusting your filters or search for something else
							</p>
						</div>
					) : data ? (
						<>
							<PosterGrid items={data.results} />
							<SearchPagination
								currentPage={page}
								totalPages={data.totalPages}
							/>
						</>
					) : null}
				</div>
			</div>
		</div>
	);
}
