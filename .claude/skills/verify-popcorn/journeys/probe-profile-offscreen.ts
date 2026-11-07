// Feature: phase-1 probe. Measures the profile log menu position at 390 wide and at 1280.
// Usage: verify-popcorn drive probe-profile-offscreen
import type { Vp } from "../scripts/lib/vp.ts";
import { actor, arcade, fixtureUser } from "./flow-lib.ts";
export default async function (vp: Vp) {
	const key = `prof${Date.now().toString(36)}`;
	fixtureUser(key);
	const a = await actor(vp, key);
	const p = a.page;
	await a.goto("/app/title/movie/603");
	await a.settle();
	await arcade(p, "Watched").click();
	const d = p.getByRole("dialog", { name: "Review" });
	await d.waitFor();
	await d.getByRole("button", { name: "Rate 4 stars" }).click();
	await d.getByRole("button", { name: /^Public/ }).click();
	await d.getByRole("button", { name: "Save & Done" }).click();
	await d.waitFor({ state: "hidden" });
	await a.goto(`/app/profile/${a.id}`);
	await p.waitForTimeout(3000);
	const curtain = p.locator('[role="dialog"]', { hasText: /Achievements? Unlocked/ }).first();
	console.log("curtain", await curtain.isVisible());
	const dump = () => p.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.querySelector("svg")).map((b) => {
		const r = b.getBoundingClientRect(); const svg = b.querySelector("svg")!;
		return { svg: String(svg.getAttribute("class")).slice(0, 44), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: getComputedStyle(b).visibility, op: getComputedStyle(b).opacity };
	}).filter((o) => /ellipsis|more/i.test(o.svg)));
	console.log(JSON.stringify(await dump()));
	if (await curtain.isVisible()) {
		const b = await curtain.locator("button", { hasText: /continue/i }).boundingBox();
		console.log("continueBox", JSON.stringify(b), "viewport", JSON.stringify(p.viewportSize()), "scrollY", await p.evaluate(() => scrollY));
		await p.screenshot({ path: `${vp.dir}/viewport-curtain.png` });
		if (b) await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
		await p.waitForTimeout(1500);
		console.log("after tap curtain", await curtain.isVisible());
	}
	await p.waitForTimeout(1500);
	const report = () => p.evaluate(() => {
		const b = document.querySelector("button:has(svg.lucide-ellipsis)") as HTMLElement;
		const chain: string[] = [];
		for (let n: HTMLElement | null = b; n && n !== document.body; n = n.parentElement) {
			const cs = getComputedStyle(n); const r = n.getBoundingClientRect();
			if (chain.length < 9 || cs.overflowX !== "visible") chain.push(`${n.tagName.toLowerCase()} x=${Math.round(r.x)} w=${Math.round(r.width)} sw=${n.scrollWidth} ox=${cs.overflowX} tf=${cs.transform === "none" ? "" : cs.transform.slice(0, 30)} ${String(n.className).slice(0, 46)}`);
		}
		return { btn: b.getBoundingClientRect().toJSON(), docW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth, winW: innerWidth, chain };
	});
	const r1 = await report();
	console.log(JSON.stringify({ btn: { x: r1.btn.x, y: r1.btn.y }, docW: r1.docW, bodyW: r1.bodyW, winW: r1.winW }));
	for (const l of r1.chain) console.log("  ", l);
	await p.evaluate(() => (document.querySelector("button:has(svg.lucide-ellipsis)") as HTMLElement).scrollIntoView({ block: "center", inline: "nearest" }));
	await p.waitForTimeout(800);
	const r2 = await report();
	console.log("after scrollIntoView", JSON.stringify({ x: r2.btn.x, y: r2.btn.y, sx: await p.evaluate(() => scrollX) }));
	await p.screenshot({ path: `${vp.dir}/card-in-viewport.png` });
	const panel = () => p.evaluate(() => {
		const b = document.querySelector("button:has(svg.lucide-ellipsis)") as HTMLElement;
		const s = b.closest(".overflow-y-auto") as HTMLElement;
		const clip = s.parentElement as HTMLElement;
		const card = (b.closest(".rounded-\\[10px\\]") ?? b.parentElement) as HTMLElement;
		const box = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
		return { scroller: box(s), clientH: s.clientHeight, scrollH: s.scrollHeight, overflowY: getComputedStyle(s).overflowY, parent: box(clip), card: box(card) };
	});
	console.log("panel at 390", JSON.stringify(await panel()));
	await p.locator("button:has(svg.lucide-ellipsis)").evaluate((b) => (b.closest(".overflow-y-auto") as HTMLElement).scrollIntoView({ block: "center" }));
	await p.waitForTimeout(600);
	await p.screenshot({ path: `${vp.dir}/panel-390.png` });
	await p.setViewportSize({ width: 1280, height: 900 });
	await p.waitForTimeout(1500);
	console.log("panel at 1280", JSON.stringify(await panel()));
	await p.screenshot({ path: `${vp.dir}/panel-1280.png` });
	const r3 = await report();
	console.log("at 1280", JSON.stringify({ x: r3.btn.x, y: r3.btn.y, docW: r3.docW }));
	await a.ctx.close();
}
