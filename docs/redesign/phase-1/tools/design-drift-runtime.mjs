// Runtime probes for 05-design-drift.md, run against a disposable stack:
//   verify-popcorn drive $PWD/docs/redesign/phase-1/tools/design-drift-runtime.mjs
// Writes docs/redesign/phase-1/tools/design-drift-runtime.json once, at the end. Evidence PNGs stay in the run's evidence dir.
// Tailwind's Vite plugin scans the repo, so writing under docs/ mid-run can reload the page being measured.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "design-drift-runtime.json");
const TITLE = "/app/title/movie/603";

async function cascade(page) {
	return page.evaluate(() => {
		const links = [...document.querySelectorAll("a")].filter((a) => a.offsetParent);
		const coloured = links.filter((a) => /(^|\s)text-(cream|neon|white|drive)/.test(a.className));
		const lagoon = getComputedStyle(document.documentElement).getPropertyValue("--lagoon-deep").trim();
		const probe = document.createElement("a");
		probe.style.display = "none";
		document.body.append(probe);
		const anchorDefault = getComputedStyle(probe).color;
		probe.remove();
		const lost = coloured.filter((a) => getComputedStyle(a).color === anchorDefault);
		const timed = [...document.querySelectorAll("button, a")].filter(
			(el) => el.offsetParent && /(^|\s)(duration-|transition-all|transition-shadow|transition-opacity)/.test(el.className),
		);
		const sample = coloured.slice(0, 3).map((a) => ({
			text: a.textContent.trim().slice(0, 24),
			cls: a.className.slice(0, 90),
			color: getComputedStyle(a).color,
		}));
		const timedSample = timed.slice(0, 3).map((el) => ({
			tag: el.tagName,
			cls: el.className.slice(0, 90),
			duration: getComputedStyle(el).transitionDuration,
			property: getComputedStyle(el).transitionProperty,
		}));
		return {
			lagoon,
			anchorDefault,
			links: links.length,
			linksWithColourUtility: coloured.length,
			linksRenderingAnchorDefault: lost.length,
			timedControls: timed.length,
			timedControlsOverridden: timed.filter((el) => /background-color, color, border-color, transform/.test(getComputedStyle(el).transitionProperty)).length,
			sample,
			timedSample,
		};
	});
}

async function surfaces(page) {
	return page.evaluate(() => {
		const css = (el, p) => (el ? getComputedStyle(el)[p] : null);
		const root = document.documentElement;
		const shell = document.querySelector("#app > div, body > div");
		return {
			htmlClass: root.className,
			colorScheme: root.style.colorScheme,
			bodyBgColor: css(document.body, "backgroundColor"),
			bodyBgImage: (css(document.body, "backgroundImage") ?? "").slice(0, 80),
			bodyColor: css(document.body, "color"),
			shellBg: css(shell, "backgroundColor"),
		};
	});
}

async function contrast(page) {
	return page.evaluate(() => {
		const parse = (c) => {
			const m = c.match(/rgba?\(([^)]+)\)/);
			if (!m) return null;
			const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
			return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
		};
		const lum = ({ r, g, b }) => {
			const f = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
			return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
		};
		const over = (top, under) => ({
			r: top.r * top.a + under.r * (1 - top.a),
			g: top.g * top.a + under.g * (1 - top.a),
			b: top.b * top.a + under.b * (1 - top.a),
			a: 1,
		});
		const backdrop = (el) => {
			const stack = [];
			for (let n = el; n; n = n.parentElement) {
				const c = parse(getComputedStyle(n).backgroundColor);
				if (c && c.a > 0) {
					stack.push(c);
					if (c.a === 1) break;
				}
			}
			return stack.reverse().reduce((acc, c) => over(c, acc), { r: 5, g: 5, b: 8, a: 1 });
		};
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		const seen = new Set();
		const low = [];
		let total = 0;
		for (let n = walker.nextNode(); n; n = walker.nextNode()) {
			const el = n.parentElement;
			if (!el || seen.has(el) || !n.textContent.trim() || !el.offsetParent) continue;
			if (/^[\p{Extended_Pictographic}\s\uFE0F\u200D]+$/u.test(n.textContent)) continue;
			let painted = false;
			for (let a = el; a && a !== document.body; a = a.parentElement) {
				if (getComputedStyle(a).backgroundImage !== "none") painted = true;
				if ((parse(getComputedStyle(a).backgroundColor)?.a ?? 0) === 1) break;
			}
			if (painted) continue;
			if (el.closest("[class*=tsqd], [data-testid*=devtools], script, style")) continue;
			seen.add(el);
			const cs = getComputedStyle(el);
			const fg = parse(cs.color);
			if (!fg || Number(cs.opacity) === 0) continue;
			total++;
			const bg = backdrop(el);
			const text = over(fg, bg);
			const [hi, lo] = [lum(text), lum(bg)].sort((a, b) => b - a);
			const ratio = (hi + 0.05) / (lo + 0.05);
			if (ratio < 3) low.push({ ratio: Math.round(ratio * 100) / 100, text: n.textContent.trim().slice(0, 30), color: cs.color, tag: el.tagName, cls: String(el.className).slice(0, 70) });
		}
		return { total, below3: low.length, low: low.slice(0, 12) };
	});
}

