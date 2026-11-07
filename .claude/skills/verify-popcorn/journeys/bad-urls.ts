// Feature: server rendering, bad URLs and the sign-in return path.
// Usage: verify-popcorn drive bad-urls [viewportWidth]   (after `verify-popcorn login`)
// Each URL is a hard load. A case checks the document status, the server-rendered HTML,
// page errors and hydration errors in the browser, new errors in the server log, and the
// visible state. All cases run, then the journey fails if any case failed.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ConsoleMessage, Page } from "playwright-core";
import type { Vp } from "../scripts/lib/vp.ts";

const HYDRATION = /hydrat|did not match|switched to client rendering|react error #(418|423|425)/i;
const SERVER_ERROR = /error|is not defined|unhandled/i;

interface Case {
	name: string;
	path: string;
	status: number;
	ssrText?: string[];
	heading?: RegExp;
	finalPath?: string;
	darkPage?: boolean;
}

export default async function badUrls(vp: Vp, args: string[]) {
	const { page } = vp;
	if (args[0]) await page.setViewportSize({ width: Number(args[0]), height: 844 });
	const failures: string[] = [];
	const check = (cond: unknown, message: string) => {
		vp.step(`${cond ? "CHECK PASS" : "CHECK FAIL"} ${message}`);
		if (!cond) failures.push(message);
	};

	await vp.goto("/app/search");
	if (new URL(page.url()).pathname === "/login") await vp.signIn();

	vp.sql(
		`insert into watchlist (id, name, owner_id, is_public, type, created_at, updated_at)
		 values ('vp-wl-felix-private', 'Felix private', 'vp-user-felix', false, 'custom', now(), now())
		 on conflict (id) do nothing;
		 insert into watchlist_member (id, watchlist_id, user_id, role, created_at)
		 values ('vp-wlm-felix-private', 'vp-wl-felix-private', 'vp-user-felix', 'owner', now())
		 on conflict do nothing`,
		"fixture: a private watchlist owned by Felix, which Vera is not a member of",
	);
	const fixture = vp.sql(
		`select w.id, w.is_public, count(m.id) filter (where m.user_id = 'vp-user-vera')
		 from watchlist w left join watchlist_member m on m.watchlist_id = w.id
		 where w.id = 'vp-wl-felix-private' group by w.id, w.is_public`,
		"fixture check: private and Vera is not a member",
	);
	check(fixture[0]?.[1] === "f" && fixture[0]?.[2] === "0", "fixture: Felix's watchlist is private and Vera is not a member");
	const missing = vp.sql(
		`select (select count(*) from "user" where id = 'vp-user-nobody'), (select count(*) from watchlist where id = 'vp-wl-nobody')`,
		"the unknown profile and watchlist ids have no rows",
	);
	check(missing[0]?.[0] === "0" && missing[0]?.[1] === "0", "DB has no user vp-user-nobody and no watchlist vp-wl-nobody");

	const signedIn: Case[] = [
		{ name: "shuffle", path: "/app/shuffle", status: 200, ssrText: ["SHOWTIME SHUFFLE"] },
		{ name: "settings", path: "/app/settings", status: 200, ssrText: ["Settings", "Blocked Users"] },
		{ name: "settings-blocked", path: "/app/settings/blocked", status: 200, ssrText: ["Blocked Users"] },
		{ name: "title-movie", path: "/app/title/movie/603", status: 200, ssrText: ["The Matrix"], heading: /The Matrix/i },
		{ name: "profile-friend", path: "/app/profile/vp-user-felix", status: 200 },
		{ name: "title-unknown-id", path: "/app/title/movie/999999999", status: 404, heading: /Title not found/i },
		{ name: "title-bad-media-type", path: "/app/title/film/603", status: 404, heading: /Title not found/i },
		{ name: "title-non-numeric-id", path: "/app/title/movie/abc", status: 404, heading: /Title not found/i },
		{ name: "tracker-unknown-show", path: "/app/tracker/999999999", status: 404, heading: /Show not found/i },
		{ name: "tracker-non-numeric-id", path: "/app/tracker/abc", status: 404, heading: /Show not found/i },
		{ name: "profile-unknown", path: "/app/profile/vp-user-nobody", status: 404, heading: /User not found/i },
		{ name: "watchlist-unknown", path: "/app/watchlists/vp-wl-nobody", status: 404, heading: /Watchlist not found/i },
		{ name: "watchlist-other-private", path: "/app/watchlists/vp-wl-felix-private", status: 404, heading: /This watchlist is private/i },
		{ name: "unknown-app-path", path: "/app/does-not-exist", status: 404, heading: /Page not found/i, darkPage: true },
		{ name: "unknown-root-path", path: "/does-not-exist", status: 404, heading: /Page not found/i, darkPage: true },
		{ name: "login-when-signed-in", path: "/login", status: 200, finalPath: "/app/search" },
		{ name: "landing-when-signed-in", path: "/", status: 200, finalPath: "/app/search" },
	];
	for (const c of signedIn) await runCase(vp, c, check);

	vp.step("deep link while signed out: /app/title/movie/603 -> /login -> magic link -> back to the title");
	await vp.context.clearCookies();
	const deepLink = "/app/title/movie/603";
	await vp.goto(deepLink);
	const loginUrl = new URL(page.url());
	check(loginUrl.pathname === "/login", `signed-out deep link redirects to /login (got ${loginUrl.pathname})`);
	check(loginUrl.searchParams.get("redirect") === deepLink, `the login URL keeps the destination (redirect=${loginUrl.searchParams.get("redirect")})`);
	await page.getByPlaceholder("you@email.com").fill("vera@popcorn.test");
	await page.getByRole("button", { name: "Send Magic Link" }).click();
	await page.getByRole("heading", { name: "Magic link sent!" }).waitFor();
	const mail = await vp.waitForMail("vera@popcorn.test");
	const callback = mail.link ? new URL(mail.link).searchParams.get("callbackURL") : null;
	check(callback === deepLink, `the magic link carries the destination (callbackURL=${callback})`);
	await page.goto(mail.link as string);
	await page.waitForURL((u) => !u.pathname.startsWith("/api/auth") && u.pathname !== "/login", { timeout: 30000 });
	await vp.settled();
	check(new URL(page.url()).pathname === deepLink, `after the magic link the user lands on ${deepLink} (got ${new URL(page.url()).pathname})`);
	await page.getByRole("heading", { name: /The Matrix/i }).first().waitFor({ timeout: 30000 }).catch(() => {});
	await vp.capture("deep-link-landed");
	await vp.context.storageState({ path: join(process.env.VP_STATE as string, "auth.json") });

	vp.step(`${failures.length} failed check(s)`);
	vp.expect(failures.length === 0, `all bad-url checks pass (failed: ${failures.join(" | ") || "none"})`);
}

