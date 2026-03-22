import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { TRPCContext } from "#/integrations/trpc/init";
import { trpcRouter } from "#/integrations/trpc/router";
import { auth } from "#/lib/auth";

async function createContext({ req }: { req: Request }): Promise<TRPCContext> {
	const session = await auth.api.getSession({ headers: req.headers });
	return { userId: session?.user?.id ?? null };
}

function handler({ request }: { request: Request }) {
	return fetchRequestHandler({
		req: request,
		router: trpcRouter,
		endpoint: "/api/trpc",
		createContext: () => createContext({ req: request }),
	});
}

export const Route = createFileRoute("/api/trpc/$")({
	server: {
		handlers: {
			GET: handler,
			POST: handler,
		},
	},
});