async function navStates(page) {
	const link = page.locator("header nav a").nth(1);
	const active = page.locator("header nav a.active").first();
	const read = (l) => l.evaluate((a) => ({ text: a.textContent, color: getComputedStyle(a).color, border: getComputedStyle(a).borderBottomColor, cls: a.className.includes("active") }));
	const out = { rest: await read(link) };
	if (await active.count()) out.active = await read(active);
	await link.hover();
	await page.waitForTimeout(300);
	out.hover = await read(link);
	await page.mouse.move(0, 400);
	return out;
}

async function motion(page, ms = 2000) {
	return page.evaluate(async (windowMs) => {
		const touched = new Set();
		let mutations = 0;
		const obs = new MutationObserver((records) => {
			for (const r of records) {
				mutations++;
				touched.add(r.target);
			}
		});
		obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["style"] });
		const startAnims = document.getAnimations();
		await new Promise((r) => setTimeout(r, windowMs));
		obs.disconnect();
		const running = document.getAnimations().filter((a) => a.playState === "running");
		return {
			styleMutations: mutations,
			elementsMoved: touched.size,
			cssAnimationsAtStart: startAnims.length,
			runningAfterWindow: running.length,
			infinite: running.filter((a) => a.effect?.getTiming().iterations === Number.POSITIVE_INFINITY).length,
			names: [...new Set(running.map((a) => a.animationName ?? "waapi"))].slice(0, 20),
		};
	}, ms);
}

export default async function probe(vp) {
	const { page } = vp;
	const result = { cascade: {}, schemes: {}, reducedMotion: {} };
	try {
		await measure(vp, page, result);
	} finally {
		writeFileSync(OUT, `${JSON.stringify(result, null, "\t")}\n`);
	}
	vp.step(`wrote ${OUT}`);
}

