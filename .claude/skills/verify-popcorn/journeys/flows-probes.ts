// Feature: phase-1 probes, cross-surface questions the entry-point flows do not answer on their own.
// Usage: verify-popcorn drive flows-probes [flowFilterRegex]
import type { Vp } from "../scripts/lib/vp.ts";
import { type Actor, arcade, type Flow, harness, holdAchievements, ownReaders, present, psql, type TitleRef } from "./flow-lib.ts";

const CHERNOBYL: TitleRef = { type: "tv", id: 87108, name: "Chernobyl" };
const MATRIX: TitleRef = { type: "movie", id: 603, name: "The Matrix" };
const REVIEW_NOTE = "probe review says it was dreadful";
const JOURNAL_NOTE = "probe journal says it was wonderful";
const SEARCH = "/app/search";

const reviewDialog = (f: Flow) => f.a.page.getByRole("dialog", { name: "Review" });
const writeDialog = (f: Flow) => f.a.page.getByRole("dialog", { name: "Write About" });
const ep = (f: Flow, n: number) => f.a.page.getByRole("button", { name: new RegExp(`^${n} .* min`) }).first();

async function track(a: Actor, f: Flow) {
	await a.goto("/app/title/tv/87108");
	await f.popup();
	await arcade(a.page, "Watched").click();
	await a.page.waitForURL("**/app/tracker/87108");
	await a.settle();
	await f.popup();
}

async function markFirst(a: Actor, f: Flow) {
	await ep(f, 1).click();
	await a.settle();
	await a.page.getByRole("button", { name: "Dismiss" }).click({ timeout: 2000 }).catch(() => {});
}

async function openEpisode(f: Flow, kind: "Note" | "Review") {
	const w = writeDialog(f);
	await f.a.page.getByRole("button", { name: /^Write/ }).first().click();
	await w.getByRole("button", { name: new RegExp(`^${kind}`) }).click();
	await w.getByRole("button", { name: /Specific Episode/ }).click();
	await w.getByRole("button", { name: /^S1\b/ }).first().click();
	await w.getByRole("button", { name: /(Episode |E)1\b/ }).first().click();
}

async function journal(f: Flow, note: string, isPublic: boolean) {
	await openEpisode(f, "Note");
	const w = writeDialog(f);
	await w.getByPlaceholder("Share your thoughts...").fill(note);
	if (isPublic) await w.getByRole("switch").click();
	await w.getByRole("button", { name: "Save Note" }).click();
	await f.a.settle();
}

async function saveReview(f: Flow, o: { stars: number; note: string; companion?: string }) {
	const d = reviewDialog(f);
	await d.waitFor();
	await d.getByRole("button", { name: `Rate ${o.stars} stars` }).click();
	await d.getByPlaceholder("Share your thoughts…").fill(o.note);
	if (o.companion) {
		await d.getByRole("button", { name: /Watched with/ }).click();
		const w = f.a.page.getByRole("dialog", { name: "Watched With" });
		await w.getByPlaceholder("@friend or a name…").fill(o.companion);
		await f.a.settle();
		await w.getByRole("button", { name: new RegExp(`@${o.companion}`) }).click();
		await w.getByRole("button", { name: /done/i }).click();
	}
	await d.getByRole("button", { name: /^Public/ }).click();
	await d.getByRole("button", { name: "Save & Done" }).click();
	await d.waitFor({ state: "hidden", timeout: 15000 });
	await f.a.settle();
}

