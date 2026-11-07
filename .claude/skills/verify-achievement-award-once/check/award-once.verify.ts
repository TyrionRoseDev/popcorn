// Exhaustive interleaving check of the REAL src/lib/evaluate-achievements.ts.
//
// For each scenario, several calls for the same user start at once. The
// explorer enumerates every order in which their statements against
// earned_achievement can commit (depth-first, replaying from scratch for each
// schedule) and checks the properties below on every schedule.
// Run through ../run.sh, not directly.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("#/env", () => ({
	env: { DATABASE_URL: "postgres://fake-db-never-connected/none" },
}));
vi.mock("#/db", async () => {
	const fake = await import("./fake-db");
	return { db: fake.db };
});

import {
	evaluateAchievements,
	syncAchievements,
} from "#/lib/evaluate-achievements";
import { callContext, resetWorld, USER_ID, world } from "./fake-db";

// ── Scenarios ──────────────────────────────────────────────────────────

interface Call {
	label: string;
	invoke: () => Promise<string[]>;
}
interface Scenario {
	name: string;
	why: string;
	initialEarned: string[];
	counts: Record<string, number>; // count(*) answers for non-earned tables
	calls: Call[];
}

const NOON = new Date(2026, 0, 1, 12, 0, 0); // avoids night-owl / early-bird
const watched = (): Call => ({
	label: 'evaluateAchievements(user, "watched")',
	invoke: () =>
		evaluateAchievements(USER_ID, "watched", {
			tmdbId: 603,
			mediaType: "movie",
			watchedAt: NOON,
			watchlistId: "wl-1",
		}),
});
const swipe = (): Call => ({
	label: 'evaluateAchievements(user, "swipe")',
	invoke: () => evaluateAchievements(USER_ID, "swipe"),
});
const review = (): Call => ({
	label: 'evaluateAchievements(user, "review")',
	invoke: () => evaluateAchievements(USER_ID, "review", { tmdbId: 603 }),
});
const sync = (): Call => ({
	label: "syncAchievements(user)",
	invoke: () => syncAchievements(USER_ID),
});

// Nine achievements that no scenario's counts can re-trigger; with one more,
// "trophy-case" (achievementCount >= 10) becomes due.
const NINE = [
	"plus-one",
	"inner-circle",
	"shared-popcorn",
	"coming-attractions",
	"word-of-mouth",
	"ticket-holder",
	"now-showing",
	"dear-diary",
	"rerun",
];

const SCENARIOS: Scenario[] = [
	{
		name: "two-first-watches",
		why: "watchlist.markWatched twice at once (two titles ticked quickly); markWatched notifies friends per returned id",
		initialEarned: [],
		counts: { watchlist_item: 1 },
		calls: [watched(), watched()],
	},
	{
		name: "two-swipes-cascade",
		why: "shuffle.recordSwipe twice at once crossing 50 swipes; channel-surfer then trophy-case cascade",
		initialEarned: NINE,
		counts: { shuffle_swipe: 50 },
		calls: [swipe(), swipe()],
	},
	{
		name: "three-swipes-cascade",
		why: "three concurrent swipes, same state",
		initialEarned: NINE,
		counts: { shuffle_swipe: 50 },
		calls: [swipe(), swipe(), swipe()],
	},
	{
		name: "swipe-vs-sync",
		why: "a swipe while the profile page runs achievement.sync",
		initialEarned: NINE,
		counts: { shuffle_swipe: 50 },
		calls: [swipe(), sync()],
	},
	{
		name: "swipe-vs-review",
		why: "two different actions at once, each earning one achievement that together reach trophy-case",
		initialEarned: NINE.slice(0, 8),
		counts: { shuffle_swipe: 50, review: 1 },
		calls: [swipe(), review()],
	},
];

// ── Explorer ───────────────────────────────────────────────────────────

interface Run {
	taken: number[];
	branching: number[];
	trace: string[];
	traceCalls: number[];
	results: (string[] | undefined)[];
	errors: (string | undefined)[];
	finalEarned: string[];
}

async function settle() {
	for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
}

async function runSchedule(s: Scenario, prefix: number[]): Promise<Run> {
	resetWorld(s.initialEarned, s.counts);
	const results: (string[] | undefined)[] = s.calls.map(() => undefined);
	const errors: (string | undefined)[] = s.calls.map(() => undefined);
	const done = s.calls.map(() => false);
	s.calls.forEach((c, i) => {
		callContext
			.run(i, () => c.invoke())
			.then(
				(r) => {
					results[i] = r;
					done[i] = true;
				},
				(e: unknown) => {
					errors[i] = e instanceof Error ? e.message : String(e);
					done[i] = true;
				},
			);
	});
	const taken: number[] = [];
	const branching: number[] = [];
	const trace: string[] = [];
	const traceCalls: number[] = [];
	for (;;) {
		await settle();
		const pend = [...world.pending].sort((a, b) => a.call - b.call);
		if (pend.length === 0) {
			if (done.every(Boolean)) break;
			throw new Error(
				"FakeDbGap: a call is blocked on something other than an earned_achievement statement",
			);
		}
		const step = taken.length;
		const k = step < prefix.length ? prefix[step] : 0;
		const op = pend[k];
		world.pending.splice(world.pending.indexOf(op), 1);
		const outcome = op.fire();
		trace.push(`call#${op.call + 1} ${op.describe} -> ${outcome}`);
		traceCalls.push(op.call);
		taken.push(k);
		branching.push(pend.length);
	}
	s.calls.forEach((c, i) => {
		trace.push(
			errors[i] !== undefined
				? `call#${i + 1} ${c.label} rejects: ${errors[i]}`
				: `call#${i + 1} ${c.label} returns [${(results[i] ?? []).join(", ")}]`,
		);
	});
	return {
		taken,
		branching,
		trace,
		traceCalls,
		results,
		errors,
		finalEarned: [...world.earned].sort(),
	};
}

