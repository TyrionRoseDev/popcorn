// Feature: mark-watched (features/mark-watched.md).
// Usage: verify-popcorn drive mark-watched [tmdbMovieId] [searchQuery]
// Default: The Matrix (603). Search -> open title -> Watched -> rate + note -> Save & Done -> reload -> DB.
import type { Vp } from "../scripts/lib/vp.ts";

export default async function markWatched(vp: Vp, args: string[]) {
	const tmdbId = Number(args[0] ?? 603);
	const query = args[1] ?? "The Matrix";
	const note = `verify-popcorn ${new Date().toISOString()}`;
	const { page } = vp;

	await vp.goto("/app/search");
	if (new URL(page.url()).pathname === "/login") await vp.signIn();
	const owner = vp.sql(`select id from "user" where email = 'vera@popcorn.test'`, "acting user")[0][0];

	const before = vp.sql(
		`select count(*) from watch_event where user_id='${owner}' and tmdb_id=${tmdbId} and media_type='movie'`,
		"precondition: no watch events yet",
	);
	vp.expect(before[0][0] === "0", `precondition: no watch_event for movie ${tmdbId} (reset with a fresh 'up' if this fails)`);

	vp.step(`search for "${query}"`);
	await vp.goto("/app/search");
	await page.getByRole("textbox", { name: "Search movies and TV shows" }).fill(query);
	const result = page.locator(`a[href="/app/title/movie/${tmdbId}"]`).first();
	await result.waitFor({ timeout: 30000 });
	await vp.capture("search-results");

	vp.step("open the title page from the result");
	await result.click();
	await page.waitForURL(`**/app/title/movie/${tmdbId}`);
	await vp.settled();
	const watchedButton = page.locator("div.text-center", { has: page.getByText("Watched", { exact: true }) }).getByRole("button");
	await watchedButton.waitFor({ timeout: 30000 });
	await page.waitForLoadState("networkidle");
	await vp.capture("title-before");

	vp.step("press Watched");
	await watchedButton.click();
	await page.getByText("Marked as watched").waitFor();
	const dialog = page.getByRole("dialog", { name: "Review" });
	await dialog.waitFor();
	await vp.capture("review-modal-open");

	vp.step("rate 4 stars, write a note, choose Public, Save & Done");
	await dialog.getByRole("button", { name: "Rate 4 stars" }).click();
	await dialog.getByPlaceholder("Share your thoughts…").fill(note);
	await dialog.getByRole("button", { name: /^Public/ }).click();
	await vp.capture("review-modal-filled");
	await dialog.getByRole("button", { name: "Save & Done" }).click();
	await dialog.waitFor({ state: "hidden", timeout: 15000 });
	vp.step("first watch unlocks an achievement popup; capture it, then Continue");
	const popup = page.getByRole("dialog", { name: /Achievements? Unlocked/ });
	await popup.waitFor({ timeout: 15000 });
	await page.waitForTimeout(1500); // curtain animation; screenshot after it settles
	await vp.capture("achievement-popup");
	await popup.getByRole("button", { name: /continue/i }).click();
	await popup.waitFor({ state: "hidden", timeout: 15000 });
	await page.waitForLoadState("networkidle");
	await vp.capture("after-save");

	vp.step("reload: watch history persists");
	await page.reload();
	await vp.settled();
	await page.getByText("Your Watch History").waitFor({ timeout: 30000 });
	await page.getByText(note).first().waitFor();
	vp.expect(true, "after reload the title page shows 'Your Watch History' with the saved note");
	await vp.capture("title-after-reload");

	const events = vp.sql(
		`select rating, note, visibility from watch_event where user_id='${owner}' and tmdb_id=${tmdbId} and media_type='movie'`,
		"side effect: watch_event row",
	);
	vp.expect(events.length === 1 && events[0][0] === "4" && events[0][1] === note && events[0][2] === "public",
		`exactly one watch_event: rating=4, note matches, visibility=public (got ${JSON.stringify(events)})`);
	const item = vp.sql(
		`select wi.watched from watchlist_item wi join watchlist w on w.id = wi.watchlist_id
		 where w.owner_id='${owner}' and w.type='default' and wi.tmdb_id=${tmdbId} and wi.media_type='movie'`,
		"side effect: default watchlist item marked watched",
	);
	vp.expect(item.length === 1 && item[0][0] === "t", "default watchlist (My Picks) item is watched=true");
	const ach = vp.sql(`select achievement_id from earned_achievement where user_id='${owner}' order by earned_at`, "side effect: achievements");
	vp.expect(ach.length >= 1, `at least one achievement earned (got ${ach.map((r) => r[0]).join(",")})`);
}
