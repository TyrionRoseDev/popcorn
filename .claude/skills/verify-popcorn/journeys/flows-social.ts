// Feature: phase-1 task-flow map, signup, social, watchlist, history and account flows.
// Usage: verify-popcorn drive flows-social [flowFilterRegex]
import type { Vp } from "../scripts/lib/vp.ts";
import { type Actor, addToList, arcade, bodyText, capture, type Flow, harness, hydrated, mailLink, ownReaders, present, psql, runFlow, type TitleRef } from "./flow-lib.ts";

const MATRIX: TitleRef = { type: "movie", id: 603, name: "The Matrix" };
const CHERNOBYL: TitleRef = { type: "tv", id: 87108, name: "Chernobyl" };
const NOTE = "verify social note";
const SEARCH = "/app/search";

const reviewDialog = (f: Flow) => f.a.page.getByRole("dialog", { name: "Review" });

async function pressWatched(f: Flow) {
	const b = arcade(f.a.page, "Watched");
	await b.waitFor();
	await f.a.settle();
	await f.tap(b, "tap Watched");
}

async function reviewTail(f: Flow, o: { stars?: number; note?: string; vis?: RegExp } = {}) {
	const d = reviewDialog(f);
	await d.waitFor();
	f.screen("Review modal");
	if (o.stars) await f.tap(d.getByRole("button", { name: `Rate ${o.stars} stars` }), `rate ${o.stars} stars`);
	if (o.note) await f.fill(d.getByPlaceholder("Share your thoughts…"), o.note, "write note");
	await f.tap(d.getByRole("button", { name: o.vis ?? /^Public/ }), "visibility");
	await f.tap(d.getByRole("button", { name: "Save & Done" }), "Save & Done");
	await d.waitFor({ state: "hidden", timeout: 15000 });
}

async function logMatrix(a: Actor, f: Flow, o: { stars?: number; note?: string; vis?: RegExp } = { stars: 4, note: NOTE }) {
	const g = f.as(a);
	await a.goto("/app/title/movie/603");
	await g.popup();
	await pressWatched(g);
	await reviewTail(g, o);
	await g.popup();
}

async function trackAndNote(a: Actor, f: Flow, isPublic: boolean) {
	const g = f.as(a);
	await a.goto("/app/title/tv/87108");
	await g.popup();
	await arcade(a.page, "Watched").click();
	await a.page.waitForURL("**/app/tracker/87108");
	await a.settle();
	await g.popup();
	await a.page.getByRole("button", { name: /^1 .* min/ }).first().click();
	await a.settle();
	await a.page.getByRole("button", { name: "Dismiss" }).click().catch(() => {});
	await a.page.getByRole("button", { name: /^Write/ }).first().click();
	const w = a.page.getByRole("dialog", { name: "Write About" });
	await w.getByRole("button", { name: /^Note/ }).click();
	await w.getByRole("button", { name: /Specific Episode/ }).click();
	await w.getByRole("button", { name: /^S1\b/ }).first().click();
	await w.getByRole("button", { name: /(Episode |E)1\b/ }).first().click();
	await w.getByPlaceholder("Share your thoughts...").fill(NOTE);
	if (isPublic) await w.getByRole("switch").click();
	await w.getByRole("button", { name: "Save Note" }).click();
	await a.settle();
}

async function sharedList(a: Actor, f: Flow, name: string, member: string) {
	await a.goto("/app/watchlists");
	await f.as(a).popup();
	await a.page.getByRole("button", { name: /New Watchlist/ }).click();
	await a.page.getByPlaceholder("e.g. Friday Night Horror").fill(name);
	await a.page.getByPlaceholder("Search username...").fill(member);
	await a.settle();
	await a.page.getByRole("button", { name: new RegExp(member) }).first().click();
	await a.page.getByRole("button", { name: "Create", exact: true }).click();
	await a.settle();
}

async function pickFriend(f: Flow, name: string) {
	const d = f.a.page.getByRole("dialog", { name: "Recommend" });
	await d.waitFor();
	f.screen("Recommend modal");
	f.decide("recipients", ["friend list / @search"]);
	f.decide("message (optional)", ["text", "empty"]);
	await f.fill(d.getByPlaceholder("@username..."), name, "type friend").catch(() => {});
	await f.tap(d.getByRole("button", { name: new RegExp(`@${name}`) }).first(), "pick friend");
	await f.fill(d.getByPlaceholder("You have to see this one…"), "watch this", "write message");
	await f.tap(d.getByRole("button", { name: /send/i }).first(), "Send");
}

