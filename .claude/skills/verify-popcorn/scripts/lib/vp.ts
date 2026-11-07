// The `vp` object every journey receives. Journeys never import Playwright themselves.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, BrowserContext, Page } from "playwright-core";

const need = (k: string) => {
	const v = process.env[k];
	if (!v) throw new Error(`${k} not set; run journeys through 'verify-popcorn drive'`);
	return v;
};

export interface Vp {
	appUrl: string;
	page: Page;
	context: BrowserContext;
	/** Evidence dir for this journey: $EVIDENCE/<journey>/ */
	dir: string;
	/** Record a labelled step; goes to steps.log and stdout. */
	step(label: string): void;
	/** Assert; throws with the message (journey fails, evidence is still flushed). */
	expect(cond: unknown, message: string): void;
	/** Full-page screenshot + ARIA snapshot of <body>, named NN-<name>. */
	capture(name: string): Promise<void>;
	/** psql -At against the run's DB; returns rows as arrays of strings. Writes query+result to evidence. */
	sql(query: string, label?: string): string[][];
	/** Newest captured email for an address, waiting up to timeoutMs. */
	waitForMail(to: string, timeoutMs?: number): Promise<{ subject: string; link: string | null; html: string }>;
	/** Navigate and wait until React has hydrated (dev SSR pages ignore input until then). */
	goto(path: string): Promise<void>;
	/** Wait for network idle + React hydration on the current page. */
	settled(): Promise<void>;
	/** Sign in through the real /login UI + captured magic link. Returns the landing URL. */
	signIn(email?: string): Promise<string>;
}

export async function createVp(journey: string): Promise<{ vp: Vp; close: (ok: boolean) => Promise<void> }> {
	const appUrl = need("VP_APP_URL");
	const state = need("VP_STATE");
	const container = need("VP_CONTAINER");
	const mailDir = need("VP_MAIL_DIR");
	const dir = join(need("VP_EVIDENCE"), journey);
	mkdirSync(dir, { recursive: true });

	const { chromium } = (await import(need("VP_PLAYWRIGHT"))) as typeof import("playwright-core");
	const browser: Browser = await chromium.launch({ executablePath: need("VP_CHROMIUM") });
	const authFile = join(state, "auth.json");
	const context = await browser.newContext({
		baseURL: appUrl,
		viewport: { width: 1440, height: 900 },
		storageState: process.env.VP_FRESH_SESSION === "1" || !existsSync(authFile) ? undefined : authFile,
	});
	await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
	const page = await context.newPage();
	const consoleLog = join(dir, "console.log");
	page.on("console", (m) => appendFileSync(consoleLog, `[${m.type()}] ${m.text()}\n`));
	page.on("pageerror", (e) => appendFileSync(consoleLog, `[pageerror] ${e.message}\n`));

	let shot = 0;
	const stepsLog = join(dir, "steps.log");
	writeFileSync(stepsLog, `journey=${journey} app=${appUrl} started=${new Date().toISOString()}\n`);

	const vp: Vp = {
		appUrl,
		page,
		context,
		dir,
		step(label) {
			const line = `${new Date().toISOString()} STEP ${label}  (url=${page.url()})`;
			appendFileSync(stepsLog, `${line}\n`);
			console.log(line);
		},
		expect(cond, message) {
			if (!cond) {
				appendFileSync(stepsLog, `FAIL ${message}\n`);
				throw new Error(`expectation failed: ${message}`);
			}
			appendFileSync(stepsLog, `PASS ${message}\n`);
			console.log(`PASS ${message}`);
		},
		async capture(name) {
			const base = `${String(++shot).padStart(2, "0")}-${name}`;
			await page.screenshot({ path: join(dir, `${base}.png`), fullPage: true });
			writeFileSync(join(dir, `${base}.aria.yml`), await page.locator("body").ariaSnapshot());
			appendFileSync(stepsLog, `CAPTURE ${base} url=${page.url()}\n`);
		},
		sql(query, label = "query") {
			const out = execFileSync(
				"docker",
				["exec", container, "psql", "-h", "127.0.0.1", "-U", "popcorn", "-d", "popcorn_verify", "-At", "-F", "\t", "-c", query],
				{ encoding: "utf8" },
			);
			appendFileSync(join(dir, "db.log"), `-- ${label}\n${query}\n${out}\n`);
			return out
				.split("\n")
				.filter(Boolean)
				.map((r) => r.split("\t"));
		},
		async waitForMail(to, timeoutMs = 15000) {
			const deadline = Date.now() + timeoutMs;
			const startedAt = Date.now() - 1000;
			while (Date.now() < deadline) {
				const files = readdirSync(mailDir).filter((f) => f.endsWith(".json")).sort().reverse();
				for (const f of files) {
					if (Number(f.split("-")[0]) < startedAt) continue;
					const m = JSON.parse(readFileSync(join(mailDir, f), "utf8"));
					const rcpt = Array.isArray(m.to) ? m.to : [m.to];
					if (rcpt.includes(to)) {
						writeFileSync(join(dir, "mail.json"), JSON.stringify({ to: m.to, subject: m.subject, link: m.link }, null, 2));
						writeFileSync(join(dir, "mail.html"), m.html);
						return m;
					}
				}
				await new Promise((r) => setTimeout(r, 250));
			}
			throw new Error(`no email to ${to} within ${timeoutMs}ms (see 'verify-popcorn logs mail')`);
		},
		async settled() {
			await page.waitForLoadState("networkidle");
			// React tags hydrated DOM nodes with __reactFiber$*; SSR-only markup has none.
			await page.waitForFunction(
				() => {
					const el = document.querySelector("main, header, form, button, a");
					return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber"));
				},
				undefined,
				{ timeout: 60000 },
			);
		},
		async goto(path) {
			await page.goto(path);
			await vp.settled();
		},
		async signIn(email = "vera@popcorn.test") {
			await vp.goto("/login");
			await page.getByPlaceholder("you@email.com").fill(email);
			await page.getByRole("button", { name: "Send Magic Link" }).click();
			await page.getByRole("heading", { name: "Magic link sent!" }).waitFor();
			vp.step(`magic link requested for ${email}`);
			await vp.capture("magic-link-sent");
			const mail = await vp.waitForMail(email);
			vp.expect(mail.link?.startsWith(`${appUrl}/api/auth/magic-link/verify`), "email contains a magic-link verify URL for this instance");
			await page.goto(mail.link as string);
			await page.waitForURL((u) => !u.pathname.startsWith("/api/auth") && u.pathname !== "/login", { timeout: 30000 });
			await vp.settled();
			vp.step(`signed in as ${email}`);
			await context.storageState({ path: authFile });
			return page.url();
		},
	};

	const close = async (ok: boolean) => {
		await context.tracing.stop({ path: join(dir, "trace.zip") }).catch(() => {});
		if (!ok) await page.screenshot({ path: join(dir, "zz-failure.png"), fullPage: true }).catch(() => {});
		appendFileSync(stepsLog, `${ok ? "RESULT PASS" : "RESULT FAIL"} finished=${new Date().toISOString()}\n`);
		await browser.close();
	};
	return { vp, close };
}
