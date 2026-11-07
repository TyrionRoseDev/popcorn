// Audit finding F91: re-entering onboarding and saving the taste step twice must not create a second
// default watchlist or more than five genres. Usage: verify-popcorn drive onboarding-rerun
import type { Vp } from "../scripts/lib/vp.ts";

async function saveTaste(vp: Vp, genreIds: number[], tmdbIds: number[]) {
	return vp.page.evaluate(
		async ([genres, ids]) => {
			const r = await fetch("/api/trpc/tasteProfile.saveTasteProfile", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					json: {
						genreIds: genres,
						titles: ids.map((tmdbId) => ({ tmdbId, mediaType: "movie", title: `t${tmdbId}`, posterPath: null })),
					},
				}),
			});
			return { status: r.status, body: await r.text() };
		},
		[genreIds, tmdbIds] as const,
	);
}

export default async function onboardingRerun(vp: Vp) {
	const email = `rerun-${Date.now()}@popcorn.test`;
	vp.step(`sign up a new user ${email}`);
	await vp.signIn(email);
	vp.expect(new URL(vp.page.url()).pathname.startsWith("/onboarding"), "a new user lands in onboarding");
	const id = vp.sql(`select id from "user" where email='${email}'`, "new user id")[0][0];

	vp.step("save the taste step, as on the first pass through onboarding");
	const first = await saveTaste(vp, [28, 18, 878], [603, 550, 680]);
	vp.expect(first.status === 200, `first save succeeds (HTTP ${first.status})`);

	vp.step("leave before finishing, come back, and save the taste step again with other picks");
	await vp.goto("/app/feed");
	vp.step(`after leaving, /app/feed sends the user to ${new URL(vp.page.url()).pathname}`);
	const second = await saveTaste(vp, [35, 27, 53], [603, 13, 155]);
	vp.step(`second save returned HTTP ${second.status}`);

	const lists = vp.sql(`select count(*) from watchlist where owner_id='${id}' and type='default'`, "default watchlists")[0][0];
	const genres = vp.sql(`select genre_id from user_genre where user_id='${id}' order by genre_id`, "saved genres").map((r) => Number(r[0]));
	const items = vp.sql(
		`select wi.tmdb_id from watchlist_item wi join watchlist w on w.id=wi.watchlist_id
		 where w.owner_id='${id}' and w.type='default' order by wi.tmdb_id`,
		"default watchlist items",
	).map((r) => Number(r[0]));

	vp.expect(lists === "1", `exactly one default watchlist after a second pass (got ${lists})`);
	vp.expect(genres.length <= 5 && genres.join() === "27,35,53", `genres are the second pass's picks, at most 5 (got ${genres.join()})`);
	vp.expect(new Set(items).size === items.length && [13, 155, 603].every((t) => items.includes(t)), `default list holds the latest picks with no duplicates (got ${items.join()})`);
}
