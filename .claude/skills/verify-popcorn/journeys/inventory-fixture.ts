// Builds the data the inventory needs, through the real UI, and captures one-shot overlays as they fire.
// Usage: verify-popcorn drive <abs path>/inventory-fixture.ts <phase> [phase...]
// Phases, in order: users | films | tv | tv-extras | lists | felix | social | shuffle
// Run order for a full inventory is in inventory.ts. Every step lands in fixture-steps.jsonl.
import type { Page } from "playwright-core";
import type { Vp } from "../scripts/lib/vp.ts";
import { ACTORS, arcade, createHarness, createWatchlist, dismissAchievements, type Harness, onboardQuick, saveSession } from "./inventory-lib.ts";

const FILMS = {
	matrix: 603, inception: 27205, parasite: 496243, madMax: 76341, shining: 694, alien: 348,
	dune: 438631, spirited: 129, twilight: 8966, heat: 949, arrival: 329865,
} as const;
const SHOWS = { breakingBad: 1396, chernobyl: 87108, queensGambit: 87739, mare: 115004 } as const;

interface WatchOpts {
	rating?: number;
	note?: string;
	visibility?: "Public" | "Private";
	skip?: boolean;
	remind?: boolean;
	companion?: string;
	snapFirstAchievement?: boolean;
}

async function watchFilm(h: Harness, page: Page, tmdbId: number, o: WatchOpts) {
	await h.open(page, `/app/title/movie/${tmdbId}`);
	const button = arcade(page, "Watched");
	await button.waitFor({ timeout: 30000 });
	await page.waitForLoadState("networkidle").catch(() => {});
	await button.click();
	const dialog = page.getByRole("dialog", { name: "Review" });
	await dialog.waitFor({ timeout: 20000 });
	if (o.skip) {
		await dialog.getByRole("button", { name: "skip", exact: true }).click();
	} else if (o.remind) {
		await dialog.getByRole("button", { name: "remind me later" }).click();
	} else {
		if (o.rating) await dialog.getByRole("button", { name: `Rate ${o.rating} stars` }).click();
		if (o.note) await dialog.getByPlaceholder("Share your thoughts…").fill(o.note);
		if (o.companion) {
			await dialog.getByRole("button", { name: /Watched with/ }).click();
			const ww = page.getByRole("dialog", { name: "Watched With" });
			await ww.waitFor();
			await page.waitForTimeout(800);
			await h.snap(page, { slug: "review-watched-with", route: "/app/title/movie/$id", state: "overlay", actor: "vera" });
			await ww.getByPlaceholder("@friend or a name…").fill(o.companion);
			await ww.getByRole("button", { name: new RegExp(o.companion, "i") }).first().click({ timeout: 8000 });
			await ww.getByRole("button", { name: /done/i }).click();
			await ww.waitFor({ state: "hidden" });
		}
		if (o.visibility) await dialog.getByRole("button", { name: new RegExp(`^${o.visibility}`) }).click();
		await dialog.getByRole("button", { name: "Save & Done" }).click();
	}
	await dialog.waitFor({ state: "hidden", timeout: 20000 });
	await dismissAchievements(h, page, !!o.snapFirstAchievement);
	await page.waitForLoadState("networkidle").catch(() => {});
}

async function trackShow(h: Harness, page: Page, tmdbId: number) {
	await h.open(page, `/app/title/tv/${tmdbId}`);
	const button = arcade(page, "Watched");
	await button.waitFor({ timeout: 30000 });
	await page.waitForLoadState("networkidle").catch(() => {});
	await button.click();
	await page.waitForURL(`**/app/tracker/${tmdbId}`, { timeout: 30000 });
	await h.settle(page);
	await page.getByRole("button", { name: "Write" }).waitFor({ timeout: 30000 });
}

async function addToWatchlist(h: Harness, page: Page, media: "movie" | "tv", tmdbId: number, listName: string) {
	await h.open(page, `/app/title/${media}/${tmdbId}`);
	const button = arcade(page, "Watchlist");
	await button.waitFor({ timeout: 30000 });
	await page.waitForLoadState("networkidle").catch(() => {});
	await button.click();
	await page.getByRole("button", { name: listName }).click();
	await page.getByText(`Added to ${listName}`).first().waitFor({ timeout: 15000 });
}

async function step(h: Harness, name: string, fn: () => Promise<unknown>, page?: Page) {
	try {
		const detail = await fn();
		h.logStep(name, true, typeof detail === "string" ? detail : "");
	} catch (err) {
		h.logStep(name, false, (err as Error).message.split("\n").slice(0, 3).join(" ").slice(0, 400));
		await page?.screenshot({ path: `${h.vp.dir}/fail-${name.replace(/\W+/g, "-").slice(0, 50)}.png` }).catch(() => {});
	}
}

