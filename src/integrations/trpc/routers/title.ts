import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "#/integrations/trpc/init";
import { fetchTitleDetails } from "#/lib/tmdb-title";

export const titleRouter = {
	details: publicProcedure
		.input(
			z.object({
				mediaType: z.enum(["movie", "tv"]),
				tmdbId: z.number(),
			}),
		)
		.query(async ({ input }) =>
			fetchTitleDetails(input.mediaType, input.tmdbId),
		),
} satisfies TRPCRouterRecord;
