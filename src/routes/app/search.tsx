import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

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
	const search = Route.useSearch();

	return (
		<div className="min-h-screen bg-drive-in-bg">
			<div className="mx-auto max-w-6xl px-4 py-10">
				<h1 className="font-display text-2xl text-cream mb-8">Search</h1>
				<p className="text-cream/50">Search page — components coming next.</p>
				<pre className="text-cream/30 text-xs mt-4">
					{JSON.stringify(search, null, 2)}
				</pre>
			</div>
		</div>
	);
}
