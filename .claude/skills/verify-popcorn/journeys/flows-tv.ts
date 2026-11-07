// Feature: phase-1 task-flow map, TV entry points. Usage: verify-popcorn drive flows-tv [flowFilterRegex]
import type { Vp } from "../scripts/lib/vp.ts";
import { type Actor, addToList, arcade, bodyText, type Flow, harness, holdAchievements, ownReaders, type TitleRef } from "./flow-lib.ts";

const CHERNOBYL: TitleRef = { type: "tv", id: 87108, name: "Chernobyl" };
const BB: TitleRef = { type: "tv", id: 1396, name: "Breaking Bad" };
const NOTE = "verify tv note";

const reviewDialog = (f: Flow) => f.a.page.getByRole("dialog", { name: "Review" });
const write = (f: Flow) => f.a.page.getByRole("dialog", { name: "Write About" });

async function track(a: Actor, f: Flow, t: TitleRef) {
	await a.goto(`/app/title/tv/${t.id}`);
	await f.popup();
	await arcade(a.page, "Watched").click();
	await a.page.waitForURL(`**/app/tracker/${t.id}`);
	await a.settle();
	await f.popup();
}

const ep = (f: Flow, n: number) => f.a.page.getByRole("button", { name: new RegExp(`^${n} .* min`) }).first();

async function reviewTail(f: Flow, o: { stars?: number; note?: string; save?: string } = {}) {
	const d = reviewDialog(f);
	await d.waitFor();
	f.screen("Review modal");
	if (o.stars) await f.tap(d.getByRole("button", { name: `Rate ${o.stars} stars` }), `rate ${o.stars} stars`);
	if (o.note) await f.fill(d.getByPlaceholder("Share your thoughts…"), o.note, "write note");
	await f.tap(d.getByRole("button", { name: /^Public/ }), "visibility Public");
	await f.tap(d.getByRole("button", { name: "Save & Done" }), "Save & Done");
	await d.waitFor({ state: "hidden", timeout: 15000 });
}

async function toTracker(f: Flow, t: TitleRef) {
	await f.drawer("Tracker");
	f.screen("Tracker index");
	await f.nav(f.a.page.locator(`a[href="/app/tracker/${t.id}"]`).first(), `open ${t.name}`);
	f.screen("Tracker detail");
	await f.a.page.getByText("Mark All").first().waitFor();
	await f.a.settle();
}

async function markAll(f: Flow) {
	await f.tap(f.a.page.getByRole("button", { name: /Mark All/ }).first(), "tap top Mark All");
}

async function aboutEpisode(f: Flow, kind: "Note" | "Review", s = 1, e = 1) {
	const p = f.a.page;
	await f.tap(p.getByRole("button", { name: /^Write/ }).first(), "tap Write");
	const w = write(f);
	await w.waitFor();
	f.screen("Write About: type");
	f.decide("note or review", ["Note", "Review"]);
	await f.tap(w.getByRole("button", { name: new RegExp(`^${kind}`) }), `choose ${kind}`);
	f.screen("Write About: scope");
	f.decide("scope", ["Specific Episode", "Full Season", kind === "Note" ? "General" : "Full Show"]);
	await f.tap(w.getByRole("button", { name: /Specific Episode/ }), "choose Specific Episode");
	f.screen("Write About: season");
	f.decide("season", ["season list"]);
	await f.tap(w.getByRole("button", { name: new RegExp(`^S${s}\\b`) }).first(), `choose season ${s}`);
	f.screen("Write About: episode");
	f.decide("episode", ["episode list"]);
	await f.tap(w.getByRole("button", { name: new RegExp(`(Episode |E)${e}\\b`) }).first(), `choose episode ${e}`);
}

