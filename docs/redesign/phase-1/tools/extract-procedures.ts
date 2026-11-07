#!/usr/bin/env bun
/**
 * Static inventory of the tRPC surface, its database reads and writes, and its
 * UI callers. Read-only on the source tree. Output is deterministic, so
 * re-running it after a change and diffing procedures.json shows what moved.
 *
 *   bun docs/redesign/phase-1/tools/extract-procedures.ts
 *   bun docs/redesign/phase-1/tools/extract-procedures.ts --root <dir> --out <file>
 *
 * Limits, all of which lean toward under-reporting:
 * - Reads and writes are found by syntax, so a table passed through a variable
 *   is missed. `.set(someVariable)` is resolved by matching procedure input keys.
 * - A `db.query.x.findMany` with no `columns:` counts as a wildcard read of every
 *   column, because the row is returned whole. `namedReaders` excludes those.
 * - UI callers are matched on `trpc.<router>.<proc>`. Cache-only uses such as
 *   `queryFilter` are counted separately and do not make a procedure "called".
 */
import { execSync } from "node:child_process";
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

type Mode = "read" | "write";

interface Op {
	table: string;
	mode: Mode;
	kind: "insert" | "update" | "delete" | "select" | "query" | "raw";
	columns: string[] | "*" | "dynamic";
	file: string;
	line: number;
	inTransaction: boolean;
}

interface Column {
	ts: string;
	sql: string;
	type: string;
	hasDefault: boolean;
	primaryKey: boolean;
}

interface Table {
	tsName: string;
	sqlName: string;
	file: string;
	line: number;
	columns: Column[];
}

interface Module {
	file: string;
	source: ts.SourceFile;
	imports: Map<string, { file: string; name: string }>;
	functions: Map<string, ts.Node>;
	variables: Map<string, ts.Expression>;
}

const AUTH_MANAGED = new Set(["user", "session", "account", "verification"]);
const CALL_SUFFIXES = new Set([
	"queryOptions",
	"mutationOptions",
	"infiniteQueryOptions",
	"mutate",
	"query",
]);

function parseArgs() {
	const scriptDir = dirname(new URL(import.meta.url).pathname);
	const args = process.argv.slice(2);
	const flag = (name: string) => {
		const i = args.indexOf(name);
		return i >= 0 ? args[i + 1] : undefined;
	};
	const root = resolve(flag("--root") ?? join(scriptDir, "../../../.."));
	const out = resolve(flag("--out") ?? join(scriptDir, "../procedures.json"));
	return { root, out };
}

const { root: ROOT, out: OUT } = parseArgs();
const rel = (p: string) => relative(ROOT, p);

function walkFiles(dir: string, keep: (p: string) => boolean): string[] {
	if (!existsSync(dir)) return [];
	const found: string[] = [];
	for (const entry of readdirSync(dir).sort()) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			found.push(...walkFiles(full, keep));
		} else if (keep(full)) {
			found.push(full);
		}
	}
	return found;
}

const isTest = (p: string) => p.includes("__tests__") || /\.test\.tsx?$/.test(p);
const isSource = (p: string) => /\.tsx?$/.test(p) && !isTest(p);

