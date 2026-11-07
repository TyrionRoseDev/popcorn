// Local stand-in for the TMDB API (the app reads TMDB_BASE_URL). Serves recorded fixtures keyed by
// path and sorted query from <fixtures-dir>/<path>/<query>.json. A miss answers 404 and logs MISS.
// Date values become DATE in the key, because the app computes them relative to today.
// With --record it forwards every request to the real API, passing through the app's Authorization
// header, and saves the response. The header is never logged or written.
// Usage: bun tmdb-stub.ts <port> <fixtures-dir> [--record]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const UPSTREAM = "https://api.themoviedb.org";
const port = Number(process.argv[2]);
const fixturesDir = process.argv[3];
const record = process.argv.includes("--record");
if (!port || !fixturesDir) {
	console.error("usage: bun tmdb-stub.ts <port> <fixtures-dir> [--record]");
	process.exit(2);
}

interface Fixture {
	status: number;
	body: unknown;
}

function fixturePath(dir: string, url: URL): string {
	const params = [...url.searchParams]
		.map(([k, v]) => [k, /^\d{4}-\d{2}-\d{2}$/.test(v) ? "DATE" : v])
		.sort(([a], [b]) => a.localeCompare(b));
	const query = new URLSearchParams(params).toString();
	return join(dir, url.pathname, `${query || "index"}.json`);
}

async function recordFixture(req: Request, url: URL, file: string): Promise<Fixture> {
	const upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, {
		headers: { authorization: req.headers.get("authorization") ?? "", accept: "application/json" },
	});
	const fixture: Fixture = { status: upstream.status, body: await upstream.json() };
	const text = `${JSON.stringify(fixture, null, "\t")}\n`;
	// Vite watches the repo and reloads the page on every write, which refetches and writes again.
	if (!existsSync(file) || readFileSync(file, "utf8") !== text) {
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, text);
	}
	return fixture;
}

Bun.serve({
	hostname: "127.0.0.1",
	port,
	async fetch(req) {
		const url = new URL(req.url);
		if (url.pathname === "/__health") return new Response("tmdb-stub ok");
		const file = fixturePath(fixturesDir, url);
		const key = `${url.pathname}${url.search}`;
		if (record) {
			const fixture = await recordFixture(req, url, file);
			console.log(`RECORD ${fixture.status} ${key}`);
			return Response.json(fixture.body, { status: fixture.status });
		}
		if (!existsSync(file)) {
			console.log(`MISS ${key}`);
			return Response.json({ status_message: `no fixture for ${key}` }, { status: 404 });
		}
		const fixture = JSON.parse(readFileSync(file, "utf8")) as Fixture;
		console.log(`HIT ${fixture.status} ${key}`);
		return Response.json(fixture.body, { status: fixture.status });
	},
});
console.log(`tmdb-stub listening on 127.0.0.1:${port} fixtures=${fixturesDir} mode=${record ? "record" : "replay"}`);
