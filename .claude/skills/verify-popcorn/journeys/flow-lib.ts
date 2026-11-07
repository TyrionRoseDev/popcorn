// Lever for docs/redesign/phase-1/02-*: counts user actions, diffs the watch-domain tables around
// each flow, and records which tRPC mutations fired. Not a journey; journeys named flows-*.ts import it.
// Fixture users are inserted the way scripts/seed.sql does. Sign-in is still the real magic link.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext, Locator, Page } from "playwright-core";
import type { Vp } from "../scripts/lib/vp.ts";

export const TABLES = [
	"user_title",
	"watch_event",
	"watch_event_companion",
	"episode_watch",
	"review",
	"journal_entry",
	"watchlist_item",
	"watchlist",
	"notification",
	"recommendation",
	"shuffle_swipe",
	"earned_achievement",
] as const;
export type Table = (typeof TABLES)[number];
type Row = Record<string, unknown> & { id: string };
export type Snapshot = Record<Table, Row[]>;

export type RowChange = {
	table: Table;
	op: "insert" | "delete" | "update";
	id: string;
	owner: string | null;
	row?: Row;
	changed?: Record<string, [unknown, unknown]>;
};

export type StepKind = "nav" | "tap" | "field" | "key";
export type FlowRecord = {
	id: string;
	job: string;
	entry: string;
	actor: string;
	start: string;
	preconditions: string[];
	steps: { kind: StepKind; label: string }[];
	counts: { actions: number; navActions: number; taskActions: number; fields: number; screens: number; decisions: number };
	screens: string[];
	decisions: { label: string; options: string[] }[];
	mutations: string[];
	result: "pass" | "fail" | "blocked";
	failure?: string;
	friction: string[];
	observations: Record<string, unknown>;
	delta: RowChange[];
	deltaSummary: Partial<Record<Table, { ins: number; del: number; upd: number }>>;
	evidence: string[];
	journey: string;
	attempts: number;
};

const ownerOf = (r: Row): string | null =>
	(r.user_id ?? r.recipient_id ?? r.owner_id ?? r.added_by ?? r.sender_id ?? null) as string | null;