function parse(file: string): ts.SourceFile {
	return ts.createSourceFile(
		file,
		readFileSync(file, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
}

const lineOf = (node: ts.Node) =>
	node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;

function unwrap(expr: ts.Expression): ts.Expression {
	let current = expr;
	while (
		ts.isParenthesizedExpression(current) ||
		ts.isAsExpression(current) ||
		ts.isSatisfiesExpression(current) ||
		ts.isNonNullExpression(current)
	) {
		current = current.expression;
	}
	return current;
}

function propName(name: ts.PropertyName): string | undefined {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
	return undefined;
}

/** Schema */

function chainRootCall(expr: ts.Expression): ts.CallExpression | undefined {
	let current = unwrap(expr);
	let last: ts.CallExpression | undefined;
	while (true) {
		if (ts.isCallExpression(current)) {
			last = current;
			current = unwrap(current.expression);
		} else if (ts.isPropertyAccessExpression(current)) {
			current = unwrap(current.expression);
		} else {
			return last;
		}
	}
}

function parseSchema(file: string) {
	const source = parse(file);
	const tables = new Map<string, Table>();
	const relations = new Map<string, Map<string, string>>();

	source.forEachChild((statement) => {
		if (!ts.isVariableStatement(statement)) return;
		for (const decl of statement.declarationList.declarations) {
			if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
			const init = unwrap(decl.initializer);
			if (!ts.isCallExpression(init)) continue;
			const callee = init.expression.getText();

			if (callee === "pgTable") {
				const [nameArg, colsArg] = init.arguments;
				if (!ts.isStringLiteral(nameArg)) continue;
				if (!ts.isObjectLiteralExpression(colsArg)) continue;
				const columns: Column[] = [];
				for (const prop of colsArg.properties) {
					if (!ts.isPropertyAssignment(prop)) continue;
					const tsName = propName(prop.name);
					const rootCall = chainRootCall(prop.initializer);
					const sqlArg = rootCall?.arguments[0];
					if (!tsName || !rootCall || !sqlArg || !ts.isStringLiteral(sqlArg)) {
						continue;
					}
					const text = prop.initializer.getText();
					columns.push({
						ts: tsName,
						sql: sqlArg.text,
						type: rootCall.expression.getText(),
						hasDefault: /\.(default|defaultNow|\$defaultFn|\$onUpdate|\$onUpdateFn)\(/.test(
							text,
						),
						primaryKey: text.includes(".primaryKey("),
					});
				}
				tables.set(decl.name.text, {
					tsName: decl.name.text,
					sqlName: nameArg.text,
					file: rel(file),
					line: lineOf(decl),
					columns,
				});
			}

			if (callee === "relations") {
				const [tableArg, builder] = init.arguments;
				if (!ts.isIdentifier(tableArg) || !ts.isArrowFunction(builder)) continue;
				const body = unwrap(builder.body as ts.Expression);
				if (!ts.isObjectLiteralExpression(body)) continue;
				const map = new Map<string, string>();
				for (const prop of body.properties) {
					if (!ts.isPropertyAssignment(prop)) continue;
					const key = propName(prop.name);
					const value = unwrap(prop.initializer);
					if (!key || !ts.isCallExpression(value)) continue;
					const target = value.arguments[0];
					if (target && ts.isIdentifier(target)) map.set(key, target.text);
				}
				relations.set(tableArg.text, map);
			}
		}
	});

	return { tables, relations };
}

/** Modules and the call graph */

function resolveImport(from: string, spec: string): string | undefined {
	let base: string;
	if (spec.startsWith("#/")) base = join(ROOT, "src", spec.slice(2));
	else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
	else return undefined;
	for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
		if (existsSync(candidate)) return candidate;
	}
	return undefined;
}

const moduleCache = new Map<string, Module>();

function loadModule(file: string): Module {
	const cached = moduleCache.get(file);
	if (cached) return cached;
	const source = parse(file);
	const mod: Module = {
		file,
		source,
		imports: new Map(),
		functions: new Map(),
		variables: new Map(),
	};
	source.forEachChild((statement) => {
		if (ts.isImportDeclaration(statement)) {
			const spec = (statement.moduleSpecifier as ts.StringLiteral).text;
			const target = resolveImport(file, spec);
			const named = statement.importClause?.namedBindings;
			if (target && named && ts.isNamedImports(named)) {
				for (const el of named.elements) {
					mod.imports.set(el.name.text, {
						file: target,
						name: (el.propertyName ?? el.name).text,
					});
				}
			}
		} else if (ts.isFunctionDeclaration(statement) && statement.name) {
			mod.functions.set(statement.name.text, statement);
		} else if (ts.isVariableStatement(statement)) {
			for (const decl of statement.declarationList.declarations) {
				if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
				const init = unwrap(decl.initializer);
				mod.variables.set(decl.name.text, decl.initializer);
				if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
					mod.functions.set(decl.name.text, init);
				}
			}
		}
	});
	moduleCache.set(file, mod);
	return mod;
}

const schemaFile = join(ROOT, "src/db/schema.ts");
const { tables, relations } = parseSchema(schemaFile);
const tableVars = new Set(tables.keys());

function isShadowed(id: ts.Identifier): boolean {
	let node: ts.Node | undefined = id.parent;
	while (node) {
		if (ts.isFunctionLike(node)) {
			for (const param of node.parameters) {
				const names: string[] = [];
				const collect = (n: ts.BindingName) => {
					if (ts.isIdentifier(n)) names.push(n.text);
					else for (const el of n.elements) {
						if (ts.isBindingElement(el)) collect(el.name);
					}
				};
				collect(param.name);
				if (names.includes(id.text)) return true;
			}
		}
		if (ts.isBlock(node)) {
			for (const statement of node.statements) {
				if (!ts.isVariableStatement(statement)) continue;
				for (const decl of statement.declarationList.declarations) {
					if (ts.isIdentifier(decl.name) && decl.name.text === id.text) return true;
				}
			}
		}
		node = node.parent;
	}
	return false;
}

function tableOf(expr: ts.Expression | undefined): string | undefined {
	if (!expr) return undefined;
	const inner = unwrap(expr);
	if (!ts.isIdentifier(inner) || !tableVars.has(inner.text)) return undefined;
	return isShadowed(inner) ? undefined : inner.text;
}

function objectKeys(expr: ts.Expression): string[] | "dynamic" {
	const inner = unwrap(expr);
	if (ts.isObjectLiteralExpression(inner)) {
		const keys: string[] = [];
		for (const prop of inner.properties) {
			if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
				const key = propName(prop.name);
				if (key) keys.push(key);
			} else if (ts.isSpreadAssignment(prop)) {
				const nested = objectKeys(prop.expression);
				if (nested !== "dynamic") keys.push(...nested);
			}
		}
		return keys;
	}
	if (ts.isConditionalExpression(inner)) {
		const a = objectKeys(inner.whenTrue);
		const b = objectKeys(inner.whenFalse);
		return [...(a === "dynamic" ? [] : a), ...(b === "dynamic" ? [] : b)];
	}
	if (
		ts.isBinaryExpression(inner) &&
		inner.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
	) {
		return objectKeys(inner.right);
	}
	if (ts.isCallExpression(inner)) {
		const callback = inner.arguments.find(
			(a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a),
		) as ts.ArrowFunction | undefined;
		if (callback && !ts.isBlock(callback.body)) return objectKeys(callback.body);
	}
	return "dynamic";
}

