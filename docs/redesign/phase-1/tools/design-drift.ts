#!/usr/bin/env bun
/**
 * Design drift scanner for Popcorn. Read-only over src/.
 *
 *   bun docs/redesign/phase-1/tools/design-drift.ts
 *
 * Writes docs/redesign/phase-1/05-design-drift.json and prints the headline
 * numbers. Output carries no timestamp, so two runs on one tree are identical.
 *
 * Scopes: app (hand-written product code a route can reach), orphan (components
 * no route imports, so no user sees them), ui (src/components/ui, shadcn),
 * emails (src/emails, inline by necessity), css (src/styles.css).
 * Excluded: routeTree.gen.ts, __tests__, *.test.*.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "docs/redesign/phase-1/05-design-drift.json");

/** Oklab distance. 0.02 is the just-noticeable step CSS Color 4 uses for gamut mapping. */
const NEAR_DELTA = 0.02;
const LOOSE_DELTA = 0.04;

type Scope = "app" | "orphan" | "ui" | "emails" | "css";
type LitCtx = "className" | "style" | "styleObject" | "constant" | "jsxText";
type Lit = { text: string; pos: number; ctx: LitCtx; prop?: string };
type Site = { file: string; line: number; scope: Scope };
type ClassUse = Site & { util: string; variants: string[]; ctx: LitCtx };
type JsxUse = Site & {
	tag: string;
	from: string | null;
	cls: string;
	attrs: Record<string, string>;
};
type CallUse = Site & { callee: string; args: string };
type StyleProp = Site & { prop: string; value: string; inJsxStyle: boolean };
type Colour = { r: number; g: number; b: number; a: number };
type SourceFileScan = {
	file: string;
	scope: Scope;
	lits: (Lit & Site)[];
	jsx: JsxUse[];
	calls: CallUse[];
	styles: StyleProp[];
	imports: { spec: string; typeOnly: boolean; names: string[] }[];
	dynamicClasses: (Site & { fragment: string })[];
};

const sh = (cmd: string, args: string[]) =>
	spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" }).stdout?.trim() ?? "";

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = join(dir, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});
}

function scopeOf(rel: string): Scope {
	if (rel.endsWith(".css")) return "css";
	if (rel.startsWith("src/components/ui/")) return "ui";
	if (rel.startsWith("src/emails/")) return "emails";
	return "app";
}

const sourceFiles = walk(SRC)
	.filter((f) => /\.(tsx?|css)$/.test(f))
	.filter((f) => !/routeTree\.gen\.ts$|__tests__|\.test\.tsx?$/.test(f))
	.map((f) => relative(ROOT, f))
	.sort();

/* ---------------------------------------------------------------- colours */

