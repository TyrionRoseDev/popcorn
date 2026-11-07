// Shared harness for the screen and state inventory (inventory.ts, inventory-fixture.ts, inventory-sheets.ts).
// Evidence layout: $VP_EVIDENCE/inventory/{cells.jsonl,fixture.json,fixture-steps.jsonl,shots/<state>/<slug>@<width>.png}
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Browser, BrowserContext, Page, Route } from "playwright-core";
import type { Vp } from "../scripts/lib/vp.ts";

export const VIEWPORTS = { 390: { width: 390, height: 844 }, 1440: { width: 1440, height: 900 } } as const;
export type Width = keyof typeof VIEWPORTS;
const CELL_LIMIT_MS = 180000;

export const WIDTHS: Width[] = [390, 1440];

export type State =
	| "empty" | "first-run" | "populated" | "loading" | "error-500" | "error-tmdb" | "bad-url" | "signed-out" | "overlay";
export type Fault = "hold-trpc" | "trpc-500" | "tmdb-down" | "hold-auth" | "auth-500";

export const ACTORS = {
	vera: "vera@popcorn.test",
	felix: "felix@popcorn.test",
	stella: "stella@popcorn.test",
	rita: "rita@popcorn.test",
	blake: "blake@popcorn.test",
	newbie: "newbie@popcorn.test",
} as const;
export type Actor = keyof typeof ACTORS | "anon";

export interface Fixture {
	users: Partial<Record<keyof typeof ACTORS, string>>;
	watchlists: Partial<Record<"empty" | "horror" | "shared" | "felixPrivate" | "felixPublic" | "myPicks", string>>;
}

export interface CellSpec {
	slug: string;
	route: string;
	url: string;
	state: State;
	actor: Actor;
	fault?: Fault;
	/** client = land on a neutral page, then router navigate, so route loaders run in the browser. */
	via?: "hard" | "client";
	widths?: Width[];
	/** Interaction after the page settles; the screenshot is taken when it returns. */
	act?: (page: Page, width: Width) => Promise<void>;
	settleMs?: number;
	/** Capture the viewport, for cells whose interaction scrolls the page. */
	viewport?: boolean;
}

export interface Cell {
	id: string;
	route: string;
	state: State;
	slug: string;
	width: Width;
	actor: Actor;
	url: string;
	finalUrl: string;
	via: "hard" | "client" | "journey";
	fault: Fault | null;
	reached: boolean;
	failure: string | null;
	screenshot: string | null;
	hydrated: boolean;
	httpStatus: number | null;
	consoleErrors: string[];
	injectedNoise: number;
	failedRequests: string[];
	overflow: boolean;
	scrollWidth: number;
	innerWidth: number;
	overflowOffenders: string[];
	skeletons: number;
	spinners: number;
	dialogs: string[];
	toasts: string[];
	h1: string | null;
	docTitle: string;
	textLength: number;
	textSample: string;
	pageHeight: number;
	capturedAt: string;
	/** Second attempt with longer waits; a host under load can make a slow render look blank. */
	retried: boolean;
}

const TMDB_PROCEDURES = new Set([
	"title.details",
	"search.results", "search.trending", "search.topRated", "search.newReleases",
	"tasteProfile.getFeed", "tasteProfile.search",
	"shuffle.getFeed",
	"episodeTracker.getSeasonEpisodes", "episodeTracker.getAllSeasonEpisodes",
]);

export interface Harness {
	retryMode: boolean;
	root: string;
	vp: Vp;
	fixture(): Fixture;
	saveFixture(f: Fixture): void;
	context(actor: Actor, width: Width): Promise<BrowserContext>;
	newPage(actor: Actor, width: Width): Promise<Page>;
	signInReal(email: string, page: Page): Promise<void>;
	open(page: Page, url: string): Promise<void>;
	settle(page: Page): Promise<boolean>;
	cell(spec: CellSpec, width: Width): Promise<Cell>;
	/** Run every width of every spec; `parallel` runs widths of one spec at once. */
	run(specs: CellSpec[], parallel?: boolean): Promise<void>;
	/** Capture a one-shot state already on screen, resizing so both widths exist. */
	snap(page: Page, base: Pick<CellSpec, "slug" | "route" | "state" | "actor">): Promise<void>;
	logStep(name: string, ok: boolean, detail?: string): void;
	close(): Promise<void>;
}

export function arcade(page: Page, label: string) {
	return page.locator("div.text-center", { has: page.getByText(label, { exact: true }) }).getByRole("button");
}

