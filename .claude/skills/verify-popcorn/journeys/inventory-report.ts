// Merges raw cells with the human review and prints the counts. Plain bun, no browser:
//   bun journeys/inventory-report.ts <evidence inventory dir> <review tsv> <out json> <out matrix md>
// Review tsv columns: pattern (state/slug@width, * allowed), designed class, note. The last matching line wins.
import { readFileSync, writeFileSync } from "node:fs";

type Class = "designed" | "generic" | "blank" | "broken" | "not applicable";
interface Raw { id: string; state: string; slug: string; route: string; width: number; reached: boolean; failure: string | null; screenshot: string | null;
	consoleErrors: string[]; overflow: boolean; scrollWidth: number; retried: boolean; [k: string]: unknown }

const [dir, reviewPath, outJson, outMd] = process.argv.slice(2);
const byId = new Map<string, Raw>();
for (const line of readFileSync(`${dir}/cells.jsonl`, "utf8").split("\n").filter(Boolean)) {
	const c = JSON.parse(line) as Raw;
	const previous = byId.get(c.id);
	if (previous && !c.reached && previous.reached) continue;
	byId.set(c.id, c);
}

const rules = readFileSync(reviewPath, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => {
	const [pattern, cls, note = ""] = l.split("\t");
	const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
	return { pattern, re, cls: cls as Class | "not reached", note };
});

const synthetic = rules.filter((r) => !r.pattern.includes("*") && !byId.has(r.pattern));
for (const r of synthetic) {
	const [state, rest] = r.pattern.split("/");
	const [slug, width] = rest.split("@");
	byId.set(r.pattern, { id: r.pattern, state, slug, route: slug, width: Number(width), reached: false, failure: r.note, screenshot: null, consoleErrors: [], overflow: false, scrollWidth: 0, retried: false });
}

const cells = [...byId.values()].map((c) => {
	const hit = rules.filter((r) => r.re.test(c.id)).at(-1);
	const designed = !c.reached && hit?.cls !== "not applicable" ? "not reached" : (hit?.cls ?? "unreviewed");
	return { ...c, designed, note: hit?.note ?? "" };
});

const tally = (key: (c: (typeof cells)[number]) => string) => {
	const t: Record<string, number> = {};
	for (const c of cells) t[key(c)] = (t[key(c)] ?? 0) + 1;
	return t;
};
const counts = {
	total: cells.length,
	byClass: tally((c) => c.designed),
	byState: tally((c) => c.state),
	overflowAt390: cells.filter((c) => c.width === 390 && c.overflow).length,
	cellsWithConsoleErrors: cells.filter((c) => c.consoleErrors.length > 0).length,
	retried: cells.filter((c) => c.retried).length,
};
writeFileSync(outJson, JSON.stringify({ counts, cells }, null, 1));

const rows = cells
	.sort((a, b) => a.state.localeCompare(b.state) || a.slug.localeCompare(b.slug) || a.width - b.width)
	.map((c) => `| ${c.route} | ${c.state} | ${c.slug} | ${c.width} | ${c.designed} | ${c.consoleErrors.length} | ${c.width === 390 ? (c.overflow ? `yes (${c.scrollWidth})` : "no") : "n/a"} | ${c.screenshot ?? ""} | ${c.retried ? "retried. " : ""}${c.note.replace(/\|/g, "/")} |`);
writeFileSync(outMd, ["| Route | State | Cell | Width | Designed state | Console errors | Overflow at 390 | Screenshot | Note |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |", ...rows].join("\n"));
console.log(JSON.stringify(counts, null, 1));
console.log("unreviewed:", cells.filter((c) => c.designed === "unreviewed").map((c) => c.id).join(" "));
