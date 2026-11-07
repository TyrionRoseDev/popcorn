// Feature: phase-1 probe. Hold the review modal open across three poll ticks. Checks that polling does not close it.
// Usage: verify-popcorn drive probe-review-modal-poll
import type { Vp } from "../scripts/lib/vp.ts";
import { actor, arcade, fixtureUser } from "./flow-lib.ts";
export default async function (vp: Vp) {
	const key = `modal${Date.now().toString(36)}`;
	fixtureUser(key);
	const a = await actor(vp, key);
	const p = a.page;
	const t0 = Date.now();
	const log = (m: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
	p.on("load", () => log("LOAD"));
	p.on("framenavigated", (fr) => { if (fr === p.mainFrame()) log(`NAV ${fr.url().slice(-40)}`); });
	p.on("request", (r) => { if (/\/api\/trpc/.test(r.url()) && !/tmdb|title\./.test(r.url())) log(`REQ ${r.method()} ${r.url().split("/api/trpc/")[1].slice(0, 70)}`); });
	p.on("console", (m) => { if (/error|warn/i.test(m.type()) && !/Description|aria-describedby/.test(m.text())) log(`CONSOLE ${m.type()} ${m.text().slice(0, 130)}`); });
	await a.goto("/app/title/movie/603");
	await a.settle();
	const b = arcade(p, "Watched");
	await b.waitFor();
	await b.click();
	const d = p.getByRole("dialog", { name: "Review" });
	await d.waitFor();
	log("review open");
	await d.getByPlaceholder("Share your thoughts…").fill("typed text that must survive");
	await d.getByRole("button", { name: "Rate 4 stars" }).click();
	let open = true;
	for (let i = 0; i < 160; i++) {
		await p.waitForTimeout(500);
		const now = await d.isVisible().catch(() => false);
		if (now !== open) { open = now; log(`REVIEW DIALOG visible=${now}`); await vp.shot(`modal-${i}`).catch(() => {}); await p.screenshot({ path: `${vp.dir}/modal-closed-${i}.png` }); }
	}
	log(`end visible=${open} text=${await d.getByPlaceholder("Share your thoughts…").inputValue().catch(() => "gone")}`);
	await a.ctx.close();
}
