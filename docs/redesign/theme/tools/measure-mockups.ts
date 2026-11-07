// Measures the theme mock-ups for docs/redesign/theme/RECOMMENDATION.md.
// Usage: verify-popcorn drive docs/redesign/theme/tools/measure-mockups.ts
type Page = {
	url(): string;
	setViewportSize(size: { width: number; height: number }): Promise<void>;
	waitForTimeout(ms: number): Promise<void>;
	evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
};

type Vp = {
	page: Page;
	goto(path: string): Promise<void>;
	signIn(email?: string): Promise<string>;
	step(label: string): void;
};
export default async function measure(vp: Vp) {
	const { page } = vp;
	await vp.goto("/app/mock/diary");
	if (new URL(page.url()).pathname === "/login") await vp.signIn();
	const rows: string[] = [];
	for (const width of [390, 1440]) {
		await page.setViewportSize({ width, height: 844 });
		for (const screen of ["diary", "title", "feed"]) {
			for (const d of ["restrained", "literal"]) {
				await vp.goto(`/app/mock/${screen}?d=${d}`);
				await page.waitForTimeout(400);
				const m = await page.evaluate(() => {
					const pc = document.querySelector(".pc") as HTMLElement;
					const top = (document.querySelector(".pc-top") as HTMLElement).getBoundingClientRect().bottom;
					const add = Array.from(document.querySelectorAll(".pc-main .pc-btn--primary"))[0]?.getBoundingClientRect();
					const firstItem = document.querySelector(".pc-main .pc-row, .pc-main .pc-stub, .pc-main .pc-post, .pc-main .pc-entry")?.getBoundingClientRect();
					const notes = Array.from(document.querySelectorAll(".pc-note, .pc-postnote")).map((n) => n.getBoundingClientRect().width);
					const small = Array.from(document.querySelectorAll(".pc-main *")).filter((e) => e.children.length === 0 && (e.textContent ?? "").trim() && Number.parseFloat(getComputedStyle(e).fontSize) < 12).length;
					return { h: pc.scrollHeight, top: Math.round(top), add: add ? Math.round(add.bottom) : null, first: firstItem ? Math.round(firstItem.top) : null, note: notes.length ? Math.round(Math.min(...notes)) : null, small };
				});
				rows.push(`${width} ${screen} ${d} height=${m.h} primaryBottom=${m.add} firstItemTop=${m.first} narrowestNote=${m.note} textUnder12px=${m.small}`);
			}
		}
	}
	for (const r of rows) vp.step(r);
}
