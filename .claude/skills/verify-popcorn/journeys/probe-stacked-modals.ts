// Feature: phase-1 probe. Hit-tests the achievement popup stacked over Show Complete, with and without reduced motion.
// Usage: verify-popcorn drive probe-stacked-modals
import type { Vp } from "../scripts/lib/vp.ts";
import { actor, arcade, fixtureUser } from "./flow-lib.ts";
export default async function (vp: Vp) {
	for (const motion of ["no-preference", "reduce"] as const) {
		const key = `trap${motion[0]}${Date.now().toString(36)}`;
		fixtureUser(key);
		const a = await actor(vp, key);
		const p = a.page;
		await p.emulateMedia({ reducedMotion: motion });
		await a.goto("/app/title/tv/87108");
		await arcade(p, "Watched").click();
		await p.waitForURL("**/app/tracker/87108");
		await a.settle();
		await p.waitForTimeout(3000);
		const first = p.locator('[role="dialog"]', { hasText: /Achievements? Unlocked/ }).first();
		if (await first.isVisible()) { await first.locator("button", { hasText: /continue/i }).click({ timeout: 8000 }); await first.waitFor({ state: "hidden" }); console.log(motion, "cleared first popup"); }
		await p.getByRole("button", { name: /Mark All/ }).first().click({ timeout: 15000 });
		await p.waitForTimeout(6000);
		const probe = () => p.evaluate(() => {
			const dialogs = [...document.querySelectorAll('[role="dialog"]')].map((d) => {
				const cs = getComputedStyle(d);
				let z = "", n: Element | null = d;
				while (n && n !== document.body) { const v = getComputedStyle(n).zIndex; if (v !== "auto") { z = v; break; } n = n.parentElement; }
				return { text: (d as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 34), pe: cs.pointerEvents, z, hidden: d.closest("[aria-hidden=true]") ? true : false, state: d.getAttribute("data-state") };
			});
			const c = [...document.querySelectorAll('[role="dialog"] button')].find((b) => /continue/i.test((b as HTMLElement).innerText)) as HTMLElement | undefined;
			if (!c) return { dialogs, body: getComputedStyle(document.body).pointerEvents, cont: null };
			const r = c.getBoundingClientRect();
			const x = r.x + r.width / 2, y = r.y + r.height / 2;
			const top = document.elementFromPoint(x, y) as HTMLElement | null;
			return { dialogs, body: getComputedStyle(document.body).pointerEvents, cont: { x, y, w: r.width, h: r.height, pe: getComputedStyle(c).pointerEvents, disabled: (c as HTMLButtonElement).disabled, top: top ? `${top.tagName}.${String(top.className).slice(0, 60)}` : null, same: top === c || c.contains(top) } };
		});
		const s1 = await probe();
		console.log(motion, "STATE", JSON.stringify(s1));
		await p.screenshot({ path: `${vp.dir}/${motion}-1-stacked.png` });
		if (s1.cont) {
			await p.touchscreen.tap(s1.cont.x, s1.cont.y);
			await p.waitForTimeout(2500);
			const s2 = await probe();
			console.log(motion, "AFTER TAP", JSON.stringify({ dialogs: s2.dialogs.map((d) => d.text), cont: !!s2.cont }));
			await p.screenshot({ path: `${vp.dir}/${motion}-2-after-tap.png` });
			if (s2.cont) {
				await p.keyboard.press("Escape");
				await p.waitForTimeout(2000);
				const s3 = await probe();
				console.log(motion, "AFTER ESC", JSON.stringify({ dialogs: s3.dialogs.map((d) => d.text), cont: !!s3.cont }));
				await p.screenshot({ path: `${vp.dir}/${motion}-3-after-esc.png` });
			}
		}
		await a.ctx.close();
	}
}