export async function createHarness(vp: Vp, retryMode = false): Promise<Harness> {
	const browser = vp.context.browser() as Browser;
	const root = join(dirname(vp.dir), "inventory");
	const authDir = join(process.env.VP_STATE as string, "inventory-auth");
	mkdirSync(authDir, { recursive: true });
	mkdirSync(join(root, "shots"), { recursive: true });
	const fixturePath = join(root, "fixture.json");
	const cellsPath = join(root, "cells.jsonl");
	const contexts = new Map<string, BrowserContext>();

	const settle = async (page: Page) => {
		await page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
		return page
			.waitForFunction(
				() => {
					const el = document.querySelector("main, header, form, button, a");
					return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber"));
				},
				undefined,
				{ timeout: 30000 },
			)
			.then(() => true)
			.catch(() => false);
	};

	const open = async (page: Page, url: string) => {
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
		await settle(page);
	};

	const signInReal = async (email: string, page: Page) => {
		await open(page, "/login");
		await page.getByPlaceholder("you@email.com").fill(email);
		await page.getByRole("button", { name: "Send Magic Link" }).click();
		await page.getByRole("heading", { name: "Magic link sent!" }).waitFor();
		const mail = await vp.waitForMail(email);
		await page.goto(mail.link as string);
		await page.waitForURL((u) => !u.pathname.startsWith("/api/auth") && u.pathname !== "/login", { timeout: 30000 });
		await settle(page);
	};

	const authFile = (actor: Actor) => join(authDir, `${actor}.json`);

	const session = async (actor: Actor) => {
		if (actor === "anon") return undefined;
		const file = authFile(actor);
		if (existsSync(file)) return file;
		const ctx = await browser.newContext({ baseURL: vp.appUrl, viewport: VIEWPORTS[1440] });
		const page = await ctx.newPage();
		await signInReal(ACTORS[actor], page);
		await ctx.storageState({ path: file });
		await ctx.close();
		return file;
	};

	const context = async (actor: Actor, width: Width) => {
		const key = `${actor}@${width}`;
		const existing = contexts.get(key);
		if (existing) return existing;
		const ctx = await browser.newContext({
			baseURL: vp.appUrl,
			viewport: VIEWPORTS[width],
			storageState: await session(actor),
		});
		contexts.set(key, ctx);
		return ctx;
	};

	const newPage = async (actor: Actor, width: Width) => (await context(actor, width)).newPage();

	const installFault = async (page: Page, fault: Fault | undefined) => {
		let release = () => {};
		if (!fault) return release;
		const gate = new Promise<void>((r) => { release = r; });
		const hold = async (route: Route) => {
			await gate;
			await route.continue().catch(() => {});
		};
		const fail = (route: Route) =>
			route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({ error: { message: "injected by inventory" } }),
			});
		if (fault === "hold-trpc") await page.route(/\/api\/trpc\//, hold);
		if (fault === "trpc-500") await page.route(/\/api\/trpc\//, fail);
		if (fault === "hold-auth") await page.route(/\/api\/auth\/sign-in/, hold);
		if (fault === "auth-500") await page.route(/\/api\/auth\/sign-in/, fail);
		if (fault === "tmdb-down") {
			await page.route(/image\.tmdb\.org/, (route) => route.abort());
			await page.route(/\/api\/trpc\//, (route) => {
				const url = new URL(route.request().url());
				const prefix = "/api/trpc/";
				const procs = decodeURIComponent(url.pathname.slice(prefix.length)).split(",");
				if (!procs.some((p) => TMDB_PROCEDURES.has(p))) return route.continue();
				// A batch stream cannot be faked per entry, so each TMDB entry becomes an invalid title.details call:
				// the server returns a real per-entry tRPC error and the rest of the batch stays real.
				const input = JSON.parse(url.searchParams.get("input") ?? "{}") as Record<string, unknown>;
				const rewritten = procs.map((p, i) => {
					if (!TMDB_PROCEDURES.has(p)) return p;
					input[i] = { json: {} };
					return "title.details";
				});
				url.pathname = prefix + rewritten.join(",");
				url.searchParams.set("input", JSON.stringify(input));
				return route.continue({ url: url.toString() });
			});
		}
		return release;
	};

	const measure = (page: Page) =>
		page.evaluate(() => {
			const se = document.scrollingElement as Element;
			const vw = window.innerWidth;
			const describe = (el: Element) => {
				const cls = typeof el.className === "string" ? el.className.slice(0, 70) : "";
				const text = (el.textContent ?? "").trim().slice(0, 30);
				return `${el.tagName.toLowerCase()}.${cls} right=${Math.round(el.getBoundingClientRect().right)} "${text}"`;
			};
			const offenders: string[] = [];
			for (const el of document.body.querySelectorAll("*")) {
				if (offenders.length >= 6) break;
				const r = el.getBoundingClientRect();
				if (r.width === 0 || r.height === 0 || r.right <= vw + 1) continue;
				const style = getComputedStyle(el);
				if (style.position === "fixed" || style.visibility === "hidden") continue;
				let clipped = false;
				for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
					const o = getComputedStyle(p).overflowX;
					if (o !== "visible") { clipped = true; break; }
				}
				if (!clipped) offenders.push(describe(el));
			}
			const inner = (document.body.innerText ?? "").replace(/\s+/g, " ").trim();
			const main = document.querySelector("main") as HTMLElement | null;
			return {
				scrollWidth: se.scrollWidth,
				innerWidth: vw,
				pageHeight: se.scrollHeight,
				offenders,
				skeletons: document.querySelectorAll(".animate-pulse").length,
				spinners: document.querySelectorAll(".animate-spin").length,
				dialogs: [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].map(
					(d) => d.getAttribute("aria-label") ?? d.querySelector("h2")?.textContent ?? d.getAttribute("role") ?? "",
				),
				toasts: [...document.querySelectorAll("[data-sonner-toast]")].map((t) => (t.textContent ?? "").trim()),
				h1: document.querySelector("h1")?.textContent?.trim() ?? null,
				docTitle: document.title,
				textLength: inner.length,
				textSample: (main?.innerText ?? inner).replace(/\s+/g, " ").trim().slice(0, 240),
			};
		});

	const record = (cell: Cell) => appendFileSync(cellsPath, `${JSON.stringify(cell)}\n`);

	const shotPath = (state: State, slug: string, width: Width) => {
		const dir = join(root, "shots", state);
		mkdirSync(dir, { recursive: true });
		return join(dir, `${slug}@${width}.png`);
	};

	const watch = (page: Page, fault: Fault | undefined) => {
		const log = { consoleErrors: [] as string[], injectedNoise: 0, failedRequests: [] as string[], status: null as number | null };
		page.on("console", (m) => {
			if (m.type() !== "error") return;
			const t = m.text().slice(0, 400);
			if (fault && /Failed to load resource|ERR_FAILED|net::ERR/.test(t)) log.injectedNoise++;
			else log.consoleErrors.push(t);
		});
		page.on("pageerror", (e) => log.consoleErrors.push(`pageerror: ${e.message.slice(0, 400)}`));
		page.on("response", (r) => {
			if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) log.status = r.status();
			const u = r.url();
			if (r.status() >= 400 && u.includes("/api/") && !fault) log.failedRequests.push(`${r.status()} ${u.slice(0, 160)}`);
		});
		return log;
	};

	const finish = async (
		page: Page,
		spec: Pick<CellSpec, "slug" | "route" | "state" | "actor" | "fault" | "url" | "viewport">,
		width: Width,
		via: Cell["via"],
		log: ReturnType<typeof watch>,
		hydrated: boolean,
		failure: string | null,
	): Promise<Cell> => {
		const id = `${spec.state}/${spec.slug}@${width}`;
		const base: Cell = {
			id, route: spec.route, state: spec.state, slug: spec.slug, width, actor: spec.actor, url: spec.url,
			finalUrl: page.url().replace(vp.appUrl, ""), via, fault: spec.fault ?? null, reached: false, failure,
			screenshot: null, hydrated, httpStatus: log.status, consoleErrors: [...new Set(log.consoleErrors)],
			injectedNoise: log.injectedNoise, failedRequests: [...new Set(log.failedRequests)], overflow: false,
			scrollWidth: 0, innerWidth: 0, overflowOffenders: [], skeletons: 0, spinners: 0, dialogs: [], toasts: [],
			h1: null, docTitle: "", textLength: 0, textSample: "", pageHeight: 0, capturedAt: new Date().toISOString(),
			retried: retryMode,
		};
		try {
			// Sibling runs share the working tree, so vite can full-reload a page mid-measure. Measure again once it lands.
			const m = await measure(page).catch(async (err: Error) => {
				if (!/context was destroyed/i.test(err.message)) throw err;
				await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
				await settle(page);
				return measure(page);
			});
			const path = shotPath(spec.state, spec.slug, width);
			// The floating TanStack devtools trigger only exists under vite dev, and it covers real UI in screenshots.
			await page.evaluate(() => {
				for (const b of document.querySelectorAll("button[aria-label]")) {
					if (!/devtools/i.test(b.getAttribute("aria-label") ?? "")) continue;
					const host = b.closest("[data-testid]") as HTMLElement | null;
					if (host) host.style.display = "none";
				}
			});
			// Fixed overlays land mid-image on a full-page capture of a scrolled page, so overlays use the viewport.
			await page.screenshot({ path, fullPage: m.dialogs.length === 0 && !spec.viewport, timeout: 45000 });
			Object.assign(base, {
				reached: failure === null,
				screenshot: path,
				overflow: m.scrollWidth > m.innerWidth,
				scrollWidth: m.scrollWidth,
				innerWidth: m.innerWidth,
				overflowOffenders: m.offenders,
				skeletons: m.skeletons,
				spinners: m.spinners,
				dialogs: m.dialogs,
				toasts: m.toasts,
				h1: m.h1,
				docTitle: m.docTitle,
				textLength: m.textLength,
				textSample: m.textSample,
				pageHeight: m.pageHeight,
			});
		} catch (err) {
			base.failure = `${failure ?? ""} capture: ${(err as Error).message.slice(0, 200)}`.trim();
		}
		record(base);
		const flag = base.reached ? "ok  " : "FAIL";
		console.log(`${flag} ${id} -> ${base.finalUrl} overflow=${base.overflow} errs=${base.consoleErrors.length}${base.failure ? ` ${base.failure}` : ""}`);
		return base;
	};

	const cell = async (spec: CellSpec, width: Width) => {
		const page = await newPage(spec.actor, width);
		const log = watch(page, spec.fault);
		const via = spec.via ?? "hard";
		let hydrated = false;
		let failure: string | null = null;
		let release = () => {};
		const waitsForNetwork = spec.fault !== "hold-trpc" && spec.fault !== "hold-auth";
		try {
			if (via === "client") {
				await open(page, "/app/settings/blocked");
				release = await installFault(page, spec.fault);
				await page.evaluate((u) => {
					(window as unknown as { __TSR_ROUTER__: { history: { push(p: string): void } } }).__TSR_ROUTER__.history.push(u);
				}, spec.url);
				hydrated = true;
			} else {
				release = await installFault(page, spec.fault);
				await page.goto(spec.url, { waitUntil: "domcontentloaded", timeout: 60000 });
			}
			if (waitsForNetwork) hydrated = (await settle(page)) || hydrated;
			else {
				hydrated = await page
					.waitForFunction(
						() => {
							const el = document.querySelector("main, header, form, button, a");
							return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber"));
						},
						undefined,
						{ timeout: 30000 },
					)
					.then(() => true)
					.catch(() => false);
			}
			const wait = spec.settleMs ?? (spec.fault === "trpc-500" || spec.fault === "tmdb-down" ? 9000 : 1200);
			await page.waitForTimeout(retryMode ? wait + 10000 : wait);
			if (spec.act) await spec.act(page, width);
		} catch (err) {
			failure = (err as Error).message.split("\n")[0].slice(0, 240);
		}
		const result = await finish(page, spec, width, via, log, hydrated, failure);
		release();
		await page.close().catch(() => {});
		return result;
	};

	// A wedged renderer can hang a Playwright call that takes no timeout, so one cell must not stop the whole matrix.
	const guarded = async (spec: CellSpec, width: Width) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const limit = new Promise<"hung">((resolve) => { timer = setTimeout(() => resolve("hung"), CELL_LIMIT_MS); });
		const outcome = await Promise.race([cell(spec, width), limit]);
		clearTimeout(timer);
		if (outcome !== "hung") return;
		const id = `${spec.state}/${spec.slug}@${width}`;
		console.log(`FAIL ${id} hung past ${CELL_LIMIT_MS}ms`);
		record({
			id, route: spec.route, state: spec.state, slug: spec.slug, width, actor: spec.actor, url: spec.url, finalUrl: "",
			via: spec.via ?? "hard", fault: spec.fault ?? null, reached: false, failure: `cell hung past ${CELL_LIMIT_MS}ms`,
			screenshot: null, hydrated: false, httpStatus: null, consoleErrors: [], injectedNoise: 0, failedRequests: [], overflow: false,
			scrollWidth: 0, innerWidth: 0, overflowOffenders: [], skeletons: 0, spinners: 0, dialogs: [], toasts: [],
			h1: null, docTitle: "", textLength: 0, textSample: "", pageHeight: 0, capturedAt: new Date().toISOString(), retried: retryMode,
		});
	};

	const run = async (specs: CellSpec[], parallel = true) => {
		for (const spec of specs) {
			const widths = spec.widths ?? WIDTHS;
			if (parallel) await Promise.all(widths.map((w) => guarded(spec, w)));
			else for (const w of widths) await guarded(spec, w);
		}
	};

	const snap: Harness["snap"] = async (page, base) => {
		const original = page.viewportSize();
		const log = watch(page, undefined);
		for (const width of WIDTHS) {
			await page.setViewportSize(VIEWPORTS[width]);
			await page.waitForTimeout(500);
			await finish(page, { ...base, url: page.url().replace(vp.appUrl, "") }, width, "journey", log, true, null);
		}
		if (original) await page.setViewportSize(original);
	};

	return {
		retryMode, root, vp, context, newPage, signInReal, open, settle, cell, run, snap,
		fixture: () =>
			existsSync(fixturePath)
				? (JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture)
				: { users: {}, watchlists: {} },
		saveFixture: (f) => writeFileSync(fixturePath, JSON.stringify(f, null, 2)),
		logStep(name, ok, detail = "") {
			appendFileSync(join(root, "fixture-steps.jsonl"), `${JSON.stringify({ name, ok, detail, at: new Date().toISOString() })}\n`);
			console.log(`${ok ? "STEP ok  " : "STEP FAIL"} ${name} ${detail}`);
		},
		async close() {
			for (const ctx of contexts.values()) await ctx.close().catch(() => {});
		},
	};
}

