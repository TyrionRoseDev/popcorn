// Feature: global CSS cascade, phone layout, touch paths and reduced motion.
// Usage on a fresh run (it logs a first watch, so the achievement popup fires once per run):
//   verify-popcorn drive layout
// Evidence: <w>-<route>.png per width, plus profile-tabs-*.png, popup-reduced.png and shuffle-*.png.
import { join } from "node:path";
import type { Browser, BrowserContext, Locator, Page } from "playwright-core";
import type { Vp } from "../scripts/lib/vp.ts";
import { arcade, hydrated } from "./flow-lib.ts";

type Width = 320 | 390 | 1440;
const WIDTHS: Width[] = [320, 390, 1440];
const MATRIX = "/app/title/movie/603";
const BREAKING_BAD = 1396;
const CHERNOBYL = 87108;

// Records every inline style change, so JS-driven motion (which document.getAnimations() cannot see) is measurable,
// including on elements that animate out and are removed. Polls running transform animations too, because
// getAnimations() forgets an animation once it finishes. Reduced-motion CSS shrinks durations to 0.01ms, which this skips.
const MOTION_RECORDER = () => {
	const w = window as unknown as {
		__moves: { t: number; el: Element; v: string; dialog: boolean }[];
		__anims: { t: number; name: string; dialog: boolean }[];
	};
	w.__moves = [];
	w.__anims = [];
	new MutationObserver((records) => {
		for (const r of records) {
			const el = r.target as HTMLElement;
			w.__moves.push({ t: performance.now(), el, v: el.style.transform, dialog: !!el.closest("[role=dialog]") });
		}
	}).observe(document, { subtree: true, attributes: true, attributeFilter: ["style"] });
	const seen = new WeakSet<Animation>();
	setInterval(() => {
		for (const a of document.getAnimations()) {
			const effect = a.effect as KeyframeEffect | null;
			if (seen.has(a) || a.playState !== "running" || !effect?.target) continue;
			if (Number(effect.getComputedTiming().activeDuration) < 50) continue;
			if (!effect.getKeyframes().some((k) => "transform" in k || "translate" in k || "scale" in k || "rotate" in k)) continue;
			seen.add(a);
			w.__anims.push({ t: performance.now(), name: (a as CSSAnimation).animationName ?? "waapi", dialog: !!effect.target.closest("[role=dialog]") });
		}
	}, 30);
};

async function newContext(browser: Browser, appUrl: string, storageState: Awaited<ReturnType<BrowserContext["storageState"]>>, width: Width, reducedMotion: "reduce" | "no-preference") {
	const phone = width < 768;
	const ctx = await browser.newContext({
		baseURL: appUrl,
		viewport: { width, height: phone ? 844 : 900 },
		isMobile: phone,
		hasTouch: phone,
		deviceScaleFactor: 1,
		reducedMotion,
		colorScheme: "dark",
		storageState,
	});
	ctx.setDefaultTimeout(45000);
	await ctx.addInitScript(MOTION_RECORDER);
	return ctx;
}

async function open(page: Page, path: string) {
	for (let attempt = 0; ; attempt++) {
		try {
			await page.goto(path, { timeout: 90000 });
			await hydrated(page);
			await page.waitForTimeout(600);
			return;
		} catch (e) {
			if (attempt === 2) throw e;
		}
	}
}

