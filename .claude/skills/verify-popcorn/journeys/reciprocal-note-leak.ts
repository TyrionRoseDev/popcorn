// Reproduces the reciprocal-copy leak: a companion's copy of a watch event carries the original's
// note and rating, and once the original goes private that review must not reach anyone but its owner.
// Usage: verify-popcorn drive reciprocal-note-leak. Needs a fresh run. Asserts the safe behaviour,
// so it FAILS while the leak is live.
import type { Vp } from "../scripts/lib/vp.ts";

const SECRET = "SECRET-ORIGIN-NOTE";
const TMDB_ID = 603;
const VERA = "vp-user-vera";
const HUGO = "vp-user-hugo";

async function trpc(vp: Vp, method: "GET" | "POST", path: string, input: unknown) {
	return vp.page.evaluate(
		async ([m, p, i]) => {
			const body = JSON.stringify({ json: i });
			const r =
				m === "GET"
					? await fetch(`/api/trpc/${p}?input=${encodeURIComponent(body)}`)
					: await fetch(`/api/trpc/${p}`, { method: "POST", headers: { "content-type": "application/json" }, body });
			return { status: r.status, body: await r.text() };
		},
		[method, path, input] as const,
	);
}

type Origin = { note: string | null; rating: number | null } | null;

async function originsOnHugosCopy(vp: Vp) {
	const reads = {
		getUserEvents: await trpc(vp, "GET", "watchEvent.getUserEvents", { userId: HUGO }),
		getForTitle: await trpc(vp, "GET", "watchEvent.getForTitle", { tmdbId: TMDB_ID, mediaType: "movie", userId: HUGO }),
		getFeed: await trpc(vp, "GET", "watchEvent.getFeed", { userId: HUGO }),
		"getFeed(all)": await trpc(vp, "GET", "watchEvent.getFeed", { filter: "all" }),
	};
	const out: Record<string, { status: number; origins: Origin[]; leaksNote: boolean }> = {};
	for (const [name, r] of Object.entries(reads)) {
		const data = r.status === 200 ? JSON.parse(r.body).result.data.json : null;
		const events: { userId: string; tmdbId: number; originEvent: Origin }[] =
			name === "getUserEvents"
				? (data?.items ?? [])
				: name === "getForTitle"
					? (data ?? [])
					: (data?.items ?? []).filter((i: { type: string }) => i.type === "watch_event").map((i: { data: unknown }) => i.data);
		const copies = events.filter((e) => e.userId === HUGO && e.tmdbId === TMDB_ID);
		out[name] = { status: r.status, origins: copies.map((e) => e.originEvent), leaksNote: r.body.includes(SECRET) };
	}
	return out;
}

function hidden(reads: Awaited<ReturnType<typeof originsOnHugosCopy>>, expectCopy: boolean) {
	return Object.entries(reads).every(
		([name, r]) =>
			r.status === 200 &&
			!r.leaksNote &&
			r.origins.every((o) => o === null) &&
			(name === "getFeed(all)" || !expectCopy || r.origins.length === 1),
	);
}

function shows(reads: Awaited<ReturnType<typeof originsOnHugosCopy>>) {
	return ["getUserEvents", "getForTitle", "getFeed"].every((name) => {
		const o = reads[name].origins;
		return o.length === 1 && o[0]?.note === SECRET && o[0]?.rating === 4;
	});
}

async function as(vp: Vp, email: string) {
	await vp.context.clearCookies();
	await vp.signIn(email);
	await vp.goto("/app");
}

