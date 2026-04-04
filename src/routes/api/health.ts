import { createFileRoute } from "@tanstack/react-router";

const HEALTH_HEADERS = {
	"cache-control": "no-store, max-age=0",
	"content-type": "text/plain; charset=utf-8",
};

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: () => new Response("ok", { status: 200, headers: HEALTH_HEADERS }),
			HEAD: () => new Response(null, { status: 200, headers: HEALTH_HEADERS }),
		},
	},
});