function inTransaction(node: ts.Node, receiver: string): boolean {
	if (receiver === "tx") return true;
	let current: ts.Node | undefined = node.parent;
	while (current) {
		if (
			ts.isCallExpression(current) &&
			ts.isPropertyAccessExpression(current.expression) &&
			current.expression.name.text === "transaction"
		) {
			return true;
		}
		current = current.parent;
	}
	return false;
}

function chainReceiver(expr: ts.Expression): string {
	let current = unwrap(expr);
	while (true) {
		if (ts.isCallExpression(current)) current = unwrap(current.expression);
		else if (ts.isPropertyAccessExpression(current)) {
			current = unwrap(current.expression);
		} else break;
	}
	return ts.isIdentifier(current) ? current.text : "";
}

function writeColumns(call: ts.CallExpression): string[] | "dynamic" {
	const columns = new Set<string>();
	let dynamic = false;
	let node: ts.Node = call;
	while (
		ts.isPropertyAccessExpression(node.parent) &&
		ts.isCallExpression(node.parent.parent)
	) {
		const outer: ts.CallExpression = node.parent.parent;
		const method = node.parent.name.text;
		const arg = outer.arguments[0];
		if (arg && (method === "values" || method === "set")) {
			const keys = objectKeys(arg);
			if (keys === "dynamic") dynamic = true;
			else for (const key of keys) columns.add(key);
		}
		if (arg && method === "onConflictDoUpdate" && ts.isObjectLiteralExpression(arg)) {
			for (const prop of arg.properties) {
				if (ts.isPropertyAssignment(prop) && propName(prop.name) === "set") {
					const keys = objectKeys(prop.initializer);
					if (keys !== "dynamic") for (const key of keys) columns.add(key);
				}
			}
		}
		node = outer;
	}
	return dynamic && columns.size === 0 ? "dynamic" : [...columns];
}

interface Analysis {
	ops: Op[];
	calls: { name: string; file: string; node: ts.Node }[];
}

function rawOps(text: string, node: ts.Node, mod: Module, ops: Op[]) {
	for (const table of tables.values()) {
		const fromJoin = new RegExp(`\\b(from|join)\\s+"?${table.sqlName}"?\\b`, "i");
		const named = table.columns
			.filter((c) => new RegExp(`\\b\\w+\\.${c.sql}\\b`).test(text))
			.map((c) => c.ts);
		if (fromJoin.test(text)) {
			ops.push({
				table: table.tsName,
				mode: "read",
				kind: "raw",
				columns: named,
				file: rel(mod.file),
				line: lineOf(node),
				inTransaction: false,
			});
		}
	}
}

