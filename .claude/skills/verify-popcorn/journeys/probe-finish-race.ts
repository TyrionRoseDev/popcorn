// Feature: phase-1 probe. Times Show Complete against the achievement popup, then taps Continue like a finger.
// Usage: verify-popcorn drive probe-finish-race
import type { Vp } from "../scripts/lib/vp.ts";
import { actor, arcade, fixtureUser, psql } from "./flow-lib.ts";
export default async function (vp: Vp) {
	for (const mode of ["slow", "fast"] as const) {
		const key = `race${mode}${Date.now().toString(36)}`;
		fixtureUser(key);
		const a = await actor(vp, key);
		const p = a.page;
		await p.emulateMedia({ reducedMotion: "no-preference" });
		await a.goto("/app/title/tv/87108");
		await arcade(p, "Watched").click();
		await p.waitForURL("**/app/tracker/87108");
		await a.settle();
		await p.waitForTimeout(3000);
		const curtain = p.locator('[role="dialog"]', { hasText: /Achievements? Unlocked/ }).first();
		if (await curtain.isVisible()) { await curtain.locator("button", { hasText: /continue/i }).click({ timeout: 8000 }); await curtain.waitFor({ state: "hidden" }); }
		const show = p.getByRole("dialog", { name: "Show Complete" });
		const t0 = Date.now();
		const ms = () => Date.now() - t0;
		await p.getByRole("button", { name: /Mark All/ }).first().click({ timeout: 15000 });
		await show.waitFor();
		console.log(mode, "show complete at", ms());
		const tapContinue = async (label: string) => {
			const b = await curtain.locator("button", { hasText: /continue/i }).boundingBox();
			if (!b) { console.log(mode, label, "no continue box"); return; }
			await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
			await p.waitForTimeout(2000);
			console.log(mode, label, "curtain=", await curtain.isVisible(), "dialogs=", JSON.stringify(await p.locator('[role="dialog"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 26)))));
		};
		if (mode === "fast") {
			const lr = p.getByRole("button", { name: /Leave a Review/ });
			await lr.waitFor();
			await p.waitForTimeout(400);
			const bb = await lr.boundingBox();
			console.log(mode, "tapping Leave a Review at", ms(), "curtainMounted", await curtain.count(), "curtainVisible", await curtain.isVisible());
			await p.touchscreen.tap(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2);
			await p.waitForTimeout(1500);
			const d = p.getByRole("dialog", { name: "Review" });
			console.log(mode, "after fast tap at", ms(), "reviewOpen", await d.isVisible(), "showComplete", await show.isVisible(), "curtain", await curtain.isVisible());
			if (await d.isVisible()) await d.getByPlaceholder("Share your thoughts…").fill("typed before the curtain");
		}
		await curtain.waitFor({ timeout: 20000 });
		console.log(mode, "curtain at", ms());
		await p.waitForTimeout(1500);
		await p.screenshot({ path: `${vp.dir}/${mode}-1-curtain.png` });
		await tapContinue("tap1");
		await p.screenshot({ path: `${vp.dir}/${mode}-2-after-tap1.png` });
		if (await curtain.isVisible()) { await tapContinue("tap2"); await p.screenshot({ path: `${vp.dir}/${mode}-3-after-tap2.png` }); }
		const d = p.getByRole("dialog", { name: "Review" });
		if (mode === "fast") console.log(mode, "review still open", await d.isVisible(), "text", await d.getByPlaceholder("Share your thoughts…").inputValue().catch(() => "gone"));
		await p.waitForTimeout(1000);
		console.log(mode, "rows", JSON.stringify({ we: psql(`select count(*) from watch_event where user_id='${a.id}'`)[0][0], reminders: psql(`select count(*) from watch_event where user_id='${a.id}' and review_reminder_at is not null`)[0][0], ntf: psql(`select type from notification where recipient_id='${a.id}'`).map((r) => r[0]) }));
		await a.goto("/app/tracker/87108");
		await p.waitForTimeout(2500);
		console.log(mode, "after reload review offer visible", await p.getByRole("button", { name: /Leave a Review/ }).isVisible().catch(() => false), "show complete", await show.isVisible());
		await p.screenshot({ path: `${vp.dir}/${mode}-4-after-reload.png` });
		await a.ctx.close();
	}
}
