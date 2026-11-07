// Builds contact sheets from cells.jsonl so a reviewer can look at many cells at once.
// Usage: verify-popcorn drive <abs path>/inventory-sheets.ts [state] [width]
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Vp } from "../scripts/lib/vp.ts";
import { type Cell, createHarness, WIDTHS } from "./inventory-lib.ts";

const PER_SHEET: Record<number, { cols: number; rows: number; tileW: number; tileH: number }> = {
	390: { cols: 6, rows: 2, tileW: 256, tileH: 554 },
	1440: { cols: 3, rows: 4, tileW: 520, tileH: 325 },
};

export default async function sheets(vp: Vp, args: string[]) {
	const h = await createHarness(vp);
	const out = join(h.root, "sheets");
	mkdirSync(out, { recursive: true });
	const byId = new Map<string, Cell>();
	for (const line of readFileSync(join(h.root, "cells.jsonl"), "utf8").split("\n").filter(Boolean)) {
		const c = JSON.parse(line) as Cell;
		byId.set(c.id, c);
	}
	const cells = [...byId.values()].filter((c) => c.screenshot && (!args[0] || c.state === args[0]));
	const page = await vp.context.newPage();
	for (const width of WIDTHS.filter((w) => !args[1] || String(w) === args[1])) {
		const g = PER_SHEET[width];
		const per = g.cols * g.rows;
		const states = [...new Set(cells.map((c) => c.state))];
		for (const state of states) {
			const group = cells.filter((c) => c.state === state && c.width === width);
			for (let i = 0; i < group.length; i += per) {
				const chunk = group.slice(i, i + per);
				const tiles = chunk
					.map((c) => {
						const b64 = readFileSync(c.screenshot as string).toString("base64");
						const flags = [c.overflow ? "OVERFLOW" : "", c.consoleErrors.length ? `ERR${c.consoleErrors.length}` : ""].filter(Boolean).join(" ");
						return `<figure><figcaption>${c.slug} <b>${flags}</b> h=${c.pageHeight}</figcaption><div style="width:${g.tileW}px;height:${g.tileH}px;overflow:hidden;background:#222"><img src="data:image/png;base64,${b64}" style="width:${g.tileW}px;display:block"></div></figure>`;
					})
					.join("");
				await page.setViewportSize({ width: g.cols * (g.tileW + 8) + 8, height: 900 });
				await page.setContent(
					`<style>body{margin:4px;background:#000;color:#fff;font:12px monospace;display:grid;grid-template-columns:repeat(${g.cols},${g.tileW}px);gap:8px}figure{margin:0}figcaption{height:16px;overflow:hidden;white-space:nowrap}b{color:#f55}</style>${tiles}`,
					{ waitUntil: "load" },
				);
				const name = `${state}-${width}-${String(i / per + 1).padStart(2, "0")}.png`;
				await page.screenshot({ path: join(out, name), fullPage: true });
				console.log(join(out, name));
			}
		}
	}
	await page.close();
	await h.close();
}