export async function dismissAchievements(h: Harness, page: Page, snap: boolean) {
	const popup = page.getByRole("dialog", { name: /Achievements? Unlocked/ });
	const shown = await popup.waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
	if (!shown) return false;
	await page.waitForTimeout(1800);
	if (snap) await h.snap(page, { slug: "achievement-popup", route: "/app/title/movie/$id", state: "overlay", actor: "vera" });
	const clicked = await popup.getByRole("button", { name: /continue/i }).click({ timeout: 6000 }).then(() => true).catch((err: Error) => {
		h.logStep("achievement Continue click failed, used Escape", false, err.message.split("\n").slice(0, 10).join(" ").slice(0, 500));
		return false;
	});
	if (!clicked) await page.keyboard.press("Escape");
	await popup.waitFor({ state: "hidden", timeout: 15000 });
	return true;
}

export async function createWatchlist(h: Harness, page: Page, name: string, isPublic: boolean) {
	await page.getByRole("button", { name: /New Watchlist|^\+|^N/ }).first().click();
	const dialog = page.getByRole("dialog", { name: /watchlist/i });
	await dialog.getByPlaceholder("e.g. Friday Night Horror").fill(name);
	if (isPublic) await dialog.getByRole("switch").click();
	await dialog.getByRole("button", { name: "Create", exact: true }).click();
	await dialog.waitFor({ state: "hidden", timeout: 15000 });
	await dismissAchievements(h, page, false);
}