const clamp = (n: number) => Math.min(255, Math.max(0, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

function fromLinear(c: number) {
	const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
	return clamp(Math.round(v * 255));
}
function toLinear(c: number) {
	const v = c / 255;
	return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function oklabToRgb(L: number, A: number, B: number, a: number): Colour {
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
	const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
	const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
	return {
		r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
		a,
	};
}
function rgbToOklab({ r, g, b }: Colour): [number, number, number] {
	const [R, G, B] = [toLinear(r), toLinear(g), toLinear(b)];
	const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
	const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
	const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}
function deltaOk(x: Colour, y: Colour) {
	const [a, b] = [rgbToOklab(x), rgbToOklab(y)];
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function parseAlpha(raw: string | undefined) {
	if (raw === undefined) return 1;
	return raw.endsWith("%") ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
}

function parseColour(input: string): Colour | null {
	const raw = input.trim().toLowerCase().replaceAll("_", " ");
	if (raw.startsWith("#")) {
		const h = raw.slice(1);
		const full =
			h.length <= 4
				? [...h].map((c) => c + c).join("")
				: h;
		return {
			r: Number.parseInt(full.slice(0, 2), 16),
			g: Number.parseInt(full.slice(2, 4), 16),
			b: Number.parseInt(full.slice(4, 6), 16),
			a: full.length === 8 ? r2(Number.parseInt(full.slice(6, 8), 16) / 255) : 1,
		};
	}
	const fn = raw.match(/^([a-z]+)\(([^()]*)\)$/);
	if (!fn) return null;
	const [, name, body] = fn;
	const parts = (body ?? "").split(/[\s,/]+/).filter(Boolean);
	if (parts.some((p) => !/^-?[\d.]+(%|deg)?$/.test(p))) return null;
	const num = (i: number) => Number.parseFloat(parts[i] ?? "0");
	const alpha = parseAlpha(parts[3]);
	if (name === "rgb" || name === "rgba") {
		const ch = (i: number) => (parts[i]?.endsWith("%") ? num(i) * 2.55 : num(i));
		return { r: clamp(ch(0)), g: clamp(ch(1)), b: clamp(ch(2)), a: alpha };
	}
	if (name === "hsl" || name === "hsla") {
		const [h, s, l] = [num(0), num(1) / 100, num(2) / 100];
		const k = (n: number) => (n + h / 30) % 12;
		const f = (n: number) =>
			l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
		return {
			r: Math.round(f(0) * 255),
			g: Math.round(f(8) * 255),
			b: Math.round(f(4) * 255),
			a: alpha,
		};
	}
	if (name === "oklch") {
		const L = parts[0]?.endsWith("%") ? num(0) / 100 : num(0);
		const rad = (num(2) * Math.PI) / 180;
		return oklabToRgb(L, num(1) * Math.cos(rad), num(1) * Math.sin(rad), alpha);
	}
	return null;
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");
const baseOf = (c: Colour) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
const canonical = (c: Colour) =>
	c.a >= 1 ? baseOf(c) : `${baseOf(c)}/${r2(c.a)}`;

const COLOUR_RE =
	/(?<![\w&/#-])(?<!url\()#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab)\([^()]*\)/g;
const NAMED: Record<string, string> = {
	white: "#ffffff",
	black: "#000000",
	red: "#ff0000",
	gold: "#ffd700",
	cyan: "#00ffff",
	magenta: "#ff00ff",
	yellow: "#ffff00",
};

const kindOf = (raw: string) =>
	raw.startsWith("#")
		? "hex"
		: raw.startsWith("rgb")
			? "rgb"
			: raw.startsWith("hsl")
				? "hsl"
				: raw.startsWith("okl")
					? "oklch"
					: "named";

/* --------------------------------------------------------------- tokens */

type TokenDef = {
	name: string;
	line: number;
	block: "root" | "dark" | "theme";
	value: string;
};

const cssPath = "src/styles.css";
const cssText = readFileSync(join(ROOT, cssPath), "utf8");
const cssNoComments = cssText.replace(/\/\*[\s\S]*?\*\//g, (m) =>
	m.replace(/[^\n]/g, " "),
);
const cssLines = cssNoComments.split("\n");

function blockRange(startRe: RegExp): [number, number] {
	const start = cssLines.findIndex((l) => startRe.test(l));
	let depth = 0;
	for (let i = start; i < cssLines.length; i++) {
		depth += (cssLines[i]?.match(/{/g) ?? []).length;
		depth -= (cssLines[i]?.match(/}/g) ?? []).length;
		if (depth === 0) return [start, i];
	}
	return [start, cssLines.length - 1];
}
const blocks = {
	root: blockRange(/^:root\s*{/),
	dark: blockRange(/^\.dark\s*{/),
	theme: blockRange(/^@theme inline\s*{/),
} as const;
const inTokenBlock = (i: number) =>
	Object.values(blocks).some(([a, b]) => i >= a && i <= b);

const tokenDefs: TokenDef[] = (Object.keys(blocks) as (keyof typeof blocks)[]).flatMap(
	(block) => {
		const [a, b] = blocks[block];
		return cssLines.slice(a, b + 1).flatMap((line, i) => {
			const m = line.match(/^\s*(--[\w-]+):\s*(.+?);\s*$/);
			return m?.[1] && m[2]
				? [{ name: m[1], line: a + i + 1, block, value: m[2] }]
				: [];
		});
	},
);
const defOf = (name: string, block: TokenDef["block"]) =>
	tokenDefs.find((t) => t.name === name && t.block === block);

function resolveToken(name: string, mode: "root" | "dark"): Colour | null {
	const def =
		defOf(name, mode) ?? defOf(name, "root") ?? defOf(name, "theme");
	if (!def) return null;
	const alias = def.value.match(/^var\((--[\w-]+)\)$/);
	return alias?.[1] ? resolveToken(alias[1], mode) : parseColour(def.value);
}

const tokenColours = [...new Set(tokenDefs.map((t) => t.name))].flatMap((name) =>
	(["dark", "root"] as const).flatMap((mode) => {
		const colour = resolveToken(name, mode);
		return colour ? [{ name, mode, colour }] : [];
	}),
);

const paletteCss = readFileSync(
	join(ROOT, "node_modules/tailwindcss/theme.css"),
	"utf8",
);
const palette = new Map<string, Colour>();
for (const m of paletteCss.matchAll(/--color-([a-z]+(?:-\d+)?):\s*([^;]+);/g)) {
	const colour = m[1] && m[2] ? parseColour(m[2]) : null;
	if (m[1] && colour) palette.set(m[1], colour);
}

/* ---------------------------------------------------------- AST extraction */

const CSS_PROPS = new Set(
	"color background backgroundColor backgroundImage border borderColor borderTop borderBottom borderLeft borderRight borderTopColor borderBottomColor borderLeftColor borderRightColor outline outlineColor boxShadow textShadow fill stroke stopColor filter accentColor caretColor fontSize fontFamily fontWeight letterSpacing lineHeight borderRadius zIndex transition transitionDuration transitionTimingFunction transitionDelay animation animationName animationDuration animationTimingFunction animationDelay animationIterationCount padding paddingTop paddingBottom paddingLeft paddingRight paddingInline paddingBlock margin marginTop marginBottom marginLeft marginRight width height minWidth minHeight maxWidth maxHeight gap top left right bottom inset".split(
		" ",
	),
);
const CLASS_CALLS = /^(cn|clsx|cx|cva|twMerge|twJoin)$/;
const CLASS_VAR = /(class|classes|classname|styles?)$/i;

function resolveImport(fromFile: string, spec: string): string | null {
	let base: string | null = null;
	if (spec.startsWith("#/") || spec.startsWith("@/")) {
		base = `src/${spec.slice(2)}`;
	} else if (spec.startsWith(".")) {
		base = relative(ROOT, resolve(ROOT, dirname(fromFile), spec));
	}
	if (!base) return null;
	const candidates = [
		base,
		`${base}.tsx`,
		`${base}.ts`,
		`${base}/index.tsx`,
		`${base}/index.ts`,
	];
	return (
		candidates.find(
			(c) => /\.(tsx?|css)$/.test(c) && existsSync(join(ROOT, c)),
		) ?? null
	);
}

function scanTs(file: string): SourceFileScan {
	const text = readFileSync(join(ROOT, file), "utf8");
	const sf = ts.createSourceFile(
		file,
		text,
		ts.ScriptTarget.Latest,
		true,
		file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
	const scope = scopeOf(file);
	const lineAt = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
	const site = (pos: number): Site => ({ file, line: lineAt(pos), scope });
	const scan: SourceFileScan = {
		file,
		scope,
		lits: [],
		jsx: [],
		calls: [],
		styles: [],
		imports: [],
		dynamicClasses: [],
	};
	const localImports = new Map<string, string>();
	const stringConsts = new Map<string, string>();

	const pushLit = (node: ts.Node, ctx: LitCtx, prop?: string) => {
		const pos = node.getStart(sf);
		const raw = node.getText(sf);
		scan.lits.push({ text: raw, pos, ctx, prop, ...site(pos) });
		const dyn = raw.match(/(?:^|[\s`"'])([a-z][\w:-]*-)\$\{/g);
		if (dyn && (ctx === "className" || /\s/.test(raw))) {
			for (const fragment of dyn) {
				scan.dynamicClasses.push({
					fragment: fragment.trim().replace(/^[`"']/, ""),
					...site(pos),
				});
			}
		}
	};

	const litText = (node: ts.Node): string => {
		const parts: string[] = [];
		const go = (n: ts.Node) => {
			if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
				parts.push(n.getText(sf).replace(/^[`"'}]|[`"']$|\$\{$/g, ""));
			} else if (ts.isIdentifier(n) && stringConsts.has(n.text)) {
				parts.push(stringConsts.get(n.text) ?? "");
			}
			n.forEachChild(go);
		};
		go(node);
		return parts.join(" ");
	};

	const collectConsts = (node: ts.Node) => {
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.initializer &&
			ts.isStringLiteralLike(node.initializer)
		) {
			stringConsts.set(node.name.text, node.initializer.text);
		}
		node.forEachChild(collectConsts);
	};
	collectConsts(sf);

	const visit = (node: ts.Node, ctx: LitCtx, prop?: string) => {
		if (ts.isTypeNode(node)) return;
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			const spec = node.moduleSpecifier;
			if (spec && ts.isStringLiteral(spec)) {
				const clause = ts.isImportDeclaration(node) ? node.importClause : null;
				const names: string[] = [];
				if (clause?.name) names.push(clause.name.text);
				const bindings = clause?.namedBindings;
				if (bindings && ts.isNamedImports(bindings)) {
					for (const el of bindings.elements) names.push(el.name.text);
				}
				const typeOnly = ts.isImportDeclaration(node)
					? (clause?.isTypeOnly ?? false)
					: node.isTypeOnly;
				scan.imports.push({ spec: spec.text, typeOnly, names });
				for (const n of names) localImports.set(n, spec.text);
			}
			return;
		}
		if (ts.isJsxAttribute(node)) {
			const name = node.name.getText(sf);
			const value = node.initializer;
			if (/^(href|xlinkHref|id|to|src|key|alt|placeholder|aria-.*)$/.test(name)) {
				if (value && ts.isJsxExpression(value) && value.expression) {
					visit(value.expression, "constant");
				}
				return;
			}
			const next: LitCtx =
				name === "className" ? "className" : name === "style" ? "style" : ctx;
			node.forEachChild((c) => visit(c, next, prop));
			return;
		}
		if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
			const tag = node.tagName.getText(sf);
			const attrs: Record<string, string> = {};
			let cls = "";
			for (const attr of node.attributes.properties) {
				if (!ts.isJsxAttribute(attr)) continue;
				const name = attr.name.getText(sf);
				const init = attr.initializer;
				if (name === "className" && init) cls = litText(init);
				else if (init && ts.isStringLiteral(init)) attrs[name] = init.text;
				else if (init) attrs[name] = init.getText(sf).slice(0, 120);
				else attrs[name] = "true";
			}
			scan.jsx.push({
				...site(node.getStart(sf)),
				tag,
				from: localImports.get(tag.split(".")[0] ?? tag) ?? null,
				cls,
				attrs,
			});
		}
		if (ts.isCallExpression(node)) {
			const callee = node.expression.getText(sf);
			scan.calls.push({
				...site(node.getStart(sf)),
				callee,
				args: node.arguments.map((a) => a.getText(sf)).join(", ").slice(0, 200),
			});
			if (CLASS_CALLS.test(callee)) {
				node.arguments.forEach((a) => {
					visit(a, "className");
				});
				return;
			}
		}
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			if (CLASS_VAR.test(node.name.text) && ctx === "constant") {
				visit(node.initializer, "className");
				return;
			}
		}
		if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
			const key = node.name.text;
			if (CSS_PROPS.has(key)) {
				const pos = node.getStart(sf);
				scan.styles.push({
					...site(pos),
					prop: key,
					value: node.initializer.getText(sf).slice(0, 160),
					inJsxStyle: ctx === "style",
				});
				visit(node.initializer, ctx === "style" ? "style" : "styleObject", key);
				return;
			}
		}
		if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
			pushLit(node, ctx, prop);
			return;
		}
		if (ts.isJsxText(node)) {
			if (node.text.trim()) pushLit(node, "jsxText");
			return;
		}
		node.forEachChild((c) => visit(c, ctx, prop));
	};
	visit(sf, "constant");
	return scan;
}

const tsScans = sourceFiles.filter((f) => !f.endsWith(".css")).map(scanTs);

/* --------------------------------------------------------- import reachability */

const importEdges = new Map(
	tsScans.map((s) => [
		s.file,
		s.imports
			.filter((i) => !i.typeOnly)
			.flatMap((i) => {
				const target = resolveImport(s.file, i.spec);
				return target ? [target] : [];
			}),
	]),
);

const isRouteFile = (f: string) =>
	f.startsWith("src/routes/") && !f.startsWith("src/routes/api") && !f.includes("api.trpc");
const routeFiles = sourceFiles.filter(isRouteFile);

function reachableFrom(start: string) {
	const seen = new Set<string>([start]);
	const queue = [start];
	while (queue.length) {
		for (const next of importEdges.get(queue.pop() as string) ?? []) {
			if (!seen.has(next)) {
				seen.add(next);
				queue.push(next);
			}
		}
	}
	return seen;
}
const routeReach = new Map(routeFiles.map((r) => [r, reachableFrom(r)]));
const routesFor = (file: string) =>
	routeFiles.filter((r) => routeReach.get(r)?.has(file)).map((r) => r.replace("src/routes/", ""));
const reachedByAnyRoute = new Set(
	[...routeReach.values()].flatMap((s) => [...s]),
);
const orphanComponents = sourceFiles.filter(
	(f) => f.startsWith("src/components/") && f.endsWith(".tsx") && !reachedByAnyRoute.has(f),
);
const orphanApp = new Set(orphanComponents.filter((f) => scopeOf(f) === "app"));

for (const scan of tsScans.filter((s) => orphanApp.has(s.file))) {
	scan.scope = "orphan";
	for (const site of [...scan.lits, ...scan.jsx, ...scan.calls, ...scan.styles, ...scan.dynamicClasses]) {
		site.scope = "orphan";
	}
}

const lits = tsScans.flatMap((s) => s.lits);
const jsx = tsScans.flatMap((s) => s.jsx);
const calls = tsScans.flatMap((s) => s.calls);
const styleProps = tsScans.flatMap((s) => s.styles);
const dynamicClasses = tsScans.flatMap((s) => s.dynamicClasses);

/* --------------------------------------------------------- Tailwind classes */

function splitVariants(token: string) {
	const parts: string[] = [];
	let depth = 0;
	let cur = "";
	for (const ch of token) {
		if (ch === "[" || ch === "(") depth++;
		if (ch === "]" || ch === ")") depth--;
		if (ch === ":" && depth === 0) {
			parts.push(cur);
			cur = "";
		} else cur += ch;
	}
	parts.push(cur);
	const util = (parts.pop() ?? "").replace(/^!|!$/g, "");
	return { util, variants: parts };
}

/** Utilities that are ordinary English words only count inside a class context. */
const BARE_WORD = /^(shadow|rounded|transition|border|outline|ring|filter|grow|shrink|hidden|block|flex|grid|table|contents|inline|static|fixed|absolute|relative|sticky|truncate|italic|underline|uppercase|lowercase|capitalize|container)$/;

const classUses: ClassUse[] = lits
	.filter((l) => l.ctx !== "jsxText" && l.ctx !== "style")
	.flatMap((l) =>
		l.text
			.replace(/^[`"'}]|[`"']$|\$\{$/g, "")
			.split(/\s+/)
			.filter(Boolean)
			.flatMap((token) => {
				const { util, variants } = splitVariants(token);
				if (BARE_WORD.test(util) && l.ctx !== "className") return [];
				return [{ file: l.file, line: l.line, scope: l.scope, util, variants, ctx: l.ctx }];
			}),
	);

const COLOUR_UTIL =
	/^-?(bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|divide|from|via|to|fill|stroke|shadow|inset-shadow|accent|caret|decoration|placeholder)-(.+)$/;
const SKIP_COLOUR_WORD = /^(transparent|current|inherit|none)$/;

type ColourClass = ClassUse & {
	family: "token" | "palette";
	name: string;
	alpha: number | null;
};

const colourClasses: ColourClass[] = classUses.flatMap((c): ColourClass[] => {
	const m = c.util.match(COLOUR_UTIL);
	if (!m?.[2] || m[2].startsWith("[") || m[2].startsWith("(")) return [];
	const [nameRaw, alphaRaw] = m[2].split("/") as [string, string | undefined];
	if (SKIP_COLOUR_WORD.test(nameRaw)) return [];
	const alpha = alphaRaw
		? alphaRaw.startsWith("[")
			? Number.parseFloat(alphaRaw.slice(1))
			: Number.parseFloat(alphaRaw) / 100
		: null;
	if (tokenDefs.some((t) => t.name === `--color-${nameRaw}`)) {
		return [{ ...c, family: "token" as const, name: nameRaw, alpha }];
	}
	if (palette.has(nameRaw)) {
		return [{ ...c, family: "palette" as const, name: nameRaw, alpha }];
	}
	return [];
});

/* ----------------------------------------------------------- colour report */

type RawColour = Site & {
	raw: string;
	kind: string;
	context: "arbitrary-class" | "inline-style" | "js-constant" | "css-rule";
};

const rawColours: RawColour[] = lits
	.filter((l) => l.ctx !== "jsxText")
	.flatMap((l) => {
		const hits: RawColour[] = [];
		for (const m of l.text.matchAll(COLOUR_RE)) {
			const before = l.text.slice(0, m.index);
			const token = before.slice(before.search(/\S+$/));
			const inClass = token.includes("[");
			const context = inClass
				? "arbitrary-class"
				: l.ctx === "style" || l.ctx === "styleObject"
					? "inline-style"
					: "js-constant";
			hits.push({
				file: l.file,
				line: l.line,
				scope: l.scope,
				raw: m[0],
				kind: kindOf(m[0]),
				context,
			});
		}
		if (l.prop && /color|fill|stroke|background/i.test(l.prop)) {
			const bare = l.text.replace(/^["'`]|["'`]$/g, "").toLowerCase();
			if (NAMED[bare]) {
				hits.push({
					file: l.file,
					line: l.line,
					scope: l.scope,
					raw: NAMED[bare] ?? bare,
					kind: "named",
					context: "inline-style",
				});
			}
		}
		return hits;
	});

cssLines.forEach((line, i) => {
	if (inTokenBlock(i) || line.startsWith("@import")) return;
	for (const m of line.matchAll(COLOUR_RE)) {
		rawColours.push({
			file: cssPath,
			line: i + 1,
			scope: "css",
			raw: m[0],
			kind: kindOf(m[0]),
			context: "css-rule",
		});
	}
});

const unparsedColours = rawColours.filter((c) => !parseColour(c.raw));
const parsedRaw = rawColours.flatMap((c) => {
	const colour = parseColour(c.raw);
	return colour ? [{ ...c, colour }] : [];
});

function mapToToken(colour: Colour) {
	const base = baseOf(colour);
	const exact = tokenColours.find(
		(t) => canonical(t.colour) === canonical(colour),
	);
	if (exact) return { status: "token-exact", token: exact.name };
	const alpha = tokenColours.find((t) => baseOf(t.colour) === base);
	if (alpha) return { status: "token-alpha", token: alpha.name };
	let best: { name: string; d: number } | null = null;
	for (const t of tokenColours) {
		const d = deltaOk(t.colour, colour);
		if (d < NEAR_DELTA && (!best || d < best.d)) best = { name: t.name, d };
	}
	return best
		? { status: "token-near", token: best.name, delta: r2(best.d * 100) / 100 }
		: { status: "off-token", token: null };
}

const siteStr = (s: Site) => `${s.file}:${s.line}`;
const uniq = <T>(xs: T[]) => [...new Set(xs)];
const sortedSites = (xs: Site[]) => uniq(xs.map(siteStr)).sort();

type ColourValue = {
	value: string;
	base: string;
	alpha: number;
	spellings: string[];
	sources: string[];
	mapping: ReturnType<typeof mapToToken>;
	scopes: Scope[];
	hits: number;
	sites: string[];
};

function resolvedClassColour(c: ColourClass): Colour {
	const base =
		c.family === "token"
			? (resolveToken(`--color-${c.name}`, "dark") ?? { r: 0, g: 0, b: 0, a: 1 })
			: (palette.get(c.name) as Colour);
	return c.alpha === null ? base : { ...base, a: r2(c.alpha) };
}

const valueMap = new Map<string, ColourValue>();
function addValue(colour: Colour, spelling: string, source: string, s: Site) {
	const key = canonical(colour);
	const entry =
		valueMap.get(key) ??
		({
			value: key,
			base: baseOf(colour),
			alpha: r2(colour.a),
			spellings: [],
			sources: [],
			mapping: mapToToken(colour),
			scopes: [],
			hits: 0,
			sites: [],
		} satisfies ColourValue);
	entry.hits++;
	if (!entry.spellings.includes(spelling)) entry.spellings.push(spelling);
	if (!entry.sources.includes(source)) entry.sources.push(source);
	if (!entry.scopes.includes(s.scope)) entry.scopes.push(s.scope);
	entry.sites.push(siteStr(s));
	valueMap.set(key, entry);
}
for (const c of parsedRaw) addValue(c.colour, c.raw, c.context, c);
for (const c of colourClasses) {
	const spelling = `${c.name}${c.alpha === null ? "" : `/${r2(c.alpha * 100)}`}`;
	addValue(resolvedClassColour(c), spelling, `${c.family}-class`, c);
}
const colourValues = [...valueMap.values()]
	.map((v) => ({ ...v, sites: uniq(v.sites).sort(), spellings: v.spellings.sort(), sources: v.sources.sort(), scopes: v.scopes.sort() }))
	.sort((a, b) => b.hits - a.hits || a.value.localeCompare(b.value));

const inScopes = (v: ColourValue, scopes: Scope[]) =>
	v.scopes.some((s) => scopes.includes(s));
const isBw = (v: ColourValue) => v.base === "#000000" || v.base === "#ffffff";
/** A value counts as off-token when some spelling of it is not a token class and it matches no token rgb. */
const isOffRaw = (v: ColourValue) =>
	v.mapping.status === "off-token" || v.mapping.status === "token-near";

function clusterBases(values: ColourValue[], threshold: number) {
	const bases = uniq(values.map((v) => v.base)).sort();
	const parent = new Map(bases.map((b) => [b, b]));
	const find = (x: string): string => {
		const p = parent.get(x) ?? x;
		return p === x ? x : find(p);
	};
	const cols = bases.map((b) => parseColour(b) as Colour);
	bases.forEach((a, i) => {
		for (let j = i + 1; j < bases.length; j++) {
			const b = bases[j] as string;
			if (deltaOk(cols[i] as Colour, cols[j] as Colour) < threshold) {
				parent.set(find(a), find(b));
			}
		}
	});
	const groups = new Map<string, string[]>();
	for (const b of bases) {
		const root = find(b);
		groups.set(root, [...(groups.get(root) ?? []), b]);
	}
	return [...groups.values()].sort((a, b) => b.length - a.length);
}

function colourSummary(scopes: Scope[]) {
	const vals = colourValues.filter((v) => inScopes(v, scopes));
	const raw = parsedRaw.filter((c) => scopes.includes(c.scope));
	const cls = colourClasses.filter((c) => scopes.includes(c.scope));
	const tally = <T>(xs: T[], key: (x: T) => string) => {
		const out: Record<string, number> = {};
		for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1;
		return Object.fromEntries(Object.entries(out).sort());
	};
	const off = vals.filter(isOffRaw);
	const tight = clusterBases(vals, NEAR_DELTA).filter((g) => g.length > 1);
	const loose = clusterBases(vals, LOOSE_DELTA);
	return {
		distinctValues: vals.length,
		distinctBaseColours: uniq(vals.map((v) => v.base)).length,
		rawLiteralHits: raw.length,
		rawDistinctSpellings: uniq(raw.map((c) => c.raw)).length,
		rawDistinctValues: uniq(raw.map((c) => canonical(c.colour))).length,
		rawByKind: tally(raw, (c) => c.kind),
		rawByContext: tally(raw, (c) => c.context),
		paletteClassHits: cls.filter((c) => c.family === "palette").length,
		paletteClassDistinct: uniq(cls.filter((c) => c.family === "palette").map((c) => `${c.name}/${c.alpha}`)).length,
		tokenClassHits: cls.filter((c) => c.family === "token").length,
		tokenClassDistinct: uniq(cls.filter((c) => c.family === "token").map((c) => `${c.name}/${c.alpha}`)).length,
		mappingOfDistinctValues: tally(vals, (v) => v.mapping.status),
		rawHitsByMapping: tally(raw, (c) => mapToToken(c.colour).status),
		offTokenDistinct: off.length,
		offTokenDistinctExcludingBlackWhite: off.filter((v) => !isBw(v)).length,
		offTokenHits: off.reduce((n, v) => n + v.hits, 0),
		nearDuplicateClusters: tight.length,
		perceptualFamiliesAtLooseDelta: loose.length,
	};
}

const alphaFamilies = Object.values(
	colourValues.reduce<Record<string, ColourValue[]>>((acc, v) => {
		const group = acc[v.base] ?? [];
		group.push(v);
		acc[v.base] = group;
		return acc;
	}, {}),
)
	.filter((g) => g.length > 1)
	.map((g) => ({
		base: g[0]?.base,
		mapsTo: g[0]?.mapping.token ?? null,
		steps: g.map((v) => v.alpha).sort((a, b) => a - b),
		hits: g.reduce((n, v) => n + v.hits, 0),
	}))
	.sort((a, b) => b.steps.length - a.steps.length);

const tokenAlphaSteps = Object.entries(
	colourClasses
		.filter((c) => c.family === "token" && c.scope === "app")
		.reduce<Record<string, Set<string>>>((acc, c) => {
			const set = acc[c.name] ?? new Set<string>();
			set.add(c.alpha === null ? "1" : String(r2(c.alpha)));
			acc[c.name] = set;
			return acc;
		}, {}),
)
	.map(([token, set]) => ({ token, steps: [...set].map(Number).sort((a, b) => a - b) }))
	.sort((a, b) => b.steps.length - a.steps.length);

const appVals = colourValues.filter((v) => inScopes(v, ["app", "css"]));
const nearDuplicates = clusterBases(appVals, NEAR_DELTA)
	.filter((g) => g.length > 1)
	.map((bases) => ({
		bases,
		hits: appVals.filter((v) => bases.includes(v.base)).reduce((n, v) => n + v.hits, 0),
		tokens: uniq(
			appVals.filter((v) => bases.includes(v.base)).flatMap((v) => (v.mapping.token ? [v.mapping.token] : [])),
		),
	}));

/* ---------------------------------------------------- utility-class measures */

const isLength = (v: string) =>
	/^-?[\d.]+(px|rem|em|%|vh|vw|vmin|vmax|ch|dvh|svh|lvh)?$|^(calc|clamp|min|max)\(/.test(v);
const insideBrackets = (u: string) => u.match(/\[(.+)\]/)?.[1] ?? "";

const MEASURES: Record<string, (u: string) => boolean> = {
	fontSize: (u) =>
		/^text-(xs|sm|base|lg|[2-9]?xl)(\/.+)?$/.test(u) ||
		(/^text-\[/.test(u) && isLength(insideBrackets(u).replace(/^length:/, ""))),
	fontFamily: (u) =>
		/^font-(sans|serif|mono|logo|display|mono-retro)$/.test(u) ||
		/^font-\[['"a-zA-Z]/.test(u) ||
		u === "display-title",
	fontWeight: (u) =>
		/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(u) ||
		/^font-\[\d+\]$/.test(u),
	letterSpacing: (u) => /^-?tracking-/.test(u),
	lineHeight: (u) => /^leading-/.test(u) || /^text-[a-z0-9]+\/\S+$/.test(u) && !COLOUR_UTIL.test(u.split("/")[0] ?? ""),
	radius: (u) => /^rounded(-|$)/.test(u),
	shadow: (u) =>
		/^(drop-shadow|text-shadow|inset-shadow)(-|$)/.test(u) ||
		/^shadow(-(2xs|xs|sm|md|lg|xl|2xl|none|inner|\[.+))?$/.test(u) ||
		/^\[(box|text)-shadow:/.test(u),
	zIndex: (u) => /^-?z-/.test(u),
	arbitrarySpacing: (u) =>
		/^-?(p[xytrblse]?|m[xytrblse]?|gap(-[xy])?|space-[xy]|indent|scroll-[mp][xytrbl]?)-\[/.test(u),
	arbitrarySizing: (u) => /^-?(w|h|size|min-w|max-w|min-h|max-h|basis|aspect)-\[/.test(u),
	arbitraryPosition: (u) =>
		/^-?(top|left|right|bottom|inset(-[xy])?|translate(-[xyz])?|rotate|scale(-[xy])?|skew(-[xy])?)-\[/.test(u),
	transition: (u) => /^transition(-|$)/.test(u),
	duration: (u) => /^duration-/.test(u),
	easing: (u) => /^ease-/.test(u),
	delay: (u) => /^delay-/.test(u),
	animate: (u) => /^animate-/.test(u) || /^\[animation/.test(u),
	twAnimateEntrance: (u) => /^(animate-(in|out)|fade-(in|out)|zoom-(in|out)|slide-(in|out)-)/.test(u),
};

const isArbitrary = (u: string) =>
	/^-?[a-z][a-z0-9-]*-\[[^\]]+\](\/.+)?$/.test(u) ||
	/^\[[a-z-]+:.+\]$/.test(u) ||
	/^-?[a-z][a-z0-9-]*-\(--[\w-]+\)$/.test(u) ||
	/^[a-z][a-z0-9-]*-[a-z0-9-]+\/\[[\d.]+\]$/.test(u);

function measure(name: string, scopes: Scope[]) {
	const hits = classUses.filter((c) => scopes.includes(c.scope) && MEASURES[name]?.(c.util));
	const byValue = new Map<string, ClassUse[]>();
	for (const h of hits) byValue.set(h.util, [...(byValue.get(h.util) ?? []), h]);
	return {
		distinct: byValue.size,
		hits: hits.length,
		values: [...byValue.entries()]
			.map(([value, xs]) => ({ value, hits: xs.length, sites: sortedSites(xs) }))
			.sort((a, b) => b.hits - a.hits || a.value.localeCompare(b.value)),
	};
}

const INLINE_FOR: Record<string, string[]> = {
	fontSize: ["fontSize"],
	fontFamily: ["fontFamily"],
	fontWeight: ["fontWeight"],
	letterSpacing: ["letterSpacing"],
	lineHeight: ["lineHeight"],
	radius: ["borderRadius"],
	shadow: ["boxShadow", "textShadow"],
	zIndex: ["zIndex"],
};
const CSS_FOR: Record<string, RegExp> = {
	fontSize: /^\s*font-size:\s*(.+?);/,
	fontFamily: /^\s*font-family:\s*(.+?);/,
	fontWeight: /^\s*font-weight:\s*(.+?);/,
	letterSpacing: /^\s*letter-spacing:\s*(.+?);/,
	lineHeight: /^\s*line-height:\s*(.+?);/,
	radius: /^\s*border-radius:\s*(.+?);/,
	shadow: /^\s*box-shadow:\s*(.+?);?$/,
	zIndex: /^\s*z-index:\s*(.+?);/,
};

function inlineMeasure(name: string, scopes: Scope[]) {
	const props = INLINE_FOR[name] ?? [];
	const hits = styleProps.filter((p) => scopes.includes(p.scope) && props.includes(p.prop));
	const byValue = new Map<string, StyleProp[]>();
	for (const h of hits) byValue.set(h.value, [...(byValue.get(h.value) ?? []), h]);
	return {
		distinct: byValue.size,
		hits: hits.length,
		values: [...byValue.entries()]
			.map(([value, xs]) => ({ value, hits: xs.length, sites: sortedSites(xs) }))
			.sort((a, b) => b.hits - a.hits || a.value.localeCompare(b.value)),
	};
}
function cssMeasure(name: string) {
	const re = CSS_FOR[name];
	if (!re) return [];
	return cssLines.flatMap((l, i) => {
		const m = l.match(re);
		return m?.[1] && !inTokenBlock(i) ? [{ value: m[1], site: `${cssPath}:${i + 1}` }] : [];
	});
}

const measureBlock = (name: string) => ({
	app: measure(name, ["app"]),
	ui: measure(name, ["ui"]),
	emails: { inline: inlineMeasure(name, ["emails"]) },
	inlineApp: inlineMeasure(name, ["app"]),
	inlineUi: inlineMeasure(name, ["ui"]),
	css: cssMeasure(name),
});

const arbitraryApp = classUses.filter((c) => c.scope === "app" && isArbitrary(c.util));
const arbitraryUi = classUses.filter((c) => c.scope === "ui" && isArbitrary(c.util));
const arbitraryFamily = (u: string) => u.match(/^-?\[?([a-z-]+?)(-\[|:|-\(|\/\[)/)?.[1] ?? u.slice(0, 12);
const arbitraryByFamily = Object.entries(
	arbitraryApp.reduce<Record<string, number>>((acc, c) => {
		const k = arbitraryFamily(c.util);
		acc[k] = (acc[k] ?? 0) + 1;
		return acc;
	}, {}),
).sort((a, b) => b[1] - a[1]);

/* ---------------------------------------------------------- component roles */

const VISUAL_UTIL = /^-?(bg|text|border|rounded|shadow|font|tracking|leading|ring|outline|from|via|to|opacity|backdrop)(-|$)|^\[(box|text)-shadow/;
function signature(cls: string) {
	return uniq(
		cls
			.split(/\s+/)
			.map((t) => splitVariants(t))
			.filter(({ util, variants }) => VISUAL_UTIL.test(util) && !variants.some((v) => /^(sm|md|lg|xl|2xl)$/.test(v)))
			.map(({ util, variants }) => [...variants, util].join(":")),
	)
		.sort()
		.join(" ");
}

type Impl = {
	name: string;
	tag?: RegExp;
	from?: RegExp;
	cls?: RegExp;
	notCls?: RegExp;
	attr?: [string, RegExp];
	call?: RegExp;
	text?: RegExp;
	notFile?: RegExp;
	signatures?: boolean;
};
type Role = { role: string; impls: Impl[]; sameRoleNote: string };

const UI = (n: string) => new RegExp(`components/ui/${n}$`);

const ROLES: Role[] = [
	{
		role: "modal",
		sameRoleNote: "Every entry shows a blocking layer over the page for one task.",
		impls: [
			{ name: "ui/dialog <Dialog>", tag: /^Dialog$/, from: UI("dialog") },
			{ name: "ui/dialog <DialogContent> skins", tag: /^DialogContent$/, signatures: true },
			{ name: "ui/alert-dialog <AlertDialog>", tag: /^AlertDialog$/, from: UI("alert-dialog") },
			{ name: "ui/alert-dialog <AlertDialogContent> skins", tag: /^AlertDialogContent$/, signatures: true },
			{ name: "ui/sheet <Sheet>", tag: /^Sheet$/, from: UI("sheet") },
			{ name: "ui/drawer <Drawer>", tag: /^Drawer$/, from: UI("drawer") },
			{ name: "vaul direct", from: /^vaul$/ },
			{
				name: "custom fixed overlay (div fixed inset-0)",
				tag: /^(div|motion\.div|section|button)$/,
				cls: /(?=.*\bfixed\b)(?=.*\binset-0\b)/,
				notCls: /pointer-events-none/,
				notFile: /retro-overlays|shuffle-atmosphere/,
				signatures: true,
			},
			{ name: "createPortal", call: /^(ReactDOM\.)?createPortal$/ },
		],
	},
	{
		role: "card",
		sameRoleNote: "Container for one title, event, or list item.",
		impls: [
			{ name: "ui/card <Card>", tag: /^Card$/, from: UI("card") },
			{ name: "named *Card component", tag: /^[A-Z]\w*Card$/ },
			{
				name: "raw card-like div (rounded + border + bg)",
				tag: /^(div|li|article|section|motion\.div|Link)$/,
				cls: /(?=.*\brounded(-|\b))(?=.*(^|\s)border(\s|$|-))(?=.*(^|\s)bg-)/,
				signatures: true,
			},
			{ name: "css .island-shell", cls: /\bisland-shell\b/ },
			{ name: "css .feature-card", cls: /\bfeature-card\b/ },
		],
	},
	{
		role: "button",
		sameRoleNote: "A control that performs one action.",
		impls: [
			{ name: "ui/button <Button>", tag: /^Button$/, from: UI("button") },
			{ name: "raw <button>", tag: /^(button|motion\.button)$/, signatures: true },
			{ name: "ArcadeButton", tag: /^ArcadeButton$/ },
			{ name: "css .cta-push", cls: /\bcta-push\b/ },
			{
				name: "link styled as button",
				tag: /^(Link|a)$/,
				cls: /(?=.*\brounded)(?=.*\bp[xy]-)(?=.*(\bbg-|\bborder\b))/,
				signatures: true,
			},
			{ name: "named *Button component", tag: /^(?!Button$|ArcadeButton$)[A-Z]\w*Button$/ },
		],
	},
	{
		role: "input",
		sameRoleNote: "Text or choice entry.",
		impls: [
			{ name: "ui/input <Input>", tag: /^Input$/, from: UI("input") },
			{ name: "raw <input>", tag: /^input$/, signatures: true },
			{ name: "ui/textarea <Textarea>", tag: /^Textarea$/, from: UI("textarea") },
			{ name: "raw <textarea>", tag: /^textarea$/, signatures: true },
			{ name: "ui/select <Select>", tag: /^Select$/, from: UI("select") },
			{ name: "ui/native-select", tag: /^NativeSelect$/ },
			{ name: "raw <select>", tag: /^select$/, signatures: true },
			{ name: "ui/checkbox|switch|slider", tag: /^(Checkbox|Switch|Slider)$/, from: /components\/ui\// },
			{ name: "ui/calendar", tag: /^Calendar$/ },
			{ name: "named *SearchBar", tag: /^\w*SearchBar$/ },
		],
	},
	{
		role: "tabs",
		sameRoleNote: "Switching between peer views.",
		impls: [
			{ name: "ui/tabs <Tabs>", tag: /^Tabs$/, from: UI("tabs") },
			{ name: "role=tab / tablist", attr: ["role", /^tab(list)?$/] },
			{ name: "ui/toggle-group", tag: /^ToggleGroup$/ },
			{ name: "shuffle ModeSwitcher / ModePill", tag: /^(ModeSwitcher|ModePill)$/ },
			{ name: "hand-rolled tab state (setActiveTab, setTab, setFilter, setView)", call: /^set(ActiveTab|Tab|Filter|View|Mode|Section)$/ },
		],
	},
	{
		role: "toast",
		sameRoleNote: "Transient confirmation or event.",
		impls: [
			{ name: "sonner toast() calls", call: /^toast(\.\w+)?$/ },
			{ name: "ui/sonner <Toaster>", tag: /^Toaster$/ },
			{ name: "AchievementPopup", tag: /^AchievementPopup$/ },
			{ name: "CompletionCelebration", tag: /^CompletionCelebration$/ },
			{ name: "MatchCelebration", tag: /^MatchCelebration$/ },
		],
	},
	{
		role: "emptyState",
		sameRoleNote: "What a screen shows when it has nothing.",
		impls: [
			{ name: "ui/empty <Empty>", tag: /^Empty$/, from: UI("empty") },
			{ name: "named *Empty* component", tag: /^[A-Z]\w*Empty\w*$|^Empty[A-Z]\w*$/ },
			{
				name: "inline empty copy",
				text: /\b(no|nothing|none|empty|haven't|hasn't|not yet)\b[^.]*\b(yet|found|here|results?|items?|entries|friends?|watchlists?|shows?|activity|reviews?|films?|titles?|journal|history|notifications?|achievements?)\b/i,
			},
		],
	},
	{
		role: "loading",
		sameRoleNote: "What a screen shows while it waits.",
		impls: [
			{ name: "ui/skeleton <Skeleton>", tag: /^Skeleton$/, from: UI("skeleton") },
			{ name: "named *Skeleton component", tag: /^[A-Z]\w*Skeleton$/ },
			{ name: "ui/spinner <Spinner>", tag: /^Spinner$/, from: UI("spinner") },
			{ name: "lucide Loader icons", tag: /^(Loader2?|LoaderCircle)$/, from: /lucide/ },
			{ name: "class animate-pulse", cls: /\banimate-pulse\b/ },
			{ name: "class animate-spin", cls: /\banimate-spin\b/ },
			{ name: "CountdownLoader", tag: /^CountdownLoader$/ },
			{ name: "loading copy", text: /^\s*["'`]?(loading|saving|sending|searching|fetching|rolling|projecting)\b/i },
		],
	},
	{
		role: "avatar",
		sameRoleNote: "A person's face or initial.",
		impls: [
			{ name: "ui/avatar <Avatar>", tag: /^Avatar$/, from: UI("avatar") },
			{ name: "raw <img> rounded-full", tag: /^img$/, cls: /\brounded-full\b/, signatures: true },
			{ name: "initial-in-circle div", tag: /^(div|span)$/, cls: /(?=.*\brounded-full\b)(?=.*\b(items-center|grid|place-items-center)\b)(?=.*\b(h|size)-\d)(?=.*\b(uppercase|font-(bold|semibold|medium))\b)/, signatures: true },
			{ name: "named *Avatar component", tag: /^(?!Avatar$)[A-Z]\w*Avatar\w*$/ },
		],
	},
	{
		role: "poster",
		sameRoleNote: "One film or show's poster image.",
		impls: [
			{ name: "named *Poster* component", tag: /^[A-Z]\w*Poster\w*$/ },
			{ name: "raw <img> with a poster src", tag: /^img$/, attr: ["src", /poster|image\.tmdb|getTmdbImageUrl|TMDB_IMAGE/i], signatures: true },
			{ name: "hardcoded image.tmdb.org URL", text: /image\.tmdb\.org/ },
			{ name: "getTmdbImageUrl() calls", call: /^getTmdbImageUrl$/ },
		],
	},
];

const scopeRe = /\.(tsx?)$/;
function runImpl(impl: Impl) {
	const inProduct = (s: Site) => s.scope === "app" && scopeRe.test(s.file);
	let sites: Site[] = [];
	let sigs: string[] = [];
	if (impl.call) {
		const re = impl.call;
		sites = calls.filter((c) => inProduct(c) && re.test(c.callee));
	} else if (impl.text) {
		const re = impl.text;
		sites = lits.filter(
			(l) => inProduct(l) && (l.ctx === "jsxText" || l.ctx === "constant") && re.test(l.text),
		);
	} else {
		const hits = jsx.filter((u) => {
			if (!inProduct(u)) return false;
			if (impl.tag && !impl.tag.test(u.tag)) return false;
			if (impl.from && !(u.from && impl.from.test(u.from))) return false;
			if (impl.cls && !impl.cls.test(u.cls)) return false;
			if (impl.notCls?.test(u.cls)) return false;
			if (impl.notFile?.test(u.file)) return false;
			if (impl.attr) {
				const v = u.attrs[impl.attr[0]];
				if (!v || !impl.attr[1].test(v)) return false;
			}
			return true;
		});
		sites = hits;
		if (impl.signatures) sigs = hits.map((h) => signature(h.cls));
	}
	const files = uniq(sites.map((s) => s.file)).sort();
	const distinct = uniq(sigs);
	return {
		name: impl.name,
		count: sites.length,
		fileCount: files.length,
		files,
		sites: sortedSites(sites),
		...(impl.signatures ? { distinctVisualSignatures: distinct.length, unstyled: sigs.filter((s) => !s).length } : {}),
	};
}

const components = Object.fromEntries(
	ROLES.map((r) => [
		r.role,
		{ sameRoleNote: r.sameRoleNote, implementations: r.impls.map(runImpl) },
	]),
);

const buttonVariants = jsx
	.filter((u) => u.scope === "app" && u.tag === "Button" && u.from && UI("button").test(u.from))
	.reduce<Record<string, number>>((acc, u) => {
		const k = `${u.attrs.variant ?? "default"}/${u.attrs.size ?? "default"}${u.cls ? "+override" : ""}`;
		acc[k] = (acc[k] ?? 0) + 1;
		return acc;
	}, {});

const uiPrimitiveUse = readdirSync(join(SRC, "components/ui"))
	.map((f) => `src/components/ui/${f}`)
	.map((f) => ({
		file: f,
		importedByAppFiles: tsScans.filter((s) => s.scope === "app" && (importEdges.get(s.file) ?? []).includes(f)).length,
		reachedByRoute: reachedByAnyRoute.has(f),
	}))
	.sort((a, b) => a.importedByAppFiles - b.importedByAppFiles || a.file.localeCompare(b.file));

/* ------------------------------------------------------------------ motion */

const keyframeDefs = cssLines.flatMap((l, i) => {
	const m = l.match(/^\s*@keyframes\s+([\w-]+)/);
	return m?.[1] ? [{ name: m[1], line: i + 1 }] : [];
});
const localKeyframeDefs = lits.flatMap((l) =>
	[...l.text.matchAll(/@keyframes\s+([\w-]+)/g)].flatMap((m) =>
		m[1] ? [{ name: m[1], site: siteStr(l) }] : [],
	),
);
const keyframeNames = uniq([...keyframeDefs, ...localKeyframeDefs].map((k) => k.name)).sort();
const keyframeCollisions = keyframeNames.filter(
	(n) => keyframeDefs.some((k) => k.name === n) && localKeyframeDefs.some((k) => k.name === n),
);
const cssAnimationRefs = cssLines.flatMap((l, i) =>
	/^\s*animation(-name)?:/.test(l) ? [{ text: l, site: `${cssPath}:${i + 1}` }] : [],
);
const keyframeUsage = keyframeNames.map((name) => {
	const re = new RegExp(`(^|[^\\w-])${name}([^\\w-]|$)`);
	const sites = lits.filter(
		(l) =>
			l.ctx !== "jsxText" &&
			re.test(l.text.replaceAll("_", " ").replace(/@keyframes\s+[\w-]+/g, "")),
	);
	const cssRefs = cssAnimationRefs.filter((r) => re.test(r.text)).map((r) => r.site);
	const files = uniq(sites.map((s) => s.file)).sort();
	return {
		name,
		definedAt: [
			...keyframeDefs.filter((k) => k.name === name).map((k) => `${cssPath}:${k.line}`),
			...localKeyframeDefs.filter((k) => k.name === name).map((k) => k.site),
		],
		tsxSites: sortedSites(sites),
		files,
		cssRefs,
		used: sites.length + cssRefs.length > 0,
		routes: uniq(files.flatMap(routesFor)).sort(),
	};
});

const durationLiterals = [
	...classUses.filter((c) => c.scope === "app" && MEASURES.duration?.(c.util)).map((c) => ({ value: c.util, site: siteStr(c) })),
	...styleProps
		.filter((p) => p.scope === "app" && /^(transition|animation|transitionDuration|animationDuration)$/.test(p.prop))
		.flatMap((p) => [...p.value.matchAll(/\b\d*\.?\d+m?s\b/g)].map((m) => ({ value: m[0], site: siteStr(p) }))),
	...lits
		.filter((l) => l.scope === "app" && /\[animation|animate-\[/.test(l.text))
		.flatMap((l) => [...l.text.matchAll(/\b\d*\.?\d+m?s\b/g)].map((m) => ({ value: m[0], site: siteStr(l) }))),
];
const toMs = (v: string) => {
	const d = v.match(/^duration-(?:\[)?([\d.]+)(ms|s)?/);
	const s = d ? `${d[1]}${d[2] ?? "ms"}` : v;
	const n = Number.parseFloat(s);
	return s.endsWith("ms") ? n : n * 1000;
};

function jsMotionNumbers(prop: RegExp) {
	const out: { value: string; site: string }[] = [];
	for (const scan of tsScans.filter((s) => s.scope === "app")) {
		const text = readFileSync(join(ROOT, scan.file), "utf8");
		text.split("\n").forEach((line, i) => {
			for (const m of line.matchAll(prop)) {
				if (m[1]) out.push({ value: m[1], site: `${scan.file}:${i + 1}` });
			}
		});
	}
	return out;
}
const motionFiles = tsScans.filter((s) => s.imports.some((i) => /^(motion|motion\/react|framer-motion)/.test(i.spec)));
const fileHasMotionLib = new Set(motionFiles.map((s) => s.file));
const jsDurations = jsMotionNumbers(/\bduration:\s*([\d.]+)/g).filter((d) => fileHasMotionLib.has(d.site.split(":")[0] ?? ""));
const jsEases = jsMotionNumbers(/\bease:\s*(\[[^\]]*\]|["'][\w-]+["'])/g).filter((d) => fileHasMotionLib.has(d.site.split(":")[0] ?? ""));
const jsSprings = jsMotionNumbers(/\b(stiffness:\s*\d+[,\s]+damping:\s*\d+)/g);

const cssEases = uniq(
	cssLines.flatMap((l) => [...l.matchAll(/cubic-bezier\([^)]*\)|\bease(?:-in|-out|-in-out)?\b|\blinear\b/g)].map((m) => m[0])),
);

type Animator = "cssClass" | "cssInline" | "motionLib" | "confetti" | "raf" | "interval" | "canvas";
type Guard = "useReducedMotion" | "matchMedia" | "motionVariant" | "confettiFlag" | "MotionConfig";

const motionProfile = tsScans
	.filter((s) => s.scope === "app")
	.map((s) => {
		const fileClasses = classUses.filter((c) => c.file === s.file);
		const fileCalls = calls.filter((c) => c.file === s.file);
		const fileJsx = jsx.filter((u) => u.file === s.file);
		const fileStyles = styleProps.filter((p) => p.file === s.file);
		const usesMotion =
			fileHasMotionLib.has(s.file) &&
			(fileJsx.some((u) => /^(motion|AnimatePresence)\b/.test(u.tag)) ||
				fileCalls.some((c) => /^(useAnimate|animate|useSpring|useMotionValue|useTransform)$/.test(c.callee)));
		const animators: Animator[] = [];
		if (fileClasses.some((c) => MEASURES.animate?.(c.util) || MEASURES.twAnimateEntrance?.(c.util) || /^(rise-in|celebration-fade-in|episode-)/.test(c.util))) animators.push("cssClass");
		if (fileStyles.some((p) => /^animation/.test(p.prop))) animators.push("cssInline");
		if (usesMotion) animators.push("motionLib");
		if (fileCalls.some((c) => /(^|\.)confetti$|^fire$|^shoot/.test(c.callee)) || s.imports.some((i) => i.spec === "canvas-confetti")) animators.push("confetti");
		if (fileCalls.some((c) => /requestAnimationFrame$/.test(c.callee))) animators.push("raf");
		if (fileCalls.some((c) => /setInterval$/.test(c.callee))) animators.push("interval");
		if (fileJsx.some((u) => u.tag === "canvas")) animators.push("canvas");
		const guards: Guard[] = [];
		if (fileCalls.some((c) => c.callee === "useReducedMotion")) guards.push("useReducedMotion");
		if (fileCalls.some((c) => /matchMedia/.test(c.callee) && /reduced-motion/.test(c.args))) guards.push("matchMedia");
		if (fileClasses.some((c) => c.variants.some((v) => /^motion-(reduce|safe)$/.test(v)))) guards.push("motionVariant");
		if (lits.some((l) => l.file === s.file && /disableForReducedMotion/.test(l.text)) || readFileSync(join(ROOT, s.file), "utf8").includes("disableForReducedMotion")) guards.push("confettiFlag");
		if (fileJsx.some((u) => u.tag === "MotionConfig")) guards.push("MotionConfig");
		return { file: s.file, animators, guards, routes: routesFor(s.file) };
	})
	.filter((p) => p.animators.length > 0);

const JS_ANIMATORS: Animator[] = ["motionLib", "confetti", "raf", "canvas"];
const jsAnimated = motionProfile.filter((p) => p.animators.some((a) => JS_ANIMATORS.includes(a)));
const jsGuarded = jsAnimated.filter((p) => p.guards.length > 0);
const cssAnimatedOnly = motionProfile.filter((p) => !p.animators.some((a) => JS_ANIMATORS.includes(a)));
const hasGlobalReducedBlock = /@media \(prefers-reduced-motion: reduce\)/.test(cssNoComments);

/* ------------------------------------------------------------------- theme */

const allTsText = sourceFiles
	.filter((f) => !f.endsWith(".css"))
	.map((f) => ({ file: f, text: readFileSync(join(ROOT, f), "utf8") }));

type ThemeElement = {
	element: string;
	components?: RegExp;
	keyframes?: RegExp;
	classes?: RegExp;
	copy?: RegExp;
	/** Matches raw source, comments included, for elements drawn inline with no component. */
	source?: RegExp;
};
const THEME: ThemeElement[] = [
	{ element: "marquee board and bulbs", components: /^(MarqueeBoard|MarqueeBoardRow|MarqueeBadge|NowShowingMarquee|ShuffleMarquee|NowShowingHeader|SectionBoard|WatchlistReelHeader)$/, keyframes: /^(marquee-pulse|bulb-chase|chase)$/, copy: /\bnow showing\b/i },
	{ element: "ticket stub", components: /^TicketStub$/, copy: /\b(admit one|ticket)\b/i },
	{ element: "film strip and reel", components: /^(FilmStrip|FilmStripCard|FilmStripRow|TrackerReelCard|WatchlistReel|SprocketRow|SprocketRowBottom|VerticalSprockets)$/, keyframes: /^scroll-reel$/, copy: /\b(reel|film strip)\b/i, source: /sprocket|perforation/i },
	{ element: "drive-in screen", components: /^(DriveInScreen|HeroTrailer)$/, keyframes: /^(screen-entrance|projector-flicker)$/, copy: /\bprojector\b/i },
	{ element: "arcade button", components: /^ArcadeButton$/, keyframes: /^(arcade-bounce|button-underglow-pulse|plasma-shift)$/, classes: /\bcta-push\b/ },
	{ element: "car silhouettes", components: /^CarSilhouettes$/ },
	{ element: "clapperboard", components: /^ClapperboardStamp$/, copy: /\bclapper/i },
	{ element: "spotlight", components: /^Spotlights$/, keyframes: /^sway-(left|right)$/ },
	{ element: "curtains", copy: /\bcurtain/i, source: /curtain/i },
	{ element: "popcorn", copy: /\bpopcorn\b/i },
	{ element: "countdown leader", components: /^CountdownLoader$/, keyframes: /^(sweep-hand|scratch-flicker|pulse-text)$/ },
	{ element: "atmosphere: fog, stars, dust", components: /^(Atmosphere|ShuffleAtmosphere)$/, keyframes: /^(fog-drift-\d|fog-crawl|twinkle|dust-float)$/ },
	{ element: "retro overlays: grain and VHS", components: /^RetroOverlays$/, keyframes: /^(grain|vhs-scan)$/ },
	{ element: "neon", keyframes: /^(neon-cycle|neon-flicker|footer-flicker|shimmer-sweep)$/ },
	{ element: "poster display case", components: /^PosterDisplayCase$/, copy: /\bfeature presentation\b/i },
	{ element: "speaker post or box", copy: /\bspeaker\b/i, source: /speaker/i },
];

const theme = THEME.map((t) => {
	const jsxSites = t.components ? jsx.filter((u) => t.components?.test(u.tag)) : [];
	const clsSites = t.classes ? jsx.filter((u) => t.classes?.test(u.cls)) : [];
	const copySites = t.copy
		? lits.filter((l) => (l.ctx === "jsxText" || l.ctx === "constant") && t.copy?.test(l.text))
		: [];
	const frames = t.keyframes ? keyframeUsage.filter((k) => t.keyframes?.test(k.name)) : [];
	const sourceFilesHit = t.source
		? allTsText.filter((f) => t.source?.test(f.text) && scopeOf(f.file) === "app").map((f) => f.file)
		: [];
	const files = uniq([
		...jsxSites.map((s) => s.file),
		...clsSites.map((s) => s.file),
		...frames.flatMap((f) => f.files),
		...sourceFilesHit,
	]).sort();
	return {
		element: t.element,
		componentSites: sortedSites(jsxSites),
		classSites: sortedSites(clsSites),
		copySites: sortedSites(copySites),
		keyframes: frames.map((f) => ({ name: f.name, used: f.used, files: f.files })),
		sourceMentions: sourceFilesHit,
		files,
		routes: uniq(files.flatMap(routesFor)).sort(),
	};
});

/* ------------------------------------------------------------ token usage */

const uniqueTokenNames = uniq(tokenDefs.map((t) => t.name));
const cssRuleText = cssLines
	.map((l, i) => (inTokenBlock(i) ? "" : l))
	.join("\n");

function varUses(name: string) {
	const re = new RegExp(`var\\(${name}[),\\s]`);
	const tsFiles = allTsText.filter((f) => re.test(f.text)).map((f) => f.file);
	const inCss = re.test(cssRuleText);
	const inThemeAlias = tokenDefs.some((t) => t.block === "theme" && t.value.includes(`var(${name})`));
	return { tsFiles, inCss, inThemeAlias };
}
const classUsesOf = (themeName: string) => {
	const prefix = themeName.match(/^--(color|font|radius)-(.+)$/);
	if (!prefix?.[2]) return [] as ClassUse[];
	const [, ns, name] = prefix;
	if (ns === "color") return colourClasses.filter((c) => c.family === "token" && c.name === name);
	if (ns === "font") return classUses.filter((c) => c.util === `font-${name}`);
	return classUses.filter((c) => new RegExp(`^rounded(-[trblse]{1,2})?-${name}$`).test(c.util));
};

const tokenUsage = uniqueTokenNames.map((name) => {
	const v = varUses(name);
	const direct = classUsesOf(name);
	const aliasName = name.startsWith("--") ? `--color-${name.slice(2)}` : name;
	const viaClass = classUsesOf(aliasName);
	const appHits = [...direct, ...viaClass].filter((c) => c.scope === "app").length;
	const uiHits = [...direct, ...viaClass].filter((c) => c.scope === "ui").length;
	const defs = tokenDefs.filter((t) => t.name === name);
	return {
		name,
		definedAt: defs.map((d) => `${cssPath}:${d.line}`),
		themeAware: defs.some((d) => d.block === "dark"),
		appClassHits: appHits,
		uiClassHits: uiHits,
		varInTs: v.tsFiles,
		varInCssRules: v.inCss,
		used: appHits + uiHits + v.tsFiles.length > 0 || v.inCss,
	};
});
const liveRadius = classUses.filter((c) => c.scope === "app" && /^rounded(-|$)/.test(c.util));
const deadCssRules = [
	"display-title",
	"island-shell",
	"feature-card",
	"island-kicker",
	"nav-link",
	"rise-in",
	"site-footer",
	"page-wrap",
	"scrollbar-amber",
	"scrollbar-hide",
	"cta-push",
	"episode-check-bounce",
	"episode-row-flash",
	"celebration-fade-in",
].map((cls) => {
	const files = allTsText.filter((f) => new RegExp(`(^|[\\s"'\`])${cls}([\\s"'\`]|$)`, "m").test(f.text)).map((f) => f.file);
	const live = files.filter((f) => reachedByAnyRoute.has(f));
	return { class: cls, files, liveFiles: live };
});

/* ---------------------------------------------------- cascade: unlayered rules */

/** Unlayered CSS beats everything in Tailwind's @layer utilities, whatever its specificity. */
const layerRanges = cssLines.flatMap((l, i) => {
	if (!/^@layer\b/.test(l)) return [];
	let depth = 0;
	for (let j = i; j < cssLines.length; j++) {
		depth += (cssLines[j]?.match(/{/g) ?? []).length;
		depth -= (cssLines[j]?.match(/}/g) ?? []).length;
		if (depth === 0) return [[i, j] as const];
	}
	return [];
});
const unlayeredElementRules = cssLines.flatMap((l, i) => {
	const inLayer = layerRanges.some(([a, b]) => i >= a && i <= b);
	const declares = cssLines.slice(i + 1, i + 6).join(" ").split("}")[0] ?? "";
	return !inLayer &&
		!inTokenBlock(i) &&
		/^(a|button|a:hover|body|code)\b[^{]*(,|{)\s*$/.test(l) &&
		/\b(color|transition|background)\s*:/.test(declares)
		? [{ selector: l.replace(/\s*{\s*$/, ""), site: `${cssPath}:${i + 1}` }]
		: [];
});

/* -------------------------------------------------------------- light/dark */

const staticDarkTokens = ["drive-in-bg", "drive-in-card", "drive-in-border", "cream", "neon-pink", "neon-cyan", "neon-amber"];
const themeAwareClassHits = colourClasses.filter(
	(c) => c.scope === "app" && c.family === "token" && !staticDarkTokens.includes(c.name),
);
const staticClassHits = colourClasses.filter(
	(c) => c.scope === "app" && c.family === "token" && staticDarkTokens.includes(c.name),
);

const lightDark = {
	themeToggleFile: "src/components/ThemeToggle.tsx",
	themeToggleReachableFromRoute: reachedByAnyRoute.has("src/components/ThemeToggle.tsx"),
	headerReachableFromRoute: reachedByAnyRoute.has("src/components/Header.tsx"),
	footerReachableFromRoute: reachedByAnyRoute.has("src/components/Footer.tsx"),
	nextThemesProviderMounted: jsx.some((u) => u.tag === "ThemeProvider"),
	useThemeSites: sortedSites(calls.filter((c) => c.callee === "useTheme")),
	initScriptFollowsOsPreference: readFileSync(join(SRC, "routes/__root.tsx"), "utf8").includes("prefers-color-scheme"),
	darkVariantHits: { app: classUses.filter((c) => c.scope === "app" && c.variants.includes("dark")).length, ui: classUses.filter((c) => c.scope === "ui" && c.variants.includes("dark")).length },
	forcedDarkSites: sortedSites([
		...jsx.filter((u) => /(^|\s)dark(\s|$)/.test(u.cls)),
		...classUses.filter((c) => c.util === "[color-scheme:dark]"),
	]),
	staticDarkClassHits: staticClassHits.length,
	themeAwareClassHits: themeAwareClassHits.length,
	staticDarkFiles: uniq(staticClassHits.map((c) => c.file)).length,
	themeAwareFiles: uniq(themeAwareClassHits.map((c) => c.file)).length,
	filesMixingBoth: uniq(staticClassHits.map((c) => c.file)).filter((f) => themeAwareClassHits.some((c) => c.file === f)).length,
	themeAwareByToken: Object.entries(
		themeAwareClassHits.reduce<Record<string, number>>((acc, c) => {
			acc[c.name] = (acc[c.name] ?? 0) + 1;
			return acc;
		}, {}),
	).sort((a, b) => b[1] - a[1]),
	themeAwareSites: sortedSites(themeAwareClassHits),
};

/* ----------------------------------------------------------------- report */

const implCount = (role: string, name: string) =>
	(components[role]?.implementations ?? []).find((i) => i.name.startsWith(name))?.count ?? 0;
const implSigs = (role: string, name: string) =>
	(components[role]?.implementations ?? []).find((i) => i.name.startsWith(name))?.distinctVisualSignatures ?? 0;

const TW_SIZE: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60, "7xl": 72, "8xl": 96, "9xl": 128 };
function sizeToPx(raw: string) {
	const v = raw.replace(/^["'`]|["'`]$/g, "");
	const tw = v.match(/^text-(xs|sm|base|lg|[2-9]?xl)(\/.+)?$/)?.[1];
	if (tw) return TW_SIZE[tw] ?? null;
	const inner = v.match(/^text-\[(.+)\]$/)?.[1] ?? v;
	const n = inner.match(/^([\d.]+)(px|rem|em)?$/);
	if (!n?.[1]) return null;
	return n[2] === "rem" || n[2] === "em" ? Number(n[1]) * 16 : Number(n[1]);
}
const sizeHits = [
	...classUses.filter((c) => c.scope === "app" && MEASURES.fontSize?.(c.util)).map((c) => ({ raw: c.util, site: c })),
	...styleProps.filter((p) => p.scope === "app" && p.prop === "fontSize").map((p) => ({ raw: p.value, site: p as Site })),
];
const sizePx = sizeHits.map((h) => ({ ...h, px: sizeToPx(h.raw) }));
const resolvedSizes = sizePx.filter((h) => h.px !== null);
const fontSizePx = {
	distinctResolvedPx: uniq(resolvedSizes.map((h) => h.px as number)).sort((a, b) => a - b),
	unresolved: uniq(sizePx.filter((h) => h.px === null).map((h) => h.raw)),
	hitsByPx: Object.fromEntries(
		uniq(resolvedSizes.map((h) => h.px as number))
			.sort((a, b) => a - b)
			.map((px) => [px, resolvedSizes.filter((h) => h.px === px).length]),
	),
	hitsBelow12px: resolvedSizes.filter((h) => (h.px as number) < 12).length,
	hitsBelow10px: resolvedSizes.filter((h) => (h.px as number) < 10).length,
	sitesBelow10px: sortedSites(resolvedSizes.filter((h) => (h.px as number) < 10).map((h) => h.site)),
};

const DIALOG_FAMILIES: [string, RegExp][] = [
	["full-screen takeover", /\b!?w-screen\b/],
	["bottom sheet", /\bbottom-0\b/],
	["transparent shell, inner card hand-built", /\bbg-transparent\b/],
	["drive-in-card token skin", /\bbg-drive-in-card\b/],
	["raw hex skin", /\bbg-\[#/],
];
const dialogFamilies = Object.fromEntries(
	[...DIALOG_FAMILIES.map(([n]) => n), "unskinned"].map((name) => [name, [] as string[]]),
);
for (const u of jsx.filter((j) => j.scope === "app" && j.tag === "DialogContent")) {
	const family = DIALOG_FAMILIES.find(([, re]) => re.test(u.cls))?.[0] ?? "unskinned";
	dialogFamilies[family]?.push(siteStr(u));
}
const dialogWidths = Object.entries(
	jsx
		.filter((j) => j.scope === "app" && j.tag === "DialogContent")
		.reduce<Record<string, number>>((acc, u) => {
			const k = u.cls.match(/\bmax-w-(\[[^\]]+\]|\w+)/)?.[0] ?? "none";
			acc[k] = (acc[k] ?? 0) + 1;
			return acc;
		}, {}),
).sort((a, b) => b[1] - a[1]);

const appColours = colourSummary(["app"]);
const appCssColours = colourSummary(["app", "css"]);
const type = {
	fontSizePx,
	fontSize: measureBlock("fontSize"),
	fontFamily: measureBlock("fontFamily"),
	fontWeight: measureBlock("fontWeight"),
	letterSpacing: measureBlock("letterSpacing"),
	lineHeight: measureBlock("lineHeight"),
};
const spacing = {
	arbitrarySpacing: { app: measure("arbitrarySpacing", ["app"]), ui: measure("arbitrarySpacing", ["ui"]) },
	arbitrarySizing: { app: measure("arbitrarySizing", ["app"]), ui: measure("arbitrarySizing", ["ui"]) },
	arbitraryPosition: { app: measure("arbitraryPosition", ["app"]), ui: measure("arbitraryPosition", ["ui"]) },
	radius: measureBlock("radius"),
	shadow: measureBlock("shadow"),
	zIndex: measureBlock("zIndex"),
	allArbitrary: {
		appHits: arbitraryApp.length,
		appDistinct: uniq(arbitraryApp.map((c) => c.util)).length,
		uiHits: arbitraryUi.length,
		uiDistinct: uniq(arbitraryUi.map((c) => c.util)).length,
		appByFamily: arbitraryByFamily,
	},
	inlineStylePropsApp: styleProps.filter((p) => p.scope === "app" && p.inJsxStyle).length,
};
const usedFrames = keyframeUsage.filter((k) => k.used);
const motion = {
	keyframesDefined: keyframeNames.length,
	keyframesInStylesCss: uniq(keyframeDefs.map((k) => k.name)).length,
	keyframesInComponentStyleTags: uniq(localKeyframeDefs.map((k) => k.name)).length,
	keyframeCollisions,
	keyframesUsed: usedFrames.length,
	keyframesUnused: keyframeUsage.filter((k) => !k.used).map((k) => k.name),
	keyframes: keyframeUsage,
	tailwindAnimate: measure("animate", ["app"]),
	twAnimateEntrance: measure("twAnimateEntrance", ["app"]),
	transitionUtilities: measure("transition", ["app"]),
	easingUtilities: measure("easing", ["app"]),
	delayUtilities: measure("delay", ["app"]),
	cssDurationsMs: uniq(durationLiterals.map((d) => toMs(d.value))).sort((a, b) => a - b),
	cssDurationHits: durationLiterals.length,
	jsDurationsSeconds: uniq(jsDurations.map((d) => Number(d.value))).sort((a, b) => a - b),
	jsDurationHits: jsDurations.length,
	jsEases: Object.entries(
		jsEases.reduce<Record<string, number>>((acc, e) => {
			acc[e.value] = (acc[e.value] ?? 0) + 1;
			return acc;
		}, {}),
	).sort((a, b) => b[1] - a[1]),
	jsSprings: uniq(jsSprings.map((s) => s.value)),
	cssEases,
	motionLibFiles: motionFiles.map((s) => s.file),
	confettiFiles: tsScans.filter((s) => s.imports.some((i) => i.spec === "canvas-confetti")).map((s) => s.file),
	reducedMotion: {
		globalCssBlock: hasGlobalReducedBlock,
		cssOnlyAnimatedFiles: cssAnimatedOnly.length,
		jsAnimatedFiles: jsAnimated.length,
		jsAnimatedFilesGuarded: jsGuarded.length,
		jsUnguarded: jsAnimated.filter((p) => p.guards.length === 0),
		jsGuarded,
	},
	profile: motionProfile,
};

const roleSummary = Object.fromEntries(
	Object.entries(components).map(([role, c]) => [
		role,
		Object.fromEntries(c.implementations.map((i) => [i.name, { count: i.count, files: i.fileCount, ...(i.distinctVisualSignatures !== undefined ? { signatures: i.distinctVisualSignatures } : {}) }])),
	]),
);

const unusedTokens = tokenUsage.filter((t) => !t.used).map((t) => t.name);

const gates = {
	offTokenDistinctApp: appColours.offTokenDistinct,
	rawColourLiteralsApp: appColours.rawLiteralHits,
	tailwindPaletteClassesApp: appColours.paletteClassHits,
	arbitraryValuesApp: arbitraryApp.length,
	arbitraryFontSizesApp: type.fontSize.app.values.filter((v) => v.value.includes("[")).length,
	distinctFontSizesApp: fontSizePx.distinctResolvedPx.length,
	fontSizeHitsBelow10px: fontSizePx.hitsBelow10px,
	distinctZIndexApp: spacing.zIndex.app.distinct,
	rawButtonsApp: implCount("button", "raw <button>"),
	rawButtonSignatures: implSigs("button", "raw <button>"),
	customOverlaysApp: implCount("modal", "custom fixed overlay"),
	hardcodedTmdbUrls: implCount("poster", "hardcoded image.tmdb.org"),
	unusedKeyframes: motion.keyframesUnused.length,
	unusedTokens: unusedTokens.length,
	orphanComponentsApp: orphanApp.size,
	jsAnimatedFilesUnguarded: jsAnimated.length - jsGuarded.length,
	inlineStylePropsApp: spacing.inlineStylePropsApp,
	unlayeredElementRules: unlayeredElementRules.length,
};

const report = {
	meta: {
		generatedBy: "docs/redesign/phase-1/tools/design-drift.ts",
		gitHead: sh("git", ["rev-parse", "--short", "HEAD"]),
		srcDirtyFiles: sh("git", ["status", "--porcelain", "src"]).split("\n").filter(Boolean).length,
		filesScanned: { total: sourceFiles.length, app: tsScans.filter((s) => s.scope === "app").length, orphan: orphanApp.size, ui: tsScans.filter((s) => s.scope === "ui").length, emails: tsScans.filter((s) => s.scope === "emails").length, css: 1 },
		definitions: {
			nearDelta: NEAR_DELTA,
			looseDelta: LOOSE_DELTA,
			distinctValue: "Canonical rgb plus alpha after parsing. Token and palette classes resolve to their dark-mode value.",
			offToken: "No token has this rgb at any alpha. Includes values within nearDelta of a token, which are near misses, not matches.",
			signature: "Sorted visual utilities (colour, border, radius, shadow, type) in a className, ignoring layout and breakpoints.",
		},
		limitations: [
			"Class names assembled at runtime are not resolved. See dynamicClasses.",
			"String constants resolve for className signatures only when declared in the same file.",
			"Component roles match by name and class pattern, so a pattern that looks like a card but is not one can count.",
		],
	},
	headline: {
		distinctColoursApp: appColours.distinctValues,
		distinctColoursAppPlusCss: appCssColours.distinctValues,
		offTokenDistinctApp: appColours.offTokenDistinct,
		offTokenDistinctAppExcludingBlackWhite: appColours.offTokenDistinctExcludingBlackWhite,
		fontSizesApp: type.fontSize.app.distinct,
		fontSizesResolvedPxApp: fontSizePx.distinctResolvedPx.length,
		fontSizeHitsBelow12px: fontSizePx.hitsBelow12px,
		arbitraryValuesApp: { hits: arbitraryApp.length, distinct: uniq(arbitraryApp.map((c) => c.util)).length },
		keyframes: { defined: keyframeNames.length, used: usedFrames.length },
		reducedMotion: { jsAnimated: jsAnimated.length, jsGuarded: jsGuarded.length, globalCssBlock: hasGlobalReducedBlock },
	},
	gates,
	colours: {
		summary: { app: appColours, orphan: colourSummary(["orphan"]), ui: colourSummary(["ui"]), emails: colourSummary(["emails"]), css: colourSummary(["css"]), appPlusCss: appCssColours },
		alphaFamilies,
		tokenAlphaSteps,
		nearDuplicates,
		dynamicClasses: dynamicClasses.map((d) => ({ fragment: d.fragment, site: siteStr(d) })),
		unparsed: unparsedColours.map((c) => ({ raw: c.raw, site: siteStr(c) })),
		values: colourValues,
	},
	type,
	spacing,
	components,
	componentSummary: roleSummary,
	dialogFamilies,
	dialogWidths,
	buttonVariants,
	uiPrimitiveUse,
	orphanComponents,
	motion,
	theme,
	lightDark,
	unlayeredElementRules,
	tokens: {
		defined: uniqueTokenNames.length,
		unused: unusedTokens,
		usage: tokenUsage,
		cssClasses: deadCssRules,
		appRadiusHits: liveRadius.length,
	},
};

writeFileSync(OUT, `${JSON.stringify(report, null, "\t")}\n`);

const print = (label: string, value: unknown) =>
	console.log(`${label.padEnd(44)} ${typeof value === "object" ? JSON.stringify(value) : value}`);
print("files scanned", report.meta.filesScanned);
print("distinct colours (app)", appColours.distinctValues);
print("distinct colours (app + styles.css rules)", appCssColours.distinctValues);
print("off-token distinct (app)", appColours.offTokenDistinct);
print("  excluding black/white alpha", appColours.offTokenDistinctExcludingBlackWhite);
print("raw colour literals (app)", appColours.rawLiteralHits);
print("palette class hits (app)", appColours.paletteClassHits);
print("near-duplicate clusters (app)", appColours.nearDuplicateClusters);
print("font sizes (app, resolved px)", fontSizePx.distinctResolvedPx.length);
print("font size hits below 12px", fontSizePx.hitsBelow12px);
print("arbitrary values (app)", report.headline.arbitraryValuesApp);
print("keyframes defined/used", report.headline.keyframes);
print("reduced motion", report.headline.reducedMotion);
print("unused tokens", unusedTokens.length);
print("orphan components (app / ui)", { app: orphanApp.size, ui: orphanComponents.length - orphanApp.size });
print("theme toggle reachable", lightDark.themeToggleReachableFromRoute);
console.log(`wrote ${relative(ROOT, OUT)}`);