export default async function reciprocalNoteLeak(vp: Vp) {
	vp.sql(
		`insert into "user" (id, name, email, email_verified, username, onboarding_completed, created_at, updated_at) values
		 ('vp-user-hugo','Hugo','hugo@popcorn.test',true,'hugo',true,now(),now()),
		 ('vp-user-nina','Nina','nina@popcorn.test',true,'nina',true,now(),now()),
		 ('vp-user-mallory','Mallory','mallory@popcorn.test',true,'mallory',true,now(),now())
		 on conflict (email) do nothing`,
		"setup: Hugo (Vera's friend), Nina (Hugo's friend only), Mallory (stranger)",
	);
	vp.sql(
		`insert into friendship (id, requester_id, addressee_id, status, created_at, updated_at) values
		 ('vp-friendship-vera-hugo','vp-user-vera','vp-user-hugo','accepted',now(),now()),
		 ('vp-friendship-hugo-nina','vp-user-hugo','vp-user-nina','accepted',now(),now())
		 on conflict do nothing`,
		"setup: friendships",
	);

	vp.step("Vera logs The Matrix with a note and 4 stars, tags Hugo, public");
	await as(vp, "vera@popcorn.test");
	const created = await trpc(vp, "POST", "watchEvent.create", {
		tmdbId: TMDB_ID,
		mediaType: "movie",
		titleName: "The Matrix",
		rating: 4,
		note: SECRET,
		visibility: "public",
		companions: [{ friendId: HUGO, name: "Hugo" }],
	});
	vp.expect(created.status === 200, `watchEvent.create returned 200 (got ${created.status} ${created.body.slice(0, 200)})`);
	const originId: string = JSON.parse(created.body).result.data.json.id;

	vp.step("Vera makes her entry private");
	const priv = await trpc(vp, "POST", "watchEvent.update", { id: originId, visibility: "private" });
	vp.expect(priv.status === 200, `watchEvent.update returned 200 (got ${priv.status})`);
	const rows = vp.sql(
		`select user_id, visibility, note, rating, origin_event_id from watch_event where tmdb_id=${TMDB_ID} order by created_at`,
		"rows: Vera's private original and Hugo's public copy",
	);
	const hugoRow = rows.find((r) => r[0] === HUGO);
	vp.expect(
		rows.find((r) => r[0] === VERA)?.[1] === "private" && hugoRow?.[1] === "public" && hugoRow?.[4] === originId,
		`DB: Vera's original is private, Hugo's copy is public and points at it (${JSON.stringify(rows)})`,
	);
	const veraPrivate = await originsOnHugosCopy(vp);

	const results: [string, boolean, unknown][] = [];
	for (const [who, email] of [
		["Mallory (stranger)", "mallory@popcorn.test"],
		["Nina (Hugo's friend, not Vera's)", "nina@popcorn.test"],
		["Hugo (copy owner; original is private)", "hugo@popcorn.test"],
	] as const) {
		vp.step(`${who} reads Hugo's events, title page data and feed`);
		await as(vp, email);
		const reads = await originsOnHugosCopy(vp);
		results.push([`${who} cannot see Vera's private note or rating`, hidden(reads, true), reads]);
		if (email === "mallory@popcorn.test") {
			for (const width of [390, 1440]) {
				await vp.page.setViewportSize({ width, height: 900 });
				await vp.goto(`/app/profile/${HUGO}`);
				await vp.capture(`mallory-hugo-profile-${width}`);
			}
		}
	}
	results.push(["Vera still sees her own note on Hugo's copy", shows(veraPrivate), veraPrivate]);

	vp.step("Vera shares her entry with companions only");
	await as(vp, "vera@popcorn.test");
	const comp = await trpc(vp, "POST", "watchEvent.update", { id: originId, visibility: "companion" });
	vp.expect(comp.status === 200, `watchEvent.update to companion returned 200 (got ${comp.status})`);

	await as(vp, "hugo@popcorn.test");
	const hugoCompanion = await originsOnHugosCopy(vp);
	results.push(["Hugo, a companion, sees Vera's companion-only note", shows(hugoCompanion), hugoCompanion]);
	await vp.goto(`/app/title/movie/${TMDB_ID}`);
	await vp.capture("hugo-title-page-companion");

	await as(vp, "mallory@popcorn.test");
	const malloryCompanion = await originsOnHugosCopy(vp);
	results.push(["Mallory still cannot see the companion-only note", hidden(malloryCompanion, true), malloryCompanion]);

	for (const [label, ok, reads] of results) {
		vp.step(`${ok ? "SAFE" : "LEAK"} ${label}: ${JSON.stringify(reads).slice(0, 600)}`);
	}
	vp.expect(
		results.every(([, ok]) => ok),
		"the origin review reaches only viewers allowed to see the original",
	);
}