async function sendRec(a: Actor, f: Flow, to: string) {
	const g = f.as(a);
	await a.goto("/app/title/movie/603");
	await g.popup();
	await arcade(a.page, "Invite").click();
	await pickFriend(g, to);
	await g.popup();
}

const cardsYes = (f: Flow) => f.a.page.getByRole("button", { name: "Yes — add to watchlist" });

async function toShuffle(f: Flow) {
	await f.drawer("Shuffle");
	f.screen("Shuffle");
	await cardsYes(f).waitFor({ timeout: 30000 });
	await f.a.settle();
}

export default async function flows(vp: Vp, args: string[]) {
	const filter = args[0];
	const titleFor = (k: string) => (k.startsWith("q2") || k.startsWith("d3") ? CHERNOBYL : MATRIX);
	const { flow, finish } = harness(vp, "soc", args, titleFor, (f, t) => ownReaders(f, t, NOTE), NOTE);
	const none = async () => {};
	const n = process.env.FLOW_SUFFIX ?? "";

	for (const [key, label, picks] of [["o1", "minimum path", null], ["o2", "picks a TV show in the taste step", "Chernobyl"]] as const) {
		if (filter && !new RegExp(filter).test(key)) continue;
		for (let attempt = 1; attempt <= 4; attempt++) {
		const email = `new${key}${n}${Date.now().toString(36)}@popcorn.test`;
		const browser = vp.context.browser();
		const ctx = await browser!.newContext({ baseURL: vp.appUrl, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: "reduce" });
		ctx.setDefaultTimeout(45000);
		const page = await ctx.newPage();
		const a = { key: `signup-${key}`, id: "", email, username: "", page, ctx, mutations: [] as string[], inflight: 0, lastActivity: Date.now(), goto: async (p: string) => { await page.goto(p); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200); }, settle: async (ms = 900) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(ms); } } as Actor;
		page.on("request", (r) => {
			const m = r.url().match(/\/api\/(trpc\/[^?]+|auth\/[^?]+)/);
			if (m && r.method() === "POST") a.mutations.push(m[1].replace("trpc/", ""));
		});
		const r = await runFlow(vp, a, { job: "sign-up", entry: `real onboarding, ${label}`, start: "/", attempt }, async (f) => {
			f.participants = [""];
			await a.goto("/");
			f.screen("Landing");
			await f.nav(page.getByRole("link", { name: /Get Started/ }).first(), "Get Started");
			f.screen("Login");
			await a.settle();
			await hydrated(page);
			await f.fill(page.getByPlaceholder("you@email.com"), email, "email");
			await f.tap(page.getByRole("button", { name: "Send Magic Link" }), "Send Magic Link");
			await page.getByRole("heading", { name: "Magic link sent!" }).waitFor();
			f.screen("Check your email");
			const link = await mailLink(email);
			f.rec.steps.push({ kind: "nav", label: "open email, tap magic link" });
			f.screen("Email client");
			await page.goto(link);
			await page.waitForURL(/onboarding/, { timeout: 30000 });
			await hydrated(page);
			let reloads = 0;
			page.on("load", () => reloads++);
			f.screen("Onboarding: Username");
			f.decide("username (required)", ["text"]);
			await f.fill(page.getByPlaceholder("cinephile42"), `n${Date.now().toString(36)}`, "username");
			await f.tap(page.getByRole("button", { name: "Continue" }), "Continue");
			await page.getByText("Add a photo").waitFor();
			f.screen("Onboarding: Avatar");
			f.decide("avatar", ["upload", "Skip for now"]);
			await f.tap(page.getByRole("button", { name: "Skip for now" }), "Skip for now");
			f.screen("Onboarding: Taste");
			await a.settle(1500);
			await f.shot("taste-empty");
			f.decide("genres (required, min 3?)", ["genre pills"]);
			f.decide("titles (required, 3-10)", ["poster grid", "search"]);
			const card = page.locator("button.group:has(h3)");
			const search = page.getByPlaceholder("Search for a movie or TV show...");
			for (const g of ["Action", "Comedy", "Drama"]) await f.tap(page.getByRole("button", { name: g, exact: true }), `genre ${g}`);
			await card.first().waitFor();
			if (picks) {
				await f.fill(search, picks, "search title");
				const hit = card.filter({ hasText: picks }).first();
				await hit.waitFor();
				await f.shot("taste-search");
				await f.tap(hit, `pick ${picks}`);
				await f.fill(search, "", "clear search");
				await card.nth(4).waitFor();
			}
			const need = picks ? 2 : 3;
			for (let i = 0; i < need; i++) await f.tap(card.nth(i + 2), `pick title ${i + 1}`);
			await f.shot("taste-picked");
			await f.tap(page.getByRole("button", { name: /continue/i }).last(), "Continue");
			await a.settle(1500);
			f.screen("Onboarding: Favourite");
			f.decide("favourite film", ["search", "Skip for now"]);
			await f.tap(page.getByRole("button", { name: "Skip for now" }), "Skip for now");
			f.screen("Onboarding: Genre");
			f.decide("favourite genre", ["pick", "Skip for now"]);
			await f.tap(page.getByRole("button", { name: "Skip for now" }), "Skip for now");
			f.screen("Onboarding: Bio");
			f.decide("bio", ["text", "Skip for now"]);
			await f.tap(page.getByRole("button", { name: "Skip for now" }), "Skip for now");
			await page.waitForURL("**/app/search**", { timeout: 30000 });
			await a.settle(2000);
			f.screen("Search (landing)");
			await f.popup();
			await f.shot("first-screen");
			f.observe("devReloadsDuringOnboarding", reloads);
			const id = psql(`select id from "user" where email='${email}'`)[0][0];
			a.id = id;
			f.participants = [id];
			f.observe("userTitleRows", psql(`select tmdb_id, media_type, current_watch_number from user_title where user_id='${id}'`));
			f.observe("myPicks", psql(`select wi.tmdb_id, wi.media_type, wi.title, wi.watched from watchlist_item wi join watchlist w on w.id=wi.watchlist_id where w.owner_id='${id}'`));
			f.observe("watchEvents", psql(`select count(*) from watch_event where user_id='${id}'`)[0][0]);
			await a.goto("/app/tracker");
			await f.popup();
			await f.shot("tracker-after-signup");
			f.observe("trackerText", (await bodyText(page)).replace(/\s+/g, " ").slice(0, 300));
			await a.goto("/app/feed");
			await f.popup();
			await f.shot("feed-after-signup");
			f.observe("feedText", (await bodyText(page)).replace(/\s+/g, " ").slice(0, 300));
			await a.goto(`/app/profile/${id}`);
			await f.popup();
			await f.shot("profile-after-signup");
			f.observe("profileText", (await bodyText(page)).replace(/\s+/g, " ").slice(0, 300));
		});
		await ctx.close();
		if (r.result !== "fail") break;
		}
	}

	await flow("w1", { job: "save-for-later", entry: "title page Watchlist popover, My Picks", start: SEARCH }, async (a, f) => {
		await a.goto("/app/title/movie/603");
		await f.popup();
	}, async (f) => {
		await f.search("The Matrix", "/app/title/movie/603");
		f.screen("Title page");
		await f.a.settle();
		const b = arcade(f.a.page, "Watchlist");
		await f.tap(b, "tap Watchlist");
		const item = f.a.page.getByRole("button", { name: "My Picks", exact: true });
		await f.retry(b, item);
		f.screen("Add to Watchlist popover");
		f.decide("which list", ["My Picks", "other lists", "Create New Watchlist"]);
		await f.tap(item, "tap My Picks");
	});
	await flow("w2", { job: "save-for-later", entry: "search poster card bookmark", start: SEARCH }, async (a, f) => {
		await a.goto("/app/title/movie/603");
		await f.popup();
	}, async (f) => {
		const p = f.a.page;
		await f.fill(p.getByRole("textbox", { name: "Search movies and TV shows" }), "The Matrix", 'search "The Matrix"');
		const hit = p.locator('a[href="/app/title/movie/603"]').first();
		await hit.waitFor({ timeout: 30000 });
		const b = hit.getByRole("button", { name: "Add to watchlist" });
		f.observe("bookmarkOpacity", await b.evaluate((el) => {
			let o = 1;
			for (let n: HTMLElement | null = el as HTMLElement; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
			return o;
		}));
		await f.shot("bookmark-visibility");
		await f.tap(b, "tap bookmark");
		await p.waitForTimeout(800);
		f.observe("urlAfterBookmarkTap", p.url());
		await f.shot("after-bookmark-tap");
		const item = p.getByRole("button", { name: "My Picks", exact: true });
		if (!(await item.isVisible())) {
			f.rec.result = "blocked";
			f.friction("bookmark has opacity 0 at touch width and tapping it follows the card link to the title page");
			return;
		}
		f.screen("Add to Watchlist popover");
		f.decide("which list", ["My Picks", "other lists", "Create New Watchlist"]);
		await f.tap(item, "tap My Picks");
	});
	await flow("sh1", { job: "decide-what-to-watch", entry: "shuffle alone, one Yes", start: SEARCH }, none, async (f) => {
		await toShuffle(f);
		await f.shot("card");
		f.decide("card", ["No", "Undo", "Hide", "Yes", "tap card for details"]);
		await f.tap(cardsYes(f), "tap Yes");
	});
	await flow("sh2", { job: "decide-what-to-watch", entry: "shuffle alone, one No then Hide", start: SEARCH }, none, async (f) => {
		await toShuffle(f);
		f.decide("card", ["No", "Undo", "Hide", "Yes", "tap card for details"]);
		await f.tap(f.a.page.getByRole("button", { name: "No — skip this title" }), "tap No");
		await f.a.page.waitForTimeout(800);
		await f.tap(f.a.page.getByRole("button", { name: "Hide", exact: true }).first(), "tap Hide");
		await f.a.page.waitForTimeout(600);
		await f.shot("hide-confirm");
		const confirm = f.a.page.getByRole("dialog").getByRole("button", { name: /hide/i }).first();
		if (await confirm.isVisible().catch(() => false)) await f.tap(confirm, "confirm Hide");
	});
	await flow("sh3", { job: "decide-what-to-watch", entry: "shuffle with a friend until a match", start: SEARCH, friend: true, friendReads: false, preconditions: ["list shared with friend"] }, async (a, f, c) => {
		await sharedList(a, f, "Together", c.friend?.username as string);
	}, async (f, c) => {
		const friend = c.friend as Actor;
		const g = f.as(friend);
		const openGroup = async (x: Flow) => {
			await x.drawer("Watchlists");
			x.screen("Watchlists");
			await x.nav(x.a.page.getByRole("link", { name: /Together/ }).first(), "open Together");
			x.screen("Together list");
			await x.nav(x.a.page.getByRole("link", { name: /Showtime Shuffle/ }), "Showtime Shuffle");
			x.screen("Shuffle (group)");
			await cardsYes(x).waitFor({ timeout: 30000 });
			await x.a.settle();
		};
		f.friction("Group shuffle has no entry on the Shuffle page. It starts only from the Showtime Shuffle link in a shared watchlist's header.");
		await openGroup(f);
		const p = f.a.page;
		await f.shot("group-card");
		const seen: string[] = [];
		const cur = async (x: Actor) => psql(`select tmdb_id, media_type from shuffle_swipe where user_id='${x.id}' order by created_at desc limit 1`)[0];
		for (let i = 0; i < 4; i++) {
			await f.tap(cardsYes(f), `A: Yes ${i + 1}`);
			await p.waitForTimeout(700);
			const s = await cur(f.a);
			if (s) seen.push(s.join("/"));
		}
		f.observe("aYes", seen);
		await friend.goto(SEARCH);
		await openGroup(g);
		let matched = false;
		for (let i = 0; i < 8 && !matched; i++) {
			await g.tap(cardsYes(g), `B: Yes ${i + 1}`);
			await friend.page.waitForTimeout(900);
			matched = await friend.page.getByRole("dialog", { name: "Match" }).isVisible();
		}
		f.observe("matched", matched);
		f.observe("matchNotifications", psql(`select recipient_id = '${friend.id}', type from notification where type like '%match%' and recipient_id in ('${friend.id}','${f.a.id}')`));
		f.observe("matchDialogText", matched ? (await friend.page.getByRole("dialog", { name: "Match" }).innerText()).replace(/\s+/g, " ") : null);
		await capture(f.vp, friend, `${f.rec.id}-match`).then((b) => f.rec.evidence.push(`${f.rec.journey}/${b}.png`));
		f.screen("Match curtain");
	});
	await flow("r1", { job: "recommend", entry: "title page Invite", start: SEARCH, friend: true, friendReads: false }, none, async (f, c) => {
		await f.search("The Matrix", "/app/title/movie/603");
		f.screen("Title page");
		await f.a.settle();
		await f.tap(arcade(f.a.page, "Invite"), "tap Invite");
		await pickFriend(f, c.friend?.username as string);
	});
	await flow("r2", { job: "recommend", entry: "review modal, Recommend to a friend", start: SEARCH, friend: true, friendReads: false }, none, async (f, c) => {
		await f.search("The Matrix", "/app/title/movie/603");
		f.screen("Title page");
		await pressWatched(f);
		const d = reviewDialog(f);
		await d.waitFor();
		f.screen("Review modal");
		await f.tap(d.getByRole("button", { name: /Recommend to a friend/ }), "Recommend to a friend");
		await pickFriend(f, c.friend?.username as string);
		await f.a.page.waitForTimeout(500);
		await f.tap(d.getByRole("button", { name: /^Public/ }), "visibility Public");
		await f.tap(d.getByRole("button", { name: "Save & Done" }), "Save & Done");
	});
	const received = async (a: Actor, f: Flow, c: { friend?: Actor }) => {
		await sendRec(c.friend as Actor, f, a.username);
		await a.goto(SEARCH);
	};
	await flow("r3", { job: "act-on-recommendation", entry: "bell Accept, then Recommendations list eye", start: SEARCH, friend: true, friendReads: false, preconditions: ["friend sent a recommendation"] }, received, async (f) => {
		await f.bell();
		await f.shot("bell");
		f.decide("recommendation", ["Accept", "Decline", "tap row to title", "X"]);
		const p = f.a.page;
		await f.tap(p.getByRole("button", { name: "Accept" }), "Accept");
		await f.key("Escape", "close notifications");
		await f.drawer("Watchlists");
		f.screen("Watchlists");
		await f.nav(p.getByRole("link", { name: /Recommendations/ }).first(), "open Recommendations");
		f.screen("Watchlist detail");
		await f.tap(p.locator('button[title="Mark watched"]').first(), "tap eye");
		await reviewTail(f, { stars: 4, note: NOTE });
	});
	await flow("r4", { job: "act-on-recommendation", entry: "bell Accept, then title page Watched", start: SEARCH, friend: true, friendReads: false, preconditions: ["friend sent a recommendation"] }, received, async (f) => {
		await f.bell();
		const p = f.a.page;
		await f.tap(p.getByRole("button", { name: "Accept" }), "Accept");
		await f.nav(p.getByRole("link", { name: /recommended/ }).first(), "tap notification row");
		f.screen("Title page");
		await pressWatched(f);
		await reviewTail(f, { stars: 4, note: NOTE });
	});
	await flow("r5", { job: "act-on-recommendation", entry: "tap row without Accept, title page Watched", start: SEARCH, friend: true, friendReads: false, preconditions: ["friend sent a recommendation"] }, received, async (f) => {
		await f.bell();
		await f.nav(f.a.page.getByRole("link", { name: /recommended/ }).first(), "tap notification row");
		f.screen("Title page");
		await pressWatched(f);
		await reviewTail(f, { stars: 4, note: NOTE });
	});
	await flow("r6", { job: "act-on-recommendation", entry: "bell Decline", start: SEARCH, friend: true, friendReads: false, preconditions: ["friend sent a recommendation"] }, received, async (f) => {
		await f.bell();
		await f.tap(f.a.page.getByRole("button", { name: "Decline" }), "Decline");
	});
	await flow("c1", { job: "watched-with", entry: "friend: bell Add yours, title page Watched", start: SEARCH, friend: true, friendReads: false, preconditions: ["friend logged this film with acting user as companion and a review"] }, async (a, f, c) => {
		const pal = c.friend as Actor;
		const g = f.as(pal);
		await pal.goto("/app/title/movie/603");
		await g.popup();
		await pressWatched(g);
		const d = reviewDialog(g);
		await d.waitFor();
		await d.getByRole("button", { name: "Rate 4 stars" }).click();
		await d.getByRole("button", { name: /Watched with/ }).click();
		const w = pal.page.getByRole("dialog", { name: "Watched With" });
		await w.getByPlaceholder("@friend or a name…").fill(a.username);
		await pal.settle();
		await w.getByRole("button", { name: new RegExp(`@${a.username}`) }).click();
		await w.getByRole("button", { name: /done/i }).click();
		await d.getByRole("button", { name: /^Public/ }).click();
		await d.getByRole("button", { name: "Save & Done" }).click();
		await pal.settle();
		await a.goto(SEARCH);
	}, async (f) => {
		await f.bell();
		await f.shot("bell");
		f.decide("companion notification", ["Add yours", "tap row", "X"]);
		await f.nav(f.a.page.getByRole("button", { name: "Add yours" }), "Add yours");
		f.screen("Title page");
		await f.shot("title-before");
		f.observe("watchedLitBeforePress", (await arcade(f.a.page, "Watched").getAttribute("class"))?.includes("0_0_60px"));
		f.observe("historyBeforePress", await present(f.a.page, "Your Watch History"));
		await pressWatched(f);
		await f.a.page.waitForTimeout(600);
		await f.shot("after-press");
		await reviewTail(f, { stars: 3, note: NOTE });
	});
	await flow("c2", { job: "delete-log", entry: "title page card, log has a reciprocal friend event", start: SEARCH, friend: true, preconditions: ["acting user logged with friend as companion"] }, async (a, f, c) => {
		await a.goto("/app/title/movie/603");
		await f.popup();
		await pressWatched(f);
		const d = reviewDialog(f);
		await d.waitFor();
		await d.getByRole("button", { name: "Rate 4 stars" }).click();
		await d.getByPlaceholder("Share your thoughts…").fill(NOTE);
		await d.getByRole("button", { name: /Watched with/ }).click();
		const w = a.page.getByRole("dialog", { name: "Watched With" });
		await w.getByPlaceholder("@friend or a name…").fill(c.friend?.username as string);
		await a.settle();
		await w.getByRole("button", { name: new RegExp(`@${c.friend?.username}`) }).click();
		await w.getByRole("button", { name: /done/i }).click();
		await d.getByRole("button", { name: /^Public/ }).click();
		await d.getByRole("button", { name: "Save & Done" }).click();
		await a.settle();
		await f.popup();
	}, async (f) => {
		await f.search("The Matrix", "/app/title/movie/603");
		f.screen("Title page");
		await f.tap(f.a.page.locator("button:has(svg.lucide-ellipsis)").first(), "open log menu");
		await f.tap(f.a.page.getByRole("button", { name: "Delete" }), "Delete");
		await f.tap(f.a.page.getByRole("button", { name: "Confirm Delete" }), "Confirm Delete");
	});
	await flow("f1", { job: "add-friend", entry: "friends search, other accepts on friends page", start: SEARCH, friend: true, friendReads: false }, async (a, _f, c) => {
		psql(`delete from friendship where requester_id='${a.id}' and addressee_id='${c.friend?.id}'`);
	}, async (f, c) => {
		const b = c.friend as Actor;
		const g = f.as(b);
		await f.drawer("Friends");
		f.screen("Friends");
		await f.fill(f.a.page.getByRole("textbox", { name: "Search friends or find new people" }), b.username, "type username");
		await f.shot("friends-search");
		await f.tap(f.a.page.getByRole("button", { name: /Add Friend/ }).first(), "Add Friend");
		await b.goto(SEARCH);
		await g.drawer("Friends");
		g.screen("B: Friends");
		await f.as(b).shot("pending");
		await g.tap(b.page.getByRole("button", { name: "Accept friend request" }), "B: Accept");
	});
	await flow("f2", { job: "add-friend", entry: "profile Add Friend, other accepts via bell and profile", start: SEARCH, friend: true, friendReads: false, preconditions: ["acting user is on the other person's profile URL"] }, async (a, _f, c) => {
		psql(`delete from friendship where requester_id='${a.id}' and addressee_id='${c.friend?.id}'`);
	}, async (f, c) => {
		const b = c.friend as Actor;
		const g = f.as(b);
		await f.a.goto(`/app/profile/${b.id}`);
		await f.popup();
		f.screen("Other profile");
		await f.shot("stranger-profile");
		f.decide("relationship", ["Add Friend", "Block"]);
		await f.tap(f.a.page.getByRole("button", { name: /Add Friend/ }).first(), "Add Friend");
		await b.goto(SEARCH);
		await g.bell();
		await g.nav(b.page.getByRole("link", { name: /friend request/ }).first(), "B: tap request row");
		g.screen("B: requester profile");
		await g.shot("accept-on-profile");
		await g.tap(b.page.getByRole("button", { name: /Accept/ }).first(), "B: Accept");
	});
	await flow("v1", { job: "see-friends-watched", entry: "feed", start: SEARCH, friend: true, friendReads: false, preconditions: ["friend logged a film publicly"] }, async (_a, f, c) => {
		await logMatrix(c.friend as Actor, f);
	}, async (f) => {
		await f.drawer("Feed");
		f.screen("Feed");
		await f.shot("feed");
		f.observe("friendLogVisible", await present(f.a.page, NOTE));
	});
	await flow("v2", { job: "see-friends-watched", entry: "friends page, friend profile, activity", start: SEARCH, friend: true, friendReads: false, preconditions: ["friend logged a film publicly"] }, async (_a, f, c) => {
		await logMatrix(c.friend as Actor, f);
	}, async (f, c) => {
		await f.drawer("Friends");
		f.screen("Friends");
		await f.nav(f.a.page.locator(`a[href="/app/profile/${c.friend?.id}"]`).first(), "open friend");
		f.screen("Friend profile");
		await f.shot("friend-profile");
		f.observe("friendLogVisible", await present(f.a.page, NOTE));
	});
	const history = async (a: Actor, f: Flow) => {
		await logMatrix(a, f);
		await trackAndNote(a, f, false);
	};
	const toProfile = async (f: Flow) => {
		await f.nav(f.a.page.getByRole("button", { name: "Open user menu" }), "open user menu");
		f.screen("User menu");
		await f.nav(f.a.page.getByRole("menuitem", { name: /profile/i }).or(f.a.page.getByRole("link", { name: /profile/i })).first(), "tap Profile");
		f.screen("Profile");
	};
	const pre = ["one public film log, one private TV journal note"];
	await flow("d1", { job: "review-own-history", entry: "profile Activity tab", start: SEARCH, preconditions: pre }, history, async (f) => {
		await toProfile(f);
		await f.shot("activity");
		f.observe("filmNote", await present(f.a.page, NOTE));
		f.observe("showsChernobyl", await present(f.a.page, "Chernobyl"));
	});
	await flow("d2", { job: "review-own-history", entry: "feed, Just Me", start: SEARCH, preconditions: pre }, history, async (f) => {
		await f.drawer("Feed");
		f.screen("Feed");
		f.decide("filter", ["Everyone", "Just Me"]);
		f.rec.steps.push({ kind: "tap", label: "choose Just Me" });
		await f.a.page.locator("select").first().selectOption({ label: "Just Me" });
		await f.a.settle();
		await f.shot("just-me");
		f.observe("showsPrivateJournal", await present(f.a.page, "Chernobyl"));
	});
	await flow("d3", { job: "review-own-history", entry: "tracker Journal tab", start: SEARCH, preconditions: pre }, history, async (f) => {
		await f.drawer("Tracker");
		f.screen("Tracker index");
		await f.tap(f.a.page.getByRole("button", { name: "Journal" }), "Journal tab");
		await f.shot("journal");
		f.observe("showsFilm", await present(f.a.page, "The Matrix"));
		f.observe("showsNote", await present(f.a.page, NOTE));
	});
	await flow("d4", { job: "review-own-history", entry: "profile Journal tab", start: SEARCH, preconditions: pre }, history, async (f) => {
		await toProfile(f);
		await f.tap(f.a.page.getByRole("button", { name: /journal/i }).first(), "Journal tab");
		await f.shot("journal");
		f.observe("showsFilm", await present(f.a.page, "The Matrix"));
		f.observe("showsNote", await present(f.a.page, NOTE));
	});
	await flow("q1", { job: "find-what-i-thought", entry: "film: search to title page history", start: SEARCH, preconditions: pre }, history, async (f) => {
		await f.search("The Matrix", "/app/title/movie/603");
		f.screen("Title page");
		await f.a.settle();
		await f.shot("title");
		f.observe("noteOnTitlePage", await present(f.a.page, NOTE));
	});
	await flow("q2a", { job: "find-what-i-thought", entry: "TV: search to title page, note absent", start: SEARCH, preconditions: pre }, history, async (f) => {
		await f.search("Chernobyl", "/app/title/tv/87108");
		f.screen("Title page");
		await f.a.settle();
		await f.shot("title");
		f.observe("noteOnTitlePage", await present(f.a.page, NOTE));
		await f.tap(arcade(f.a.page, "Watched"), "tap Watched to reach tracker");
		await f.a.page.waitForURL("**/app/tracker/87108");
		f.screen("Tracker detail");
		await f.a.settle();
		await f.shot("tracker");
		f.observe("noteOnTracker", await present(f.a.page, NOTE));
		f.friction("the only link from a TV title page to my notes is the button labelled Watched");
	});
	await flow("x1", { job: "delete-account", entry: "user menu, settings, Danger Zone", start: SEARCH, friend: true, friendReads: false, preconditions: ["logged with friend as companion, friend got notification, shared list with item, recommendation sent"] }, async (a, f, c) => {
		const pal = c.friend as Actor;
		await sharedList(a, f, "Together", pal.username);
		await addToList(a, f, MATRIX, "Together");
		await a.goto("/app/title/movie/603");
		await f.popup();
		await pressWatched(f);
		const d = reviewDialog(f);
		await d.waitFor();
		await d.getByRole("button", { name: "Rate 4 stars" }).click();
		await d.getByPlaceholder("Share your thoughts…").fill(NOTE);
		await d.getByRole("button", { name: /Watched with/ }).click();
		const w = a.page.getByRole("dialog", { name: "Watched With" });
		await w.getByPlaceholder("@friend or a name…").fill(pal.username);
		await a.settle();
		await w.getByRole("button", { name: new RegExp(`@${pal.username}`) }).click();
		await w.getByRole("button", { name: /done/i }).click();
		await d.getByRole("button", { name: /^Public/ }).click();
		await d.getByRole("button", { name: "Save & Done" }).click();
		await a.settle();
		await f.popup();
		await sendRec(a, f, pal.username);
	}, async (f, c) => {
		const p = f.a.page;
		await f.nav(p.getByRole("button", { name: "Open user menu" }), "open user menu");
		f.screen("User menu");
		await f.nav(p.getByRole("menuitem", { name: /settings/i }).or(p.getByRole("link", { name: /settings/i })).first(), "tap Settings");
		f.screen("Settings");
		await f.shot("settings");
		await f.tap(p.getByRole("button", { name: "Delete Account" }), "Delete Account");
		f.screen("Delete dialog");
		f.decide("confirm deletion", ["type DELETE", "Cancel"]);
		const d = p.getByRole("dialog");
		await f.fill(d.getByPlaceholder("DELETE"), "DELETE", "type DELETE");
		await f.tap(d.getByRole("button", { name: /Delete Account/ }), "Delete Account");
		await p.waitForURL((u) => !u.pathname.startsWith("/app"), { timeout: 20000 }).catch(() => {});
		await f.shot("after-delete");
		f.observe("landedOn", p.url());
		const pal = c.friend as Actor;
		await pal.goto("/app/feed");
		await capture(f.vp, pal, `${f.rec.id}-friend-feed-after`).then((b) => f.rec.evidence.push(`${f.rec.journey}/${b}.png`));
		f.observe("friendFeedAfter", (await bodyText(pal.page)).replace(/\s+/g, " ").slice(0, 300));
		f.observe("friendRows", psql(`select tmdb_id, origin_event_id, visibility from watch_event where user_id='${pal.id}'`));
	});
	finish();
}