async function explore(s: Scenario): Promise<Run[]> {
	const runs: Run[] = [];
	let prefix: number[] = [];
	for (;;) {
		const r = await runSchedule(s, prefix);
		runs.push(r);
		let j = r.taken.length - 1;
		while (j >= 0 && r.taken[j] + 1 >= r.branching[j]) j--;
		if (j < 0) break;
		prefix = [...r.taken.slice(0, j), r.taken[j] + 1];
	}
	return runs;
}

// A schedule is serial when each call's statements are contiguous: since the
// other tables are constant, that equals running the calls one after another.
function isSerial(r: Run): boolean {
	const seen = new Set<number>();
	let prev = -1;
	for (const c of r.traceCalls) {
		if (c !== prev) {
			if (seen.has(c)) return false;
			seen.add(c);
			prev = c;
		}
	}
	return true;
}

// ── Properties ─────────────────────────────────────────────────────────

const PROPERTIES = {
	noThrow:
		"No call rejects (a duplicate INSERT must not surface as a 500 to the user).",
	sound:
		"Every id a call returns as newly earned is in earned_achievement at the end and was not there at the start.",
	complete:
		"Every row added to earned_achievement is returned as newly earned by some call (no silent award, so no missed popup or friend notification).",
	reportOnceSerial:
		"When the calls run one after another, each achievement is returned as newly earned at most once in total.",
	reportOnce:
		"Even when the calls overlap, each achievement is returned as newly earned at most once in total (friends get one achievement_earned notification, not two).",
	sameOutcomeAsSerial:
		"Overlapping calls end with the same earned_achievement rows as some serial order (no meta achievement like trophy-case is skipped).",
} as const;
type Prop = keyof typeof PROPERTIES;

function violated(s: Scenario, r: Run, serialFinals: Set<string>): Prop[] {
	const out: Prop[] = [];
	const initial = new Set(s.initialEarned);
	const final = new Set(r.finalEarned);
	const reported = r.results.flatMap((x) => x ?? []);
	if (r.errors.some((e) => e !== undefined)) out.push("noThrow");
	if (reported.some((id) => !final.has(id) || initial.has(id)))
		out.push("sound");
	if ([...final].some((id) => !initial.has(id) && !reported.includes(id)))
		out.push("complete");
	const dup = reported.length !== new Set(reported).size;
	if (dup && isSerial(r)) out.push("reportOnceSerial");
	if (dup) out.push("reportOnce");
	if (!serialFinals.has(r.finalEarned.join(",")))
		out.push("sameOutcomeAsSerial");
	return out;
}

const knownFindings: string[] = JSON.parse(
	readFileSync(resolve(__dirname, "../known-findings.json"), "utf8"),
).known;

describe("achievement award-once (src/lib/evaluate-achievements.ts)", () => {
	it("holds on every interleaving of every scenario", async () => {
		const unexpected: string[] = [];
		const seenKeys = new Set<string>();
		const lines: string[] = [];
		for (const s of SCENARIOS) {
			const runs = await explore(s);
			const serialFinals = new Set(
				runs.filter(isSerial).map((r) => r.finalEarned.join(",")),
			);
			const firstBad = new Map<Prop, Run>();
			const badCount = new Map<Prop, number>();
			for (const r of runs) {
				for (const p of violated(s, r, serialFinals)) {
					badCount.set(p, (badCount.get(p) ?? 0) + 1);
					const prev = firstBad.get(p);
					if (!prev || r.trace.length < prev.trace.length) firstBad.set(p, r);
				}
			}
			lines.push(
				`\n=== ${s.name}: ${runs.length} schedules (${runs.filter(isSerial).length} serial) — ${s.why}`,
			);
			for (const p of Object.keys(PROPERTIES) as Prop[]) {
				const key = `${s.name}/${p}`;
				const n = badCount.get(p) ?? 0;
				if (n === 0) {
					lines.push(`  PASS ${p}`);
					continue;
				}
				seenKeys.add(key);
				const known = knownFindings.includes(key);
				if (!known) unexpected.push(key);
				lines.push(
					`  ${known ? "KNOWN FINDING" : "VIOLATED"} ${p} in ${n}/${runs.length} schedules: ${PROPERTIES[p]}`,
				);
				lines.push("    shortest counterexample:");
				for (const t of firstBad.get(p)?.trace ?? []) lines.push(`      ${t}`);
			}
		}
		const stale = knownFindings.filter((k) => !seenKeys.has(k));
		if (stale.length > 0) {
			lines.push(
				`\nKnown findings that no longer reproduce (confirm the fix, then remove them from known-findings.json): ${stale.join(", ")}`,
			);
		}
		lines.push(
			unexpected.length === 0 && stale.length === 0
				? "\nRESULT: OK (no violations beyond known-findings.json)"
				: `\nRESULT: FAIL unexpected=[${unexpected.join(", ")}] stale=[${stale.join(", ")}]`,
		);
		console.log(lines.join("\n"));
		expect({ unexpected, stale }).toEqual({ unexpected: [], stale: [] });
	}, 120_000);
});