async function runCase(vp: Vp, c: Case, check: (cond: unknown, message: string) => void) {
	const { page } = vp;
	vp.step(`hard load ${c.path}`);
	const pageErrors: string[] = [];
	const hydrationErrors: string[] = [];
	const onPageError = (e: Error) => {
		pageErrors.push(e.message.slice(0, 200));
		if (HYDRATION.test(e.message)) hydrationErrors.push(e.message.slice(0, 200));
	};
	const onConsole = (m: ConsoleMessage) => {
		if (m.type() === "error" && HYDRATION.test(m.text())) hydrationErrors.push(m.text().slice(0, 200));
	};
	page.on("pageerror", onPageError);
	page.on("console", onConsole);
	const logBefore = serverLogSize();
	const res = await page.goto(c.path);
	const status = res?.status() ?? null;
	const html = (await res?.text().catch(() => "")) ?? "";
	await vp.settled().catch(() => {});
	await page.waitForTimeout(1500);
	page.off("pageerror", onPageError);
	page.off("console", onConsole);
	const newServerLog = serverLogSince(logBefore);

	check(status === c.status, `${c.name}: document status ${c.status} (got ${status})`);
	for (const text of c.ssrText ?? []) {
		check(visibleText(html).includes(text), `${c.name}: server-rendered HTML contains "${text}" (${html.length} bytes)`);
	}
	check(pageErrors.length === 0, `${c.name}: no page errors (${pageErrors.join(" | ") || "none"})`);
	check(hydrationErrors.length === 0, `${c.name}: no hydration errors (${hydrationErrors.length})`);
	const serverErrors = newServerLog.split("\n").filter((l) => SERVER_ERROR.test(l));
	check(serverErrors.length === 0, `${c.name}: no new server errors in the log (${serverErrors.slice(0, 2).join(" | ").slice(0, 300) || "none"})`);
	if (c.finalPath) {
		const path = new URL(page.url()).pathname;
		check(path === c.finalPath, `${c.name}: lands on ${c.finalPath} (got ${path})`);
	}
	if (c.heading) {
		const visible = await page
			.getByRole("heading", { name: c.heading })
			.first()
			.isVisible()
			.catch(() => false);
		check(visible, `${c.name}: heading ${c.heading} is visible`);
	}
	if (c.darkPage) {
		check((await centreLuminance(page)) < 0.2, `${c.name}: the page uses the app's dark theme`);
		const back = await page.getByRole("link", { name: /home|search|popcorn/i }).count();
		check(back > 0, `${c.name}: offers a link back into the app`);
	}
	await vp.capture(c.name);
}

function visibleText(html: string): string {
	const body = html.replace(/<head[\s\S]*?<\/head>/, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
	return body.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
}

function serverLogPath() {
	return join(process.env.VP_STATE as string, "app.log");
}

function serverLogSize(): number {
	try {
		return statSync(serverLogPath()).size;
	} catch {
		return 0;
	}
}

function serverLogSince(offset: number): string {
	try {
		return readFileSync(serverLogPath()).subarray(offset).toString("utf8");
	} catch {
		return "";
	}
}

async function centreLuminance(page: Page): Promise<number> {
	return page.evaluate(() => {
		let el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
		while (el) {
			const bg = getComputedStyle(el).backgroundColor;
			const m = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
			if (m && (m[4] === undefined || Number(m[4]) > 0.5)) {
				const [r, g, b] = [m[1], m[2], m[3]].map((v) => Number(v) / 255);
				return 0.2126 * r + 0.7152 * g + 0.0722 * b;
			}
			el = el.parentElement;
		}
		const root = getComputedStyle(document.documentElement).backgroundColor;
		return root === "rgba(0, 0, 0, 0)" ? 1 : 0;
	});
}