function queryReads(
	table: string,
	arg: ts.Expression | undefined,
	node: ts.Node,
	mod: Module,
	ops: Op[],
	aliases: Map<string, string>,
) {
	const base = {
		mode: "read" as const,
		kind: "query" as const,
		file: rel(mod.file),
		line: lineOf(node),
		inTransaction: false,
	};
	let columns: string[] | "*" = "*";
	const inner = arg ? unwrap(arg) : undefined;
	if (inner && ts.isObjectLiteralExpression(inner)) {
		for (const prop of inner.properties) {
			if (!ts.isPropertyAssignment(prop)) continue;
			const key = propName(prop.name);
			const value = unwrap(prop.initializer);
			if (key === "columns" && ts.isObjectLiteralExpression(value)) {
				const keys = objectKeys(value);
				if (keys !== "dynamic") columns = keys;
			}
			if (key === "with" && ts.isObjectLiteralExpression(value)) {
				for (const rel_ of value.properties) {
					if (!ts.isPropertyAssignment(rel_)) continue;
					const relName = propName(rel_.name);
					const target = relName ? relations.get(table)?.get(relName) : undefined;
					if (target) {
						queryReads(target, rel_.initializer, node, mod, ops, aliases);
					}
				}
			}
			if (ts.isArrowFunction(value) && value.parameters[0]) {
				const param = value.parameters[0].name;
				if (ts.isIdentifier(param)) aliases.set(param.text, table);
			}
		}
	}
	ops.push({ ...base, table, columns });
}

function analyze(root: ts.Node, mod: Module): Analysis {
	const ops: Op[] = [];
	const calls: Analysis["calls"] = [];
	const aliases = new Map<string, string>();

	const visit = (node: ts.Node) => {
		if (ts.isCallExpression(node)) {
			const callee = node.expression;

			if (ts.isPropertyAccessExpression(callee)) {
				const method = callee.name.text;
				const table = tableOf(node.arguments[0]);

				if (table && ["insert", "update", "delete"].includes(method)) {
					ops.push({
						table,
						mode: "write",
						kind: method as Op["kind"],
						columns: method === "delete" ? [] : writeColumns(node),
						file: rel(mod.file),
						line: lineOf(node),
						inTransaction: inTransaction(node, chainReceiver(callee.expression)),
					});
				}

				if (table && ["from", "innerJoin", "leftJoin", "rightJoin"].includes(method)) {
					const receiver = unwrap(callee.expression);
					const bareSelect =
						method === "from" &&
						ts.isCallExpression(receiver) &&
						receiver.arguments.length === 0;
					ops.push({
						table,
						mode: "read",
						kind: "select",
						columns: bareSelect ? "*" : [],
						file: rel(mod.file),
						line: lineOf(node),
						inTransaction: false,
					});
				}

				if (
					(method === "findFirst" || method === "findMany") &&
					ts.isPropertyAccessExpression(callee.expression) &&
					ts.isPropertyAccessExpression(callee.expression.expression) &&
					callee.expression.expression.name.text === "query"
				) {
					const name = callee.expression.name.text;
					if (tableVars.has(name)) {
						queryReads(name, node.arguments[0], node, mod, ops, aliases);
					}
				}
			}

			if (ts.isIdentifier(callee)) {
				const local = mod.functions.get(callee.text);
				if (local) calls.push({ name: callee.text, file: mod.file, node: local });
				const imported = mod.imports.get(callee.text);
				if (imported && !imported.file.endsWith("db/schema.ts")) {
					const target = loadModule(imported.file);
					const fn = target.functions.get(imported.name);
					if (fn) calls.push({ name: imported.name, file: imported.file, node: fn });
				}
			}
		}

		if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
			const alias = aliases.get(node.expression.text);
			const table = alias ?? tableOf(node.expression);
			const column = node.name.text;
			if (table && tables.get(table)?.columns.some((c) => c.ts === column)) {
				ops.push({
					table,
					mode: "read",
					kind: "select",
					columns: [column],
					file: rel(mod.file),
					line: lineOf(node),
					inTransaction: false,
				});
			}
		}

		if (ts.isTaggedTemplateExpression(node) && node.tag.getText() === "sql") {
			const template = node.template;
			const text = ts.isNoSubstitutionTemplateLiteral(template)
				? template.text
				: [
						template.head.text,
						...template.templateSpans.flatMap((span) => [
							tableOf(span.expression)
								? tables.get(tableOf(span.expression) as string)?.sqlName
								: "?",
							span.literal.text,
						]),
					].join("");
			const spaced = text.replace(/\s+/g, " ");
			rawOps(spaced, node, mod, ops);
		}

		ts.forEachChild(node, visit);
	};

	visit(root);
	return { ops, calls };
}

