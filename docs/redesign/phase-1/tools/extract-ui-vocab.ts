#!/usr/bin/env bun
/**
 * Lists every user-facing string in src/routes and src/components that uses a
 * term from the concept vocabulary, with file:line. JSX text, display props,
 * toast calls, and template literals are read. Class names and imports are not.
 *
 *   bun docs/redesign/phase-1/tools/extract-ui-vocab.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

const scriptDir = dirname(new URL(import.meta.url).pathname);
const ROOT = resolve(scriptDir, "../../../..");
const OUT = join(scriptDir, "ui-vocab.json");

const TERMS: Record<string, RegExp> = {
	log: /\b(log(ged|s)?|watch event|watch history|history|mark(ed)? (as )?watched|watched)\b/i,
	rating: /\b(rat(e|ed|ing|ings)|stars?)\b/i,
	review: /\breviews?\b|\breviewed\b/i,
	thoughts: /\bthoughts?\b/i,
	note: /\bnotes?\b/i,
	journal: /\bjournal\b/i,
	diary: /\bdiary\b/i,
	progress: /\b(tracker|tracked|progress|caught up|completed?|watching|episodes?)\b/i,
	rewatch: /\b(re-?watch(es|ing)?|watch \d|encore)\b/i,
	watchlist: /\bwatchlists?\b/i,
	savedTitle: /\b(my picks|picks?|bookmark(ed)?|saved?|add to)\b/i,
	recommendation: /\b(recommend(ed|s|ation|ations)?|invite[sd]?|suggest(ed|ions)?)\b/i,
	friend: /\b(friends?|mutual|member|crew)\b/i,
	notification: /\b(notifications?|alerts?)\b/i,
	achievement: /\b(achievements?|badges?|trophy)\b/i,
	companion: /\b(companions?|watched with|together|shared)\b/i,
	visibility: /\b(public|private|visible|visibility|who can see|hidden|hide)\b/i,
	shuffle: /\b(shuffle|swipe[sd]?|match(es)?|curtain call)\b/i,
};

const DISPLAY_PROPS = new Set([
	"label",
	"title",
	"placeholder",
	"aria-label",
	"description",
	"text",
	"alt",
]);

function files(dir: string): string[] {
	return readdirSync(dir)
		.sort()
		.flatMap((entry) => {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) {
				return entry === "__tests__" || entry === "ui" ? [] : files(full);
			}
			return /\.tsx$/.test(full) ? [full] : [];
		});
}

function isDisplayLiteral(node: ts.Node): boolean {
	const parent = node.parent;
	if (ts.isJsxAttribute(parent)) {
		return DISPLAY_PROPS.has(parent.name.getText());
	}
	if (ts.isJsxExpression(parent)) {
		if (ts.isJsxAttribute(parent.parent)) {
			return DISPLAY_PROPS.has(parent.parent.name.getText());
		}
		return true;
	}
	if (ts.isPropertyAssignment(parent)) {
		return ["label", "text", "description", "title"].includes(
			parent.name.getText(),
		);
	}
	if (ts.isCallExpression(parent)) {
		return /^toast(\.|$)/.test(parent.expression.getText());
	}
	if (ts.isConditionalExpression(parent) || ts.isBinaryExpression(parent)) {
		return isDisplayLiteral(parent);
	}
	return false;
}

const hits: Record<string, { text: string; at: string }[]> = {};
for (const key of Object.keys(TERMS)) hits[key] = [];

for (const base of ["src/routes", "src/components"]) {
	for (const file of files(join(ROOT, base))) {
		const source = ts.createSourceFile(
			file,
			readFileSync(file, "utf8"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX,
		);
		const record = (node: ts.Node, raw: string) => {
			const text = raw.replace(/\s+/g, " ").trim();
			if (text.length < 2 || !/[a-zA-Z]/.test(text)) return;
			const line =
				source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
			const at = `${relative(ROOT, file)}:${line}`;
			for (const [key, pattern] of Object.entries(TERMS)) {
				if (pattern.test(text)) hits[key].push({ text, at });
			}
		};
		const visit = (node: ts.Node) => {
			if (ts.isJsxText(node)) record(node, node.text);
			else if (
				(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
				isDisplayLiteral(node)
			) {
				record(node, node.text);
			} else if (ts.isTemplateExpression(node) && isDisplayLiteral(node)) {
				record(
					node,
					[node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(
						"…",
					),
				);
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
}

const summary = Object.fromEntries(
	Object.entries(hits).map(([key, list]) => {
		const counts = new Map<string, number>();
		for (const hit of list) counts.set(hit.text, (counts.get(hit.text) ?? 0) + 1);
		return [
			key,
			{
				total: list.length,
				distinct: counts.size,
				strings: [...counts.keys()].sort(),
			},
		];
	}),
);

writeFileSync(OUT, `${JSON.stringify({ summary, hits }, null, "\t")}\n`);
for (const [key, value] of Object.entries(summary)) {
	console.log(`${key}: ${value.total} hits, ${value.distinct} distinct`);
}
