import {
	MutationCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { ReactNode } from "react";
import superjson from "superjson";
import { TRPCProvider } from "#/integrations/trpc/react";
import type { TRPCRouter } from "#/integrations/trpc/router";

function getUrl() {
	const base = (() => {
		if (typeof window !== "undefined") return "";
		return `http://localhost:${process.env.PORT ?? 3000}`;
	})();
	return `${base}/api/trpc`;
}

export const trpcClient = createTRPCClient<TRPCRouter>({
	links: [
		httpBatchStreamLink({
			transformer: superjson,
			url: getUrl(),
		}),
	],
});

// Mutable ref so MutationCache can call into React context without circular deps
export let onNewAchievements: ((ids: string[]) => void) | null = null;
export function setOnNewAchievements(fn: ((ids: string[]) => void) | null) {
	onNewAchievements = fn;
}

let context:
	| {
			queryClient: QueryClient;
			trpc: ReturnType<typeof createTRPCOptionsProxy<TRPCRouter>>;
	  }
	| undefined;

export function getContext() {
	if (context) {
		return context;
	}

	const queryClient = new QueryClient({
		defaultOptions: {
			dehydrate: { serializeData: superjson.serialize },
			hydrate: { deserializeData: superjson.deserialize },
		},
		mutationCache: new MutationCache({
			onSuccess: (data) => {
				if (
					data &&
					typeof data === "object" &&
					"newAchievements" in data &&
					Array.isArray(data.newAchievements) &&
					data.newAchievements.length > 0
				) {
					onNewAchievements?.(data.newAchievements as string[]);
				}
			},
		}),
	});

	const serverHelpers = createTRPCOptionsProxy({
		client: trpcClient,
		queryClient: queryClient,
	});
	context = {
		queryClient,
		trpc: serverHelpers,
	};

	return context;
}

export default function TanStackQueryProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { queryClient } = getContext();

	return (
		<QueryClientProvider client={queryClient}>
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				{children}
			</TRPCProvider>
		</QueryClientProvider>
	);
}
