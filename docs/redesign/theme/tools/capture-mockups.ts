// Captures the theme mock-ups and the current screens they replace into docs/redesign/theme/mockups/.
// Usage: verify-popcorn drive docs/redesign/theme/tools/capture-mockups.ts
// Needs the throwaway routes under src/routes/app/mock/ on the checked-out branch.
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import sharp from "sharp";
type Page = {
	url(): string;
	setViewportSize(size: { width: number; height: number }): Promise<void>;
	locator(selector: string): { waitFor(): Promise<void> };
	waitForLoadState(state: "networkidle"): Promise<void>;
	waitForTimeout(ms: number): Promise<void>;
	evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
	screenshot(options?: { fullPage?: boolean }): Promise<Buffer>;
};

type Vp = {
	page: Page;
	goto(path: string): Promise<void>;
	signIn(email?: string): Promise<string>;
	step(label: string): void;
	expect(cond: boolean, msg: string): void;
};

const OUT = new URL("../mockups/", import.meta.url).pathname;
const LIMIT = 400 * 1024;
const WIDTHS = [390, 1440];

const mocks = [
	{ name: "diary", path: "/app/mock/diary" },
	{ name: "title", path: "/app/mock/title" },
	{ name: "feed", path: "/app/mock/feed" },
	{ name: "feed-empty", path: "/app/mock/feed", state: "empty" },
];

const current = [
	{ name: "current-title", path: "/app/title/movie/603" },
	{ name: "current-feed", path: "/app/feed" },
];

export default async function captureMockups(vp: Vp) {
	const { page } = vp;
	mkdirSync(OUT, { recursive: true });

	await vp.goto("/app/feed");
	if (new URL(page.url()).pathname === "/login") await vp.signIn();

	async function imagesLoaded() {
		await page.waitForLoadState("networkidle");
		await page.evaluate(async () => {
			await Promise.all(
				Array.from(document.images).map((i) =>
					i.complete ? null : new Promise((r) => i.addEventListener("loadend", r, { once: true })),
				),
			);
			await document.fonts.ready;
			for (const el of Array.from(document.body.children).slice(1)) {
				if (el.tagName === "DIV") (el as HTMLElement).style.display = "none";
			}
		});
		await page.waitForTimeout(600);
	}

	async function save(file: string, png: Buffer) {
		let out = png;
		if (out.length > LIMIT) out = await sharp(png).png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
		if (out.length > LIMIT) out = await sharp(png).png({ palette: true, quality: 70, colours: 128, compressionLevel: 9 }).toBuffer();
		writeFileSync(`${OUT}${file}`, out);
		const kb = Math.round(statSync(`${OUT}${file}`).size / 1024);
		vp.expect(kb <= 400, `${file} is ${kb} KB, limit 400 KB`);
		vp.step(`saved ${file} (${kb} KB)`);
	}

	for (const width of WIDTHS) {
		for (const m of mocks) {
			for (const d of ["restrained", "literal"]) {
				await page.setViewportSize({ width, height: 900 });
				const qs = new URLSearchParams({ d, ...(m.state ? { state: m.state } : {}) });
				await vp.goto(`${m.path}?${qs}`);
				await page.locator(".pc-main").waitFor();
				await imagesLoaded();
				const height = await page.evaluate(() => document.querySelector(".pc")?.scrollHeight ?? 900);
				await page.setViewportSize({ width, height });
				await page.waitForTimeout(300);
				await save(`${m.name}-${d}@${width}.png`, await page.screenshot());
			}
		}
		for (const c of current) {
			await page.setViewportSize({ width, height: 900 });
			await vp.goto(c.path);
			await imagesLoaded();
			await page.waitForTimeout(1500);
			await save(`${c.name}@${width}.png`, await page.screenshot({ fullPage: true }));
		}
	}
}