// Moving means three or more distinct inline transforms on one element, or a transform animation that started in the window.
function motionSince(page: Page, since: number, dialogOnly = false) {
	return page.evaluate(
		({ since, dialogOnly }) => {
			const w = window as unknown as {
				__moves: { t: number; el: Element; v: string; dialog: boolean }[];
				__anims: { t: number; name: string; dialog: boolean }[];
			};
			const seen = new Map<Element, Set<string>>();
			for (const m of w.__moves) {
				if (m.t < since || (dialogOnly && !m.dialog)) continue;
				const values = seen.get(m.el) ?? new Set<string>();
				values.add(m.v);
				seen.set(m.el, values);
			}
			const jsMoved = [...seen.entries()].filter(([, v]) => v.size >= 3).map(([el, v]) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 40)} x${v.size}`);
			const moving = w.__anims.filter((a) => a.t >= since && (!dialogOnly || a.dialog)).map((a) => a.name);
			return { jsMoved, moving };
		},
		{ since, dialogOnly },
	);
}

const now = (page: Page) => page.evaluate(() => performance.now());

function pageChecks(page: Page, width: number) {
	return page.evaluate((width) => {
		const checkWords = width < 768;
		const visible = (el: Element) => {
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle(el);
			return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
		};
		const describe = (el: Element) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).replace(/\s+/g, ".").slice(0, 60)}`;

		const sw = document.documentElement.scrollWidth;
		const iw = window.innerWidth;
		const offenders = sw > width
			? [...document.querySelectorAll("body *")]
					.filter((el) => el.getBoundingClientRect().right > width + 1 && visible(el))
					.map((el) => ({ el: describe(el), right: Math.round(el.getBoundingClientRect().right) }))
					.sort((a, b) => b.right - a.right)
					.slice(0, 4)
			: [];

		const split: string[] = [];
		if (checkWords) {
			const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
			for (let n = walker.nextNode(); n && split.length < 8; n = walker.nextNode()) {
				const parent = n.parentElement;
				if (!parent || !visible(parent) || parent.closest("script, style, [aria-hidden=true]")) continue;
				const text = n.textContent ?? "";
				for (const m of text.matchAll(/[\p{L}\p{N}]{3,}/gu)) {
					const range = document.createRange();
					range.setStart(n, m.index);
					range.setEnd(n, m.index + m[0].length);
					const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
					if (tops.size > 1) split.push(`${m[0]} in ${describe(parent)}`);
				}
			}
		}

		const STRUCTURAL = /(^|\s)(first|last|odd|even|only|nth-[^:]+):/;
		const cascade: string[] = [];
		for (const el of document.querySelectorAll("a, button")) {
			if (!visible(el) || (el as HTMLButtonElement).disabled || STRUCTURAL.test(String((el as HTMLElement).className))) continue;
			const probe = document.createElement("span");
			for (const attr of el.attributes) probe.setAttribute(attr.name, attr.value);
			probe.removeAttribute("href");
			probe.style.display = "none";
			el.after(probe);
			const want = getComputedStyle(probe);
			const got = getComputedStyle(el);
			const diffs = (["color", "transitionDuration", "transitionProperty"] as const).filter((p) => want[p] !== got[p]).map((p) => `${p} ${got[p]} != ${want[p]}`);
			probe.remove();
			if (diffs.length) cascade.push(`${describe(el)} "${(el.textContent ?? "").trim().slice(0, 16)}": ${diffs.join(", ")}`);
		}

		const navLinks = [...document.querySelectorAll("header nav a")].filter(visible).length;

		const unlayered: string[] = [];
		for (const sheet of document.styleSheets) {
			let rules: CSSRuleList;
			try {
				rules = sheet.cssRules;
			} catch {
				continue;
			}
			for (const rule of rules) {
				if (rule instanceof CSSStyleRule && /(^|,)\s*(a|button)(:hover)?\s*(,|$)/.test(rule.selectorText)) unlayered.push(rule.selectorText);
			}
		}

		return { sw, iw, offenders, split, cascade: cascade.slice(0, 6), cascadeCount: cascade.length, navLinks, unlayered };
	}, width);
}