/** Saves a session for an actor so later journeys reuse the magic-link sign-in. */
export async function saveSession(h: Harness, actor: keyof typeof ACTORS, page: Page) {
	await page.context().storageState({ path: join(process.env.VP_STATE as string, "inventory-auth", `${actor}.json`) });
	h.logStep(`session saved for ${actor}`, true);
}

/** Completes onboarding the shortest way, through the real form. */
export async function onboardQuick(page: Page, username: string) {
	await page.getByPlaceholder("cinephile42").fill(username);
	await page.getByRole("button", { name: "Continue" }).click();
	await page.getByRole("heading", { name: "Add a photo" }).waitFor({ timeout: 20000 });
	await page.getByRole("button", { name: "Skip for now" }).click();
	await pickTaste(page);
	await page.getByRole("button", { name: "Skip for now" }).click({ timeout: 20000 });
	await page.waitForTimeout(800);
	await page.getByRole("button", { name: "Skip for now" }).click({ timeout: 20000 });
	await page.waitForTimeout(800);
	await page.getByRole("button", { name: "Skip for now" }).click({ timeout: 20000 });
	await page.waitForURL("**/app/search**", { timeout: 30000 });
}

export async function pickTaste(page: Page) {
	const genres = page.getByRole("button", { name: /^(Action|Comedy|Drama|Horror|Thriller|Sci-Fi|Science Fiction)$/ });
	await genres.first().waitFor({ timeout: 30000 });
	await page.waitForTimeout(1500);
	for (let i = 0; i < 3; i++) await genres.nth(i).click();
	const titles = page.locator("button:has(img[loading=lazy])");
	await titles.first().waitFor({ timeout: 30000 });
	await page.waitForTimeout(800);
	for (let i = 0; i < 4; i++) await titles.nth(i).click();
	await page.getByRole("button", { name: /Continue/ }).click();
}