function deepOps(start: Analysis, seen = new Set<ts.Node>()) {
	const collected: (Op & { via: string })[] = [];
	const helpers = new Set<string>();
	const queue = [...start.calls];
	while (queue.length > 0) {
		const call = queue.shift();
		if (!call || seen.has(call.node)) continue;
		seen.add(call.node);
		helpers.add(call.name);
		const mod = loadModule(call.file);
		const analysis = analyze(call.node, mod);
		for (const op of analysis.ops) collected.push({ ...op, via: call.name });
		queue.push(...analysis.calls);
	}
	return { ops: collected, helpers: [...helpers].sort() };
}

/** Routers and procedures */

function summarizeZod(expr: ts.Expression, mod: Module, depth = 0): string {
	const inner = unwrap(expr);
	if (ts.isIdentifier(inner)) {
		const local = mod.variables.get(inner.text);
		return local ? summarizeZod(local, mod, depth) : inner.text;
	}
	const steps: { name: string; args: readonly ts.Expression[] }[] = [];
	let current: ts.Expression = inner;
	while (ts.isCallExpression(current)) {
		const callee = current.expression;
		if (!ts.isPropertyAccessExpression(callee)) break;
		steps.unshift({ name: callee.name.text, args: current.arguments });
		current = callee.expression;
	}
	const head = steps[0];
	if (!head) return inner.getText().replace(/\s+/g, " ");

	const modifiers = steps.slice(1).map((s) => s.name);
	let core: string;
	if (head.name === "object" && head.args[0]) {
		const shape = unwrap(head.args[0]);
		if (ts.isObjectLiteralExpression(shape)) {
			const fields = shape.properties.flatMap((prop) => {
				if (!ts.isPropertyAssignment(prop)) return [];
				const key = propName(prop.name);
				const value = summarizeZod(prop.initializer, mod, depth + 1);
				return value.endsWith("?")
					? [`${key}?: ${value.slice(0, -1)}`]
					: [`${key}: ${value}`];
			});
			core = `{ ${fields.join(", ")} }`;
		} else core = "object";
	} else if (head.name === "enum" && head.args[0]) {
		const values = unwrap(head.args[0]);
		core = ts.isArrayLiteralExpression(values)
			? values.elements.map((e) => (e as ts.StringLiteral).text).join("|")
			: "enum";
	} else if (head.name === "array" && head.args[0]) {
		core = `${summarizeZod(head.args[0], mod, depth + 1)}[]`;
	} else if (head.name === "record") {
		core = "record";
	} else {
		core = head.name;
	}

	const limits = steps
		.slice(1)
		.filter((s) => (s.name === "min" || s.name === "max") && s.args[0])
		.map((s) => `${s.name}=${s.args[0].getText()}`);
	if (limits.length > 0) core = `${core}(${limits.join(",")})`;
	if (modifiers.includes("nullable") || modifiers.includes("nullish")) {
		core = `${core}|null`;
	}
	if (
		modifiers.includes("optional") ||
		modifiers.includes("nullish") ||
		modifiers.includes("default")
	) {
		core = `${core}?`;
	}
	return core;
}

interface RawProcedure {
	router: string;
	name: string;
	kind: "query" | "mutation";
	access: "protected" | "public";
	file: string;
	line: number;
	endLine: number;
	input: string;
	handler: ts.Node;
	mod: Module;
}

function procedureFrom(
	router: string,
	name: string,
	init: ts.Expression,
	mod: Module,
): RawProcedure | undefined {
	let kind: RawProcedure["kind"] | undefined;
	let handler: ts.Node | undefined;
	let input = "none";
	let current = unwrap(init);
	while (ts.isCallExpression(current)) {
		const callee = current.expression;
		if (!ts.isPropertyAccessExpression(callee)) break;
		const method = callee.name.text;
		if (method === "query" || method === "mutation") {
			kind = method;
			handler = current.arguments[0];
		}
		if (method === "input" && current.arguments[0]) {
			input = summarizeZod(current.arguments[0], mod);
		}
		current = callee.expression;
	}
	if (!kind || !handler || !ts.isIdentifier(current)) return undefined;
	const access = current.text === "protectedProcedure" ? "protected" : "public";
	const source = mod.source;
	return {
		router,
		name,
		kind,
		access,
		file: rel(mod.file),
		line: lineOf(init),
		endLine: source.getLineAndCharacterOfPosition(init.getEnd()).line + 1,
		input,
		handler,
		mod,
	};
}

function routerProperties(
	expr: ts.Expression,
): ts.ObjectLiteralExpression | undefined {
	const inner = unwrap(expr);
	if (ts.isObjectLiteralExpression(inner)) return inner;
	if (ts.isCallExpression(inner) && inner.arguments[0]) {
		return routerProperties(inner.arguments[0]);
	}
	return undefined;
}

