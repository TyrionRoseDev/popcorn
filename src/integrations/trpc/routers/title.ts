import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "#/integrations/trpc/init";
import { getTitleQuote } from "#/lib/quote-generator";
import { fetchTitleDetails } from "#/lib/tmdb-title";

export const titleRouter = {
	details: publicProcedure
		.input(
			z.object({
				mediaType: z.enum(["movie", "tv"]),
				tmdbId: z.number(),
			}),
		)
		.query(async ({ input }) => {
			const details = await fetchTitleDetails(input.mediaType, input.tmdbId);

			const quote = await getTitleQuote(
				input.tmdbId,
				input.mediaType,
				details.title,
				details.year,
			);

			return {
				...details,
				tagline: details.tagline,
				featuredQuote: quote?.quote ?? null,
				quoteCharacter: quote?.character ?? null,
			};
		}),
} satisfies TRPCRouterRecord;
