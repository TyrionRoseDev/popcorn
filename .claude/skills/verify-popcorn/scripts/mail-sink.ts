// Local stand-in for the Resend HTTP API (the app reads RESEND_BASE_URL at startup).
// Every POST /emails is written to $VP_MAIL_DIR/<timestamp>-<n>.json and answered like Resend.
// Usage: VP_MAIL_DIR=/path bun mail-sink.ts <port>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const port = Number(process.argv[2]);
const dir = process.env.VP_MAIL_DIR;
if (!port || !dir) {
	console.error("usage: VP_MAIL_DIR=<dir> bun mail-sink.ts <port>");
	process.exit(2);
}
mkdirSync(dir, { recursive: true });
let n = 0;

Bun.serve({
	hostname: "127.0.0.1",
	port,
	async fetch(req) {
		const url = new URL(req.url);
		if (req.method === "GET" && url.pathname === "/__health") {
			return new Response("mail-sink ok");
		}
		if (req.method === "POST" && url.pathname === "/emails") {
			const body = (await req.json()) as Record<string, unknown>;
			const id = `vp-mail-${Date.now()}-${++n}`;
			const html = String(body.html ?? "");
			// The first absolute link back to the app is the magic / verification link.
			const link =
				html.match(/href="(http[^"]*\/api\/auth\/[^"]*)"/)?.[1]?.replaceAll("&amp;", "&") ??
				null;
			const record = { id, receivedAt: new Date().toISOString(), link, ...body };
			writeFileSync(join(dir, `${Date.now()}-${n}.json`), JSON.stringify(record, null, 2));
			console.log(`captured ${id} to=${JSON.stringify(body.to)} subject=${JSON.stringify(body.subject)}`);
			return Response.json({ id });
		}
		return new Response("not found", { status: 404 });
	},
});
console.log(`mail-sink listening on 127.0.0.1:${port} dir=${dir}`);