// Visible to a finger: inside the viewport after scrolling the page (never a clipped container) to it, painted on top, and not faded out.
async function reachable(page: Page, loc: Locator) {
	await loc.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - window.innerHeight / 2));
	await page.waitForTimeout(150);
	return loc.evaluate((el) => {
		const r = el.getBoundingClientRect();
		let opacity = 1;
		for (let n: Element | null = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
		const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
		const inView = r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight;
		return { inView, onTop: !!hit && (hit === el || el.contains(hit)), opacity, box: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` };
	});
}

export default async function (vp: Vp) {
	const failures: string[] = [];
	const check = (ok: unknown, message: string) => {
		vp.step(`${ok ? "ok  " : "FAIL"} ${message}`);
		if (!ok) failures.push(message);
	};

	await vp.goto("/app/search");
	if (new URL(vp.page.url()).pathname === "/login") await vp.signIn();
	const me = vp.sql(`select id from "user" where email = 'vera@popcorn.test'`, "acting user")[0][0];
	const felix = vp.sql(`select id from "user" where email = 'felix@popcorn.test'`, "friend")[0][0];
	const state = await vp.context.storageState();
	const browser = vp.context.browser() as Browser;
	const shot = (page: Page, name: string) => page.screenshot({ path: join(vp.dir, `${name}.png`), fullPage: true });

	vp.step("reduced motion: log a first watch at 390 and watch the achievement popup");
	const reduced = await newContext(browser, vp.appUrl, state, 390, "reduce");
	const rp = await reduced.newPage();
	await open(rp, MATRIX);
	await arcade(rp, "Watched").tap();
	const review = rp.getByRole("dialog", { name: "Review" });
	await review.waitFor();
	await review.getByRole("button", { name: "Rate 4 stars" }).tap();
	await review.getByPlaceholder("Share your thoughts…").fill("Layout journey note");
	await review.getByRole("button", { name: /^Public/ }).tap();
	const t0 = await now(rp);
	await review.getByRole("button", { name: "Save & Done" }).tap();
	const popup = rp.getByRole("dialog", { name: /Achievements? Unlocked/ });
	const popupShown = await popup.waitFor({ timeout: 20000 }).then(() => true, () => false);
	check(popupShown, "first watch opens the achievement popup (fresh run required)");
	if (popupShown) {
		await rp.waitForTimeout(1500);
		const m = await motionSince(rp, t0, true);
		await shot(rp, "popup-reduced");
		check(m.jsMoved.length === 0 && m.moving.length === 0, `achievement popup does not move under reduced motion (js=${m.jsMoved.join(" | ") || "none"} waapi=${m.moving.join(",") || "none"})`);
		while (await popup.isVisible()) {
			await popup.getByRole("button", { name: /continue/i }).first().tap();
			await rp.waitForTimeout(800);
		}
	}

	vp.step("reduced motion: swipe on shuffle at 390");
	await open(rp, "/app/shuffle");
	const no = rp.getByRole("button", { name: "No — skip this title" });
	await no.waitFor({ timeout: 60000 });
	await rp.waitForTimeout(1500);
	await shot(rp, "shuffle-reduced-before");
	const s0 = await now(rp);
	await no.tap();
	await rp.waitForTimeout(1200);
	const sm = await motionSince(rp, s0);
	check(sm.jsMoved.length === 0 && sm.moving.length === 0, `shuffle swipe does not move under reduced motion (js=${sm.jsMoved.join(" | ") || "none"} waapi=${sm.moving.join(",") || "none"})`);

	vp.step("touch path: save from search with the poster bookmark at 390");
	await open(rp, "/app/search?q=inception&type=all&sort=relevance&page=1");
	const bookmark = rp.getByRole("button", { name: "Add to watchlist" }).first();
	await bookmark.waitFor({ timeout: 30000 });
	const bm = await reachable(rp, bookmark);
	check(bm.inView && bm.onTop && bm.opacity > 0.95, `search poster bookmark is visible without hover on touch (opacity=${bm.opacity.toFixed(2)} onTop=${bm.onTop} box=${bm.box})`);
	await bookmark.tap();
	const lists = rp.getByText("Add to Watchlist", { exact: true });
	check(await lists.waitFor({ timeout: 10000 }).then(() => true, () => false), "tapping the bookmark opens the watchlist picker");
	const existing = rp.locator("[data-slot=popover-content] button").filter({ hasNotText: "Create New Watchlist" }).first();
	if (await existing.count()) {
		await existing.tap();
	} else {
		await rp.getByRole("button", { name: "Create New Watchlist" }).tap();
		await rp.getByPlaceholder("e.g. Friday Night Horror").fill("Layout Picks");
		await rp.getByRole("button", { name: "Create" }).tap();
	}
	await rp.getByText(/Added to|Created/).first().waitFor({ timeout: 15000 }).catch(() => {});
	await rp.waitForTimeout(1000);

	vp.step("populate the tracker: Breaking Bad watched from its title page");
	await open(rp, `/app/title/tv/${BREAKING_BAD}`);
	await arcade(rp, "Watched").tap();
	await rp.waitForURL(`**/app/tracker/${BREAKING_BAD}`, { timeout: 30000 }).catch(() => {});

	vp.step("reduced motion: finish Chernobyl and look for confetti");
	await open(rp, `/app/title/tv/${CHERNOBYL}`);
	await arcade(rp, "Watched").tap();
	await rp.waitForURL(`**/app/tracker/${CHERNOBYL}`, { timeout: 30000 });
	await hydrated(rp);
	await rp.getByRole("button", { name: /Mark All/ }).first().tap();
	const complete = rp.getByRole("dialog", { name: "Show Complete" });
	check(await complete.waitFor({ timeout: 20000 }).then(() => true, () => false), "marking every episode opens Show Complete");
	await rp.waitForTimeout(1000);
	const canvases = await rp.evaluate(() => document.querySelectorAll("body > canvas").length);
	check(canvases === 0, `no confetti canvas under reduced motion (${canvases})`);
	await shot(rp, "show-complete-reduced");

	vp.step("reduced motion: scroll the landing page");
	await open(rp, "/");
	const l0 = await now(rp);
	for (let y = 0; y < 3000; y += 300) {
		await rp.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
		await rp.waitForTimeout(120);
	}
	const lm = await motionSince(rp, l0);
	check(lm.jsMoved.length === 0 && lm.moving.length === 0, `landing does not tilt or slide on scroll under reduced motion (js=${lm.jsMoved.join(" | ") || "none"} waapi=${lm.moving.join(",") || "none"})`);
	await reduced.close();

	const listId = vp.sql(`select w.id from watchlist w join watchlist_item i on i.watchlist_id = w.id where w.owner_id = '${me}' limit 1`, "watchlist with an item")[0]?.[0];
	const rows = {
		watch: vp.sql(`select tmdb_id, media_type from watch_event where user_id = '${me}' order by created_at`, "watch events"),
		listItems: vp.sql(`select i.tmdb_id from watchlist_item i join watchlist w on w.id = i.watchlist_id where w.owner_id = '${me}'`, "watchlist items"),
		tracked: vp.sql(`select tmdb_id from user_title where user_id = '${me}' and media_type = 'tv'`, "tracked shows"),
	};
	check(rows.watch.some(([id]) => id === "603"), "DB has the Matrix watch event the review modal saved");
	check(rows.listItems.some(([id]) => id === "27205"), "DB has Inception on a watchlist, saved from the search bookmark by touch");
	check(rows.tracked.some(([id]) => id === String(BREAKING_BAD)), "DB has Breaking Bad tracked");

	vp.step("control: the same swipe at 390 with motion allowed");
	const full = await newContext(browser, vp.appUrl, state, 390, "no-preference");
	const fp = await full.newPage();
	await open(fp, "/app/shuffle");
	const fno = fp.getByRole("button", { name: "No — skip this title" });
	await fno.waitFor({ timeout: 60000 });
	await fp.waitForTimeout(1500);
	const c0 = await now(fp);
	await fno.tap();
	await fp.waitForTimeout(1200);
	const cm = await motionSince(fp, c0);
	check(cm.jsMoved.length + cm.moving.length > 0, `detector control: the swipe moves when motion is allowed (js=${cm.jsMoved.join(" | ") || "none"} waapi=${cm.moving.join(",") || "none"})`);
	await full.close();

	const routes: [string, string][] = [
		["landing", "/"],
		["search", "/app/search?q=matrix&type=all&sort=relevance&page=1"],
		["shuffle", "/app/shuffle"],
		["shuffle-hidden", "/app/shuffle/hidden"],
		["watchlists", "/app/watchlists"],
		["watchlist", listId ? `/app/watchlists/${listId}` : "/app/watchlists"],
		["friends", "/app/friends"],
		["feed", "/app/feed"],
		["tracker", "/app/tracker"],
		["tracker-show", `/app/tracker/${BREAKING_BAD}`],
		["settings", "/app/settings"],
		["settings-blocked", "/app/settings/blocked"],
		["profile", `/app/profile/${me}`],
		["profile-friend", `/app/profile/${felix}`],
		["title-movie", MATRIX],
		["title-tv", `/app/title/tv/${BREAKING_BAD}`],
	];

	for (const width of WIDTHS) {
		vp.step(`sweep at ${width}`);
		const ctx = await newContext(browser, vp.appUrl, state, width, "no-preference");
		const page = await ctx.newPage();
		for (const [name, path] of routes) {
			await open(page, path);
			const r = await pageChecks(page, width);
			check(r.sw === width && r.iw === width, `${width} ${name}: no sideways scroll (scrollWidth ${r.sw}, innerWidth ${r.iw}${r.offenders.length ? `, widest ${r.offenders.map((o) => `${o.el} to ${o.right}`).join(" | ")}` : ""})`);
			if (width !== 1440) check(r.split.length === 0, `${width} ${name}: no word split across lines (${r.split.join(" | ") || "none"})`);
			check(r.cascadeCount === 0, `${width} ${name}: links and buttons compute the colour and transition their classes set (${r.cascadeCount} differ${r.cascade.length ? `: ${r.cascade.join(" | ")}` : ""})`);
			if (width === 1440 && path.startsWith("/app")) check(r.navLinks === 6, `${width} ${name}: six nav links visible`);
			check(r.unlayered.length === 0, `${width} ${name}: no unlayered rule styles bare a or button (${r.unlayered.join(", ") || "none"})`);
			if (width !== 320) await shot(page, `${width}-${name}`);
		}

		vp.step(`profile tabs at ${width}`);
		await open(page, `/app/profile/${me}`);
		const panelText = (tab: Locator) => tab.locator("xpath=../following-sibling::*[1]").locator("p, a, h3").first();
		const tabs: [string, (tab: Locator) => Locator][] = [
			["Journal", panelText],
			["Watchlists", panelText],
			["Recent Activity", () => page.locator("button:has(svg.lucide-ellipsis)").first()],
		];
		for (const [label, content] of tabs) {
			const tab = page.getByRole("button", { name: label, exact: true });
			const t = await reachable(page, tab);
			check(t.inView && t.onTop, `${width} profile: ${label} tab is on screen (${t.box})`);
			await (width < 768 ? tab.tap({ timeout: 5000 }) : tab.click({ timeout: 5000 })).catch(() => {});
			await page.waitForTimeout(700);
			const panel = await tab.evaluate((b) => {
				const bar = b.parentElement as HTMLElement;
				const panelEl = bar.nextElementSibling as HTMLElement | null;
				const r = panelEl?.getBoundingClientRect();
				const scroller = panelEl?.querySelector(".overflow-y-auto") as HTMLElement | null;
				return { h: Math.round(r?.height ?? 0), w: Math.round(r?.width ?? 0), right: Math.round(r?.right ?? 0), scrollerH: scroller ? scroller.clientHeight : null, active: b.className.includes("border-neon"), iw: innerWidth };
			});
			check(panel.active, `${width} profile: tapping ${label} makes it the active tab`);
			check(panel.h > 60 && panel.right <= panel.iw && (panel.scrollerH === null || panel.scrollerH > 60), `${width} profile: ${label} panel has room on screen (h=${panel.h} w=${panel.w} right=${panel.right} scrollerH=${panel.scrollerH})`);
			const target = content(tab);
			if (await target.count()) {
				const c = await reachable(page, target);
				check(c.inView && c.onTop, `${width} profile: ${label} content is reachable (${c.box})`);
			} else check(false, `${width} profile: ${label} content exists`);
			if (width === 390) await shot(page, `profile-tabs-${label.toLowerCase().replace(/\s+/g, "-")}-390`);
		}
		const menu = page.locator("button:has(svg.lucide-ellipsis)").first();
		if (await menu.count()) {
			await (width < 768 ? menu.tap({ timeout: 5000 }) : menu.click({ timeout: 5000 })).catch(() => {});
			const pop = page.locator("[data-slot=popover-content]");
			const edit = pop.getByRole("button", { name: "Edit" });
			const del = pop.getByRole("button", { name: "Delete" });
			const opened = await edit.waitFor({ timeout: 5000 }).then(() => true, () => false);
			check(opened && (await reachable(page, edit)).onTop && (await reachable(page, del)).onTop, `${width} profile: Edit and Delete are reachable from the activity card menu`);
			await page.keyboard.press("Escape");
		}
		await ctx.close();
	}

	vp.expect(failures.length === 0, `layout journey: ${failures.length} check(s) failed${failures.length ? `: ${failures.join(" || ")}` : ""}`);
}
