// Rebuilds 02-flows.json and the marked tables in 02-task-flows.md and 02-row-delta-matrix.md
// from the per-flow records a verify-popcorn run writes. Usage: bun gen-02-tables.ts <evidence-dir>
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const evidence = process.argv[2];
if (!evidence) throw new Error("usage: bun gen-02-tables.ts <evidence-dir>");
const here = dirname(new URL(import.meta.url).pathname);
const TABLES = ["user_title", "watch_event", "watch_event_companion", "episode_watch", "review", "journal_entry", "watchlist_item", "watchlist", "notification", "recommendation", "shuffle_swipe", "earned_achievement"];
const SHORT: Record<string, string> = { user_title: "ut", watch_event: "we", watch_event_companion: "wec", episode_watch: "ew", review: "rev", journal_entry: "je", watchlist_item: "wi", watchlist: "wl", notification: "ntf", recommendation: "rec", shuffle_swipe: "sw", earned_achievement: "ach" };

const dir = join(evidence, "flows");
type Rec = Record<string, any>;
const flows: Rec[] = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
const jobOrder = ["sign-up", "log-film-now", "log-film-past-date", "log-film-rewatch", "watched-with", "change-log", "delete-log", "change-privacy", "track-show", "mark-next-episode", "mark-season", "finish-show", "rewatch-show", "write-about-episode", "log-tv-from-watchlist", "save-for-later", "decide-what-to-watch", "recommend", "act-on-recommendation", "add-friend", "see-friends-watched", "review-own-history", "find-what-i-thought", "delete-account", "probe"];
// addItem from a flow's setup can land after the baseline clear. No inserted item means it was setup, not the flow.
for (const r of flows) if (!r.deltaSummary.watchlist_item?.ins) r.mutations = r.mutations.filter((m: string) => !m.endsWith("watchlist.addItem"));
flows.sort((a, b) => jobOrder.indexOf(a.job) - jobOrder.indexOf(b.job) || a.id.localeCompare(b.id));

const deltaCell = (r: Rec, t: string) => {
	const s = r.deltaSummary[t];
	if (!s) return "";
	return [s.ins && `+${s.ins}`, s.del && `-${s.del}`, s.upd && `~${s.upd}`].filter(Boolean).join(" ");
};
const firstEvidence = (r: Rec) => r.evidence.find((e: string) => /-end|-failure/.test(e)) ?? r.evidence[0] ?? "";
const lit = (v: unknown) => (v === true ? "yes" : v === false ? "no" : v == null ? "" : String(v));