function collectProcedures(): RawProcedure[] {
	const rootFile = join(ROOT, "src/integrations/trpc/router.ts");
	const rootMod = loadModule(rootFile);
	const appRouter = rootMod.variables.get("trpcRouter");
	const appProps = appRouter ? routerProperties(appRouter) : undefined;
	if (!appProps) throw new Error("trpcRouter not found in router.ts");

	const procedures: RawProcedure[] = [];
	for (const prop of appProps.properties) {
		if (!ts.isPropertyAssignment(prop)) continue;
		const mount = propName(prop.name) as string;
		const value = unwrap(prop.initializer);
		if (!ts.isIdentifier(value)) continue;

		const imported = rootMod.imports.get(value.text);
		const mod = imported ? loadModule(imported.file) : rootMod;
		const init = mod.variables.get(imported ? imported.name : value.text);
		const props = init ? routerProperties(init) : undefined;
		if (!props) continue;

		for (const member of props.properties) {
			if (!ts.isPropertyAssignment(member)) continue;
			const name = propName(member.name) as string;
			const procedure = procedureFrom(mount, name, member.initializer, mod);
			if (procedure) procedures.push(procedure);
		}
	}
	return procedures;
}

/** UI references */

interface UiRef {
	file: string;
	line: number;
	use: string;
	cacheOnly: boolean;
}

function scanUi() {
	const files = walkFiles(join(ROOT, "src"), isSource).filter(
		(f) => !f.includes("integrations/trpc/routers/"),
	);
	const refs = new Map<string, UiRef[]>();
	const pattern = /\btrpc\s*\.\s*(\w+)\s*\.\s*(\w+)(?:\s*\.\s*(\w+))?/g;
	const bodies = new Map<string, string>();
	for (const file of files) {
		const text = readFileSync(file, "utf8");
		bodies.set(file, text);
		for (const match of text.matchAll(pattern)) {
			const [, router, proc, suffix = "bare"] = match;
			const line = text.slice(0, match.index).split("\n").length;
			const key = `${router}.${proc}`;
			const list = refs.get(key) ?? [];
			list.push({
				file: rel(file),
				line,
				use: suffix,
				cacheOnly: !CALL_SUFFIXES.has(suffix) && suffix !== "bare",
			});
			refs.set(key, list);
		}
	}
	return { refs, bodies };
}