function userId(vp: Vp, email: string) {
	return vp.sql(`select id from "user" where email='${email}'`, `id of ${email}`)[0]?.[0];
}

function watchlistId(vp: Vp, owner: string, name: string) {
	return vp.sql(`select id from watchlist where owner_id='${owner}' and name='${name}'`, `watchlist ${name}`)[0]?.[0];
}

async function phaseUsers(h: Harness) {
	const { vp } = h;
	for (const [actor, username] of [["stella", "stellastranger"], ["rita", "ritarequester"], ["blake", "blakeblocked"]] as const) {
		await step(h, `new account ${actor} through magic link and onboarding`, async () => {
			if (userId(vp, ACTORS[actor])) return "already exists";
			const ctx = await h.vp.context.browser()?.newContext({ baseURL: vp.appUrl, viewport: { width: 1440, height: 900 } });
			if (!ctx) throw new Error("no browser");
			const page = await ctx.newPage();
			await h.signInReal(ACTORS[actor], page);
			vp.expect(new URL(page.url()).pathname === "/onboarding", `${actor} lands on /onboarding`);
			await onboardQuick(page, username);
			await saveSession(h, actor, page);
			await ctx.close();
		});
	}
	const f = h.fixture();
	for (const actor of ["vera", "felix", "stella", "rita", "blake"] as const) f.users[actor] = userId(vp, ACTORS[actor]);
	h.saveFixture(f);
}

async function phaseFilms(h: Harness) {
	const page = await h.newPage("vera", 1440);
	await step(h, "film watched, 4 stars, note, public (first watch fires achievement)", () =>
		watchFilm(h, page, FILMS.matrix, {
			rating: 4, visibility: "Public", snapFirstAchievement: true,
			note: "Still the best lobby scene ever filmed. Rewatched the bullet time twice.",
		}));
	await step(h, "film watched, skip review", () => watchFilm(h, page, FILMS.inception, { skip: true }));
	await step(h, "film watched, rating only, watched with Felix", () =>
		watchFilm(h, page, FILMS.parasite, { rating: 5, companion: "felixfriend", visibility: "Public" }));
	await step(h, "film watched, private note", () =>
		watchFilm(h, page, FILMS.madMax, { rating: 3, note: "Too loud for a Tuesday.", visibility: "Private" }));
	await step(h, "film watched, remind me later", () => watchFilm(h, page, FILMS.arrival, { remind: true }));
	await step(h, "film rewatch attempt: press Watched twice on a rated film", async () => {
		const before = h.vp.sql(`select count(*) from watch_event where user_id='vp-user-vera' and tmdb_id=${FILMS.matrix}`, "rewatch before")[0][0];
		await h.open(page, `/app/title/movie/${FILMS.matrix}`);
		const button = arcade(page, "Watched");
		await button.waitFor({ timeout: 30000 });
		await page.waitForLoadState("networkidle").catch(() => {});
		await button.click();
		await page.waitForTimeout(2500);
		await h.snap(page, { slug: "film-rewatch-press-1", route: "/app/title/movie/$id", state: "overlay", actor: "vera" });
		await button.click();
		await page.waitForTimeout(2500);
		await h.snap(page, { slug: "film-rewatch-press-2", route: "/app/title/movie/$id", state: "overlay", actor: "vera" });
		const after = h.vp.sql(`select count(*) from watch_event where user_id='vp-user-vera' and tmdb_id=${FILMS.matrix}`, "rewatch after")[0][0];
		return `watch_event rows for Matrix ${before} -> ${after}`;
	});
	await page.close();
}

