// In-memory stand-in for `#/db` that lets the explorer decide the order in
// which concurrent calls' statements against `earned_achievement` commit.
//
// Model of the database (what the verification assumes about Postgres):
// - Every awaited drizzle statement is one atomic step. JS between two awaits
//   in src/lib/evaluate-achievements.ts runs without interleaving.
// - `earned_achievement` has the unique index `earned_achievement_unique`
//   on (user_id, achievement_id) (src/db/schema.ts). An INSERT that hits it
//   raises 23505 unless it has ON CONFLICT DO NOTHING.
// - Every other table holds constant data for the duration of the scenario,
//   so statements on them commute with everything and run immediately
//   (no scheduling point). Their answers come from `world.counts`.
//
// Anything the evaluation path does that this fake does not model throws a
// `FakeDbGap` error. That is a modeling gap, not a product bug.

import { AsyncLocalStorage } from "node:async_hooks";
import { getTableName, type Table } from "drizzle-orm";

export const USER_ID = "user-1";
export const EARNED = "earned_achievement";

export class FakeDbGap extends Error {
	constructor(what: string) {
		super(`FakeDbGap: ${what} is not modeled by check/fake-db.ts`);
	}
}

export const callContext = new AsyncLocalStorage<number>();

export interface PendingOp {
	call: number;
	describe: string;
	fire: () => string; // runs atomically, returns the outcome text for the trace
}

export const world = {
	earned: new Set<string>(),
	counts: {} as Record<string, number>,
	pending: [] as PendingOp[],
};

export function resetWorld(earned: string[], counts: Record<string, number>) {
	world.earned = new Set(earned);
	world.counts = { ...counts };
	world.pending = [];
}

interface Stmt {
	kind: "select" | "selectDistinct" | "insert";
	fields?: Record<string, unknown>;
	table?: Table;
	values?: unknown;
	onConflictDoNothing?: boolean;
	returning?: boolean;
}

class UniqueViolation extends Error {
	code = "23505";
	constructor() {
		super(
			'duplicate key value violates unique constraint "earned_achievement_unique"',
		);
	}
}

function tableName(t: Table | undefined): string {
	if (!t) throw new FakeDbGap("statement without a table");
	return getTableName(t);
}

function submit(stmt: Stmt): Promise<unknown> {
	const name = tableName(stmt.table);
	if (name !== EARNED) {
		if (stmt.kind === "insert") throw new FakeDbGap(`INSERT into ${name}`);
		if (stmt.kind === "selectDistinct") return Promise.resolve([]);
		if (stmt.fields && "value" in stmt.fields) {
			return Promise.resolve([{ value: world.counts[name] ?? 0 }]);
		}
		return Promise.resolve([]);
	}

	const call = callContext.getStore();
	if (call === undefined) throw new FakeDbGap("statement outside a call");

	return new Promise((resolve, reject) => {
		if (stmt.kind === "insert") {
			const rows = (
				Array.isArray(stmt.values) ? stmt.values : [stmt.values]
			) as { achievementId: string }[];
			const ids = rows.map((r) => r.achievementId);
			const clause = stmt.onConflictDoNothing ? " ON CONFLICT DO NOTHING" : "";
			world.pending.push({
				call,
				describe: `INSERT earned_achievement(${ids.join(",")})${clause}${stmt.returning ? " RETURNING" : ""}`,
				fire: () => {
					const clash = ids.filter((id) => world.earned.has(id));
					if (clash.length > 0 && !stmt.onConflictDoNothing) {
						reject(new UniqueViolation());
						return `throws 23505 unique_violation on ${clash.join(",")}`;
					}
					const inserted = ids.filter((id) => !world.earned.has(id));
					for (const id of inserted) world.earned.add(id);
					const out = inserted.map((id) => ({
						id: `row-${id}`,
						userId: USER_ID,
						achievementId: id,
					}));
					resolve(stmt.returning ? out : { rowCount: out.length, rows: [] });
					return inserted.length > 0
						? `inserted ${inserted.join(",")}`
						: `conflict, 0 rows inserted`;
				},
			});
		} else {
			world.pending.push({
				call,
				describe: "SELECT achievement_id FROM earned_achievement",
				fire: () => {
					const rows = [...world.earned].map((id) => ({
						id: `row-${id}`,
						userId: USER_ID,
						achievementId: id,
						earnedAt: new Date(0),
					}));
					resolve(rows);
					return `${rows.length} rows`;
				},
			});
		}
	});
}

function builder(stmt: Stmt): unknown {
	const passthrough = new Set([
		"where",
		"groupBy",
		"orderBy",
		"limit",
		"innerJoin",
		"leftJoin",
	]);
	const target: Record<string, unknown> = {};
	const proxy: unknown = new Proxy(target, {
		get(_t, prop) {
			if (prop === "then") {
				return (
					onFulfilled?: (v: unknown) => unknown,
					onRejected?: (e: unknown) => unknown,
				) => {
					let p: Promise<unknown>;
					try {
						p = submit(stmt);
					} catch (e) {
						p = Promise.reject(e);
					}
					return p.then(onFulfilled, onRejected);
				};
			}
			if (typeof prop !== "string") return undefined;
			if (prop === "from")
				return (t: Table) => {
					stmt.table = t;
					return proxy;
				};
			if (prop === "values")
				return (v: unknown) => {
					stmt.values = v;
					return proxy;
				};
			if (prop === "onConflictDoNothing")
				return () => {
					stmt.onConflictDoNothing = true;
					return proxy;
				};
			if (prop === "returning")
				return () => {
					stmt.returning = true;
					return proxy;
				};
			if (passthrough.has(prop)) return () => proxy;
			throw new FakeDbGap(`query builder method .${prop}()`);
		},
	});
	return proxy;
}

export const db = {
	select: (fields?: Record<string, unknown>) =>
		builder({ kind: "select", fields }),
	selectDistinct: (fields?: Record<string, unknown>) =>
		builder({ kind: "selectDistinct", fields }),
	insert: (table: Table) => builder({ kind: "insert", table }),
	update: () => {
		throw new FakeDbGap("db.update");
	},
	delete: () => {
		throw new FakeDbGap("db.delete");
	},
	transaction: () => {
		throw new FakeDbGap("db.transaction");
	},
	execute: () => Promise.resolve({ rows: [] }),
	query: new Proxy(
		{},
		{
			get(_t, tableKey) {
				if (tableKey === "earnedAchievement")
					throw new FakeDbGap("db.query.earnedAchievement");
				return {
					findMany: () => Promise.resolve([]),
					findFirst: () => Promise.resolve(undefined),
				};
			},
		},
	),
};