export default async function flows(vp: Vp, args: string[]) {
	const titleFor = (k: string) => (k === "p4" ? MATRIX : CHERNOBYL);
	const { flow, finish } = harness(vp, "prb", args, titleFor, (f, t) => ownReaders(f, t, REVIEW_NOTE), REVIEW_NOTE);

	await flow("p1", {
		job: "probe",
		entry: "one episode, public journal and a contradicting public review",
		start: SEARCH,
		preconditions: ["show tracked, E1 marked"],
		readers: async (f) => f.observe("journalNoteOn", await ownReaders(f, CHERNOBYL, JOURNAL_NOTE)),
	}, async (a, f) => {
		await track(a, f);
		await markFirst(a, f);
	}, async (f) => {
		await f.a.goto("/app/tracker/87108");
		await f.popup();
		await journal(f, JOURNAL_NOTE, true);
		await openEpisode(f, "Review");
		await saveReview(f, { stars: 2, note: REVIEW_NOTE });
		f.observe("rows", {
			journal: psql(`select scope, season_number, episode_number, is_public, note from journal_entry where user_id='${f.a.id}'`),
			watchEvents: psql(`select scope, scope_season_number, scope_episode_number, rating, note, visibility from watch_event where user_id='${f.a.id}'`),
			review: psql(`select count(*) from review where user_id='${f.a.id}'`),
		});
	});

	await flow("p2", {
		job: "probe",
		entry: "private journal note, friend looks for it",
		start: SEARCH,
		friend: true,
		preconditions: ["show tracked, E1 marked, friendship"],
	}, async (a, f) => {
		await track(a, f);
		await markFirst(a, f);
	}, async (f) => {
		await f.a.goto("/app/tracker/87108");
		await f.popup();
		await journal(f, REVIEW_NOTE, false);
	});

	await flow("p3", {
		job: "mark-next-episode",
		entry: "friend's episode review, bell Mark in tracker",
		start: SEARCH,
		friend: true,
		friendReads: false,
		preconditions: ["friend reviewed S1E1 with acting user as companion"],
	}, async (a, f, c) => {
		const pal = c.friend as Actor;
		const g = f.as(pal);
		await track(pal, g);
		await markFirst(pal, g);
		await openEpisode(g, "Review");
		await saveReview(g, { stars: 4, note: "friend episode review", companion: a.username });
		await a.goto(SEARCH);
	}, async (f) => {
		await f.bell();
		await f.shot("bell");
		f.decide("companion notification", ["Mark in tracker", "tap row", "X"]);
		await f.tap(f.a.page.getByRole("button", { name: "Mark in tracker" }), "Mark in tracker");
		await f.shot("after-mark");
	});

	await flow("p4", {
		job: "change-log",
		entry: "title page Skip, then add a rating later",
		start: SEARCH,
		preconditions: ["film marked watched with Skip, so no log exists"],
	}, async (a, f) => {
		await a.goto("/app/title/movie/603");
		await f.popup();
		await arcade(a.page, "Watched").click();
		await a.page.getByRole("button", { name: "Skip" }).click();
		await a.settle();
	}, async (f) => {
		await f.search("The Matrix", "/app/title/movie/603");
		f.screen("Title page");
		await f.a.settle();
		f.observe("addRatingAffordance", await present(f.a.page, "Add a rating"));
		await f.shot("after-skip");
		const dialog = reviewDialog(f);
		let presses = 0;
		for (; presses < 2 && !(await dialog.isVisible()); presses++) {
			await f.tap(arcade(f.a.page, "Watched"), `tap Watched ${presses + 1}`);
			await f.a.page.waitForTimeout(1200);
		}
		f.observe("pressesToReachReview", presses);
		f.friction("No visible way to add a rating after Skip other than toggling Watched");
		f.screen("Review modal");
		await f.tap(dialog.getByRole("button", { name: "Rate 4 stars" }), "rate 4 stars");
		await f.fill(dialog.getByPlaceholder("Share your thoughts…"), REVIEW_NOTE, "write note");
		await f.tap(dialog.getByRole("button", { name: /^Public/ }), "visibility Public");
		await f.tap(dialog.getByRole("button", { name: "Save & Done" }), "Save & Done");
	});

	await flow("p5", {
		job: "probe",
		entry: "finished show with a completion review, unmark and remark E1",
		start: SEARCH,
		preconditions: ["show finished, review left from the celebration", "user already holds the finish achievements"],
	}, async (a, f) => {
		holdAchievements(a);
		await track(a, f);
		await a.page.getByRole("button", { name: /Mark All/ }).first().click();
		await a.settle();
		await f.popup();
		await a.page.getByRole("button", { name: /Leave a Review/ }).click();
		await a.settle();
		await saveReview(f, { stars: 5, note: REVIEW_NOTE });
		f.observe("completionReviewScope", psql(`select scope from watch_event where user_id='${a.id}'`));
	}, async (f) => {
		await f.a.goto("/app/tracker/87108");
		await f.popup();
		await f.tap(ep(f, 1), "unmark E1");
		await f.tap(ep(f, 1), "remark E1");
		await f.a.page.waitForTimeout(1200);
		f.observe("celebrationAsksForReviewAgain", await f.a.page.getByRole("button", { name: /Leave a Review/ }).isVisible());
		await f.shot("after-remark");
	});

	finish();
}
