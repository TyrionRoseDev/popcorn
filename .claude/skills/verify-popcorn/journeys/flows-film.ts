// Feature: phase-1 task-flow map, film logging entry points. Usage: verify-popcorn drive flows-film [flowFilter]
import type { Vp } from "../scripts/lib/vp.ts";
import { type Actor, addToList, arcade, bodyText, type Flow, harness, ownReaders, psql, type TitleRef } from "./flow-lib.ts";

const MATRIX: TitleRef = { type: "movie", id: 603, name: "The Matrix" };
const SEARCH = "/app/search";

const reviewDecisions = (f: Flow) => {
	f.decide("rating (optional)", ["1-5 stars", "none"]);
	f.decide("note (optional)", ["text", "empty"]);
	f.decide("date (optional)", ["Add date", "none"]);
	f.decide("recommend to a friend (optional)", ["open", "ignore"]);
	f.decide("watched with (optional)", ["open", "ignore"]);
	f.decide("visibility (required, no default)", ["Public", "Private", "Companion if companions set"]);
	f.decide("finish", ["Save & Done", "skip", "remind me later"]);
};

async function pressWatched(f: Flow) {
	const { page } = f.a;
	const b = arcade(page, "Watched");
	await b.waitFor();
	await f.a.settle();
	await f.tap(b, "tap Watched");
}

const reviewDialog = (f: Flow) => f.a.page.getByRole("dialog", { name: "Review" });

async function fillReview(f: Flow, o: { stars?: number; note?: string; vis?: RegExp; save?: string } = {}) {
	const d = reviewDialog(f);
	await d.waitFor();
	f.screen("Review modal");
	if (o.stars) await f.tap(d.getByRole("button", { name: `Rate ${o.stars} stars` }), `rate ${o.stars} stars`);
	if (o.note) await f.fill(d.getByPlaceholder("Share your thoughts…"), o.note, "write note");
	await f.tap(d.getByRole("button", { name: o.vis ?? /^Public/ }), `visibility ${o.vis ?? "Public"}`);
	await f.tap(d.getByRole("button", { name: o.save ?? "Save & Done" }), o.save ?? "Save & Done");
	await d.waitFor({ state: "hidden", timeout: 15000 });
}

async function createList(a: Actor, f: Flow, name: string) {
	await a.goto("/app/watchlists");
	await f.popup();
	await a.page.getByRole("button", { name: /New Watchlist/ }).click();
	await a.page.getByPlaceholder("e.g. Friday Night Horror").fill(name);
	await a.page.getByRole("button", { name: "Create", exact: true }).click();
	await a.settle();
}

const card = (f: Flow) => f.a.page.locator("button:has(svg.lucide-ellipsis)").first();