async function phaseTv(h: Harness) {
	const page = await h.newPage("vera", 1440);
	await step(h, "track Breaking Bad, mark season 1", async () => {
		await trackShow(h, page, SHOWS.breakingBad);
		await page.getByRole("button", { name: "Mark All" }).nth(1).click();
		await page.getByText(/Marked \d+ episodes? as watched/).first().waitFor({ timeout: 20000 });
		await dismissAchievements(h, page, false);
	});
	await step(h, "finish Chernobyl with the strip Mark All, capture the celebration", async () => {
		await trackShow(h, page, SHOWS.chernobyl);
		await page.getByRole("button", { name: "Mark All" }).first().click();
		const done = page.getByRole("dialog", { name: "Show Complete" });
		await done.waitFor({ timeout: 25000 });
		await page.waitForTimeout(1500);
		await h.snap(page, { slug: "completion-celebration-stacked-under-achievement", route: "/app/tracker/$id", state: "overlay", actor: "vera" });
		await dismissAchievements(h, page, false);
		await done.getByRole("button", { name: "Remind Me Later" }).click();
	});
	await step(h, "finish The Queen's Gambit, remind later", async () => {
		await trackShow(h, page, SHOWS.queensGambit);
		await page.getByRole("button", { name: "Mark All" }).first().click();
		const done = page.getByRole("dialog", { name: "Show Complete" });
		await done.waitFor({ timeout: 25000 });
		await done.getByRole("button", { name: "Remind Me Later" }).click();
		await dismissAchievements(h, page, false);
	});
	await step(h, "start a rewatch of Chernobyl", async () => {
		await h.open(page, `/app/tracker/${SHOWS.chernobyl}`);
		await page.getByRole("button", { name: "Rewatch" }).click();
		const dialog = page.getByRole("dialog", { name: "Start Rewatch" });
		await dialog.waitFor();
		await page.waitForTimeout(600);
		await h.snap(page, { slug: "rewatch-confirm", route: "/app/tracker/$id", state: "overlay", actor: "vera" });
		await dialog.getByRole("button", { name: /Start Rewatch/ }).click();
		await dialog.waitFor({ state: "hidden", timeout: 15000 });
		await page.waitForTimeout(1500);
		await h.snap(page, { slug: "tracker-rewatching", route: "/app/tracker/$id", state: "overlay", actor: "vera" });
	});
	await page.close();
}

async function phaseTvExtras(h: Harness) {
	const page = await h.newPage("vera", 1440);
	await step(h, "mark one episode of season 2, capture the review prompt", async () => {
		await h.open(page, `/app/tracker/${SHOWS.breakingBad}`);
		await page.locator("select").first().selectOption("2");
		await page.waitForTimeout(1000);
		await page.getByRole("button", { name: /Seven Thirty-Seven/ }).first().click({ timeout: 10000 });
		await page.getByText(/Add thoughts on/).waitFor({ timeout: 15000 });
		await page.waitForTimeout(600);
		await h.snap(page, { slug: "episode-review-prompt", route: "/app/tracker/$id", state: "overlay", actor: "vera" });
		await page.getByRole("button", { name: "Dismiss" }).click();
		await dismissAchievements(h, page, false);
	});
	await step(h, "journal note on the whole show through the write-about modal", async () => {
		await h.open(page, `/app/tracker/${SHOWS.breakingBad}`);
		await page.getByRole("button", { name: "Write" }).click();
		const dialog = page.getByRole("dialog", { name: "Write About" });
		await dialog.waitFor();
		await dialog.getByText(/note/i).first().click();
		await page.waitForTimeout(600);
		await dialog.getByText("General", { exact: true }).click();
		await page.waitForTimeout(600);
		await dialog.getByPlaceholder("Share your thoughts...").fill("Walt was never a good guy. Season one proves it.");
		await page.waitForTimeout(300);
		await h.snap(page, { slug: "write-about-note-filled", route: "/app/tracker/$id", state: "overlay", actor: "vera" });
		await dialog.getByRole("button", { name: "Save Note" }).click();
		await dialog.waitFor({ state: "hidden", timeout: 15000 });
		await dismissAchievements(h, page, false);
	});
	await step(h, "finish Mare of Easttown, capture the celebration alone, then the show review", async () => {
		await trackShow(h, page, SHOWS.mare);
		await page.getByRole("button", { name: "Mark All" }).first().click();
		const done = page.getByRole("dialog", { name: "Show Complete" });
		await done.waitFor({ timeout: 25000 });
		await page.waitForTimeout(1500);
		await dismissAchievements(h, page, false);
		await page.waitForTimeout(600);
		await h.snap(page, { slug: "completion-celebration-alone", route: "/app/tracker/$id", state: "overlay", actor: "vera" });
		await done.getByRole("button", { name: "Leave a Review" }).click();
		const review = page.getByRole("dialog", { name: /Review|Write About/ }).first();
		await review.waitFor({ timeout: 10000 });
		await page.waitForTimeout(800);
		await h.snap(page, { slug: "review-modal-show-scope", route: "/app/tracker/$id", state: "overlay", actor: "vera" });
		await review.getByRole("button", { name: "Rate 5 stars" }).click();
		await review.getByPlaceholder(/Share your thoughts/).fill("Kate Winslet ate this. Accent and all.");
		await review.getByRole("button", { name: /Save/ }).first().click();
		await review.waitFor({ state: "hidden", timeout: 15000 });
		await dismissAchievements(h, page, false);
	});
	await page.close();
}