async function measure(vp, page, result) {
	const visit = async (route, read) => {
		let last;
		for (let attempt = 0; attempt < 4; attempt++) {
			try {
				await vp.goto(route);
				return await read();
			} catch (err) {
				last = String(err).slice(0, 120);
				await page.waitForTimeout(2500);
			}
		}
		return { error: last };
	};

	await vp.goto("/app/search");
	if (new URL(page.url()).pathname === "/login") await vp.signIn();
	const owner = vp.sql(`select id from "user" where email = 'vera@popcorn.test'`, "acting user")[0][0];
	const routes = ["/app/search", "/app/feed", "/app/watchlists", "/app/friends", "/app/tracker", "/app/settings", `/app/profile/${owner}`, TITLE];

	vp.step("cascade: do unlayered a and button rules beat Tailwind utilities");
	await page.emulateMedia({ colorScheme: "dark" });
	for (const route of routes) {
		result.cascade[route] = await visit(route, () => cascade(page));
	}
	for (const scheme of ["light", "dark"]) {
		vp.step(`scheme ${scheme}`);
		await page.emulateMedia({ colorScheme: scheme });
		const s = (result.schemes[scheme] = { routes: {}, layers: {} });
		for (const route of ["/app/search", "/app/settings", TITLE]) {
			s.routes[route] = await visit(route, () => surfaces(page));
		}
		await vp.goto("/app/search");
		await vp.capture(`${scheme}-search`);
		s.nav = await navStates(page);
		s.contrast = {};
		for (const route of routes) {
			s.contrast[route] = await visit(route, () => contrast(page));
		}

		await vp.goto(TITLE);
		await vp.capture(`${scheme}-title`);
		const watchlistBtn = page.locator("div.text-center", { has: page.getByText("Watchlist", { exact: true }) }).getByRole("button");
		if (await watchlistBtn.count()) {
			await watchlistBtn.first().click();
			await page.waitForTimeout(500);
			s.layers.watchlistPopover = await page.evaluate(() => {
				const el = document.querySelector("[data-slot=popover-content], [data-radix-popper-content-wrapper] > *");
				if (!el) return null;
				const cs = getComputedStyle(el);
				return { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, cls: el.className.slice(0, 120) };
			});
			await vp.capture(`${scheme}-title-watchlist-layer`);
			await page.keyboard.press("Escape");
		}

		await vp.goto("/app/settings");
		await page.getByText("Bio", { exact: false }).first().click();
		await page.waitForTimeout(500);
		s.layers.settingsDialog = await page.evaluate(() => {
			const el = document.querySelector("[role=dialog]");
			if (!el) return null;
			const cs = getComputedStyle(el);
			const close = el.querySelector("[data-slot=dialog-close], button[class*=absolute]");
			return { bg: cs.backgroundColor, color: cs.color, closeColor: close ? getComputedStyle(close).color : null };
		});
		await vp.capture(`${scheme}-settings-dialog`);
		await page.keyboard.press("Escape");

		await vp.goto(TITLE);
		await page.getByRole("button", { name: /hid/i }).first().click({ timeout: 8000 });
		await page.waitForTimeout(400);
		const confirm = page.getByRole("dialog").getByRole("button", { name: /hide/i });
		if (await confirm.count()) await confirm.first().click();
		await page.waitForSelector("[data-sonner-toast]", { timeout: 8000 }).catch(() => {});
		await page.waitForTimeout(500);
		s.layers.toast = await page.evaluate(() => {
			const t = document.querySelector("[data-sonner-toast]");
			if (!t) return { present: false };
			const cs = getComputedStyle(t);
			return { present: true, theme: document.querySelector("[data-sonner-toaster]")?.getAttribute("data-sonner-theme"), bg: cs.backgroundColor, color: cs.color, text: t.textContent.slice(0, 40) };
		});
		await vp.capture(`${scheme}-toast`);
	}

	await page.emulateMedia({ colorScheme: "dark" });
	const motionRoutes = ["/app/search", "/app/shuffle", "/app/tracker", "/app/watchlists", `/app/profile/${owner}`, TITLE];
	for (const pref of ["no-preference", "reduce"]) {
		vp.step(`reduced motion: ${pref}`);
		await page.emulateMedia({ reducedMotion: pref, colorScheme: "dark" });
		result.reducedMotion[pref] = {};
		for (const route of motionRoutes) {
			const sample = await visit(route, async () => {
				await page.waitForTimeout(1500);
				return motion(page);
			});
			result.reducedMotion[pref][route] = { landedOn: new URL(page.url()).pathname, ...sample };
		}
	}
	result.entranceMotion = {};
	const browser = page.context().browser();
	const origin = new URL(page.url()).origin;
	const storageState = await page.context().storageState();
	const countWaapi = () => {
		const seen = new WeakSet();
		window.__waapi = 0;
		setInterval(() => {
			for (const a of document.getAnimations()) {
				if (a instanceof CSSAnimation || a instanceof CSSTransition || seen.has(a)) continue;
				seen.add(a);
				window.__waapi++;
			}
		}, 40);
	};
	for (const pref of ["no-preference", "reduce"]) {
		const out = (result.entranceMotion[pref] = {});
		const anonCtx = await browser.newContext({ baseURL: origin, reducedMotion: pref, colorScheme: "dark", viewport: { width: 1280, height: 800 } });
		await anonCtx.addInitScript(countWaapi);
		const landing = await anonCtx.newPage();
		await landing.goto("/", { waitUntil: "load", timeout: 90000 });
		await landing.waitForTimeout(4000);
		out.landingLoad = await landing.evaluate(() => window.__waapi);
		await landing.mouse.wheel(0, 900);
		await landing.waitForTimeout(1500);
		out.landingAfterScroll = await landing.evaluate(() => window.__waapi);
		await anonCtx.close();

		const ctx = await browser.newContext({ baseURL: origin, reducedMotion: pref, colorScheme: "dark", storageState, viewport: { width: 1280, height: 800 } });
		await ctx.addInitScript(countWaapi);
		const p = await ctx.newPage();
		await p.goto(`/app/profile/${owner}`, { waitUntil: "load", timeout: 90000 });
		await p.waitForTimeout(5000);
		out.profileLoad = await p.evaluate(() => window.__waapi);
		const before = out.profileLoad;
		await p.getByRole("button", { name: /journal/i }).first().click({ timeout: 4000 }).catch(() => {});
		await p.waitForTimeout(1200);
		out.profileTabSwitch = (await p.evaluate(() => window.__waapi)) - before;
		await ctx.close();
	}

	const anon = await page.context().browser().newContext({ baseURL: new URL(page.url()).origin, reducedMotion: "reduce", colorScheme: "light", viewport: { width: 1280, height: 800 } });
	const anonPage = await anon.newPage();
	result.anonymous = {};
	for (const route of ["/", "/login"]) {
		await anonPage.goto(route, { waitUntil: "load", timeout: 90000 });
		await anonPage.waitForTimeout(1200);
		const anonContrast = await contrast(anonPage);
		result.anonymous[route] = {
			lightSurfaces: await surfaces(anonPage),
			lightContrast: anonContrast,
			reduceMotion: await motion(anonPage),
		};
		await anonPage.screenshot({ path: join(vp.evidenceDir ?? dirname(OUT), `anon-light-${route === "/" ? "landing" : "login"}.png`) }).catch(() => {});
	}
	await anon.close();
	vp.step(`wrote ${OUT}`);
}
