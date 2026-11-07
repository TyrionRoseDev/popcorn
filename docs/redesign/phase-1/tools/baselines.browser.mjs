// Browser-driven baselines against the production server started by baselines.sh.
// Sections write $BASELINE_WORK/sections/<name>.json; `baselines.sh merge` folds them into 06-baselines.json.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { MODALS, MODALS_NOT_REACHED, MODAL_ACTOR, resetModalActor } from "./baselines.modals.mjs";

const need = (k) => {
	const v = process.env[k];
	if (!v) throw new Error(`${k} not set; run through baselines.sh`);
	return v;
};
const WORK = need("BASELINE_WORK");
const TOOLS = need("BASELINE_TOOLS");
const APP = need("BASELINE_APP");
const CHROMIUM = need("BASELINE_CHROMIUM");
const CONTAINER = need("BASELINE_CONTAINER");
const MAIL_DIR = need("BASELINE_MAIL_DIR");

const require = createRequire(join(TOOLS, "package.json"));
const { chromium } = require("playwright-core");
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const AXE_VERSION = require("axe-core/package.json").version;
const importTool = (rel) => import(pathToFileURL(join(TOOLS, "node_modules", rel)).href);

const VIEWPORTS = {
	mobile: { width: 390, height: 844 },
	desktop: { width: 1440, height: 900 },
};
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const IMPACTS = ["critical", "serious", "moderate", "minor"];
const AXE_PASSES = Number(process.env.BASELINE_AXE_PASSES ?? 3);
const RUNTIME_RUNS = Number(process.env.BASELINE_RUNTIME_RUNS ?? 5);
const LH_RUNS = Number(process.env.BASELINE_LH_RUNS ?? 3);

const ACTORS = {
	empty: { id: "vp-user-erin", email: "erin@popcorn.test", username: "erinempty", name: "Erin Empty" },
	populated: { id: "vp-user-vera", email: "vera@popcorn.test" },
	friend: { id: "vp-user-felix", email: "felix@popcorn.test" },
	[MODAL_ACTOR.key]: MODAL_ACTOR,
	newbie: { email: "nora@popcorn.test" },
};

const sql = (query) =>
	execFileSync(
		"docker",
		["exec", CONTAINER, "psql", "-h", "127.0.0.1", "-U", "popcorn", "-d", "popcorn_verify", "-At", "-F", "\t", "-c", query],
		{ encoding: "utf8" },
	)
		.split("\n")
		.filter(Boolean)
		.map((r) => r.split("\t"));