function authClientWrites() {
	const writes: { column: string; file: string; line: number }[] = [];
	for (const file of walkFiles(join(ROOT, "src"), isSource)) {
		const source = parse(file);
		const visit = (node: ts.Node) => {
			if (
				ts.isCallExpression(node) &&
				node.expression.getText() === "authClient.updateUser" &&
				node.arguments[0]
			) {
				const keys = objectKeys(node.arguments[0]);
				if (keys !== "dynamic") {
					for (const column of keys) {
						writes.push({ column, file: rel(file), line: lineOf(node) });
					}
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return writes;
}

/** Assembly */

function git(command: string): string {
	try {
		return execSync(`git ${command}`, {
			cwd: ROOT,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim();
	} catch {
		return "";
	}
}

function uniq<T>(items: T[]): T[] {
	return [...new Set(items)];
}

function shapeOps(ops: (Op & { via?: string })[], mode: Mode) {
	const byTable = new Map<
		string,
		{ columns: Set<string>; wildcard: boolean; via: Set<string>; sites: Set<string> }
	>();
	for (const op of ops) {
		if (op.mode !== mode) continue;
		const entry = byTable.get(op.table) ?? {
			columns: new Set<string>(),
			wildcard: false,
			via: new Set<string>(),
			sites: new Set<string>(),
		};
		if (Array.isArray(op.columns)) {
			for (const column of op.columns) entry.columns.add(column);
		} else {
			entry.wildcard = true;
		}
		if (op.via) entry.via.add(op.via);
		entry.sites.add(`${op.file}:${op.line}`);
		byTable.set(op.table, entry);
	}
	return [...byTable.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([table, e]) => ({
			table,
			columns: [...e.columns].sort(),
			wildcard: e.wildcard,
			via: [...e.via].sort(),
			sites: [...e.sites].sort(),
		}));
}

function inputKeys(summary: string): string[] {
	return [...summary.matchAll(/(\w+)\??:/g)].map((m) => m[1]);
}

function main() {
	const raw = collectProcedures();
	const { refs, bodies } = scanUi();
	const authWrites = authClientWrites();

	const entryFiles = [
		...walkFiles(join(ROOT, "src/routes/api"), isSource),
		...walkFiles(join(ROOT, "src/scripts"), isSource),
	];

	const procedures = raw.map((p) => {
		const direct = analyze(p.handler, p.mod);
		const deep = deepOps(direct);
		const directOps: (Op & { via?: string })[] = direct.ops.map((op) => {
			if (op.columns !== "dynamic") return op;
			const keys = inputKeys(p.input);
			const table = tables.get(op.table);
			return {
				...op,
				columns: keys.filter((k) => table?.columns.some((c) => c.ts === k)),
			};
		});
		const allOps = [...directOps, ...deep.ops];
		const callers = refs.get(`${p.router}.${p.name}`) ?? [];
		const real = callers.filter((c) => !c.cacheOnly);
		const cache = callers.filter((c) => c.cacheOnly);

		const writesOutsideTx = uniq(
			allOps
				.filter((op) => op.mode === "write" && !op.inTransaction)
				.map((op) => op.table),
		).sort();
		const writeTables = uniq(
			allOps.filter((op) => op.mode === "write").map((op) => op.table),
		).sort();
		const hasOtherUserInput = /\b(userId|friendId)\??:/.test(p.input);
		const readTables = new Set(
			allOps.filter((op) => op.mode === "read").map((op) => op.table),
		);
		const directReadColumns = (table: string) =>
			directOps
				.filter((op) => op.mode === "read" && op.table === table)
				.flatMap((op) => (Array.isArray(op.columns) ? op.columns : []));

		return {
			path: `${p.router}.${p.name}`,
			router: p.router,
			name: p.name,
			kind: p.kind,
			access: p.access,
			file: p.file,
			line: p.line,
			endLine: p.endLine,
			input: p.input,
			tablesWritten: shapeOps(allOps, "write"),
			tablesRead: shapeOps(allOps, "read"),
			helpers: deep.helpers,
			uiCallers: real.map(({ file, line, use }) => ({ file, line, use })),
			uiCacheRefs: cache.map(({ file, line, use }) => ({ file, line, use })),
			zeroUiCallers: real.length === 0,
			transaction: {
				writeTables,
				writesOutsideTx,
				multiTableWriteOutsideTx: writesOutsideTx.length >= 2,
			},
			privacy: {
				takesOtherUserId: hasOtherUserInput,
				readsBlock: readTables.has("block"),
				readsFriendship: readTables.has("friendship"),
				namesVisibility:
					directReadColumns("watchEvent").includes("visibility") ||
					directReadColumns("journalEntry").includes("isPublic") ||
					directReadColumns("watchlist").includes("isPublic"),
			},
		};
	});

	const entries = entryFiles.map((file) => {
		const mod = loadModule(file);
		const direct = analyze(mod.source, mod);
		const deep = deepOps(direct);
		const ops = [...direct.ops, ...deep.ops];
		return {
			file: rel(file),
			tablesWritten: shapeOps(ops, "write"),
			tablesRead: shapeOps(ops, "read"),
		};
	});

	const uiText = [...bodies.entries()]
		.filter(([file]) => /src\/(routes|components)\//.test(file))
		.map(([, text]) => text)
		.join("\n");

	const deadProcedures = new Set(
		procedures.filter((p) => p.zeroUiCallers).map((p) => p.path),
	);
	const isLive = (id: string) => !deadProcedures.has(id);

	const tableReport = [...tables.values()].map((table) => {
		const writers = new Set<string>();
		const readers = new Set<string>();
		const columns = table.columns.map((column) => {
			const colWriters = new Set<string>();
			const namedReaders = new Set<string>();
			const wildcardReaders = new Set<string>();
			const sources = [
				...procedures.map((p) => ({
					id: p.path,
					w: p.tablesWritten,
					r: p.tablesRead,
				})),
				...entries.map((e) => ({
					id: e.file,
					w: e.tablesWritten,
					r: e.tablesRead,
				})),
			];
			for (const source of sources) {
				for (const w of source.w) {
					if (w.table !== table.tsName) continue;
					writers.add(source.id);
					if (w.columns.includes(column.ts)) colWriters.add(source.id);
				}
				for (const r of source.r) {
					if (r.table !== table.tsName) continue;
					readers.add(source.id);
					if (r.columns.includes(column.ts)) namedReaders.add(source.id);
					if (r.wildcard) wildcardReaders.add(source.id);
				}
			}
			for (const write of authWrites) {
				if (table.tsName === "user" && write.column === column.ts) {
					colWriters.add(`authClient.updateUser ${write.file}:${write.line}`);
				}
			}
			const uiMentions =
				uiText.match(new RegExp(`\\b${column.ts}\\b`, "g"))?.length ?? 0;
			return {
				column: column.ts,
				sql: column.sql,
				type: column.type,
				hasDefault: column.hasDefault,
				writers: [...colWriters].sort(),
				namedReaders: [...namedReaders].sort(),
				wildcardReaders: wildcardReaders.size,
				uiMentions,
				noWriter: colWriters.size === 0 && !column.primaryKey,
				noReader: namedReaders.size === 0 && wildcardReaders.size === 0,
				noNamedReader: namedReaders.size === 0,
				noLiveWriter:
					colWriters.size > 0 && ![...colWriters].some(isLive),
				noLiveNamedReader:
					namedReaders.size > 0 && ![...namedReaders].some(isLive),
			};
		});
		const authManaged = AUTH_MANAGED.has(table.tsName);
		return {
			table: table.tsName,
			sql: table.sqlName,
			file: table.file,
			line: table.line,
			authManaged,
			writers: [...writers].sort(),
			readers: [...readers].sort(),
			noWriter: writers.size === 0 && !authManaged,
			noReader: readers.size === 0 && !authManaged,
			noLiveWriter:
				!authManaged && writers.size > 0 && ![...writers].some(isLive),
			columns,
		};
	});

	const liveTables = tableReport.filter((t) => !t.authManaged);
	const flaggedColumns = liveTables.flatMap((t) =>
		t.columns.map((c) => ({ table: t.table, ...c })),
	);

	const report = {
		meta: {
			commit: git("rev-parse --short HEAD"),
			dirtyFiles: git("status --porcelain").split("\n").filter(Boolean).length,
			source: "docs/redesign/phase-1/tools/extract-procedures.ts",
		},
		summary: {
			routers: uniq(procedures.map((p) => p.router)).length,
			procedures: procedures.length,
			queries: procedures.filter((p) => p.kind === "query").length,
			mutations: procedures.filter((p) => p.kind === "mutation").length,
			public: procedures.filter((p) => p.access === "public").map((p) => p.path),
			tables: tableReport.length,
			zeroUiCallers: procedures.filter((p) => p.zeroUiCallers).map((p) => p.path),
			zeroUiCallersButCacheRefs: procedures
				.filter((p) => p.zeroUiCallers && p.uiCacheRefs.length > 0)
				.map((p) => p.path),
			multiTableWriteOutsideTx: procedures
				.filter((p) => p.transaction.multiTableWriteOutsideTx)
				.map((p) => ({
					path: p.path,
					tables: p.transaction.writesOutsideTx,
				})),
			otherUserReadsWithoutBlockCheck: procedures
				.filter(
					(p) =>
						p.kind === "query" &&
						p.privacy.takesOtherUserId &&
						!p.privacy.readsBlock,
				)
				.map((p) => p.path),
			tablesWithoutWriter: tableReport.filter((t) => t.noWriter).map((t) => t.table),
			tablesWithoutReader: tableReport.filter((t) => t.noReader).map((t) => t.table),
			columnsWithoutWriter: flaggedColumns
				.filter((c) => c.noWriter && !c.hasDefault)
				.map((c) => `${c.table}.${c.column}`),
			columnsDefaultOnly: flaggedColumns
				.filter((c) => c.noWriter && c.hasDefault)
				.map((c) => `${c.table}.${c.column}`),
			tablesWithoutLiveWriter: tableReport
				.filter((t) => t.noLiveWriter)
				.map((t) => t.table),
			columnsWithoutLiveWriter: flaggedColumns
				.filter((c) => c.noLiveWriter)
				.map((c) => `${c.table}.${c.column}`),
			columnsWithoutLiveNamedReader: flaggedColumns
				.filter((c) => c.noLiveNamedReader)
				.map((c) => `${c.table}.${c.column}`),
			columnsWithoutReader: flaggedColumns
				.filter((c) => c.noReader)
				.map((c) => `${c.table}.${c.column}`),
			columnsWithoutNamedReader: flaggedColumns
				.filter((c) => c.noNamedReader && !c.noReader)
				.map((c) => `${c.table}.${c.column}`),
		},
		procedures,
		entryPoints: entries,
		tables: tableReport,
	};

	writeFileSync(OUT, `${JSON.stringify(report, null, "\t")}\n`);
	console.log(JSON.stringify(report.summary, null, 2));
}

main();