export function snapshot(): Snapshot {
	const parts = TABLES.map((t) => `'${t}',(select coalesce(json_agg(x),'[]'::json) from ${t} x)`).join(",");
	const out = execFileSync(
		"docker",
		["exec", process.env.VP_CONTAINER as string, "psql", "-h", "127.0.0.1", "-U", "popcorn", "-d", "popcorn_verify", "-At", "-c", `select json_build_object(${parts})`],
		{ encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
	);
	return JSON.parse(out);
}

export function diff(a: Snapshot, b: Snapshot): RowChange[] {
	const changes: RowChange[] = [];
	for (const t of TABLES) {
		const before = new Map(a[t].map((r) => [r.id, r]));
		const after = new Map(b[t].map((r) => [r.id, r]));
		for (const [id, r] of after) {
			const old = before.get(id);
			if (!old) {
				changes.push({ table: t, op: "insert", id, owner: ownerOf(r), row: r });
				continue;
			}
			const changed: Record<string, [unknown, unknown]> = {};
			for (const k of Object.keys(r)) {
				if (JSON.stringify(old[k]) !== JSON.stringify(r[k])) changed[k] = [old[k], r[k]];
			}
			if (Object.keys(changed).length) changes.push({ table: t, op: "update", id, owner: ownerOf(r), changed });
		}
		for (const [id, r] of before) {
			if (!after.has(id)) changes.push({ table: t, op: "delete", id, owner: ownerOf(r), row: r });
		}
	}
	return changes;
}

// Stands in for a user who earned these on an earlier show, so a finish raises no achievement popup.
export function holdAchievements(a: { id: string }, ids = ["series-finale", "binge-watch"]) {
	for (const id of ids) psql(`insert into earned_achievement (id, user_id, achievement_id) values ('${a.id}-${id}', '${a.id}', '${id}') on conflict do nothing`);
}

export function psql(query: string): string[][] {
	const out = execFileSync(
		"docker",
		["exec", process.env.VP_CONTAINER as string, "psql", "-h", "127.0.0.1", "-U", "popcorn", "-d", "popcorn_verify", "-v", "ON_ERROR_STOP=1", "-At", "-F", "\t", "-c", query],
		{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
	);
	return out.split("\n").filter(Boolean).map((r) => r.split("\t"));
}

export async function mailLink(email: string, timeoutMs = 90000): Promise<string> {
	const dir = process.env.VP_MAIL_DIR as string;
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort().reverse()) {
			const m = JSON.parse(readFileSync(join(dir, f), "utf8"));
			if ([m.to].flat().includes(email) && m.link) return m.link as string;
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error(`no email to ${email} within ${timeoutMs}ms`);
}

export type Actor = {
	key: string;
	id: string;
	email: string;
	username: string;
	page: Page;
	ctx: BrowserContext;
	mutations: string[];
	inflight: number;
	lastActivity: number;
	goto(path: string): Promise<void>;
	settle(quietMs?: number): Promise<void>;
};

export function fixtureUser(key: string, friends: string[] = []) {
	const id = `fx-${key}`;
	psql(`INSERT INTO "user" (id, name, email, email_verified, username, bio, onboarding_completed, created_at, updated_at)
		VALUES ('${id}','${key}','${key}@popcorn.test',true,'${key.replace(/[^a-z0-9]/g, "")}','fixture',true,NOW(),NOW()) ON CONFLICT (email) DO NOTHING`);
	for (const f of friends) {
		psql(`INSERT INTO friendship (id, requester_id, addressee_id, status, created_at, updated_at)
			VALUES ('fx-fr-${key}-${f}','${id}','fx-${f}','accepted',NOW(),NOW()) ON CONFLICT DO NOTHING`);
	}
	return id;
}

export async function actor(vp: Vp, key: string, opts: { email?: string; id?: string; username?: string } = {}): Promise<Actor> {
	const email = opts.email ?? `${key}@popcorn.test`;
	const browser = vp.context.browser();
	if (!browser) throw new Error("no browser");
	const authFile = join(process.env.VP_STATE as string, `auth-${key}.json`);
	const ctx = await browser.newContext({
		baseURL: vp.appUrl,
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
		deviceScaleFactor: 1,
		reducedMotion: "reduce",
		storageState: existsSync(authFile) ? authFile : undefined,
	});
	ctx.setDefaultTimeout(45000);
	const page = await ctx.newPage();
	const a: Actor = {
		key,
		id: opts.id ?? `fx-${key}`,
		email,
		username: opts.username ?? key.replace(/[^a-z0-9]/g, ""),
		page,
		ctx,
		mutations: [],
		inflight: 0,
		lastActivity: Date.now(),
		async goto(path) {
			await page.goto(path);
			await hydrated(page);
			await a.settle();
			await page.waitForTimeout(400);
		},
		async settle(quietMs = 700) {
			const deadline = Date.now() + 8000;
			while (Date.now() < deadline) {
				if (a.inflight === 0 && Date.now() - a.lastActivity >= quietMs) return;
				await page.waitForTimeout(100);
			}
		},
	};
	page.on("request", (r) => {
		if (!r.url().includes("/api/")) return;
		a.inflight++;
		a.lastActivity = Date.now();
		if (r.method() === "POST") {
			const m = r.url().match(/\/api\/(trpc\/[^?]+|auth\/[^?]+)/);
			if (m) a.mutations.push(m[1].replace("trpc/", ""));
		}
	});
	const done = (r: { url(): string }) => {
		if (!r.url().includes("/api/")) return;
		a.inflight = Math.max(0, a.inflight - 1);
		a.lastActivity = Date.now();
	};
	page.on("requestfinished", done);
	page.on("requestfailed", done);
	// Requests cancelled by a navigation can report neither event, which would pin inflight above zero.
	page.on("framenavigated", (fr) => {
		if (fr === page.mainFrame()) a.inflight = 0;
	});
	page.on("pageerror", (e) => writeFileSync(join(vp.dir, "pageerrors.log"), `${key}: ${e.message}\n`, { flag: "a" }));
	if (!existsSync(authFile)) {
		try {
			await page.goto("/login");
			await hydrated(page);
			await page.getByPlaceholder("you@email.com").fill(email);
			await page.getByRole("button", { name: "Send Magic Link" }).click();
			await page.getByRole("heading", { name: "Magic link sent!" }).waitFor();
			await page.goto(await mailLink(email));
			await page.waitForURL((u) => !u.pathname.startsWith("/api/auth") && u.pathname !== "/login", { timeout: 60000 });
			await hydrated(page);
			await ctx.storageState({ path: authFile });
		} catch (e) {
			await ctx.close();
			throw e;
		}
	}
	return a;
}

export async function hydrated(page: Page) {
	await page.waitForLoadState("networkidle");
	await page.waitForFunction(
		() => {
			const el = document.querySelector("main, header, form, button, a");
			return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber"));
		},
		undefined,
		{ timeout: 60000 },
	);
}

let shot = 0;
export async function capture(vp: Vp, a: Actor, name: string): Promise<string> {
	const base = `${String(++shot).padStart(3, "0")}-${name}`;
	await a.page.screenshot({ path: join(vp.dir, `${base}.png`), fullPage: true }).catch(() => {});
	const aria = await a.page.locator("body").ariaSnapshot().catch(() => "");
	writeFileSync(join(vp.dir, `${base}.aria.yml`), aria);
	return base;
}

export class Flow {
	rec: FlowRecord;
	before!: Snapshot;
	reading = false;
	participants?: string[];
	as(other: Actor): Flow {
		const g = Object.create(this) as Flow;
		g.a = other;
		return g;
	}
	constructor(
		public vp: Vp,
		public a: Actor,
		job: string,
		entry: string,
		start: string,
		preconditions: string[] = [],
	) {
		const journey = vp.dir.split("/").pop() as string;
		this.rec = {
			id: flowId(job, entry),
			job,
			entry,
			actor: a.key,
			start,
			preconditions,
			steps: [],
			counts: { actions: 0, navActions: 0, taskActions: 0, fields: 0, screens: 0, decisions: 0 },
			screens: [],
			decisions: [],
			mutations: [],
			result: "pass",
			friction: [],
			observations: {},
			delta: [],
			deltaSummary: {},
			evidence: [],
			journey,
			attempts: 1,
		};
	}
	screen(name: string) {
		if (this.rec.screens.at(-1) !== name) this.rec.screens.push(name);
	}
	decide(label: string, options: string[]) {
		this.rec.decisions.push({ label, options });
	}
	friction(text: string) {
		this.rec.friction.push(text);
	}
	observe(key: string, value: unknown) {
		this.rec.observations[key] = value;
	}
	async popup() {
		const overlays = await this.a.page.evaluate(() => {
			const o = document.querySelectorAll("vite-error-overlay");
			for (const x of o) x.remove();
			return o.length;
		}).catch(() => 0);
		if (overlays) this.rec.observations.viteOverlaysRemoved = Number(this.rec.observations.viteOverlaysRemoved ?? 0) + overlays;
		// Located by text, not role: a Radix modal underneath marks the popup aria-hidden while it is on screen.
		const d = this.a.page.locator('[role="dialog"]', { hasText: /Achievements? Unlocked/ }).first();
		if (!(await d.isVisible().catch(() => false))) return false;
		if (!this.reading) this.screen("Achievement popup");
		// A real touch, not a locator click: under a live Radix modal the popup is inert, so the tap
		// lands on the layer beneath. Each tap the user would need is counted.
		const cont = d.locator("button", { hasText: /continue/i });
		for (let taps = 0; taps < 8 && (await d.isVisible().catch(() => false)); taps++) {
			const box = await cont.boundingBox();
			if (!box) break;
			if (!this.reading) this.rec.steps.push({ kind: "tap", label: "dismiss achievement popup" });
			await this.a.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
			await this.a.page.waitForTimeout(900);
		}
		await this.a.settle();
		return true;
	}
	async nav(target: Locator, label: string) {
		await this.popup();
		this.rec.steps.push({ kind: "nav", label });
		await target.click();
		await this.a.settle();
		await this.popup();
	}
	async tap(target: Locator, label: string) {
		await this.popup();
		this.rec.steps.push({ kind: "tap", label });
		await this.clickThroughPopup(target);
		await this.a.settle();
		await this.popup();
	}

	// The achievement popup can land between the check and the click, and it covers everything.
	private async clickThroughPopup(target: Locator) {
		for (let tries = 0; ; tries++) {
			try {
				await target.click({ timeout: 12000 });
				return;
			} catch (err) {
				const cleared = await this.popup();
				if (!cleared && tries >= 2) throw err;
			}
		}
	}
	async tapNow(target: Locator, label: string) {
		this.rec.steps.push({ kind: "tap", label });
		await target.click();
	}

	async tapTimed(target: Locator, label: string, expired: string) {
		if (await target.isVisible()) {
			await this.tap(target, label).catch(() => this.observe("timedPrompt", expired));
			return;
		}
		this.observe("timedPrompt", expired);
	}

	async fill(target: Locator, value: string, label: string) {
		await this.popup();
		this.rec.steps.push({ kind: "field", label });
		await target.fill(value);
		await this.a.settle(350);
	}
	async drawer(link: string) {
		const p = this.a.page;
		const burger = p.getByRole("banner").getByRole("button").first();
		await this.nav(burger, "open drawer");
		const target = p.getByRole("dialog").getByRole("link", { name: link, exact: false }).first();
		await this.retry(burger, target);
		this.screen("Nav drawer");
		await this.nav(target, `drawer: ${link}`);
	}
	async search(query: string, href: string) {
		const p = this.a.page;
		await this.fill(p.getByRole("textbox", { name: "Search movies and TV shows" }), query, `search "${query}"`);
		const hit = p.locator(`a[href="${href}"]`).first();
		await hit.waitFor({ timeout: 60000 });
		await this.nav(hit, "tap result");
	}
	async retry(trigger: Locator, appears: Locator) {
		for (let i = 0; i < 3; i++) {
			await this.a.page.waitForTimeout(500);
			if (await appears.isVisible().catch(() => false)) return;
			this.rec.observations.harnessRetries = Number(this.rec.observations.harnessRetries ?? 0) + 1;
			await trigger.click();
		}
	}
	async bell() {
		await this.nav(this.a.page.getByRole("banner").getByRole("button").nth(1), "open notifications");
		this.screen("Notifications panel");
	}
	async key(key: string, label: string) {
		this.rec.steps.push({ kind: "key", label });
		await this.a.page.keyboard.press(key);
		await this.a.settle();
	}
	async shot(name: string) {
		const base = await capture(this.vp, this.a, `${this.rec.id}-${name}`.slice(0, 90));
		this.rec.evidence.push(`${this.rec.journey}/${base}.png`);
	}
}

const flowsDir = () => {
	const d = join(process.env.VP_EVIDENCE as string, "flows");
	mkdirSync(d, { recursive: true });
	return d;
};

export type FlowOpts = {
	job: string;
	entry: string;
	start: string;
	preconditions?: string[];
	readers?: (f: Flow) => Promise<void>;
	attempt?: number;
};

export async function runFlow(vp: Vp, a: Actor, o: FlowOpts, body: (f: Flow) => Promise<void>, others: Actor[] = []): Promise<FlowRecord> {
	const f = new Flow(vp, a, o.job, o.entry, o.start, o.preconditions);
	f.rec.attempts = o.attempt ?? 1;
	f.before = snapshot();
	for (const x of [a, ...others]) x.mutations.length = 0;
	console.log(`FLOW ${f.rec.id}`);
	try {
		await body(f);
	} catch (err) {
		f.rec.result = "fail";
		f.rec.failure = (err as Error).message.split("\n").slice(0, 3).join(" | ");
		await f.shot("failure").catch(() => {});
		console.log(`  FLOW FAIL ${f.rec.failure}`);
	}
	await a.settle();
	await a.page.waitForTimeout(1200);
	await f.popup().catch(() => {});
	const after = snapshot();
	const r = f.rec;
	const mine = f.participants ?? [`fx-${a.key}`];
	r.delta = diff(f.before, after).filter((c) => mine.some((m) => (c.owner ?? "").startsWith(m)));
	for (const c of r.delta) {
		const s = (r.deltaSummary[c.table] ??= { ins: 0, del: 0, upd: 0 });
		s[c.op === "insert" ? "ins" : c.op === "delete" ? "del" : "upd"]++;
	}
	r.mutations = [...a.mutations, ...others.flatMap((x) => x.mutations.map((m) => `${x.key}:${m}`))];
	const kinds = r.steps.map((s) => s.kind);
	r.counts = {
		actions: r.steps.length,
		navActions: kinds.filter((k) => k === "nav").length,
		taskActions: kinds.filter((k) => k !== "nav").length,
		fields: kinds.filter((k) => k === "field").length,
		screens: r.screens.length,
		decisions: r.decisions.length,
	};
	if (o.readers) {
		f.reading = true;
		const pre = snapshot();
		try {
			await o.readers(f);
		} catch (err) {
			f.observe("readersError", (err as Error).message.split("\n")[0]);
			console.log(`  READERS ERROR ${(err as Error).message.split("\n")[0]}`);
		}
		const mine2 = f.participants ?? [`fx-${a.key}`];
		const sideEffects = diff(pre, snapshot()).filter((c) => mine2.some((m) => (c.owner ?? "").startsWith(m)));
		if (sideEffects.length) f.observe("writesCausedByReading", sideEffects.map((c) => `${c.op} ${c.table}`));
	}
	writeFileSync(join(flowsDir(), `${r.id}.json`), JSON.stringify(r, null, "\t"));
	console.log(`  ${r.result} actions=${r.counts.actions} screens=${r.counts.screens} decisions=${r.counts.decisions} delta=${JSON.stringify(r.deltaSummary)}`);
	return r;
}

export const bodyText = (p: Page) => p.evaluate(() => document.body.innerText);
export const present = async (p: Page, needle: string) => (await bodyText(p)).toLowerCase().includes(needle.toLowerCase());
export const isLit = async (p: Page, label: string) =>
	(await arcade(p, label).getAttribute("class"))?.includes("0_0_60px") ?? false;

export type TitleRef = { type: "movie" | "tv"; id: number; name: string };

export async function ownReaders(f: Flow, t: TitleRef, note?: string): Promise<Record<string, unknown>> {
	const { a } = f;
	const p = a.page;
	const out: Record<string, unknown> = {};
	await a.goto(`/app/title/${t.type}/${t.id}`);
	await f.popup();
	await arcade(p, "Watched").waitFor({ timeout: 30000 });
	await a.settle();
	out.titleWatchedLit = await isLit(p, "Watched");
	out.titleBookmarkLit = await isLit(p, "Watchlist");
	out.titleHistorySection = await present(p, "Your Watch History");
	out.titleNoteVisible = note ? await present(p, note) : null;
	await f.shot("reader-title");
	await a.goto("/app/feed");
	await f.popup();
	out.feedOwn = await present(p, t.name);
	out.feedNote = note ? await present(p, note) : null;
	await f.shot("reader-feed");
	await a.goto(`/app/profile/${a.id}`);
	await f.popup();
	await a.settle();
	out.profileActivity = await present(p, t.name);
	out.profileNote = note ? await present(p, note) : null;
	out.profileStatsText = (await bodyText(p)).replace(/\s+/g, " ").match(/.{0,160}(watched|hours|Watch Time).{0,120}/i)?.[0] ?? null;
	await f.shot("reader-profile");
	await a.goto(`/app/profile/${a.id}`);
	await f.popup();
	await p.getByRole("button", { name: /journal/i }).first().click().catch(() => {});
	await a.settle();
	out.profileJournalTab = note ? await present(p, note) : await present(p, t.name);
	await f.shot("reader-profile-journal");
	if (t.type === "tv") {
		await a.goto("/app/tracker");
		await f.popup();
		out.trackerIndexText = (await bodyText(p)).replace(/\s+/g, " ").match(/Series Tracker.{0,200}/)?.[0] ?? null;
		await f.shot("reader-tracker-index");
		await p.getByRole("button", { name: "Journal" }).click();
		await a.settle();
		out.trackerJournalTab = note ? await present(p, note) : null;
		await f.shot("reader-tracker-journal");
		await a.goto(`/app/tracker/${t.id}`);
		await f.popup();
		out.trackerDetailNote = note ? await present(p, note) : null;
		out.trackerDetailProgress = (await bodyText(p)).replace(/\s+/g, " ").match(/\d+\s*\/\s*\d+/)?.[0] ?? null;
		await f.shot("reader-tracker-detail");
	}
	const pick = psql(`select id from watchlist where owner_id='${a.id}' and type='default'`)[0]?.[0];
	if (pick) {
		await a.goto(`/app/watchlists/${pick}`);
		await f.popup();
		out.myPicksHasTitle = await present(p, t.name);
		out.myPicksTick = await p.locator('button[title="Mark unwatched"]').count();
		await f.shot("reader-mypicks");
	}
	return out;
}

export async function friendReaders(f: Flow, viewer: Actor, owner: Actor, t: TitleRef, note?: string): Promise<Record<string, unknown>> {
	const p = viewer.page;
	const out: Record<string, unknown> = {};
	await viewer.goto("/app/feed");
	out.friendFeed = await present(p, t.name);
	out.friendFeedNote = note ? await present(p, note) : null;
	await capture(f.vp, viewer, `${f.rec.id}-friend-feed`).then((b) => f.rec.evidence.push(`${f.rec.journey}/${b}.png`));
	await viewer.goto(`/app/profile/${owner.id}`);
	await viewer.settle();
	out.friendProfile = await present(p, t.name);
	out.friendProfileNote = note ? await present(p, note) : null;
	await capture(f.vp, viewer, `${f.rec.id}-friend-profile`).then((b) => f.rec.evidence.push(`${f.rec.journey}/${b}.png`));
	await viewer.goto(`/app/title/${t.type}/${t.id}`);
	await viewer.settle();
	out.friendTitlePageMentionsOwner = await present(p, owner.username);
	await capture(f.vp, viewer, `${f.rec.id}-friend-title`).then((b) => f.rec.evidence.push(`${f.rec.journey}/${b}.png`));
	return out;
}
export const arcade = (p: Page, label: string) =>
	p.locator("div.text-center", { has: p.getByText(label, { exact: true }) }).getByRole("button");

const MAX_ATTEMPTS = 3;
const flowId = (job: string, entry: string) => `${job}--${entry}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function alreadyPassed(o: FlowOpts) {
	if (!process.env.FLOW_RESUME) return false;
	const file = join(flowsDir(), `${flowId(o.job, o.entry)}.json`);
	return existsSync(file) && JSON.parse(readFileSync(file, "utf8")).result !== "fail";
}
export type Ctx = { friend?: Actor };
export type HarnessFlow = FlowOpts & { friend?: boolean; friendReads?: boolean; start?: string };

export function harness(vp: Vp, prefix: string, args: string[], t: TitleRef | ((key: string) => TitleRef), reader: (f: Flow, t: TitleRef) => Promise<Record<string, unknown>>, note: string) {
	const filter = args[0];
	const failures: string[] = [];
	const signInFailures: string[] = [];
	const n = process.env.FLOW_SUFFIX ?? "";
	const flow = async (
		key: string,
		o: HarnessFlow,
		setup: (a: Actor, f: Flow, c: Ctx) => Promise<void>,
		body: (f: Flow, c: Ctx) => Promise<void>,
	) => {
		if (filter && !new RegExp(filter).test(key)) return;
		if (alreadyPassed(o)) return;
		const title = typeof t === "function" ? t(key) : t;
		let r: FlowRecord | undefined;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			const u = `${prefix}${key}${n}${attempt > 1 ? `a${attempt}` : ""}`.toLowerCase();
			const c: Ctx = {};
			if (o.friend) fixtureUser(`${u}pal`);
			fixtureUser(u, o.friend ? [`${u}pal`] : []);
			let a: Actor;
			try {
				a = await actor(vp, u);
				if (o.friend) c.friend = await actor(vp, `${u}pal`);
			} catch (e) {
				signInFailures.push(`${key} attempt ${attempt}: ${String(e).slice(0, 160)}`);
				continue;
			}
			r = await runFlow(vp, a, {
				...o,
				attempt,
				readers: async (f) => {
					if (f.rec.result === "fail" && attempt < MAX_ATTEMPTS) return;
					f.observe("readers", await reader(f, title));
					if (c.friend && o.friendReads !== false) f.observe("friendReaders", await friendReaders(f, c.friend, a, title, note));
					if (c.friend) {
						await c.friend.goto("/app/feed");
						await c.friend.page.getByRole("banner").getByRole("button").nth(1).click();
						await c.friend.settle();
						f.observe("friendNotifications", (await bodyText(c.friend.page)).replace(/\s+/g, " ").slice(0, 600));
					}
					await o.readers?.(f);
				},
			}, async (f) => {
				await setup(a, f, c);
				f.rec.steps = [];
				f.rec.screens = [];
				f.rec.decisions = [];
				f.rec.evidence = [];
				f.before = snapshot();
				a.mutations.length = 0;
				await a.goto("/app/search");
				await f.popup();
				f.rec.steps = [];
				f.screen("Search (landing)");
				await body(f, c);
				await f.shot("end");
			}, c.friend ? [c.friend] : []);
			await a.ctx.close();
			await c.friend?.ctx.close();
			if (r.result !== "fail") break;
		}
		if (!r) failures.push(`${key}: never signed in`);
		if (r?.result === "fail") failures.push(`${r.id}: ${r.failure}`);
	};
	return { flow, finish: () => { if (signInFailures.length) console.log(`sign-in retries:\n${signInFailures.join("\n")}`); if (failures.length) throw new Error(`failed flows:\n${failures.join("\n")}`); } };
}

export async function addToList(a: Actor, f: Flow, t: TitleRef, list: string) {
	await a.goto(`/app/title/${t.type}/${t.id}`);
	await f.popup();
	await a.goto(`/app/title/${t.type}/${t.id}`);
	await f.popup();
	const item = a.page.getByRole("button", { name: list, exact: true });
	for (let i = 0; i < 4 && !(await item.isVisible()); i++) {
		await arcade(a.page, "Watchlist").click();
		await a.page.waitForTimeout(900);
	}
	await item.click();
	await a.settle();
}
