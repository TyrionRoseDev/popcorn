#!/usr/bin/env bun
/**
 * Validates every file:line anchor in findings.data.ts, then counts findings.
 *
 *   bun docs/redesign/phase-1/tools/audit-findings.ts            counts, render into 04-logic-audit.md
 *   bun docs/redesign/phase-1/tools/audit-findings.ts --anchors  also print each anchored source line
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { FILES, FINDINGS, type Finding, type Severity, type Tag } from "./findings.data";

const tools = dirname(new URL(import.meta.url).pathname);
const root = resolve(tools, "../../../..");
const report = join(tools, "..", "04-logic-audit.md");
const showAnchors = process.argv.includes("--anchors");

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const TAGS: Tag[] = ["SPLIT", "DENORM", "NO-DOMAIN-LAYER", "PRIVACY", "FEATURE-OVERLAP", "MISSING-STATE", "BUG", "VOCAB", "OTHER"];
const WEIGHT: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const expand = (cite: string) => {
	const [alias, line] = cite.split(":");
	return { path: FILES[alias], line: Number(line) };
};

let broken = 0;
for (const finding of FINDINGS) {
	for (const cite of finding.cites) {
		const { path, line } = expand(cite);
		if (!path || !existsSync(join(root, path))) {
			console.log(`BROKEN ${finding.id} ${cite}: no such file`);
			broken++;
			continue;
		}
		const lines = readFileSync(join(root, path), "utf8").split("\n");
		if (line < 1 || line > lines.length) {
			console.log(`BROKEN ${finding.id} ${cite}: past end of file`);
			broken++;
		} else if (showAnchors) {
			console.log(`${finding.id} ${cite}\t${lines[line - 1].trim().slice(0, 96)}`);
		}
	}
}

const ids = FINDINGS.map((f) => f.id);
if (new Set(ids).size !== ids.length) throw new Error("duplicate finding id");

const weight = (list: Finding[]) => list.reduce((sum, f) => sum + WEIGHT[f.sev], 0);
const visible = FINDINGS.filter((f) => f.visible);
const pct = (part: number, whole: number) => `${((100 * part) / whole).toFixed(1)}%`;
const has = (f: Finding, tag: Tag) => f.tag === tag || (f.also ?? []).includes(tag);

const matrix = [
	`| Tag | ${SEVERITIES.join(" | ")} | total | user-noticeable |`,
	"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
	...TAGS.map((tag) => {
		const list = FINDINGS.filter((f) => f.tag === tag);
		const cells = SEVERITIES.map((s) => list.filter((f) => f.sev === s).length);
		return `| ${tag} | ${cells.join(" | ")} | ${list.length} | ${list.filter((f) => f.visible).length} |`;
	}),
	`| All | ${SEVERITIES.map((s) => FINDINGS.filter((f) => f.sev === s).length).join(" | ")} | ${FINDINGS.length} | ${visible.length} |`,
];

const share = [
	"| Tag | Primary, of noticeable | Primary or secondary | Severity-weighted share |",
	"| --- | ---: | ---: | ---: |",
	...TAGS.map((tag) => {
		const primary = visible.filter((f) => f.tag === tag);
		const either = visible.filter((f) => has(f, tag));
		return `| ${tag} | ${primary.length} (${pct(primary.length, visible.length)}) | ${either.length} (${pct(either.length, visible.length)}) | ${pct(weight(primary), weight(visible))} |`;
	}),
];

const NAMES = ["Unify the five tables only", "Derive watched from the log, drop watchlist_item state", "One shared domain layer only"];
const counterfactual = [
	"| Intervention | Resolves | Partly | Untouched | Resolves, high or critical only |",
	"| --- | ---: | ---: | ---: | ---: |",
	...NAMES.map((name, i) => {
		const n = (v: string, list = visible) => list.filter((f) => f.fix[i] === v).length;
		const serious = visible.filter((f) => f.sev === "high" || f.sev === "critical");
		return `| ${name} | ${n("y")} | ${n("p")} | ${n("n")} | ${n("y", serious)} of ${serious.length} |`;
	}),
];

const PLANS: [string, number[]][] = [
	["Unify the five and derive watched", [0, 1]],
	["All three", [0, 1, 2]],
];
const planRows = PLANS.map(([name, parts]) => {
	const solved = (f: Finding) => parts.some((i) => f.fix[i] === "y");
	const touched = (f: Finding) => parts.some((i) => f.fix[i] !== "n");
	const serious = visible.filter((f) => f.sev === "high" || f.sev === "critical");
	const yes = visible.filter(solved).length;
	const part = visible.filter((f) => touched(f) && !solved(f)).length;
	return `| ${name} | ${yes} | ${part} | ${visible.length - yes - part} | ${serious.filter(solved).length} of ${serious.length} |`;
});
counterfactual.push(...planRows);

const serious = visible.filter((f) => f.sev === "high" || f.sev === "critical");
const countTag = (list: Finding[], ...tags: Tag[]) => list.filter((f) => tags.includes(f.tag)).length;
const touchedByUnify = visible.filter((f) => f.fix[0] !== "n").length;
const sensitivity = [
	"| Reading of 'traces to SPLIT' | Noticeable findings | Share |",
	"| --- | ---: | ---: |",
	`| Primary tag SPLIT | ${countTag(visible, "SPLIT")} of ${visible.length} | ${pct(countTag(visible, "SPLIT"), visible.length)} |`,
	`| Primary or secondary SPLIT | ${visible.filter((f) => has(f, "SPLIT")).length} of ${visible.length} | ${pct(visible.filter((f) => has(f, "SPLIT")).length, visible.length)} |`,
	`| Any finding unifying the five would at least partly help | ${touchedByUnify} of ${visible.length} | ${pct(touchedByUnify, visible.length)} |`,
	`| SPLIT primary, high or critical only | ${countTag(serious, "SPLIT")} of ${serious.length} | ${pct(countTag(serious, "SPLIT"), serious.length)} |`,
	`| SPLIT plus DENORM, the hypothesis widened to six stores | ${countTag(visible, "SPLIT", "DENORM")} of ${visible.length} | ${pct(countTag(visible, "SPLIT", "DENORM"), visible.length)} |`,
	`| SPLIT plus DENORM, high or critical only | ${countTag(serious, "SPLIT", "DENORM")} of ${serious.length} | ${pct(countTag(serious, "SPLIT", "DENORM"), serious.length)} |`,
	`| For comparison, DENORM plus NO-DOMAIN-LAYER | ${countTag(visible, "DENORM", "NO-DOMAIN-LAYER")} of ${visible.length} | ${pct(countTag(visible, "DENORM", "NO-DOMAIN-LAYER"), visible.length)} |`,
	`| For comparison, PRIVACY, high or critical only | ${countTag(serious, "PRIVACY")} of ${serious.length} | ${pct(countTag(serious, "PRIVACY"), serious.length)} |`,
];

const link = (cite: string) => {
	const { path, line } = expand(cite);
	return `\`${path.replace("src/integrations/trpc/routers/", "routers/").replace("src/", "")}:${line}\``;
};
const entry = (f: Finding) =>
	[
		`#### ${f.id}. ${f.title}`,
		"",
		`${f.sev}, ${f.tag}${f.also ? ` (also ${f.also.join(", ")})` : ""}, ${f.visible ? "user-noticeable" : "not user-noticeable"}, ${f.label}${f.wtOnly ? ", working tree only" : ""}.`,
		"",
		f.scenario,
		"",
		f.cites.map(link).join(", "),
		"",
	].join("\n");

const body = SEVERITIES.map((sev) => {
	const list = FINDINGS.filter((f) => f.sev === sev);
	return [`### ${sev[0].toUpperCase()}${sev.slice(1)} (${list.length})`, "", ...list.map(entry)].join("\n");
}).join("\n");

const blocks: Record<string, string> = {
	matrix: matrix.join("\n"),
	share: share.join("\n"),
	counterfactual: counterfactual.join("\n"),
	sensitivity: sensitivity.join("\n"),
	findings: body,
};

if (existsSync(report)) {
	let text = readFileSync(report, "utf8");
	for (const [name, block] of Object.entries(blocks)) {
		text = text.replace(
			new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`),
			(_, open, close) => `${open}\n${block}\n${close}`,
		);
	}
	writeFileSync(report, text);
}

const cites = FINDINGS.reduce((sum, f) => sum + f.cites.length, 0);
console.log(`${FINDINGS.length} findings, ${cites} anchors, ${broken} broken`);
console.log(blocks.matrix);
console.log(blocks.share);
console.log(blocks.counterfactual);
console.log(blocks.sensitivity);
process.exit(broken ? 1 : 0);
