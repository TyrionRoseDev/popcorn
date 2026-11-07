// Feature: phase-1 probe. Hit-tests whether text a reader found in the DOM can be seen at 390 wide.
// Usage: verify-popcorn drive probe-reader-visibility
import type { Page } from "playwright-core";
import type { Vp } from "../scripts/lib/vp.ts";
import { actor, arcade, capture, fixtureUser, holdAchievements, psql } from "./flow-lib.ts";

const FILM_NOTE = "visible film note";
const JOURNAL_NOTE = "visible journal note";

const hitTest = (p: Page, text: string) =>
	p.getByText(text).first().evaluate(async (el) => {
		el.scrollIntoView({ block: "center", inline: "nearest" });
		await new Promise((r) => setTimeout(r, 500));
		const r = el.getBoundingClientRect();
		const x = r.x + Math.min(r.width, 40) / 2;
		const y = r.y + r.height / 2;
		const top = document.elementFromPoint(x, y);
		return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), hit: !!top && (top === el || el.contains(top) || top.contains(el)) };
	}).catch(() => ({ missing: true, hit: false }));

export default async function probe(vp: Vp) {
	const key = `vis${Date.now().toString(36)}`;
	fixtureUser(`${key}pal`);
	fixtureUser(key, [`${key}pal`]);
	const a = await actor(vp, key);
	const pal = await actor(vp, `${key}pal`);
	holdAchievements(a, ["first-watch", "series-finale"]);
	const clear = async (p: Page) => {
		const c = p.locator('[role="dialog"]', { hasText: /Achievements? Unlocked/ }).first();
		await p.waitForTimeout(1500);
		for (let i = 0; i < 6 && (await c.isVisible().catch(() => false)); i++) {
			const b = await c.locator("button", { hasText: /continue/i }).boundingBox();
			if (b) await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
			await p.waitForTimeout(900);
		}
	};
	const p = a.page;
	await a.goto("/app/title/movie/603");
	await clear(p);
	await arcade(p, "Watched").click();
	const d = p.getByRole("dialog", { name: "Review" });
	await d.waitFor();
	await d.getByRole("button", { name: "Rate 4 stars" }).click();
	await d.getByPlaceholder("Share your thoughts…").fill(FILM_NOTE);
	await d.getByRole("button", { name: /^Public/ }).click();
	await d.getByRole("button", { name: "Save & Done" }).click();
	await d.waitFor({ state: "hidden" });
	await a.settle();
	await clear(p);
	await a.goto("/app/title/tv/87108");
	await clear(p);
	await arcade(p, "Watched").click();
	await p.waitForURL("**/app/tracker/87108");
	await a.settle();
	await clear(p);
	await p.getByRole("button", { name: /^1 .* min/ }).first().click();
	await a.settle();
	await clear(p);
	await p.getByRole("button", { name: "Dismiss" }).click({ timeout: 2000 }).catch(() => {});
	await p.getByRole("button", { name: /^Write/ }).first().click();
	const w = p.getByRole("dialog", { name: "Write About" });
	await w.getByRole("button", { name: /^Note/ }).click();
	await w.getByRole("button", { name: /Specific Episode/ }).click();
	await w.getByRole("button", { name: /^S1\b/ }).first().click();
	await w.getByRole("button", { name: /(Episode |E)1\b/ }).first().click();
	await w.getByPlaceholder("Share your thoughts...").fill(JOURNAL_NOTE);
	await w.getByRole("switch").click();
	await w.getByRole("button", { name: "Save Note" }).click();
	await a.settle();

	const out: Record<string, unknown> = {};
	const check = async (actorName: string, x: typeof a, label: string, path: string, text: string, tab?: string) => {
		await x.goto(path);
		await clear(x.page);
		if (tab) {
			await x.page.getByRole("button", { name: tab, exact: true }).first().click().catch(() => {});
			await x.settle();
		}
		out[label] = await hitTest(x.page, text);
		await x.page.screenshot({ path: `${vp.dir}/${label}.png` });
		await capture(vp, x, `${actorName}-${label}`);
	};
	await check("own", a, "title-film-note", "/app/title/movie/603", FILM_NOTE);
	await check("own", a, "feed-film-note", "/app/feed", FILM_NOTE);
	await check("own", a, "profile-activity-film-note", `/app/profile/${a.id}`, FILM_NOTE);
	await check("own", a, "profile-journal-note", `/app/profile/${a.id}`, JOURNAL_NOTE, "Journal");
	await check("own", a, "tracker-index-journal-note", "/app/tracker", JOURNAL_NOTE, "Journal");
	await check("own", a, "tracker-detail-journal-note", "/app/tracker/87108", JOURNAL_NOTE);
	await check("friend", pal, "friend-feed-film-note", "/app/feed", FILM_NOTE);
	await check("friend", pal, "friend-profile-film-note", `/app/profile/${a.id}`, FILM_NOTE);
	console.log(JSON.stringify(out, null, 0));
	console.log(JSON.stringify({ events: psql(`select count(*) from watch_event where user_id='${a.id}'`)[0][0] }));
	await a.ctx.close();
	await pal.ctx.close();
}