const counts = ["| Job | Entry point | Result | Attempts | Actions (nav+task) | Fields | Screens | Decisions | Mutations | Evidence |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
for (const r of flows) {
	const c = r.counts;
	counts.push(`| ${r.job} | ${r.entry} | ${r.result} | ${r.attempts ?? 1} | ${c.actions} (${c.navActions}+${c.taskActions}) | ${c.fields} | ${c.screens} | ${c.decisions} | ${[...new Set(r.mutations as string[])].join(", ").replace(/\|/g, "/") || "none"} | \`${r.id}.json\`, \`${firstEvidence(r)}\` |`);
}

const notes = ["| Job | Entry point | Friction recorded during the run | Failure after all attempts |", "| --- | --- | --- | --- |"];
for (const r of flows) {
	if (!r.friction.length && !r.failure) continue;
	const clean = (t: string) => t.replace(/\|/g, "/").replace(/\s+/g, " ").slice(0, 220);
	notes.push(`| ${r.job} | ${r.entry} | ${r.friction.map(clean).join("; ")} | ${r.failure ? clean(r.failure) : ""} |`);
}

const summary = ["| Job | Entry points driven | Completed | Not completed | Min actions | Max actions | Min screens | Max screens | Max decisions |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
for (const job of jobOrder) {
	const all = flows.filter((r) => r.job === job);
	if (!all.length || job === "probe") continue;
	const rs = all.filter((r) => r.result === "pass");
	const a = rs.map((r) => r.counts.actions);
	const s = rs.map((r) => r.counts.screens);
	summary.push(`| ${job} | ${all.length} | ${rs.length} | ${all.length - rs.length} | ${Math.min(...a)} | ${Math.max(...a)} | ${Math.min(...s)} | ${Math.max(...s)} | ${Math.max(...rs.map((r) => r.counts.decisions))} |`);
}

const matrix = [`| Job | Entry point | ${TABLES.map((t) => SHORT[t]).join(" | ")} | Record |`, `| --- | --- | ${TABLES.map(() => "---").join(" | ")} | --- |`];
for (const r of flows) matrix.push(`| ${r.job} | ${r.entry} | ${TABLES.map((t) => deltaCell(r, t)).join(" | ")} | \`${r.id}.json\` |`);

const rcols = ["titleWatchedLit", "titleHistorySection", "titleNoteVisible", "feedOwn", "feedNote", "profileActivity", "profileNote", "profileJournalTab", "myPicksHasTitle", "myPicksTick", "trackerJournalTab", "trackerDetailNote", "trackerDetailProgress"];
const readers = [`| Job | Entry point | ${rcols.join(" | ")} |`, `| --- | --- | ${rcols.map(() => "---").join(" | ")} |`];
for (const r of flows) {
	const o = r.observations?.readers;
	if (!o) continue;
	readers.push(`| ${r.job} | ${r.entry} | ${rcols.map((c) => lit(o[c])).join(" | ")} |`);
}
const fcols = ["friendFeed", "friendFeedNote", "friendProfile", "friendProfileNote", "friendTitlePageMentionsOwner"];
const friend = [`| Job | Entry point | ${fcols.join(" | ")} | friend's bell (first 200 chars) |`, `| --- | --- | ${fcols.map(() => "---").join(" | ")} | --- |`];
for (const r of flows) {
	const o = r.observations?.friendReaders;
	const bell = (r.observations?.friendNotifications ?? "").replace(/\|/g, "/");
	if (!o && !bell) continue;
	const at = bell.indexOf("Notifications");
	friend.push(`| ${r.job} | ${r.entry} | ${fcols.map((c) => lit(o?.[c])).join(" | ")} | ${bell.slice(at < 0 ? 0 : at, (at < 0 ? 0 : at) + 200)} |`);
}

const flat = flows.map(({ delta, ...r }) => ({
	...r,
	deltaRows: delta.map((c: Rec) => ({ table: c.table, op: c.op, owner: c.owner, changed: c.changed ? Object.keys(c.changed) : undefined, row: c.row ? pick(c.row) : undefined })),
}));
function pick(row: Rec) {
	const keep = ["tmdb_id", "media_type", "rating", "note", "visibility", "scope", "scope_season_number", "scope_episode_number", "watch_number", "watched", "watched_at", "origin_event_id", "type", "status", "action", "achievement_id", "season_number", "episode_number", "is_public", "current_watch_number", "review_reminder_at", "name", "kept_in_watchlist", "action_taken"];
	return Object.fromEntries(Object.entries(row).filter(([k]) => keep.includes(k)));
}
writeFileSync(join(here, "02-flows.json"), JSON.stringify({ evidence, generatedFrom: "docs/redesign/phase-1/gen-02-tables.ts", tables: TABLES, legend: "actions = user actions: taps, field fills, key presses, navigation taps. Characters are not counted.", flows: flat }, null, 1));

function inject(file: string, blocks: Record<string, string[]>) {
	const p = join(here, file);
	if (!existsSync(p)) return;
	let s = readFileSync(p, "utf8");
	for (const [k, lines] of Object.entries(blocks)) {
		const re = new RegExp(`<!-- gen:${k} -->[\\s\\S]*?<!-- /gen:${k} -->`);
		s = s.replace(re, `<!-- gen:${k} -->\n${lines.join("\n")}\n<!-- /gen:${k} -->`);
	}
	writeFileSync(p, s);
}
inject("02-task-flows.md", { summary, counts, notes });
inject("02-row-delta-matrix.md", { matrix, readers, friend });
console.log(`flows=${flows.length} pass=${flows.filter((r) => r.result === "pass").length} blocked=${flows.filter((r) => r.result === "blocked").length} fail=${flows.filter((r) => r.result === "fail").length}`);
