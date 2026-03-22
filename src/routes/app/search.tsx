import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SearchBar } from "#/components/search/search-bar";
import { SearchLanding } from "#/components/search/search-landing";
import { SearchResults } from "#/components/search/search-results";

const searchParamsSchema = z.object({
	q: z.string().default(""),
	type: z.enum(["all", "movie", "tv"]).default("all"),
	genre: z.number().optional(),
	yearMin: z.number().optional(),
	yearMax: z.number().optional(),
	rating: z.number().optional(),
	sort: z
		.enum(["relevance", "popularity", "rating", "newest", "oldest"])
		.default("relevance"),
	page: z.number().default(1),
});

export const Route = createFileRoute("/app/search")({
	validateSearch: (search) => searchParamsSchema.parse(search),
	component: SearchPage,
});

function SearchPage() {
	const { q, type, genre, yearMin, yearMax, rating, sort, page } =
		Route.useSearch();
	const hasQuery = q.trim().length > 0;

	return (
		<div className="mx-auto max-w-6xl px-4 py-10">
			<div className="mb-8">
				<SearchBar initialValue={q} />
			</div>

			{hasQuery ? (
				<SearchResults
					q={q}
					type={type}
					genre={genre}
					yearMin={yearMin}
					yearMax={yearMax}
					rating={rating}
					sort={sort}
					page={page}
				/>
			) : (
				<SearchLanding />
			)}
		</div>
	);
}
