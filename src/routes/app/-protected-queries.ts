import type { QueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { type TRPCRouter, trpcRouter } from "#/integrations/trpc/router";

interface AppLoaderContext {
	user: { id: string };
	queryClient: QueryClient;
	trpc: TRPCOptionsProxy<TRPCRouter>;
}

// During SSR the tRPC HTTP client sends no cookies, so protected procedures run
// in-process as the signed-in user instead.
export const ensureProfile = createIsomorphicFn()
	.server((context: AppLoaderContext, input: { userId: string }) =>
		trpcRouter.createCaller({ userId: context.user.id }).friend.profile(input),
	)
	.client((context: AppLoaderContext, input: { userId: string }) =>
		context.queryClient.ensureQueryData(
			context.trpc.friend.profile.queryOptions(input),
		),
	);

export const ensureWatchlist = createIsomorphicFn()
	.server((context: AppLoaderContext, input: { watchlistId: string }) =>
		trpcRouter.createCaller({ userId: context.user.id }).watchlist.get(input),
	)
	.client((context: AppLoaderContext, input: { watchlistId: string }) =>
		context.queryClient.ensureQueryData(
			context.trpc.watchlist.get.queryOptions(input),
		),
	);
