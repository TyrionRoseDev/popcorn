#!/usr/bin/env bun
// Design-token budget. Counts three kinds of hits in src/ (outside src/components/ui, src/emails,
// tests and the token blocks of src/styles.css) and fails when any count rises above
// scripts/token-budget.json, printing file:line for each hit the budget does not cover.
//
//   bun scripts/token-budget.ts            check
//   bun scripts/token-budget.ts --update   rewrite the budget to today's hits; refuses to raise a count
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");
const BUDGET_FILE = join(ROOT, "scripts/token-budget.json");
const TOKEN_CSS = "src/styles.css";
const EXCLUDED = [/^src\/components\/ui\//, /^src\/emails\//, /\/__tests__\//, /\.test\.tsx?$/, /^src\/routeTree\.gen\.ts$/];

const KINDS = ["rawColour", "arbitraryValue", "inlineStyleColour"] as const;
type Kind = (typeof KINDS)[number];
type Hit = { kind: Kind; file: string; line: number; text: string };
type Baseline = Record<Kind, Record<string, string[]>>;
type Budget = { totals: Record<Kind, number>; hits: Baseline };

// From docs/redesign/phase-1/tools/design-drift.ts.
const COLOUR_RE =
	/(?<![\w&/#-])(?<!url\()#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab)\([^()]*\)/g;
const ARBITRARY_RE = /(?<![\w$])-?[a-z][a-z0-9-]*-\[[^\]\s]+\](?:\/[\w.[\]]+)?/g;
const STYLE_COLOUR_PROP = /^(color|background(Color|Image)?|border(Top|Right|Bottom|Left)?Color|outlineColor|fill|stroke|(box|text)Shadow|caretColor|accentColor|textDecorationColor)$/;
const TOKEN_ONLY = /^var\(--[\w-]+\)$/;

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const path = join(dir, e.name);
		if (e.isDirectory()) return sourceFiles(path);
		return /\.(tsx?|css)$/.test(e.name) ? [path] : [];
	});
}

function textHits(kind: Kind, re: RegExp, text: string, file: string, lineAt: (offset: number) => number): Hit[] {
	return [...text.matchAll(re)].map((m) => ({ kind, file, line: lineAt(m.index), text: m[0] }));
}

function scanTs(file: string, source: string): Hit[] {
	const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
	const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
	const hits: Hit[] = [];
	const visit = (node: ts.Node) => {
		if (
			ts.isStringLiteral(node) ||
			ts.isNoSubstitutionTemplateLiteral(node) ||
			ts.isTemplateHead(node) ||
			ts.isTemplateMiddle(node) ||
			ts.isTemplateTail(node)
		) {
			const start = node.getStart(sf) + 1;
			const lineAt = (offset: number) => lineOf(start + offset);
			hits.push(...textHits("rawColour", COLOUR_RE, node.text, file, lineAt));
			hits.push(...textHits("arbitraryValue", ARBITRARY_RE, node.text, file, lineAt));
		}
		if (
			ts.isJsxAttribute(node) &&
			node.name.getText(sf) === "style" &&
			node.initializer &&
			ts.isJsxExpression(node.initializer) &&
			node.initializer.expression &&
			ts.isObjectLiteralExpression(node.initializer.expression)
		) {
			for (const prop of node.initializer.expression.properties) {
				if (!ts.isPropertyAssignment(prop) || !STYLE_COLOUR_PROP.test(prop.name.getText(sf))) continue;
				const value = prop.initializer;
				if (ts.isStringLiteralLike(value) && TOKEN_ONLY.test(value.text)) continue;
				hits.push({ kind: "inlineStyleColour", file, line: lineOf(prop.getStart(sf)), text: prop.getText(sf).replace(/\s+/g, " ") });
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return hits;
}

function scanCss(file: string, source: string): Hit[] {
	const lines = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).split("\n");
	const skip = new Set<number>();
	if (file === TOKEN_CSS) {
		for (const start of [/^:root\s*{/, /^\.dark\s*{/, /^@theme inline\s*{/]) {
			let depth = 0;
			for (let i = lines.findIndex((l) => start.test(l)); i >= 0 && i < lines.length; i++) {
				skip.add(i);
				depth += (lines[i].match(/{/g) ?? []).length - (lines[i].match(/}/g) ?? []).length;
				if (depth === 0) break;
			}
		}
	}
	return lines.flatMap((line, i) => {
		if (skip.has(i) || line.startsWith("@import")) return [];
		const at = () => i + 1;
		return [...textHits("rawColour", COLOUR_RE, line, file, at), ...textHits("arbitraryValue", ARBITRARY_RE, line, file, at)];
	});
}

function scan(): Hit[] {
	return sourceFiles(SRC)
		.map((path) => relative(ROOT, path))
		.filter((file) => !EXCLUDED.some((re) => re.test(file)))
		.sort()
		.flatMap((file) => {
			const source = readFileSync(join(ROOT, file), "utf8");
			return file.endsWith(".css") ? scanCss(file, source) : scanTs(file, source);
		});
}

function toBudget(hits: Hit[]): Budget {
	const totals = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>;
	const baseline = Object.fromEntries(KINDS.map((k) => [k, {}])) as Baseline;
	for (const hit of hits) {
		totals[hit.kind]++;
		const perFile = baseline[hit.kind];
		perFile[hit.file] ??= [];
		perFile[hit.file].push(hit.text);
	}
	for (const kind of KINDS) for (const texts of Object.values(baseline[kind])) texts.sort();
	return { totals, hits: baseline };
}

function uncovered(hits: Hit[], baseline: Baseline): Hit[] {
	const remaining = new Map<string, number>();
	for (const kind of KINDS)
		for (const [file, texts] of Object.entries(baseline[kind] ?? {}))
			for (const text of texts) remaining.set(`${kind}\0${file}\0${text}`, (remaining.get(`${kind}\0${file}\0${text}`) ?? 0) + 1);
	return hits.filter((hit) => {
		const key = `${hit.kind}\0${hit.file}\0${hit.text}`;
		const left = remaining.get(key) ?? 0;
		if (left > 0) remaining.set(key, left - 1);
		return left === 0;
	});
}

const hits = scan();
const current = toBudget(hits);
const budget = JSON.parse(readFileSync(BUDGET_FILE, "utf8")) as Budget;
const over = KINDS.filter((k) => current.totals[k] > budget.totals[k]);

for (const kind of KINDS) {
	const mark = current.totals[kind] > budget.totals[kind] ? "OVER" : "ok  ";
	console.log(`${mark} ${kind.padEnd(18)} ${current.totals[kind]} / budget ${budget.totals[kind]}`);
}

if (process.argv.includes("--update")) {
	if (over.length > 0) {
		console.error(`refusing to raise the budget for ${over.join(", ")}; the budget only goes down`);
		process.exit(1);
	}
	writeFileSync(BUDGET_FILE, `${JSON.stringify(current, null, "\t")}\n`);
	console.log(`wrote ${relative(ROOT, BUDGET_FILE)}`);
	process.exit(0);
}

if (over.length > 0) {
	console.error("\nNew hits not covered by the budget. Use a token from src/styles.css instead:");
	for (const hit of uncovered(hits, budget.hits).filter((h) => over.includes(h.kind)))
		console.error(`  ${hit.file}:${hit.line}  ${hit.kind}  ${hit.text}`);
	process.exit(1);
}
if (KINDS.some((k) => current.totals[k] < budget.totals[k]))
	console.log("\nCounts fell below the budget. Lock that in with: bun scripts/token-budget.ts --update");