async function pickCompanion(f: Flow, q: string, friend: boolean) {
	const d = reviewDialog(f);
	await f.tap(d.getByRole("button", { name: /Watched with/ }), "open Watched with");
	const w = f.a.page.getByRole("dialog", { name: "Watched With" });
	await w.waitFor();
	f.screen("Watched With modal");
	f.decide("companion source", ["friend from list", "free-text name"]);
	await f.fill(w.getByPlaceholder("@friend or a name…"), q, "type companion");
	if (friend) await f.tap(w.getByRole("button", { name: new RegExp(`@${q}`) }), "pick friend");
	else await f.tap(w.getByRole("button", { name: /Add "/ }), "add free-text name");
	await f.tap(w.getByRole("button", { name: /done/i }), "Done");
}

async function logFilm(a: Actor, f: Flow, o: { stars?: number; note?: string; vis?: RegExp } = {}) {
	await a.goto("/app/title/movie/603");
	await f.popup();
	await pressWatched(f);
	await fillReview(f, o);
	await f.popup();
}

async function sharedList(a: Actor, f: Flow, name: string, member: string) {
	await a.goto("/app/watchlists");
	await f.popup();
	await a.page.getByRole("button", { name: /New Watchlist/ }).click();
	await a.page.getByPlaceholder("e.g. Friday Night Horror").fill(name);
	await a.page.getByPlaceholder("Search username...").fill(member);
	await a.settle();
	await a.page.getByRole("button", { name: new RegExp(member) }).first().click();
	await a.page.getByRole("button", { name: "Create", exact: true }).click();
	await a.settle();
}

const listId = (a: Actor, name: string) => psql(`select id from watchlist where owner_id='${a.id}' and name='${name}'`)[0][0];

async function toList(f: Flow, name: string) {
	await f.drawer("Watchlists");
	f.screen("Watchlists");
	await f.nav(f.a.page.getByRole("link", { name: new RegExp(name) }).first(), `open ${name}`);
	f.screen("Watchlist detail");
}

const eye = (f: Flow) => f.a.page.locator('button[title="Mark watched"]').first();
const uneye = (f: Flow) => f.a.page.locator('button[title="Mark unwatched"]').first();

export default async function flows(vp: Vp, args: string[]) {
	const { flow, finish } = harness(vp, "film", args, MATRIX, (f, t) => ownReaders(f, t, "verify note"), "verify note");
	const none = async () => {};
	const inPicks = async (a: Actor, f: Flow) => addToList(a, f, MATRIX, "My Picks");
	const openTitle = async (f: Flow) => {
		await f.search("The Matrix", "/app/title/movie/603");
		f.screen("Title page");
	};
	const titleLog = async (f: Flow, o: { stars?: number; note?: string; vis?: RegExp } = { stars: 4, note: "verify note" }) => {
		await openTitle(f);
		await pressWatched(f);
		reviewDecisions(f);
		await fillReview(f, o);
	};
	const skipFromModal = async (f: Flow) => {
		const d = reviewDialog(f);
		await d.waitFor();
		f.screen("Review modal");
		reviewDecisions(f);
		await f.tap(d.getByRole("button", { name: "skip" }), "skip");
	};

	await flow("a1", { job: "log-film-now", entry: "title page, rate+note+public", start: SEARCH }, none, async (f) => titleLog(f));

	await flow("a2", { job: "log-film-now", entry: "title page, Skip", start: SEARCH }, none, async (f) => {
		await openTitle(f);
		await pressWatched(f);
		await skipFromModal(f);
	});

	await flow("a3", { job: "log-film-now", entry: "title page, remind me later", start: SEARCH }, none, async (f) => {
		await openTitle(f);
		await pressWatched(f);
		const d = reviewDialog(f);
		await d.waitFor();
		f.screen("Review modal");
		reviewDecisions(f);
		await f.tap(d.getByRole("button", { name: "remind me later" }), "remind me later");
	});

	await flow("b1", { job: "log-film-now", entry: "My Picks card eye, rate+note+public", start: SEARCH, preconditions: ["film in My Picks, unwatched"] }, inPicks, async (f) => {
		await toList(f, "My Picks");
		await f.tap(eye(f), "tap eye (Mark watched)");
		reviewDecisions(f);
		await fillReview(f, { stars: 4, note: "verify note" });
	});

	await flow("b2", { job: "log-film-now", entry: "custom list card eye, rate+note+public", start: SEARCH, preconditions: ["film in one custom list, unwatched"] }, async (a, f) => {
		await createList(a, f, "Later");
		await addToList(a, f, MATRIX, "Later");
	}, async (f) => {
		await toList(f, "Later");
		await f.tap(eye(f), "tap eye (Mark watched)");
		reviewDecisions(f);
		await fillReview(f, { stars: 4, note: "verify note" });
	});

	await flow("b3", { job: "log-film-now", entry: "My Picks card eye, Skip", start: SEARCH, preconditions: ["film in My Picks, unwatched"] }, inPicks, async (f) => {
		await toList(f, "My Picks");
		await f.tap(eye(f), "tap eye (Mark watched)");
		await skipFromModal(f);
	});

	await flow("b4", { job: "log-film-now", entry: "My Picks card eye, remind me later", start: SEARCH, preconditions: ["film in My Picks, unwatched"] }, inPicks, async (f) => {
		await toList(f, "My Picks");
		await f.tap(eye(f), "tap eye (Mark watched)");
		const d = reviewDialog(f);
		await d.waitFor();
		f.screen("Review modal");
		reviewDecisions(f);
		await f.tap(d.getByRole("button", { name: "remind me later" }), "remind me later");
	});

	await flow("c1", { job: "log-film-now", entry: "title page, film in one custom list", start: SEARCH, preconditions: ["film in one custom list, unwatched"] }, async (a, f) => {
		await createList(a, f, "Later");
		await addToList(a, f, MATRIX, "Later");
	}, async (f) => titleLog(f));

	await flow("c2", { job: "log-film-now", entry: "title page, film in My Picks", start: SEARCH, preconditions: ["film in My Picks, unwatched"] }, inPicks, async (f) => titleLog(f));

	await flow("c3", { job: "log-film-now", entry: "title page, film in two custom lists", start: SEARCH, preconditions: ["film in two custom lists, unwatched"] }, async (a, f) => {
		await createList(a, f, "Later");
		await createList(a, f, "Soon");
		await addToList(a, f, MATRIX, "Later");
		await addToList(a, f, MATRIX, "Soon");
	}, async (f) => {
		await titleLog(f);
		const p = f.a.page;
		await p.waitForTimeout(800);
		const dlg = p.getByRole("dialog").first();
		f.observe("removalDialogText", (await dlg.isVisible()) ? (await dlg.innerText()).replace(/\s+/g, " ") : "no dialog");
		await f.shot("removal-dialog");
		f.decide("remove from which watchlists", ["per-list choice", "keep"]);
	});

	await flow("d1", { job: "log-film-past-date", entry: "title page, Add date 2024-03-15", start: SEARCH }, none, async (f) => {
		await openTitle(f);
		await pressWatched(f);
		const d = reviewDialog(f);
		await d.waitFor();
		f.screen("Review modal");
		reviewDecisions(f);
		const p = f.a.page;
		await f.tap(d.getByRole("button", { name: "Add date" }), "tap Add date");
		f.screen("Date popover");
		await f.shot("calendar");
		f.decide("date", ["month dropdown", "year dropdown", "day", "time"]);
		const combos = p.getByRole("combobox");
		f.observe("calendarCombos", await combos.count());
		f.rec.steps.push({ kind: "tap", label: "choose year 2024" });
		await p.locator("select.rdp-years_dropdown, select[aria-label*='year' i]").first().selectOption("2024");
		f.rec.steps.push({ kind: "tap", label: "choose month March" });
		await p.locator("select.rdp-months_dropdown, select[aria-label*='month' i]").first().selectOption({ label: "Mar" });
		await f.tap(p.getByRole("gridcell", { name: "15" }).getByRole("button").first(), "tap day 15");
		await f.shot("date-picked");
		await f.tap(d.getByText("Your Review"), "tap outside to close calendar");
		await f.tap(d.getByRole("button", { name: "Rate 4 stars" }), "rate 4 stars");
		await f.fill(d.getByPlaceholder("Share your thoughts…"), "verify note", "write note");
		await f.tap(d.getByRole("button", { name: /^Public/ }), "visibility Public");
		await f.tap(d.getByRole("button", { name: "Save & Done" }), "Save & Done");
		await d.waitFor({ state: "hidden", timeout: 15000 });
	});

	await flow("e1", { job: "log-film-rewatch", entry: "title page Watched toggle, film already rated", start: SEARCH, preconditions: ["one rated log exists"] }, async (a, f) => logFilm(a, f, { stars: 4, note: "verify note" }), async (f) => {
		await openTitle(f);
		await pressWatched(f);
		const p = f.a.page;
		f.observe("afterFirstPress", { reviewOpen: await reviewDialog(f).isVisible(), toast: (await bodyText(p)).match(/Removed from watched|Marked as watched/)?.[0] ?? null });
		await f.shot("after-first-press");
		await pressWatched(f);
		await p.waitForTimeout(600);
		f.observe("afterSecondPress", { reviewOpen: await reviewDialog(f).isVisible(), toast: (await bodyText(p)).match(/Removed from watched|Marked as watched/g) });
		await f.shot("after-second-press");
		f.friction("two presses of Watched, no review modal, no new log: the rewatch never gets recorded");
		if (!(await reviewDialog(f).isVisible())) f.rec.result = "blocked";
	});

	await flow("e2", { job: "log-film-rewatch", entry: "title page Watched toggle, first log has no rating", start: SEARCH, preconditions: ["one unrated log exists"] }, async (a, f) => logFilm(a, f, { note: "verify note" }), async (f) => {
		await openTitle(f);
		await pressWatched(f);
		await pressWatched(f);
		reviewDecisions(f);
		await fillReview(f, { stars: 3, note: "second time" });
	});

	await flow("e3", { job: "log-film-rewatch", entry: "custom list eye off then on", start: SEARCH, preconditions: ["film in custom list, ticked through eye"] }, async (a, f) => {
		await createList(a, f, "Later");
		await addToList(a, f, MATRIX, "Later");
		await a.goto(`/app/watchlists/${listId(a, "Later")}`);
		await f.popup();
		await f.tap(eye(f), "eye");
		await fillReview(f, { stars: 4, note: "verify note" });
		await f.popup();
	}, async (f) => {
		await toList(f, "Later");
		await f.tap(uneye(f), "tap eye off (Mark unwatched)");
		await f.tap(eye(f), "tap eye on (Mark watched)");
		reviewDecisions(f);
		await fillReview(f, { stars: 5, note: "second time" });
	});

	await flow("g1", { job: "watched-with", entry: "review modal, friend", start: SEARCH, friend: true }, none, async (f, c) => {
		await openTitle(f);
		await pressWatched(f);
		const d = reviewDialog(f);
		await d.waitFor();
		f.screen("Review modal");
		reviewDecisions(f);
		await f.tap(d.getByRole("button", { name: "Rate 4 stars" }), "rate 4 stars");
		await f.fill(d.getByPlaceholder("Share your thoughts…"), "verify note", "write note");
		await pickCompanion(f, c.friend?.username as string, true);
		await f.tap(d.getByRole("button", { name: /^Public/ }), "visibility Public");
		await f.tap(d.getByRole("button", { name: "Save & Done" }), "Save & Done");
		await d.waitFor({ state: "hidden", timeout: 15000 });
	});

	await flow("g2", { job: "watched-with", entry: "review modal, free-text name", start: SEARCH }, none, async (f) => {
		await openTitle(f);
		await pressWatched(f);
		const d = reviewDialog(f);
		await d.waitFor();
		f.screen("Review modal");
		reviewDecisions(f);
		await pickCompanion(f, "Gran", false);
		await f.tap(d.getByRole("button", { name: /^Public/ }), "visibility Public");
		await f.tap(d.getByRole("button", { name: "Save & Done" }), "Save & Done");
		await d.waitFor({ state: "hidden", timeout: 15000 });
	});

	await flow("g3", { job: "watched-with", entry: "edit existing log, add friend", start: SEARCH, friend: true, preconditions: ["one rated log exists"] }, async (a, f) => logFilm(a, f, { stars: 4, note: "verify note" }), async (f, c) => {
		await openTitle(f);
		await f.tap(card(f), "open log menu");
		f.screen("Log menu");
		await f.tap(f.a.page.getByRole("button", { name: "Edit" }), "Edit");
		await pickCompanion(f, c.friend?.username as string, true);
		const d = reviewDialog(f);
		await f.tap(d.getByRole("button", { name: "Save Changes" }), "Save Changes");
		await d.waitFor({ state: "hidden", timeout: 15000 });
	});

	const edit = async (f: Flow) => {
		await f.tap(card(f), "open log menu");
		f.screen("Log menu");
		await f.tap(f.a.page.getByRole("button", { name: "Edit" }), "Edit");
		const d = reviewDialog(f);
		await d.waitFor();
		f.screen("Review modal (edit)");
		await f.tap(d.getByRole("button", { name: "Rate 2 stars" }), "change rating to 2");
		await f.tap(d.getByRole("button", { name: "Save Changes" }), "Save Changes");
		await d.waitFor({ state: "hidden", timeout: 15000 });
	};
	const del = async (f: Flow) => {
		await f.tap(card(f), "open log menu");
		f.screen("Log menu");
		await f.tap(f.a.page.getByRole("button", { name: "Delete" }), "Delete");
		await f.tap(f.a.page.getByRole("button", { name: "Confirm Delete" }), "Confirm Delete");
	};
	const toFeed = async (f: Flow) => {
		await f.drawer("Feed");
		f.screen("Feed");
	};
	const toProfile = async (f: Flow) => {
		await f.nav(f.a.page.getByRole("button", { name: "Open user menu" }), "open user menu");
		f.screen("User menu");
		await f.nav(f.a.page.getByRole("menuitem", { name: /profile/i }).or(f.a.page.getByRole("link", { name: /profile/i })).first(), "tap Profile");
		f.screen("Profile");
	};
	const logged = async (a: Actor, f: Flow) => logFilm(a, f, { stars: 4, note: "verify note" });
	const pre = ["one rated log exists"];

	await flow("h1", { job: "change-log", entry: "title page card", start: SEARCH, preconditions: pre }, logged, async (f) => {
		await openTitle(f);
		await edit(f);
	});
	await flow("h2", { job: "change-log", entry: "feed card", start: SEARCH, preconditions: pre }, logged, async (f) => {
		await toFeed(f);
		await edit(f);
	});
	await flow("h3", { job: "change-log", entry: "profile activity card", start: SEARCH, preconditions: pre }, logged, async (f) => {
		await toProfile(f);
		await edit(f);
	});
	await flow("i1", { job: "delete-log", entry: "title page card, only log", start: SEARCH, preconditions: pre }, logged, async (f) => {
		await openTitle(f);
		await del(f);
	});
	await flow("i2", { job: "delete-log", entry: "feed card, only log", start: SEARCH, preconditions: pre }, logged, async (f) => {
		await toFeed(f);
		await del(f);
	});
	await flow("i3", { job: "delete-log", entry: "profile activity card, only log", start: SEARCH, preconditions: pre }, logged, async (f) => {
		await toProfile(f);
		await del(f);
	});
	await flow("i4", { job: "delete-log", entry: "title page card, one of two logs", start: SEARCH, preconditions: ["two logs exist, created through custom list eye"] }, async (a, f) => {
		await createList(a, f, "Later");
		await addToList(a, f, MATRIX, "Later");
		await a.goto(`/app/watchlists/${listId(a, "Later")}`);
		await f.popup();
		await f.tap(eye(f), "eye");
		await fillReview(f, { stars: 4, note: "verify note" });
		await f.popup();
		await f.tap(uneye(f), "eye off");
		await f.tap(eye(f), "eye on");
		await fillReview(f, { stars: 5, note: "second time" });
		await f.popup();
	}, async (f) => {
		await openTitle(f);
		await del(f);
	});
	await flow("i5", { job: "delete-log", entry: "title page Watched toggle off", start: SEARCH, preconditions: pre }, logged, async (f) => {
		await openTitle(f);
		await pressWatched(f);
		f.friction("toast says Removed from watched; watch history stays on the same page");
	});
	await flow("i6", { job: "delete-log", entry: "title page card, log made through custom list eye", start: SEARCH, preconditions: ["film ticked in custom list through eye"] }, async (a, f) => {
		await createList(a, f, "Later");
		await addToList(a, f, MATRIX, "Later");
		await a.goto(`/app/watchlists/${listId(a, "Later")}`);
		await f.popup();
		await f.tap(eye(f), "eye");
		await fillReview(f, { stars: 4, note: "verify note" });
		await f.popup();
	}, async (f) => {
		await openTitle(f);
		await del(f);
	});

	await flow("j1", { job: "change-privacy", entry: "edit log, public to private", start: SEARCH, friend: true, preconditions: pre }, logged, async (f) => {
		await openTitle(f);
		await f.tap(card(f), "open log menu");
		f.screen("Log menu");
		await f.tap(f.a.page.getByRole("button", { name: "Edit" }), "Edit");
		const d = reviewDialog(f);
		await d.waitFor();
		f.screen("Review modal (edit)");
		await f.tap(d.getByRole("button", { name: /^Private/ }), "visibility Private");
		await f.tap(d.getByRole("button", { name: "Save Changes" }), "Save Changes");
		await d.waitFor({ state: "hidden", timeout: 15000 });
	});
	await flow("j2", { job: "change-privacy", entry: "log private from the start", start: SEARCH, friend: true }, none, async (f) => titleLog(f, { stars: 4, note: "verify note", vis: /^Private/ }));
	await flow("j3", { job: "change-privacy", entry: "private log of a title on a shared list", start: SEARCH, friend: true, preconditions: ["film on a list shared with friend"] }, async (a, f, c) => {
		await sharedList(a, f, "Together", c.friend?.username as string);
		await addToList(a, f, MATRIX, "Together");
	}, async (f) => titleLog(f, { stars: 4, note: "verify note", vis: /^Private/ }));
	await flow("j4", { job: "log-film-now", entry: "shared list eye, Skip, by a member", start: SEARCH, friend: true, preconditions: ["film on list shared with friend, acting user owns list"] }, async (a, f, c) => {
		await sharedList(a, f, "Together", c.friend?.username as string);
		await addToList(a, f, MATRIX, "Together");
	}, async (f) => {
		await toList(f, "Together");
		await f.tap(eye(f), "tap eye (Mark watched)");
		await skipFromModal(f);
	});

	await flow("k1", { job: "log-film-now", entry: "review reminder notification, Review now", start: SEARCH, preconditions: ["remind me later log exists, reminder made due by SQL, cron called"] }, async (a, f) => {
		await a.goto("/app/title/movie/603");
		await f.popup();
		await pressWatched(f);
		await reviewDialog(f).getByRole("button", { name: "remind me later" }).click();
		await a.settle();
		await f.popup();
		psql(`update watch_event set review_reminder_at = now() - interval '1 minute' where user_id='${a.id}'`);
		const r = await fetch(`${vp.appUrl}/api/cron/review-reminders`, { headers: { authorization: "Bearer verify-popcorn-cron" } });
		f.observe("cron", await r.text());
	}, async (f) => {
		await f.bell();
		await f.shot("bell");
		f.decide("reminder", ["Review now", "Dismiss"]);
		await f.nav(f.a.page.getByRole("button", { name: "Review now", exact: true }), "Review now");
		const d = reviewDialog(f);
		await d.waitFor();
		f.screen("Review modal (edit)");
		await f.tap(d.getByRole("button", { name: "Rate 4 stars" }), "rate 4 stars");
		await f.fill(d.getByPlaceholder("Share your thoughts…"), "verify note", "write note");
		await f.tap(d.getByRole("button", { name: "Save Changes" }), "Save Changes");
		await d.waitFor({ state: "hidden", timeout: 15000 });
	});

	finish();
}