async function phaseLists(h: Harness) {
	const { vp } = h;
	const page = await h.newPage("vera", 1440);
	await step(h, "public watchlist Friday Night Horror with two films", async () => {
		await h.open(page, "/app/watchlists");
		await createWatchlist(h, page, "Friday Night Horror", true);
		await addToWatchlist(h, page, "movie", FILMS.shining, "Friday Night Horror");
		await addToWatchlist(h, page, "movie", FILMS.alien, "Friday Night Horror");
	});
	await step(h, "default watchlist gets a to-watch film", () => addToWatchlist(h, page, "movie", FILMS.heat, "My Picks"));
	await step(h, "shared watchlist Date Night, invite Felix", async () => {
		await h.open(page, "/app/watchlists");
		await createWatchlist(h, page, "Date Night", false);
		const id = watchlistId(vp, "vp-user-vera", "Date Night");
		await addToWatchlist(h, page, "movie", FILMS.dune, "Date Night");
		await h.open(page, `/app/watchlists/${id}`);
		await page.getByRole("button", { name: "Invite" }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByPlaceholder("Search username...").fill("felix");
		await dialog.getByText(/felixfriend/).first().click({ timeout: 15000 });
		await dialog.getByRole("button", { name: /invite|confirm|add/i }).first().click({ timeout: 10000 });
		await page.getByText(/Invited @felixfriend/).first().waitFor({ timeout: 15000 });
	});
	await step(h, "hide Twilight from shuffle through the title page", async () => {
		await h.open(page, `/app/title/movie/${FILMS.twilight}`);
		await page.getByRole("button", { name: "Hide", exact: true }).click({ timeout: 30000 });
		await page.waitForTimeout(600);
		await h.snap(page, { slug: "hide-confirm", route: "/app/title/movie/$id", state: "overlay", actor: "vera" });
		await page.getByRole("alertdialog").or(page.getByRole("dialog")).getByRole("button", { name: /hide/i }).last().click();
		await page.getByText("Hidden from Shuffle").first().waitFor({ timeout: 15000 });
	});
	const f = h.fixture();
	f.watchlists.horror = watchlistId(vp, "vp-user-vera", "Friday Night Horror");
	f.watchlists.shared = watchlistId(vp, "vp-user-vera", "Date Night");
	f.watchlists.myPicks = watchlistId(vp, "vp-user-vera", "My Picks");
	h.saveFixture(f);
	await page.close();
}

async function phaseFelix(h: Harness) {
	const { vp } = h;
	const page = await h.newPage("felix", 1440);
	await step(h, "felix reviews Dune publicly", () =>
		watchFilm(h, page, FILMS.dune, { rating: 5, note: "Sand has never looked so good.", visibility: "Public" }));
	await step(h, "felix reviews The Matrix publicly", () =>
		watchFilm(h, page, FILMS.matrix, { rating: 4, note: "Vera told me to. She was right.", visibility: "Public" }));
	await step(h, "felix tracks Breaking Bad, finishes season 1", async () => {
		await trackShow(h, page, SHOWS.breakingBad);
		await page.getByRole("button", { name: "Mark All" }).nth(1).click();
		await page.getByText(/Marked \d+ episodes? as watched/).first().waitFor({ timeout: 20000 });
		await dismissAchievements(h, page, false);
	});
	await step(h, "felix creates a public and a private watchlist", async () => {
		await h.open(page, "/app/watchlists");
		await createWatchlist(h, page, "Felix Picks", true);
		await h.open(page, "/app/watchlists");
		await createWatchlist(h, page, "Felix Secrets", false);
		await addToWatchlist(h, page, "movie", FILMS.heat, "Felix Secrets");
		await addToWatchlist(h, page, "movie", FILMS.spirited, "Felix Picks");
	});
	await step(h, "felix recommends Spirited Away to Vera with a message", async () => {
		await h.open(page, `/app/title/movie/${FILMS.spirited}`);
		await arcade(page, "Invite").click({ timeout: 30000 });
		const dialog = page.getByRole("dialog", { name: "Recommend" });
		await dialog.waitFor();
		await page.waitForTimeout(1200);
		await h.snap(page, { slug: "recommend-modal-felix", route: "/app/title/movie/$id", state: "overlay", actor: "felix" });
		await dialog.getByRole("button", { name: /veraverify/ }).first().click({ timeout: 10000 });
		await dialog.getByPlaceholder("You have to see this one…").fill("You will cry at the train scene.");
		await dialog.getByRole("button", { name: "Send Recommendation" }).click();
		await dialog.waitFor({ state: "hidden", timeout: 15000 });
	});
	const f = h.fixture();
	f.watchlists.felixPrivate = watchlistId(vp, "vp-user-felix", "Felix Secrets");
	f.watchlists.felixPublic = watchlistId(vp, "vp-user-felix", "Felix Picks");
	h.saveFixture(f);
	await page.close();
}

async function phaseSocial(h: Harness) {
	const f = h.fixture();
	const rita = await h.newPage("rita", 1440);
	await step(h, "rita sends Vera a friend request from /app/friends", async () => {
		await h.open(rita, "/app/friends");
		await rita.getByRole("textbox", { name: "Search friends or find new people" }).fill("veraverify");
		await rita.getByRole("button", { name: "Add Friend" }).first().click({ timeout: 20000 });
		await rita.getByText(/Friend request sent/).first().waitFor({ timeout: 15000 });
	});
	await rita.close();
	const vera = await h.newPage("vera", 1440);
	await step(h, "vera blocks Blake from his profile", async () => {
		await h.open(vera, `/app/profile/${f.users.blake}`);
		await vera.getByRole("button", { name: "Block", exact: true }).click({ timeout: 20000 });
		await vera.getByRole("button", { name: "Yes", exact: true }).click();
		await vera.waitForTimeout(1500);
	});
	await vera.close();
}

async function swipeYes(page: Page, count: number) {
	const yes = page.getByRole("button", { name: "Yes — add to watchlist" });
	let swiped = 0;
	for (; swiped < count; swiped++) {
		await yes.click({ timeout: 15000 });
		await page.waitForTimeout(1100);
		if (await page.getByRole("dialog", { name: "Match" }).isVisible()) break;
	}
	return swiped;
}

async function phaseShuffle(h: Harness) {
	const { vp } = h;
	const f = h.fixture();
	const shared = f.watchlists.shared;
	const felix = await h.newPage("felix", 1440);
	await step(h, "felix swipes yes on the shared deck", async () => {
		await h.open(felix, `/app/shuffle?watchlistId=${shared}`);
		await felix.waitForTimeout(3000);
		return `swiped ${await swipeYes(felix, 12)}`;
	});
	await felix.close();
	const vera = await h.newPage("vera", 1440);
	await step(h, "vera swipes the shared deck until a match fires", async () => {
		await h.open(vera, `/app/shuffle?watchlistId=${shared}`);
		await vera.waitForTimeout(3000);
		const swiped = await swipeYes(vera, 40);
		const match = vera.getByRole("dialog", { name: "Match" });
		await match.waitFor({ timeout: 8000 });
		await vera.waitForTimeout(1200);
		await h.snap(vera, { slug: "match-celebration", route: "/app/shuffle", state: "overlay", actor: "vera" });
		await vera.keyboard.press("Escape");
		return `swiped ${swiped}`;
	});
	await step(h, "vera swipes a few cards in solo shuffle", async () => {
		await h.open(vera, "/app/shuffle");
		await vera.waitForTimeout(3000);
		await swipeYes(vera, 3);
		await vera.getByRole("button", { name: "No — skip this title" }).click({ timeout: 10000 });
		await vera.waitForTimeout(1100);
		await dismissAchievements(h, vera, false);
	});
	await vera.close();
	vp.sql(`select watchlist_id, count(*) from shuffle_swipe group by 1`, "swipes after shuffle phase");
}

// See previous years needs a past-year event. Paging the calendar back that far is slow to drive, so this one row moves by SQL.
async function phasePastYear(h: Harness) {
	h.vp.sql(`update watch_event set watched_at = '2024-06-14 20:00:00' where user_id = 'vp-user-vera' and tmdb_id = 329865`, "move Arrival to 2024");
}

const PHASES: Record<string, (h: Harness) => Promise<void>> = {
	users: phaseUsers, films: phaseFilms, tv: phaseTv, "tv-extras": phaseTvExtras, lists: phaseLists, felix: phaseFelix, social: phaseSocial, shuffle: phaseShuffle, "past-year": phasePastYear,
};

export default async function inventoryFixture(vp: Vp, args: string[]) {
	const h = await createHarness(vp);
	try {
		for (const phase of args) {
			vp.step(`fixture phase ${phase}`);
			const fn = PHASES[phase];
			vp.expect(!!fn, `known phase ${phase}`);
			await fn(h);
		}
	} finally {
		await h.close();
	}
}