const authFile = (actor) => join(WORK, "auth", `${actor}.json`);
const writeSection = (name, value) => writeFileSync(join(WORK, "sections", `${name}.json`), `${JSON.stringify(value, null, 1)}\n`);
const median = (xs) => {
	const s = [...xs].sort((a, b) => a - b);
	if (!s.length) return null;
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const stat = (xs) => {
	const v = xs.filter((x) => typeof x === "number" && Number.isFinite(x));
	return { n: v.length, median: median(v), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null };
};
const round = (x, d = 0) => (x == null ? x : Number(x.toFixed(d)));
const NCPU = Number(execFileSync("sysctl", ["-n", "hw.ncpu"], { encoding: "utf8" }).trim());
const MIN_CLEAN_SAMPLES = 3;

function loadNow() {
	const m = execFileSync("uptime", { encoding: "utf8" }).match(/load averages?:\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
	return { load1: Number(m[1]), load5: Number(m[2]), load15: Number(m[3]) };
}

// A sample is PROVISIONAL when the 1-minute load exceeds the core count at either end of it.
const loadStamp = (before, after) => ({
	load1Before: before.load1,
	load5Before: before.load5,
	load1After: after.load1,
	load5After: after.load5,
	ncpu: NCPU,
	status: Math.max(before.load1, after.load1) > NCPU ? "PROVISIONAL" : "BASELINE",
});

async function sampled(fn) {
	const before = loadNow();
	const value = await fn();
	return { ...value, load: loadStamp(before, loadNow()) };
}

// Timing aggregate: `baseline` is built from clean samples only and stays null until enough exist.
function timingStat(samples, pick) {
	const clean = samples.filter((s) => s.load.status === "BASELINE");
	const ok = clean.length >= MIN_CLEAN_SAMPLES;
	return {
		status: ok ? "BASELINE" : "PROVISIONAL",
		samples: samples.length,
		cleanSamples: clean.length,
		baseline: ok ? stat(clean.map(pick)) : null,
		provisional: stat(samples.map(pick)),
	};
}

async function launch() {
	return chromium.launch({ executablePath: CHROMIUM });
}

async function newContext(browser, { actor, viewport = "desktop", ...rest } = {}) {
	const vp = typeof viewport === "string" ? VIEWPORTS[viewport] : viewport;
	return browser.newContext({
		baseURL: APP,
		viewport: vp,
		storageState: actor ? authFile(actor) : undefined,
		...rest,
	});
}

export async function settle(page, extraMs = 600) {
	await page.waitForLoadState("load").catch(() => {});
	await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
	await page
		.waitForFunction(
			() => {
				const el = document.querySelector("main, header, form, button, a");
				return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber"));
			},
			undefined,
			{ timeout: 20000 },
		)
		.catch(() => {});
	await page
		.waitForFunction(() => !document.querySelector('[data-slot="skeleton"], .animate-pulse'), undefined, { timeout: 8000 })
		.catch(() => {});
	await page.waitForTimeout(extraMs);
}

// The achievement popup can open by itself after any page load and hides the page from axe and Lighthouse.
async function dismissAutoPopup(page) {
	const popup = page.getByRole("dialog", { name: /Achievements? Unlocked/ });
	if (!(await popup.isVisible().catch(() => false))) return false;
	await page.waitForTimeout(1500);
	await popup.getByRole("button", { name: /continue/i }).click();
	await popup.waitFor({ state: "hidden", timeout: 10000 });
	await page.waitForTimeout(300);
	return true;
}

async function drainAchievementPopups(browser, actor) {
	const ctx = await newContext(browser, { actor, viewport: "desktop" });
	const page = await ctx.newPage();
	let dismissed = 0;
	for (const path of ["/app/feed", `/app/profile/${ACTORS[actor].id}`, "/app/feed"]) {
		await page.goto(path);
		await settle(page, 2500);
		if (await dismissAutoPopup(page)) dismissed++;
	}
	await ctx.close();
	return dismissed;
}

async function signIn(browser, key) {
	const actor = ACTORS[key];
	const ctx = await newContext(browser);
	const page = await ctx.newPage();
	await page.goto("/login");
	await settle(page, 100);
	const started = Date.now() - 1000;
	for (let attempt = 0; attempt < 4; attempt++) {
		await page.getByPlaceholder("you@email.com").fill(actor.email);
		await page.getByRole("button", { name: "Send Magic Link" }).click();
		const sent = await page
			.getByRole("heading", { name: "Magic link sent!" })
			.waitFor({ timeout: 6000 })
			.then(() => true, () => false);
		if (sent) break;
		await page.waitForTimeout(11000);
	}
	let link = null;
	for (let i = 0; i < 60 && !link; i++) {
		for (const f of readdirSync(MAIL_DIR).filter((n) => n.endsWith(".json")).sort().reverse()) {
			if (Number(f.split("-")[0]) < started) continue;
			const m = JSON.parse(readFileSync(join(MAIL_DIR, f), "utf8"));
			if ([m.to].flat().includes(actor.email) && m.link?.startsWith(APP)) {
				link = m.link;
				break;
			}
		}
		if (!link) await page.waitForTimeout(250);
	}
	if (!link) throw new Error(`no magic link for ${actor.email} addressed to ${APP}`);
	await page.goto(link);
	await page.waitForURL((u) => !u.pathname.startsWith("/api/auth") && u.pathname !== "/login", { timeout: 30000 });
	await ctx.storageState({ path: authFile(key) });
	const landed = new URL(page.url()).pathname;
	await ctx.close();
	return landed;
}

async function trpc(ctx, path, input) {
	const res = await ctx.request.post(`/api/trpc/${path}`, { data: { json: input } });
	const body = await res.json().catch(() => null);
	if (!res.ok()) throw new Error(`${path} -> ${res.status()} ${JSON.stringify(body).slice(0, 300)}`);
	return body?.result?.data?.json;
}

const WATCHED = [
	{ tmdbId: 603, mediaType: "movie", rating: 5, note: "Still the best lobby scene ever filmed.", titleName: "The Matrix" },
	{ tmdbId: 27205, mediaType: "movie", rating: 4, note: "Great at the drive-in.", titleName: "Inception" },
	{ tmdbId: 550, mediaType: "movie", rating: 4, titleName: "Fight Club" },
	{ tmdbId: 13, mediaType: "movie", rating: 3, titleName: "Forrest Gump" },
];
const WATCHLIST_ITEMS = [
	{ tmdbId: 694, mediaType: "movie", titleName: "The Shining" },
	{ tmdbId: 539, mediaType: "movie", titleName: "Psycho" },
	{ tmdbId: 1396, mediaType: "tv", titleName: "Breaking Bad" },
];

async function seed() {
	sql(`INSERT INTO "user" (id, name, email, email_verified, username, bio, onboarding_completed, created_at, updated_at) VALUES
		('${ACTORS.empty.id}', '${ACTORS.empty.name}', '${ACTORS.empty.email}', true, '${ACTORS.empty.username}', NULL, true, NOW(), NOW()),
		('${MODAL_ACTOR.id}', '${MODAL_ACTOR.name}', '${MODAL_ACTOR.email}', true, '${MODAL_ACTOR.username}', NULL, true, NOW(), NOW())
		ON CONFLICT (email) DO NOTHING;
		INSERT INTO friendship (id, requester_id, addressee_id, status, created_at, updated_at)
		VALUES ('vp-friendship-mia-felix', '${MODAL_ACTOR.id}', 'vp-user-felix', 'accepted', NOW(), NOW()) ON CONFLICT DO NOTHING;`);

	const browser = await launch();
	const landed = {};
	for (const key of Object.keys(ACTORS)) landed[key] = await signIn(browser, key);

	const already = Number(sql(`select count(*) from watch_event where user_id='${ACTORS.populated.id}'`)[0][0]);
	if (!already) {
		const vera = await newContext(browser, { actor: "populated" });
		const felix = await newContext(browser, { actor: "friend" });
		for (const w of WATCHED) await trpc(vera, "watchEvent.create", { ...w, visibility: "public" });
		await trpc(felix, "watchEvent.create", { tmdbId: 78, mediaType: "movie", rating: 5, note: "Rain on the windscreen.", visibility: "public", titleName: "Blade Runner" });
		await trpc(felix, "watchEvent.create", { tmdbId: 603, mediaType: "movie", rating: 4, visibility: "public", titleName: "The Matrix" });
		const wl = await trpc(vera, "watchlist.create", { name: "Friday Night Horror", isPublic: true, memberIds: ["vp-user-felix"] });
		for (const item of WATCHLIST_ITEMS) await trpc(vera, "watchlist.addItem", { watchlistId: wl.id, ...item });
		await trpc(vera, "episodeTracker.addShow", { tmdbId: 1396, seasonEpisodeCounts: { 1: 7, 2: 13 } });
		await trpc(vera, "episodeTracker.markEpisodes", {
			tmdbId: 1396,
			episodes: [1, 2, 3].map((episodeNumber) => ({ seasonNumber: 1, episodeNumber, runtime: 47 })),
		});
		await trpc(vera, "journalEntry.create", { tmdbId: 1396, titleName: "Breaking Bad", scope: "episode", seasonNumber: 1, episodeNumber: 3, note: "The tension in the basement.", isPublic: true });
		await trpc(felix, "recommendation.send", { recipientIds: ["vp-user-vera"], tmdbId: 78, mediaType: "movie", titleName: "Blade Runner", message: "One for the big screen." });
		await vera.close();
		await felix.close();
	}
	const pastYear = Number(sql(`select count(*) from watch_event where user_id='${ACTORS.populated.id}' and watched_at < date_trunc('year', now())`)[0][0]);
	if (!pastYear) {
		const vera = await newContext(browser, { actor: "populated" });
		await trpc(vera, "watchEvent.create", { tmdbId: 603, mediaType: "movie", rating: 5, visibility: "public", titleName: "The Matrix", watchedAt: `${new Date().getFullYear() - 1}-06-01T20:00:00.000Z` });
		await vera.close();
	}
	const popupsDrained = {};
	for (const key of ["empty", "populated", "friend"]) popupsDrained[key] = await drainAchievementPopups(browser, key);
	await browser.close();
	const counts = {};
	for (const t of ["watch_event", "watchlist_item", "episode_watch", "journal_entry", "recommendation", "notification", "earned_achievement"]) {
		counts[t] = Number(sql(`select count(*) from ${t}`)[0][0]);
	}
	writeSection("seed", { landed, counts, popupsDrained, actors: Object.fromEntries(Object.entries(ACTORS).map(([k, v]) => [k, v.email])) });
	console.log(JSON.stringify({ landed, counts }));
}

function actorWatchlistId(actor) {
	return sql(`select id from watchlist where owner_id='${ACTORS[actor].id}' order by (type='custom') desc, created_at limit 1`)[0]?.[0] ?? null;
}

// One row per screen. `states` lists which accounts see it; `path` may depend on the account.
function routeRegistry() {
	const signedIn = ["empty", "populated"];
	const list = (actor) => actorWatchlistId(actor);
	return [
		{ id: "landing", states: ["signed-out"], path: () => "/" },
		{ id: "login", states: ["signed-out"], path: () => "/login" },
		{ id: "not-found", states: ["signed-out"], path: () => "/this-page-does-not-exist" },
		{ id: "onboarding", states: ["newbie"], path: () => "/onboarding" },
		{ id: "feed", states: signedIn, path: () => "/app/feed" },
		{ id: "search", states: signedIn, path: () => "/app/search" },
		{ id: "search-results", states: ["populated"], path: () => "/app/search?q=matrix" },
		{ id: "title-movie", states: signedIn, path: () => "/app/title/movie/603" },
		{ id: "title-tv", states: signedIn, path: () => "/app/title/tv/1396" },
		{ id: "tracker", states: signedIn, path: () => "/app/tracker" },
		{ id: "tracker-show", states: signedIn, path: () => "/app/tracker/1396" },
		{ id: "watchlists", states: signedIn, path: () => "/app/watchlists" },
		{ id: "watchlist-detail", states: signedIn, path: (s) => (list(s) ? `/app/watchlists/${list(s)}` : null) },
		{ id: "shuffle", states: signedIn, path: () => "/app/shuffle", wait: 5000 },
		{ id: "shuffle-hidden", states: signedIn, path: () => "/app/shuffle/hidden" },
		{ id: "friends", states: signedIn, path: () => "/app/friends" },
		{ id: "profile-self", states: signedIn, path: (s) => `/app/profile/${ACTORS[s].id}` },
		{ id: "profile-friend", states: ["populated"], path: () => "/app/profile/vp-user-felix" },
		{ id: "settings", states: signedIn, path: () => "/app/settings" },
		{ id: "settings-blocked", states: signedIn, path: () => "/app/settings/blocked" },
	];
}

const actorForState = (state) => (state === "signed-out" ? undefined : state);

async function runAxe(page, include) {
	await page.evaluate(AXE_SOURCE);
	return page.evaluate(
		async ({ tags, include }) => {
			const context = include ? { include: [include] } : document;
			const r = await window.axe.run(context, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations", "incomplete"] });
			const reason = (n) => n.any?.[0]?.data?.messageKey ?? n.any?.[0]?.id ?? n.all?.[0]?.id ?? n.none?.[0]?.id ?? "unknown";
			const slim = (items) =>
				items.map((v) => ({
					id: v.id,
					impact: v.impact,
					tags: v.tags.filter((t) => /^wcag2\d?a+$|^best-practice$/.test(t)),
					help: v.help,
					nodes: v.nodes.map((n) => ({ impact: n.impact, target: n.target.join(" "), html: n.html.slice(0, 200), reason: reason(n) })),
				}));
			return { violations: slim(r.violations), incomplete: slim(r.incomplete) };
		},
		{ tags: AXE_TAGS, include },
	);
}

const MAX_NODES_KEPT = 5;
function trimScenario(s) {
	const trim = (items) => items.map((v) => ({ ...v, nodeCount: v.nodes.length, nodes: v.nodes.slice(0, MAX_NODES_KEPT) }));
	return { ...s, violations: trim(s.violations), incomplete: trim(s.incomplete) };
}

function summarizeScenario(s) {
	const byImpact = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
	const byBucket = Object.fromEntries(AXE_TAGS.map((t) => [t, Object.fromEntries(IMPACTS.map((i) => [i, 0]))]));
	for (const v of s.violations) {
		for (const n of v.nodes) {
			const impact = n.impact ?? v.impact;
			byImpact[impact]++;
			for (const t of v.tags) byBucket[t][impact]++;
		}
	}
	return { byImpact, byBucket };
}

async function axeRoutes(browser, pass) {
	const scenarios = [];
	for (const route of routeRegistry()) {
		for (const state of route.states) {
			for (const viewport of Object.keys(VIEWPORTS)) {
				const path = route.path(state);
				const key = `${route.id}|${state}|${viewport}`;
				if (!path) {
					scenarios.push({ key, route: route.id, state, viewport, skipped: "no watchlist exists for this account", violations: [], incomplete: [] });
					continue;
				}
				const ctx = await newContext(browser, { actor: actorForState(state), viewport });
				const page = await ctx.newPage();
				const response = await page.goto(path).catch((e) => ({ status: () => `nav-error ${e.message}` }));
				await settle(page, route.wait ?? 600);
				const autoPopup = await dismissAutoPopup(page);
				const openDialogs = await page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').count();
				const finalPath = new URL(page.url()).pathname + new URL(page.url()).search;
				const r = await runAxe(page);
				scenarios.push({ key, route: route.id, state, viewport, path, finalPath, status: response.status(), autoPopup, openDialogs, ...r });
				if (pass === 0) await page.screenshot({ path: join(WORK, "shots", `axe-${key.replaceAll("|", "-")}.png`) });
				await ctx.close();
			}
		}
	}
	return scenarios;
}

const helpers = { settle, sql, trpc, runAxe, VIEWPORTS, WORK };

const MODAL_ATTEMPTS = 3;

async function openAndScanModal(browser, modal, viewport, key, pass, attempt) {
	const ctx = await newContext(browser, { actor: modal.actor ?? MODAL_ACTOR.key, viewport });
	const page = await ctx.newPage();
	const row = { key, route: `modal:${modal.id}`, state: modal.actor ?? MODAL_ACTOR.key, viewport, attempts: attempt + 1, violations: [], incomplete: [] };
	try {
		const scope = await modal.open(page, helpers);
		await page.waitForTimeout(500);
		row.focusInside = await page.evaluate((s) => !!document.querySelector(s)?.contains(document.activeElement), scope);
		row.scopeName = await page.evaluate((s) => {
			const el = document.querySelector(s);
			if (!el) return null;
			const by = el.getAttribute("aria-labelledby");
			return el.getAttribute("aria-label") ?? (by ? document.getElementById(by)?.textContent : null);
		}, scope);
		Object.assign(row, await runAxe(page, scope));
		row.scope = scope;
		if (pass === 0) await page.screenshot({ path: join(WORK, "shots", `modal-${modal.id}-${viewport}.png`) });
	} catch (e) {
		row.skipped = `could not open after ${attempt + 1} attempts: ${e.message.split("\n")[0].slice(0, 200)}`;
	}
	await ctx.close();
	return row;
}

async function axeModals(browser, pass) {
	const scenarios = [];
	for (const viewport of Object.keys(VIEWPORTS)) {
		resetModalActor(sql);
		for (const modal of MODALS) {
			if (modal.viewport && modal.viewport !== viewport) continue;
			if (process.env.BASELINE_MODAL_FILTER && !process.env.BASELINE_MODAL_FILTER.split(",").includes(modal.id)) continue;
			const key = `modal:${modal.id}|${modal.actor ?? MODAL_ACTOR.key}|${viewport}`;
			let row;
			for (let attempt = 0; attempt < MODAL_ATTEMPTS; attempt++) {
				row = await openAndScanModal(browser, modal, viewport, key, pass, attempt);
				if (!row.skipped) break;
			}
			scenarios.push(row);
		}
	}
	return scenarios;
}

async function axeSection() {
	const browser = await launch();
	const only = process.argv[3];
	const passes = [];
	for (let pass = 0; pass < AXE_PASSES; pass++) {
		const routes = only === "modals" ? [] : await axeRoutes(browser, pass);
		const modals = only === "routes" ? [] : await axeModals(browser, pass);
		const scenarios = [...routes, ...modals];
		passes.push({ pass, load: loadNow(), scenarios });
		console.log(`axe pass ${pass}: ${scenarios.length} scenarios, ${scenarios.filter((s) => s.skipped).length} skipped`);
	}
	await browser.close();
	writeSection("axe-raw", { passes: passes.map((p) => ({ ...p, scenarios: p.scenarios.map(trimScenario) })) });
	writeSection("axe", aggregateAxe(passes));
}

function aggregateAxe(passes) {
	const scope = (s) => (s.route.startsWith("modal:") ? "modals" : "routes");
	const perPass = passes.map((p) => {
		const out = { routes: blank(), modals: blank() };
		for (const s of p.scenarios) {
			if (s.skipped) continue;
			const { byImpact, byBucket } = summarizeScenario(s);
			const dest = out[scope(s)];
			for (const i of IMPACTS) {
				dest.byImpact[i] += byImpact[i];
				for (const t of AXE_TAGS) dest.byBucket[t][i] += byBucket[t][i];
			}
		}
		return out;
	});
	function blank() {
		return {
			byImpact: Object.fromEntries(IMPACTS.map((i) => [i, 0])),
			byBucket: Object.fromEntries(AXE_TAGS.map((t) => [t, Object.fromEntries(IMPACTS.map((i) => [i, 0]))])),
		};
	}
	const totals = {};
	for (const sc of ["routes", "modals"]) {
		totals[sc] = {
			byImpact: Object.fromEntries(IMPACTS.map((i) => [i, stat(perPass.map((p) => p[sc].byImpact[i]))])),
			byBucket: Object.fromEntries(
				AXE_TAGS.map((t) => [t, Object.fromEntries(IMPACTS.map((i) => [i, stat(perPass.map((p) => p[sc].byBucket[t][i]))]))]),
			),
		};
	}

	const keys = [...new Set(passes.flatMap((p) => p.scenarios.map((s) => s.key)))];
	const perScenario = keys.map((key) => {
		const rows = passes.map((p) => p.scenarios.find((s) => s.key === key)).filter(Boolean);
		const measured = rows.filter((s) => !s.skipped);
		const sums = measured.map(summarizeScenario);
		return {
			key,
			route: rows[0].route,
			state: rows[0].state,
			viewport: rows[0].viewport,
			path: rows[0].path,
			finalPath: rows[0].finalPath,
			skipped: measured.length ? undefined : rows[0].skipped,
			focusInside: rows[0].focusInside,
			scopeName: rows[0].scopeName,
			impacts: Object.fromEntries(IMPACTS.map((i) => [i, stat(sums.map((x) => x.byImpact[i]))])),
			rules: [...new Set(measured.flatMap((s) => s.violations.map((v) => v.id)))],
		};
	});

	const ruleMap = new Map();
	const incompleteMap = new Map();
	for (const s of passes[0].scenarios) {
		for (const v of s.violations) {
			const r = ruleMap.get(v.id) ?? { id: v.id, impact: v.impact, help: v.help, tags: v.tags, nodes: 0, scenarios: new Set(), distinct: new Set(), example: v.nodes[0] };
			r.nodes += v.nodes.length;
			r.scenarios.add(s.key);
			for (const n of v.nodes) r.distinct.add(n.target);
			ruleMap.set(v.id, r);
		}
		for (const v of s.incomplete) {
			const r = incompleteMap.get(v.id) ?? { id: v.id, nodes: 0, scenarios: new Set(), reasons: {} };
			r.nodes += v.nodes.length;
			r.scenarios.add(s.key);
			for (const n of v.nodes) r.reasons[n.reason] = (r.reasons[n.reason] ?? 0) + 1;
			incompleteMap.set(v.id, r);
		}
	}
	const rank = { critical: 0, serious: 1, moderate: 2, minor: 3 };
	const rules = [...ruleMap.values()]
		.map((r) => ({ ...r, scenarios: r.scenarios.size, distinct: r.distinct.size }))
		.sort((a, b) => rank[a.impact] - rank[b.impact] || b.nodes - a.nodes);
	const incomplete = [...incompleteMap.values()].map((r) => ({ ...r, scenarios: r.scenarios.size })).sort((a, b) => b.nodes - a.nodes);

	const NAME_RULES = ["button-name", "link-name", "input-button-name", "aria-command-name", "aria-input-field-name", "aria-toggle-field-name", "label", "select-name", "image-alt", "svg-img-alt", "aria-dialog-name"];
	const unnamed = {};
	for (const s of passes[0].scenarios) {
		for (const v of s.violations) {
			if (!NAME_RULES.includes(v.id)) continue;
			unnamed[s.key] ??= {};
			unnamed[s.key][v.id] = v.nodes.length;
		}
	}
	return {
		tool: `axe-core ${AXE_VERSION}`,
		tags: AXE_TAGS,
		passes: passes.length,
		scenarioCount: keys.length,
		skipped: perScenario.filter((s) => s.skipped).map((s) => ({ key: s.key, reason: s.skipped })),
		modalsNotReached: MODALS_NOT_REACHED,
		autoPopups: passes.flatMap((p) => p.scenarios.filter((s) => s.autoPopup).map((s) => `pass ${p.pass} ${s.key}`)),
		dialogsOpenDuringRouteScan: passes.flatMap((p) => p.scenarios.filter((s) => s.openDialogs).map((s) => `pass ${p.pass} ${s.key}`)),
		loadPerPass: passes.map((p) => ({ ...p.load, ncpu: NCPU })),
		modalRetries: passes.flatMap((p) => p.scenarios.filter((s) => s.attempts > 1).map((s) => `pass ${p.pass} ${s.key} attempts ${s.attempts}`)),
		totals,
		perScenario,
		rules,
		incomplete,
		unnamed,
	};
}


const TEXT_TYPES = /text\/|javascript|json|svg/;

// Compressing reverse proxy, used only for the `gzip` Lighthouse variant. The Bun server sends text uncompressed.
async function startGzipProxy() {
	const http = await import("node:http");
	const zlib = await import("node:zlib");
	const target = new URL(APP);
	const server = http.createServer((req, res) => {
		const upstream = http.request(
			{ hostname: "127.0.0.1", port: target.port, path: req.url, method: req.method, headers: { ...req.headers, host: target.host } },
			(up) => {
				const headers = { ...up.headers };
				if (TEXT_TYPES.test(headers["content-type"] ?? "") && !headers["content-encoding"]) {
					delete headers["content-length"];
					headers["content-encoding"] = "gzip";
					res.writeHead(up.statusCode, headers);
					up.pipe(zlib.createGzip({ level: 6, flush: zlib.constants.Z_SYNC_FLUSH })).pipe(res);
				} else {
					res.writeHead(up.statusCode, headers);
					up.pipe(res);
				}
			},
		);
		upstream.on("error", () => res.destroy());
		req.pipe(upstream);
	});
	await new Promise((r) => server.listen(0, "127.0.0.1", r));
	return { url: `http://localhost:${server.address().port}`, close: () => server.close() };
}

const LH_MODES = {
	quality: { categories: ["accessibility", "best-practices", "seo"], section: "lighthouse-quality", variants: false },
	perf: { categories: ["performance"], section: "lighthouse-perf", variants: true },
};
const LH_ATTEMPTS = 2;
const LH_METRICS = {
	fcpMs: "first-contentful-paint",
	lcpMs: "largest-contentful-paint",
	tbtMs: "total-blocking-time",
	cls: "cumulative-layout-shift",
	siMs: "speed-index",
};

function summarizeLhr(lhr, categories) {
	const failing = {};
	for (const cat of categories) {
		failing[cat] = lhr.categories[cat].auditRefs
			.map((ref) => ({ ref, a: lhr.audits[ref.id] }))
			.filter(({ ref, a }) => a.score !== null && a.score < 1 && (ref.weight > 0 || cat === "performance") && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable" && a.scoreDisplayMode !== "manual")
			.map(({ ref, a }) => ({
				id: a.id,
				title: a.title,
				weight: ref.weight,
				score: a.score,
				display: a.displayValue,
				items: Array.isArray(a.details?.items) ? a.details.items.length : undefined,
				examples: (Array.isArray(a.details?.items) ? a.details.items : []).slice(0, 3).map((i) => i.node?.snippet?.slice(0, 140) ?? i.url?.slice(0, 120) ?? i.source?.url).filter(Boolean),
			}));
	}
	const hosts = {};
	for (const r of lhr.audits["network-requests"]?.details?.items ?? []) {
		const host = new URL(r.url).host.replace(/^localhost.*/, "app") || "inline-data";
		hosts[host] ??= { requests: 0, transferBytes: 0 };
		hosts[host].requests++;
		hosts[host].transferBytes += r.transferSize ?? 0;
	}
	const lcpEl = lhr.audits["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.snippet;
	return {
		scores: Object.fromEntries(categories.map((c) => [c, lhr.categories[c].score === null ? null : Math.round(lhr.categories[c].score * 100)])),
		metrics: Object.fromEntries(Object.entries(LH_METRICS).map(([k, id]) => [k, lhr.audits[id]?.numericValue ?? null])),
		failing,
		hosts,
		lcpElement: lcpEl?.slice(0, 160),
		finalUrl: lhr.finalDisplayedUrl,
		runtimeError: lhr.runtimeError?.code,
		warnings: lhr.runWarnings,
		benchmarkIndex: lhr.environment?.benchmarkIndex,
		throttling: lhr.configSettings.throttling,
		throttlingMethod: lhr.configSettings.throttlingMethod,
		formFactor: lhr.configSettings.formFactor,
		lighthouseVersion: lhr.lighthouseVersion,
		chromeUA: lhr.environment?.hostUserAgent,
	};
}

async function lighthouseOnce({ url, preset, actor, block = [], save, categories }) {
	const { launch: launchChrome } = await importTool("chrome-launcher/dist/index.js");
	const lighthouse = (await importTool("lighthouse/core/index.js")).default;
	const desktop = (await importTool("lighthouse/core/config/desktop-config.js")).default;
	const puppeteer = (await importTool("puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")).default;
	const profile = mkdtempSync(join(tmpdir(), "baseline-lh-"));
	const chrome = await launchChrome({ chromePath: CHROMIUM, userDataDir: profile, chromeFlags: ["--no-sandbox", "--disable-dev-shm-usage"] });
	try {
		const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}`, defaultViewport: null });
		const page = await browser.newPage();
		if (actor) {
			const { cookies } = JSON.parse(readFileSync(authFile(actor), "utf8"));
			await browser.setCookie(...cookies.map(({ name, value, domain, path, httpOnly, secure, sameSite, expires }) => ({ name, value, domain, path, httpOnly, secure, sameSite, expires })));
		}
		const flags = {
			port: chrome.port,
			output: "json",
			logLevel: "error",
			onlyCategories: categories,
			disableStorageReset: true,
			blockedUrlPatterns: block,
		};
		const result = await lighthouse(url, flags, preset === "desktop" ? desktop : undefined, page);
		writeFileSync(save, JSON.stringify(result.lhr));
		await browser.disconnect();
		return summarizeLhr(result.lhr, categories);
	} finally {
		chrome.kill();
		rmSync(profile, { recursive: true, force: true });
	}
}

function lighthouseTargets() {
	const profile = `/app/profile/${ACTORS.populated.id}`;
	return [
		{ id: "landing", path: "/" },
		{ id: "login", path: "/login" },
		{ id: "feed", path: "/app/feed", actor: "populated" },
		{ id: "search", path: "/app/search", actor: "populated" },
		{ id: "title-movie", path: "/app/title/movie/603", actor: "populated" },
		{ id: "tracker", path: "/app/tracker", actor: "populated" },
		{ id: "watchlists", path: "/app/watchlists", actor: "populated" },
		{ id: "profile-self", path: profile, actor: "populated" },
		{ id: "settings", path: "/app/settings", actor: "populated" },
	];
}

async function lighthouseJob(j, categories) {
	const save = join(WORK, "lighthouse", `${j.id}-${j.preset}-${j.variant}-${j.run}-${categories.length}.json`);
	const row = { id: j.id, preset: j.preset, variant: j.variant, run: j.run, path: j.path };
	for (let attempt = 1; attempt <= LH_ATTEMPTS; attempt++) {
		row.attempts = attempt;
		delete row.error;
		try {
			Object.assign(row, await sampled(() => lighthouseOnce({ url: j.base + j.path, preset: j.preset, actor: j.actor, block: j.block, save, categories })));
			row.landedOnTarget = new URL(row.finalUrl).pathname === j.path.split("?")[0];
			if (!row.runtimeError && row.landedOnTarget) break;
		} catch (e) {
			row.error = e.message.slice(0, 300);
		}
	}
	return row;
}

async function lighthouseSection() {
	const mode = LH_MODES[process.argv[3] ?? "quality"];
	if (!mode) throw new Error(`lighthouse mode must be one of ${Object.keys(LH_MODES)}`);
	const only = process.argv[4]?.split(",");
	const { categories } = mode;
	const isPerf = categories.includes("performance");
	const targets = lighthouseTargets().filter((t) => !only || only.includes(t.id));
	const proxy = mode.variants ? await startGzipProxy() : null;
	const jobs = [];
	for (let run = 0; run < LH_RUNS; run++) {
		for (const preset of ["mobile", "desktop"]) {
			for (const t of targets) jobs.push({ ...t, preset, run, variant: "as-served", base: APP });
		}
		if (!mode.variants) continue;
		for (const id of ["landing", "title-movie", "feed"]) {
			const t = targets.find((x) => x.id === id);
			if (!t) continue;
			jobs.push({ ...t, preset: "mobile", run, variant: "gzip", base: proxy.url });
			jobs.push({ ...t, preset: "mobile", run, variant: "no-tmdb-images", base: APP, block: ["*image.tmdb.org*"] });
		}
	}
	const rows = [];
	for (const [i, j] of jobs.entries()) {
		const row = await lighthouseJob(j, categories);
		rows.push(row);
		console.log(`${i + 1}/${jobs.length} ${j.id} ${j.preset} ${j.variant} run ${j.run}: ${row.error ?? JSON.stringify(row.scores)} load ${row.load?.load1Before} ${row.load?.status}`);
	}
	proxy?.close();
	const groups = new Map();
	for (const r of rows) {
		const k = `${r.id}|${r.preset}|${r.variant}`;
		groups.set(k, [...(groups.get(k) ?? []), r]);
	}
	const summary = [...groups.entries()].map(([key, rs]) => {
		const ok = rs.filter((r) => !r.error && !r.runtimeError && r.landedOnTarget);
		const aggregate = (pick) => (isPerf ? timingStat(ok, pick) : stat(ok.map(pick)));
		const first = ok[0];
		const failing = {};
		for (const c of categories) {
			const seen = new Map();
			for (const r of ok) {
				for (const a of r.failing[c]) {
					const prev = seen.get(a.id) ?? { ...a, runsFailing: 0 };
					prev.runsFailing++;
					seen.set(a.id, prev);
				}
			}
			failing[c] = [...seen.values()];
		}
		return {
			key,
			id: rs[0].id,
			preset: rs[0].preset,
			variant: rs[0].variant,
			path: rs[0].path,
			runs: rs.length,
			validRuns: ok.length,
			retried: rs.filter((r) => r.attempts > 1).length,
			errors: rs.filter((r) => r.error || r.runtimeError || !r.landedOnTarget).map((r) => r.error ?? r.runtimeError ?? `landed on ${r.finalUrl}`),
			scores: Object.fromEntries(categories.map((c) => [c, aggregate((r) => r.scores[c])])),
			metrics: isPerf ? Object.fromEntries(Object.keys(LH_METRICS).map((m) => [m, aggregate((r) => r.metrics[m])])) : undefined,
			benchmarkIndex: isPerf ? aggregate((r) => r.benchmarkIndex) : undefined,
			hosts: first?.hosts,
			lcpElement: first?.lcpElement,
			throttling: first?.throttling,
			throttlingMethod: first?.throttlingMethod,
			failing,
		};
	});
	writeSection(mode.section, {
		version: rows.find((r) => r.lighthouseVersion)?.lighthouseVersion,
		chrome: rows.find((r) => r.chromeUA)?.chromeUA,
		runsPerCell: LH_RUNS,
		categories,
		summary,
		warnings: [...new Set(rows.flatMap((r) => r.warnings ?? []))],
		samples: rows.filter((r) => r.load).map((r) => ({ metric: mode.section, id: r.id, preset: r.preset, variant: r.variant, run: r.run, scores: r.scores, metrics: isPerf ? r.metrics : undefined, benchmarkIndex: isPerf ? r.benchmarkIndex : undefined, load: r.load })),
	});
}

function runtimeRoutes() {
	const list = actorWatchlistId("populated");
	return [
		{ id: "landing", path: "/" },
		{ id: "login", path: "/login" },
		{ id: "feed", path: "/app/feed", actor: "populated" },
		{ id: "search", path: "/app/search", actor: "populated" },
		{ id: "title-movie", path: "/app/title/movie/603", actor: "populated" },
		{ id: "title-tv", path: "/app/title/tv/1396", actor: "populated" },
		{ id: "tracker", path: "/app/tracker", actor: "populated" },
		{ id: "tracker-show", path: "/app/tracker/1396", actor: "populated" },
		{ id: "watchlists", path: "/app/watchlists", actor: "populated" },
		{ id: "watchlist-detail", path: `/app/watchlists/${list}`, actor: "populated" },
		{ id: "shuffle", path: "/app/shuffle", actor: "populated" },
		{ id: "friends", path: "/app/friends", actor: "populated" },
		{ id: "profile-self", path: `/app/profile/${ACTORS.populated.id}`, actor: "populated" },
		{ id: "settings", path: "/app/settings", actor: "populated" },
	];
}

async function browserLoad(browser, route) {
	const ctx = await newContext(browser, { actor: route.actor, viewport: "mobile" });
	const page = await ctx.newPage();
	const seen = [];
	page.on("requestfinished", async (req) => {
		const entry = { url: req.url(), type: req.resourceType(), status: null, bytes: 0 };
		seen.push(entry);
		const [res, sizes] = await Promise.all([req.response(), req.sizes().catch(() => null)]);
		entry.status = res?.status() ?? null;
		entry.bytes = (sizes?.responseBodySize ?? 0) + (sizes?.responseHeadersSize ?? 0);
	});
	// httpBatchStreamLink aborts its stream once the batch is complete, so ERR_ABORTED after a good response is success.
	page.on("requestfailed", async (req) => {
		const entry = { url: req.url(), type: req.resourceType(), status: "failed", bytes: 0 };
		seen.push(entry);
		const res = await req.response().catch(() => null);
		if (res) entry.status = res.status();
	});
	const consoleErrors = [];
	page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));
	page.on("pageerror", (e) => consoleErrors.push(`pageerror ${e.message.slice(0, 200)}`));
	await page.goto(route.path);
	await settle(page, 300);
	const autoPopup = await dismissAutoPopup(page);
	const timing = await page.evaluate(() => {
		const n = performance.getEntriesByType("navigation")[0];
		const trpc = performance
			.getEntriesByType("resource")
			.filter((r) => r.name.includes("/api/trpc/"))
			.map((r) => ({ name: decodeURIComponent(new URL(r.name).pathname.replace("/api/trpc/", "")), firstByteMs: r.responseStart - r.requestStart, totalMs: r.duration }));
		return { ttfbMs: n.responseStart - n.requestStart, dclMs: n.domContentLoadedEventEnd, loadMs: n.loadEventEnd, trpc };
	});
	await page.waitForTimeout(100);
	const finalPath = new URL(page.url()).pathname;
	await ctx.close();
	const app = new URL(APP);
	const own = seen.filter((r) => new URL(r.url).host === app.host);
	const trpcReqs = own.filter((r) => r.url.includes("/api/trpc/"));
	const procedures = trpcReqs.flatMap((r) => decodeURIComponent(new URL(r.url).pathname.replace("/api/trpc/", "")).split(","));
	const byType = {};
	for (const r of seen) byType[r.type] = (byType[r.type] ?? 0) + 1;
	const scripts = [...new Set(own.filter((r) => r.type === "script").map((r) => new URL(r.url).pathname.split("/").pop()))];
	return {
		finalPath,
		requests: seen.length,
		ownRequests: own.length,
		externalRequests: seen.length - own.length,
		byType,
		trpcHttp: trpcReqs.length,
		procedures,
		failed: seen.filter((r) => r.status === "failed" || (typeof r.status === "number" && r.status >= 400)).map((r) => `${r.status} ${r.url.slice(0, 120)}`),
		transferBytes: seen.reduce((a, r) => a + r.bytes, 0),
		ownTransferBytes: own.reduce((a, r) => a + r.bytes, 0),
		scripts,
		consoleErrors,
		autoPopup,
		...timing,
	};
}

async function timedFetch(url, cookie) {
	const started = performance.now();
	const res = await fetch(url, { headers: cookie ? { cookie } : {}, redirect: "manual" });
	const headerMs = performance.now() - started;
	const body = await res.arrayBuffer();
	return { status: res.status, headerMs, totalMs: performance.now() - started, bytes: body.byteLength };
}

async function runtimeSection() {
	const routes = runtimeRoutes();
	const browser = await launch();
	const rows = Object.fromEntries(routes.map((r) => [r.id, []]));
	for (let run = 0; run < RUNTIME_RUNS; run++) {
		for (const route of routes) rows[route.id].push(await sampled(() => browserLoad(browser, route)));
		console.log(`runtime browser run ${run} done`);
	}
	await browser.close();

	const { cookies } = JSON.parse(readFileSync(authFile("populated"), "utf8"));
	const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
	const SERVER_RUNS = RUNTIME_RUNS * 4;
	const server = { "api-health": [] };
	for (const r of routes) server[r.id] = [];
	for (let i = 0; i < SERVER_RUNS; i++) {
		server["api-health"].push(await sampled(() => timedFetch(`${APP}/api/health`)));
		for (const r of routes) server[r.id].push(await sampled(() => timedFetch(APP + r.path, r.actor ? cookie : undefined)));
	}

	const COLD_IDS = [105, 680, 155, 857, 348, 497, 862, 11, 122, 424];
	const titleCold = [];
	for (const id of COLD_IDS.slice(0, RUNTIME_RUNS * 2)) titleCold.push(await sampled(() => timedFetch(`${APP}/app/title/movie/${id}`, cookie)));
	const tmdbDirect = [];
	for (let i = 0; i < RUNTIME_RUNS * 2; i++) {
		tmdbDirect.push(
			await sampled(async () => {
				const started = performance.now();
				const res = await fetch("https://api.themoviedb.org/3/movie/603?append_to_response=credits,videos", { headers: { authorization: `Bearer ${need("BASELINE_TMDB")}` } });
				await res.arrayBuffer();
				return { status: res.status, ms: performance.now() - started };
			}),
		);
	}

	const summarizeServer = (samples) => ({
		statuses: [...new Set(samples.map((s) => s.status))],
		ttfbMs: timingStat(samples, (s) => round(s.headerMs, 1)),
		totalMs: timingStat(samples, (s) => round(s.totalMs, 1)),
		htmlBytes: stat(samples.map((s) => s.bytes)),
	});
	writeSection("runtime", {
		runs: RUNTIME_RUNS,
		serverRuns: SERVER_RUNS,
		viewport: "mobile 390x844, no network or CPU throttling, cold browser cache per run",
		routes: routes.map((r) => {
			const xs = rows[r.id];
			return {
				id: r.id,
				path: r.path,
				finalPaths: [...new Set(xs.map((x) => x.finalPath))],
				requests: stat(xs.map((x) => x.requests)),
				ownRequests: stat(xs.map((x) => x.ownRequests)),
				externalRequests: stat(xs.map((x) => x.externalRequests)),
				byType: xs[0].byType,
				trpcHttp: stat(xs.map((x) => x.trpcHttp)),
				procedureCalls: stat(xs.map((x) => x.procedures.length)),
				procedures: xs[0].procedures,
				trpcSlowestMs: timingStat(xs, (x) => Math.max(0, ...x.trpc.map((t) => t.totalMs))),
				browserTtfbMs: timingStat(xs, (x) => round(x.ttfbMs, 1)),
				dclMs: timingStat(xs, (x) => round(x.dclMs)),
				loadMs: timingStat(xs, (x) => round(x.loadMs)),
				transferBytes: stat(xs.map((x) => x.transferBytes)),
				ownTransferBytes: stat(xs.map((x) => x.ownTransferBytes)),
				scripts: xs[0].scripts,
				failed: [...new Set(xs.flatMap((x) => x.failed))],
				consoleErrors: [...new Set(xs.flatMap((x) => x.consoleErrors))].slice(0, 6),
			};
		}),
		server: Object.fromEntries(Object.entries(server).map(([k, v]) => [k, summarizeServer(v)])),
		titleCold: summarizeServer(titleCold),
		tmdbDirectMs: { ...timingStat(tmdbDirect, (t) => round(t.ms, 1)), statuses: [...new Set(tmdbDirect.map((t) => t.status))] },
		samples: [
			...routes.flatMap((r) => rows[r.id].map((x, run) => ({ metric: "browser-load", id: r.id, run, ttfbMs: round(x.ttfbMs, 1), dclMs: round(x.dclMs), loadMs: round(x.loadMs), load: x.load }))),
			...Object.entries(server).flatMap(([id, xs]) => xs.map((x, run) => ({ metric: "server-fetch", id, run, ttfbMs: round(x.headerMs, 1), totalMs: round(x.totalMs, 1), load: x.load }))),
			...titleCold.map((x, run) => ({ metric: "title-cold", id: "title-movie", run, ttfbMs: round(x.headerMs, 1), totalMs: round(x.totalMs, 1), load: x.load })),
			...tmdbDirect.map((x, run) => ({ metric: "tmdb-direct", id: "tmdb", run, totalMs: round(x.ms, 1), load: x.load })),
		],
	});
}

const describeFocus = async (page) => {
	const aria = await page.locator(":focus").first().ariaSnapshot({ timeout: 1000 }).catch(() => null);
	const info = await page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el === document.body) return { tag: "body" };
		const cs = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		return {
			tag: el.tagName.toLowerCase(),
			text: el.textContent?.trim().slice(0, 40),
			href: el.getAttribute("href"),
			labelBelow: el.closest("div.text-center")?.textContent?.trim().slice(0, 30) ?? null,
			inDialog: !!el.closest('[role="dialog"], [role="alertdialog"]'),
			outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
			boxShadow: cs.boxShadow.slice(0, 80),
			rect: [r.x, r.y, r.width, r.height].map(Math.round),
		};
	});
	return { aria: aria?.split("\n")[0] ?? null, ...info };
};

const isUnnamed = (stop) => /^- (button|link)(:| \[|$)/.test(stop.aria ?? "") || (/^- (button|link) ""/.test(stop.aria ?? ""));

async function tabUntil(page, predicate, limit) {
	const stops = [];
	for (let i = 0; i < limit; i++) {
		await page.keyboard.press("Tab");
		const stop = await describeFocus(page);
		stops.push(stop);
		if (predicate(stop)) return { reached: true, stops };
	}
	return { reached: false, stops };
}

async function keyboardSection() {
	const browser = await launch();
	resetModalActor(sql);
	const ctx = await newContext(browser, { actor: MODAL_ACTOR.key, viewport: "desktop" });
	const page = await ctx.newPage();
	await page.goto("/app/title/movie/603");
	await settle(page, 1200);
	const isWatched = (s) => s.labelBelow === "Watched";
	const walk = await tabUntil(page, isWatched, 80);
	const target = walk.stops.at(-1);
	await page.screenshot({ path: join(WORK, "shots", "keyboard-watched-focused.png") });
	const unfocused = await page.evaluate(() => {
		const el = document.activeElement;
		el.blur();
		const cs = getComputedStyle(el);
		const out = `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}|${cs.boxShadow.slice(0, 80)}`;
		el.focus();
		return out;
	});
	const a11y = await page.locator(":focus").first().evaluate((el) => ({ ariaLabel: el.getAttribute("aria-label"), labelledby: el.getAttribute("aria-labelledby"), title: el.getAttribute("title"), pressed: el.getAttribute("aria-pressed") }));
	const result = {
		route: "/app/title/movie/603",
		viewport: "desktop 1440x900",
		reachedWatched: walk.reached,
		tabStopsToReach: walk.stops.length,
		ariaAtTarget: target?.aria,
		a11yAttributes: a11y,
		focusStyleFocused: `${target?.outline}|${target?.boxShadow}`,
		focusStyleUnfocused: unfocused,
		focusIndicatorChanges: `${target?.outline}|${target?.boxShadow}` !== unfocused,
		unnamedStopsOnTheWay: walk.stops.filter(isUnnamed).length,
		stopSample: walk.stops.map((s) => s.aria ?? `${s.tag}`),
	};

	await page.keyboard.press("Enter");
	const review = page.getByRole("dialog", { name: "Review" });
	result.enterOpensReview = await review.waitFor({ timeout: 8000 }).then(() => true, () => false);
	if (result.enterOpensReview) {
		await page.waitForTimeout(500);
		result.focusAfterOpen = await describeFocus(page);
		const toPublic = await tabUntil(page, (s) => /button "Public/.test(s.aria ?? ""), 40);
		result.publicReached = toPublic.reached;
		result.tabStopsToPublic = toPublic.stops.length;
		result.focusStayedInDialog = toPublic.stops.every((s) => s.inDialog);
		result.unnamedStopsInReview = toPublic.stops.filter(isUnnamed).length;
		await page.keyboard.press("Enter");
		await page.keyboard.press("Escape");
		await review.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
		await page.waitForTimeout(400);
		result.escapeCloses = !(await review.isVisible());
		result.focusAfterClose = await describeFocus(page);
		result.focusReturnedToWatched = isWatched(result.focusAfterClose);
	}
	result.watchEventsAfterEscape = Number(sql(`select count(*) from watch_event where user_id='${MODAL_ACTOR.id}' and tmdb_id=603`)[0][0]);
	await ctx.close();

	resetModalActor(sql);
	const ctx2 = await newContext(browser, { actor: MODAL_ACTOR.key, viewport: "desktop" });
	const page2 = await ctx2.newPage();
	await page2.goto("/app/title/movie/603");
	await settle(page2, 1200);
	await tabUntil(page2, isWatched, 80);
	await page2.keyboard.press("Space");
	const review2 = page2.getByRole("dialog", { name: "Review" });
	result.spaceOpensReview = await review2.waitFor({ timeout: 8000 }).then(() => true, () => false);
	if (result.spaceOpensReview) {
		await page2.waitForTimeout(500);
		await tabUntil(page2, (s) => /button "Public/.test(s.aria ?? ""), 40);
		await page2.keyboard.press("Enter");
		const toSave = await tabUntil(page2, (s) => /Save & Done/.test(s.aria ?? ""), 15);
		result.saveReachedAfterVisibility = toSave.reached;
		if (toSave.reached) {
			await page2.keyboard.press("Enter");
			result.saveClosesDialog = await review2.waitFor({ state: "hidden", timeout: 8000 }).then(() => true, () => false);
		}
		await page2.waitForTimeout(1000);
		result.keyboardOnlyWatchEvents = Number(sql(`select count(*) from watch_event where user_id='${MODAL_ACTOR.id}' and tmdb_id=603`)[0][0]);
	}
	await ctx2.close();

	const skip = {};
	for (const [id, path, actor] of [["landing", "/", undefined], ["login", "/login", undefined], ["feed", "/app/feed", "populated"], ["title-movie", "/app/title/movie/603", "populated"]]) {
		const c = await newContext(browser, { actor, viewport: "desktop" });
		const p = await c.newPage();
		await p.goto(path);
		await settle(p, 600);
		await p.keyboard.press("Tab");
		const first = await describeFocus(p);
		skip[id] = {
			firstStop: first.aria ?? first.tag,
			hasSkipLink: /skip/i.test(first.aria ?? ""),
			mainLandmarks: await p.locator("main").count(),
			h1Count: await p.locator("h1").count(),
		};
		await c.close();
	}
	result.skipLinks = skip;
	await browser.close();
	writeSection("keyboard", result);
	console.log(JSON.stringify({ reached: result.reachedWatched, stops: result.tabStopsToReach, aria: result.ariaAtTarget }));
}

const MOTION_ROUTES = () => runtimeRoutes().filter((r) => ["landing", "login", "feed", "title-movie", "tracker-show", "watchlists", "shuffle", "profile-self", "settings"].includes(r.id));

const ZOOM_WIDTHS = {
	at390: { width: 390, height: 844 },
	wcagReflow320: { width: 320, height: 568 },
	zoom200At390: { width: 195, height: 422 },
};

const motionProbe = () => {
	const running = document.getAnimations().filter((a) => a.playState === "running");
	const infinite = running.filter((a) => a.effect?.getTiming().iterations === Infinity);
	const names = {};
	for (const a of infinite) {
		const n = a.animationName ?? a.constructor.name;
		names[n] = (names[n] ?? 0) + 1;
	}
	return { running: running.length, infinite: infinite.length, names, canvases: document.querySelectorAll("canvas").length };
};

async function motionFrames(page) {
	const a = await page.screenshot();
	await page.waitForTimeout(1200);
	const b = await page.screenshot();
	return !a.equals(b);
}

const reflowProbe = () => {
	const vw = document.documentElement.clientWidth;
	const overflowPx = document.documentElement.scrollWidth - vw;
	window.scrollTo(99999, 0);
	const scrollablePx = Math.round(window.scrollX);
	window.scrollTo(0, 0);
	const clippedByAncestor = (el) => {
		for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
			if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true;
		}
		return false;
	};
	const offenders = new Map();
	for (const el of document.body.querySelectorAll("*")) {
		const r = el.getBoundingClientRect();
		if (!r.width || !r.height || r.right <= vw + 1 || getComputedStyle(el).position === "fixed" || el.closest(".fixed") || clippedByAncestor(el)) continue;
		const k = `${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).slice(0, 48)}`;
		const prev = offenders.get(k) ?? { el: k, count: 0, right: 0 };
		prev.count++;
		prev.right = Math.max(prev.right, Math.round(r.right));
		offenders.set(k, prev);
	}
	const bars = [...document.body.querySelectorAll("*")].filter((el) => {
		const cs = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		return (cs.position === "fixed" || cs.position === "sticky") && r.width >= vw * 0.9 && r.height > 0 && r.height < innerHeight * 0.6 && (r.top <= 1 || r.bottom >= innerHeight - 1) && cs.pointerEvents !== "none";
	});
	return {
		vw,
		overflowPx,
		scrollablePx,
		offenders: [...offenders.values()].sort((x, y) => y.right - x.right).slice(0, 4),
		fixedBarPx: Math.round(bars.reduce((a, el) => a + el.getBoundingClientRect().height, 0)),
		viewportHeight: innerHeight,
	};
};

async function motionSection() {
	const browser = await launch();
	const routes = MOTION_ROUTES();
	const motion = [];
	const zoom = [];
	for (const route of routes) {
		const row = { id: route.id, path: route.path };
		for (const mode of ["no-preference", "reduce"]) {
			const ctx = await newContext(browser, { actor: route.actor, viewport: "mobile", reducedMotion: mode });
			const page = await ctx.newPage();
			await page.goto(route.path);
			await settle(page, 1500);
			row[mode] = { ...(await page.evaluate(motionProbe)), pixelsMoveAfterSettle: await motionFrames(page) };
			if (mode === "reduce") await page.screenshot({ path: join(WORK, "shots", `reduced-${route.id}.png`) });
			await ctx.close();
		}
		motion.push(row);

		const widths = {};
		for (const [label, viewport] of Object.entries(ZOOM_WIDTHS)) {
			const ctx = await newContext(browser, { actor: route.actor, viewport, deviceScaleFactor: label === "zoom200At390" ? 2 : 1 });
			const page = await ctx.newPage();
			await page.goto(route.path);
			await settle(page, 800);
			await dismissAutoPopup(page);
			widths[label] = await page.evaluate(reflowProbe);
			if (label === "zoom200At390") await page.screenshot({ path: join(WORK, "shots", `zoom200-${route.id}.png`) });
			await ctx.close();
		}
		zoom.push({ id: route.id, path: route.path, ...widths });
	}

	const schemeCompare = [];
	for (const route of routes.filter((r) => ["landing", "login", "feed", "title-movie"].includes(r.id))) {
		const row = { id: route.id };
		for (const colorScheme of ["light", "dark"]) {
			const ctx = await newContext(browser, { actor: route.actor, viewport: "mobile", colorScheme });
			const page = await ctx.newPage();
			await page.goto(route.path);
			await settle(page, 600);
			const r = await runAxe(page);
			const { byImpact } = summarizeScenario(r);
			row[colorScheme] = { ...byImpact, htmlClass: await page.evaluate(() => document.documentElement.className), bodyBg: await page.evaluate(() => getComputedStyle(document.body).backgroundColor) };
			await ctx.close();
		}
		schemeCompare.push(row);
	}

	const celebration = {};
	for (const mode of ["no-preference", "reduce"]) {
		resetModalActor(sql);
		const ctx = await newContext(browser, { actor: MODAL_ACTOR.key, viewport: "mobile", reducedMotion: mode });
		const page = await ctx.newPage();
		await page.goto("/app/title/movie/603");
		await settle(page, 800);
		await page.locator("div.text-center", { has: page.getByText("Watched", { exact: true }) }).getByRole("button").click();
		const review = page.getByRole("dialog", { name: "Review" });
		await review.waitFor({ timeout: 15000 });
		await review.getByRole("button", { name: "Rate 4 stars" }).click();
		await review.getByRole("button", { name: /^Public/ }).click();
		await review.getByRole("button", { name: "Save & Done" }).click();
		const popup = page.getByRole("dialog", { name: /Achievements? Unlocked/ });
		await popup.waitFor({ timeout: 15000 });
		const samples = [];
		for (let i = 0; i < 6; i++) {
			samples.push(await page.evaluate(motionProbe));
			await page.waitForTimeout(250);
		}
		celebration[mode] = { maxRunning: Math.max(...samples.map((s) => s.running)), maxInfinite: Math.max(...samples.map((s) => s.infinite)), maxCanvases: Math.max(...samples.map((s) => s.canvases)) };
		await page.screenshot({ path: join(WORK, "shots", `celebration-${mode}.png`) });
		await ctx.close();
	}
	await browser.close();
	writeSection("motion-zoom", { motion, zoom, celebration, schemeCompare, zoomMethod: "zoom200At390 is 195x422 CSS px at deviceScaleFactor 2, the layout a 390 px wide window gets at 200% browser zoom. wcagReflow320 is the width WCAG 1.4.10 actually requires." });
}

const SECTIONS = { seed, axe: axeSection, lighthouse: lighthouseSection, runtime: runtimeSection, keyboard: keyboardSection, motion: motionSection };

const name = process.argv[2];
if (!SECTIONS[name]) throw new Error(`unknown section ${name}`);
await SECTIONS[name]();