export default async function flows(vp: Vp, args: string[]) {
	const titleFor = (k: string) => (k.startsWith("s") ? BB : CHERNOBYL);
	const { flow, finish } = harness(vp, "tv", args, titleFor, (f, t) => ownReaders(f, t, NOTE), NOTE);
	const none = async () => {};
	const tracked = (t: TitleRef) => async (a: Actor, f: Flow) => track(a, f, t);
	const trackedVeteran = async (a: Actor, f: Flow) => {
		holdAchievements(a);
		await track(a, f, CHERNOBYL);
	};
	const VETERAN = ["show tracked", "user already holds Series Finale and Binge Watch from an earlier show, so no achievement popup"];
	const finished = async (a: Actor, f: Flow) => {
		await track(a, f, CHERNOBYL);
		await a.page.getByRole("button", { name: /Mark All/ }).first().click();
		await a.settle();
		await a.page.waitForTimeout(800);
		await f.popup();
		const later = a.page.getByRole("button", { name: /Leave a Review/ });
		if (await later.isVisible().catch(() => false)) await a.page.keyboard.press("Escape");
		await a.settle();
		await f.popup();
	};
	const SEARCH = "/app/search";

	await flow("t1", { job: "track-show", entry: "title page Watched", start: SEARCH }, none, async (f) => {
		await f.search("Chernobyl", "/app/title/tv/87108");
		f.screen("Title page");
		await arcade(f.a.page, "Watched").waitFor();
		await f.a.settle();
		await f.tap(arcade(f.a.page, "Watched"), "tap Watched");
		await f.a.page.waitForURL("**/app/tracker/87108");
		f.screen("Tracker detail");
		f.friction("button is labelled Watched and the intent recorded is 'tracking'; no log exists yet");
	});
	await flow("t2", { job: "track-show", entry: "tracker index, Browse TV Shows", start: SEARCH }, none, async (f) => {
		await f.drawer("Tracker");
		f.screen("Tracker index");
		await f.nav(f.a.page.getByRole("link", { name: "Browse TV Shows" }), "Browse TV Shows");
		f.screen("Search (tv filter)");
		await f.search("Chernobyl", "/app/title/tv/87108");
		f.screen("Title page");
		await arcade(f.a.page, "Watched").waitFor();
		await f.a.settle();
		await f.tap(arcade(f.a.page, "Watched"), "tap Watched");
		await f.a.page.waitForURL("**/app/tracker/87108");
		f.screen("Tracker detail");
	});
	await flow("t3", { job: "mark-next-episode", entry: "tracker detail row, dismiss prompt", start: SEARCH, preconditions: ["show tracked"] }, tracked(CHERNOBYL), async (f) => {
		await toTracker(f, CHERNOBYL);
		await f.tap(ep(f, 1), "tap E1");
		f.decide("Add thoughts on S1E1?", ["Yes", "Dismiss", "ignore 8s"]);
		await f.shot("prompt");
		await f.tapTimed(f.a.page.getByRole("button", { name: "Dismiss" }), "Dismiss", "8s prompt expired before the tap");
	});
	await flow("t4", { job: "write-about-episode", entry: "prompt after marking, Yes, review modal", start: SEARCH, preconditions: ["show tracked"] }, tracked(CHERNOBYL), async (f) => {
		await toTracker(f, CHERNOBYL);
		await f.tapNow(ep(f, 1), "tap E1");
		f.decide("Add thoughts on S1E1?", ["Yes", "Dismiss", "ignore 8s"]);
		await f.tap(f.a.page.getByRole("button", { name: "Yes" }), "Yes");
		await reviewTail(f, { stars: 4, note: NOTE });
	});
	await flow("t5", { job: "write-about-episode", entry: "Write, Note, episode (private default)", start: SEARCH, preconditions: ["show tracked, E1 marked"] }, async (a, f) => {
		await track(a, f, CHERNOBYL);
		await ep(f, 1).click();
		await a.settle();
	}, async (f) => {
		await toTracker(f, CHERNOBYL);
		await aboutEpisode(f, "Note");
		const w = write(f);
		f.screen("Write About: note");
		f.decide("note visibility", ["Private (default)", "Public"]);
		await f.fill(w.getByPlaceholder("Share your thoughts..."), NOTE, "write note");
		await f.tap(w.getByRole("button", { name: "Save Note" }), "Save Note");
	});
	await flow("t6", { job: "write-about-episode", entry: "Write, Note, episode, Public", start: SEARCH, friend: true, preconditions: ["show tracked, E1 marked"] }, async (a, f) => {
		await track(a, f, CHERNOBYL);
		await ep(f, 1).click();
		await a.settle();
	}, async (f) => {
		await toTracker(f, CHERNOBYL);
		await aboutEpisode(f, "Note");
		const w = write(f);
		f.screen("Write About: note");
		f.decide("note visibility", ["Private (default)", "Public"]);
		await f.fill(w.getByPlaceholder("Share your thoughts..."), NOTE, "write note");
		await f.tap(w.getByRole("switch"), "toggle Public");
		await f.tap(w.getByRole("button", { name: "Save Note" }), "Save Note");
	});
	await flow("t7", { job: "write-about-episode", entry: "Write, Review, episode", start: SEARCH, preconditions: ["show tracked, E1 marked"] }, async (a, f) => {
		await track(a, f, CHERNOBYL);
		await ep(f, 1).click();
		await a.settle();
	}, async (f) => {
		await toTracker(f, CHERNOBYL);
		await aboutEpisode(f, "Review");
		await reviewTail(f, { stars: 4, note: NOTE });
	});
	await flow("t8", { job: "write-about-episode", entry: "Write, Review, unwatched episode", start: SEARCH, preconditions: ["show tracked, nothing marked"] }, tracked(CHERNOBYL), async (f) => {
		await toTracker(f, CHERNOBYL);
		await aboutEpisode(f, "Review");
		const w = write(f);
		await f.shot("completion-check");
		f.screen("Write About: completion check");
		f.decide("episode not marked", ["Mark as Complete", "Continue Anyway"]);
		await f.tap(w.getByRole("button", { name: "Mark as Complete" }), "Mark as Complete");
		await reviewTail(f, { stars: 4, note: NOTE });
	});
	await flow("s1", { job: "mark-season", entry: "season row Mark All", start: SEARCH, preconditions: ["show tracked"] }, tracked(BB), async (f) => {
		await toTracker(f, BB);
		await f.tap(f.a.page.getByRole("button", { name: /Mark All/ }).nth(1), "tap season 1 Mark All");
	});
	await flow("s2", { job: "mark-season", entry: "top Mark All, show still has more seasons", start: SEARCH, preconditions: ["show tracked"] }, tracked(BB), async (f) => {
		await toTracker(f, BB);
		await markAll(f);
		await f.shot("after");
		f.observe("celebrationVisible", await f.a.page.getByRole("dialog", { name: "Show Complete" }).isVisible());
	});
	await flow("t9b", { job: "finish-show", entry: "first finish, achievements earned, top Mark All", start: SEARCH, preconditions: ["show tracked", "user has never finished a show"] }, tracked(CHERNOBYL), async (f) => {
		await toTracker(f, CHERNOBYL);
		await f.tapNow(f.a.page.getByRole("button", { name: /Mark All/ }).first(), "tap top Mark All");
		await f.a.page.getByRole("dialog", { name: "Show Complete" }).waitFor();
		await f.a.page.waitForTimeout(1500);
		await f.shot("stacked");
		f.screen("Show Complete, covered by Achievements Unlocked");
		f.decide("visible choice", ["Continue"]);
		await f.popup();
		await f.shot("after-popup");
		f.observe("reviewOfferVisibleAfterPopup", await f.a.page.getByRole("button", { name: /Leave a Review/ }).isVisible());
		f.observe("showCompleteOpenAfterPopup", await f.a.page.getByRole("dialog", { name: "Show Complete" }).isVisible());
		f.friction("Show Complete and the popup open together. The first Continue tap lands on Show Complete underneath and closes it, so Leave a Review and Remind Me Later are never seen.");
	});
	await flow("t9", { job: "finish-show", entry: "top Mark All, Leave a Review", start: SEARCH, preconditions: VETERAN }, trackedVeteran, async (f) => {
		await toTracker(f, CHERNOBYL);
		await markAll(f);
		await f.a.page.waitForTimeout(800);
		f.screen("Show Complete");
		f.decide("after finish", ["Leave a Review", "Remind Me Later"]);
		await f.shot("celebration");
		await f.tap(f.a.page.getByRole("button", { name: /Leave a Review/ }), "Leave a Review");
		await reviewTail(f, { stars: 5, note: NOTE });
	});
	await flow("t10", { job: "finish-show", entry: "top Mark All, Remind Me Later", start: SEARCH, preconditions: VETERAN }, trackedVeteran, async (f) => {
		await toTracker(f, CHERNOBYL);
		await markAll(f);
		await f.a.page.waitForTimeout(800);
		f.screen("Show Complete");
		f.decide("after finish", ["Leave a Review", "Remind Me Later"]);
		await f.tap(f.a.page.getByRole("button", { name: /Remind Me Later/ }), "Remind Me Later");
	});
	await flow("t11", { job: "finish-show", entry: "top Mark All, dismiss celebration", start: SEARCH, preconditions: VETERAN }, trackedVeteran, async (f) => {
		await toTracker(f, CHERNOBYL);
		await markAll(f);
		await f.a.page.waitForTimeout(800);
		f.screen("Show Complete");
		await f.key("Escape", "dismiss celebration");
	});
	await flow("t12", { job: "finish-show", entry: "tap the last episode row", start: SEARCH, preconditions: [...VETERAN, "E1-E4 marked one by one"] }, async (a, f) => {
		holdAchievements(a);
		await track(a, f, CHERNOBYL);
		for (const n of [1, 2, 3, 4]) {
			await ep(f, n).click();
			await a.settle();
			await f.popup();
		}
	}, async (f) => {
		await toTracker(f, CHERNOBYL);
		await f.tap(ep(f, 5), "tap E5");
		await f.a.page.waitForTimeout(800);
		f.observe("celebration", await f.a.page.getByRole("dialog", { name: "Show Complete" }).isVisible());
		await f.shot("after-last");
		f.screen("Show Complete");
		f.decide("after finish", ["Leave a Review", "Remind Me Later"]);
		await f.tap(f.a.page.getByRole("button", { name: /Leave a Review/ }), "Leave a Review");
		await reviewTail(f, { stars: 5, note: NOTE });
	});
	await flow("t13", { job: "rewatch-show", entry: "tracker detail Rewatch", start: SEARCH, preconditions: ["show finished"] }, finished, async (f) => {
		await toTracker(f, CHERNOBYL);
		await f.tap(f.a.page.getByRole("button", { name: /^Rewatch/ }), "tap Rewatch");
		const d = f.a.page.getByRole("dialog", { name: "Start Rewatch" });
		await d.waitFor();
		f.screen("Start Rewatch");
		f.decide("confirm rewatch", ["Start Rewatch", "Cancel"]);
		await f.tap(d.getByRole("button", { name: /Start Rewatch/ }), "Start Rewatch");
		await f.shot("watch-2");
		await f.tap(ep(f, 1), "tap E1 on Watch 2");
		await f.tapTimed(f.a.page.getByRole("button", { name: "Dismiss" }), "Dismiss prompt", "8s prompt expired before the tap");
	});
	await flow("t14", { job: "rewatch-show", entry: "tracker index card Rewatch", start: SEARCH, preconditions: ["show finished"] }, finished, async (f) => {
		await f.drawer("Tracker");
		f.screen("Tracker index");
		await f.shot("index");
		const b = f.a.page.locator('button[title="Rewatch this show"]').first();
		f.observe("rewatchButtonOpacity", await b.evaluate((el) => getComputedStyle(el).opacity));
		await f.tap(b, "tap Rewatch on card");
		const d = f.a.page.getByRole("dialog", { name: "Start Rewatch" });
		await d.waitFor();
		f.screen("Start Rewatch");
		f.decide("confirm rewatch", ["Start Rewatch", "Cancel"]);
		await f.tap(d.getByRole("button", { name: /Start Rewatch/ }), "Start Rewatch");
	});
	await flow("t15", { job: "delete-log", entry: "tracker: unmark episode", start: SEARCH, preconditions: ["E1 marked"] }, async (a, f) => {
		await track(a, f, CHERNOBYL);
		await ep(f, 1).click();
		await a.settle();
	}, async (f) => {
		await toTracker(f, CHERNOBYL);
		await f.tap(ep(f, 1), "tap E1 again");
		await f.tap(f.a.page.getByRole("button", { name: "Unmark" }), "Unmark in toast");
	});
	await flow("t16", { job: "delete-log", entry: "tracker Notes & Reviews: delete a review", start: SEARCH, preconditions: ["finished show with show review"] }, async (a, f) => {
		holdAchievements(a);
		await track(a, f, CHERNOBYL);
		await a.page.getByRole("button", { name: /Mark All/ }).first().click();
		await a.settle();
		await a.page.waitForTimeout(800);
		await f.popup();
		await f.popup();
		await a.page.getByRole("button", { name: /Leave a Review/ }).click();
		await a.settle();
		await reviewTail(f, { stars: 5, note: NOTE });
		await f.popup();
	}, async (f) => {
		await toTracker(f, CHERNOBYL);
		await f.shot("notes-section");
		await f.tap(f.a.page.locator("button:has(svg.lucide-trash-2)").first(), "tap trash");
		await f.tap(f.a.page.getByRole("button", { name: "Delete" }), "Delete in toast");
	});
	await flow("t17", { job: "delete-log", entry: "remove show from tracker", start: SEARCH, preconditions: ["finished show with review and public note"] }, async (a, f) => {
		holdAchievements(a);
		await track(a, f, CHERNOBYL);
		await a.page.getByRole("button", { name: /Mark All/ }).first().click();
		await a.settle();
		await a.page.waitForTimeout(800);
		await f.popup();
		await f.popup();
		await a.page.getByRole("button", { name: /Leave a Review/ }).click();
		await a.settle();
		await reviewTail(f, { stars: 5, note: NOTE });
		await f.popup();
	}, async (f) => {
		await f.drawer("Tracker");
		f.screen("Tracker index");
		const b = f.a.page.locator('button[title="Remove from tracker"]').first();
		f.observe("removeButtonOpacity", await b.evaluate((el) => getComputedStyle(el).opacity));
		await f.tap(b, "tap X on card");
		f.decide("remove show", ["Remove in 5s toast", "ignore"]);
		await f.tap(f.a.page.getByRole("button", { name: "Remove", exact: true }), "Remove in toast");
	});
	await flow("t18", { job: "log-tv-from-watchlist", entry: "My Picks card eye on a TV show, rate+note", start: SEARCH, preconditions: ["show in My Picks, not tracked"] }, async (a, f) => {
		await addToList(a, f, CHERNOBYL, "My Picks");
	}, async (f) => {
		await f.drawer("Watchlists");
		f.screen("Watchlists");
		await f.nav(f.a.page.getByRole("link", { name: /My Picks/ }).first(), "open My Picks");
		f.screen("Watchlist detail");
		await f.tap(f.a.page.locator('button[title="Mark watched"]').first(), "tap eye");
		await reviewTail(f, { stars: 4, note: NOTE });
	});
	await flow("t19", { job: "change-privacy", entry: "journal note: edit toggle", start: SEARCH, preconditions: ["private note on E1"] }, async (a, f) => {
		await track(a, f, CHERNOBYL);
		await ep(f, 1).click();
		await a.settle();
		await a.page.getByRole("button", { name: "Dismiss" }).click().catch(() => {});
		await aboutEpisode(f, "Note");
		await write(f).getByPlaceholder("Share your thoughts...").fill(NOTE);
		await write(f).getByRole("button", { name: "Save Note" }).click();
		await a.settle();
	}, async (f) => {
		await toTracker(f, CHERNOBYL);
		await f.tap(f.a.page.locator("button:has(svg.lucide-pencil)").first(), "tap pencil");
		const d = f.a.page.getByRole("dialog").first();
		await d.waitFor();
		f.screen("Edit note modal");
		await f.shot("edit-note");
		await f.tap(d.getByRole("switch"), "toggle Public");
		await f.tap(d.getByRole("button", { name: /Save/ }), "Save");
		f.observe("afterText", (await bodyText(f.a.page)).includes(NOTE));
	});
	finish();
}
