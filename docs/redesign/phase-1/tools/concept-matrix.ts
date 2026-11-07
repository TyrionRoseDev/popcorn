#!/usr/bin/env bun
/**
 * Builds the concept matrix from procedures.json and ui-vocab.json, then writes
 * it between the matrix markers in 03-concept-map.md. Run extract-procedures.ts
 * and extract-ui-vocab.ts first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const tools = dirname(new URL(import.meta.url).pathname);
const phase = join(tools, "..");
const report = JSON.parse(readFileSync(join(phase, "procedures.json"), "utf8"));
const vocab = JSON.parse(readFileSync(join(tools, "ui-vocab.json"), "utf8"));

interface Concept {
	name: string;
	stores: string[];
	words: string[];
	note: string;
}

const CONCEPTS: Concept[] = [
	{ name: "A watch or log", stores: ["watchEvent", "episodeWatch"],
		words: ["Mark watched", "Watch History", "Your Watch History", "logged", "Mark in tracker", "Watch event deleted"],
		note: "Two row types mean 'I watched this'. Films and whole shows get a watch_event. Episodes get an episode_watch. The two never link in practice, because the UI never passes watchEventId (F07, F08). 'Logged' appears only on the watch event card (watch-event-card.tsx:245)." },
	{ name: "A rating", stores: ["watchEvent.rating", "review.rating"],
		words: ["Your Rating", "Rating", "Star Ratings", "Rate &amp; Review"],
		note: "Rating lives on each event, so a title has no rating of its own (F89). review.rating has no live writer, yet six achievements read it (F16)." },
	{ name: "A review or thoughts", stores: ["watchEvent.note", "watchEvent.reviewText", "review.text", "journalEntry.note"],
		words: ["Your Review", "Leave a Review", "Submit Review", "Rate &amp; Review", "Share your thoughts…", "Add thoughts on", "Notes & Reviews", "Reviewed"],
		note: "The label says review and the column is note. The live review box writes watch_event.note. watch_event.review_text is read by the ratings drill-down and nothing live writes it (F17)." },
	{ name: "A note", stores: ["journalEntry.note", "watchEvent.note"],
		words: ["Your Note", "Edit Note", "Save Note", "Note", "Delete this note?", "Note saved"],
		note: "'Note' in the UI means journal_entry. 'note' in the schema also means the review text on watch_event. Same word, different rows (F84). Films have no journal entry at all (F23)." },
	{ name: "A diary entry", stores: ["watchEvent", "journalEntry"],
		words: ["Film Diary", "Journal", "Journal Entry", "Journal your thoughts", "Watch History", "Notes & Reviews"],
		note: "No table is called diary. The landing page says Film Diary (routes/index.tsx:23), the profile tab says Journal (profile.$userId.tsx:72), and that tab's component is DiaryTab (profile.$userId.tsx:1685). Five surfaces each show a subset (F25)." },
	{ name: "A show's progress", stores: ["episodeWatch", "userTitle.currentWatchNumber", "userTitle.seasonEpisodeCounts", "watchlistItem.watchedSeasons"],
		words: ["Progress", "Episode Tracker", "Series Tracker", "Tracker", "Completed", "Show Complete", "Mark as Complete", "Seasons Watched"],
		note: "Tracker and Progress are used for one thing. watched_seasons is a legacy second copy, and six rules decide 'complete' (F33)." },
	{ name: "A rewatch", stores: ["userTitle.currentWatchNumber", "episodeWatch.watchNumber", "watchEvent.watchNumber", "journalEntry.watchNumber"],
		words: ["Rewatch", "Start Rewatch", "Rewatch this show", "Start rewatching", "Watch 1"],
		note: "A rewatch exists for TV only. Films have no watch number above 1 (F04). 'Rewatch 2' and 'Watch 2' label the same state (F85)." },
	{ name: "A watchlist", stores: ["watchlist", "watchlistMember"],
		words: ["Watchlist", "Watchlists", "My Watchlists", "Create New Watchlist"],
		note: "Four list types share the table: default, custom, shuffle and recommendations. The schema comment names three (F73)." },
	{ name: "A saved title", stores: ["watchlistItem", "userTitle"],
		words: ["Add to Watchlist", "In watchlist", "Remove from watchlist", "Pick"],
		note: "user_title means 'tracked show' in the tracker and 'taste pick' in onboarding (F35, F99). 'Saved' itself never appears as a word for a title. My Picks is a server-side list name, written in three places (F66)." },
	{ name: "Watched status", stores: ["watchlistItem.watched", "watchlistItem.watchedAt", "watchlistItem.keptInWatchlist"],
		words: ["Watched", "Mark watched", "Marked as watched", "Removed from watched"],
		note: "Stored per list row, so a person has no watched status. Every other meaning is derived differently by each screen (F01, F06, F27)." },
	{ name: "A recommendation", stores: ["recommendation", "watchlistItem.recommendedBy", "watchlistItem.recommendationMessage"],
		words: ["Recommend", "Recommend to a friend", "Send Recommendation", "Recommendation sent!", "Invite", "Recommended by @"],
		note: "The title page button says Invite and opens the recommend form (F83). status is never written (F49)." },
	{ name: "A friend", stores: ["friendship", "block"],
		words: ["Friends", "Add Friend", "Friend Requests", "Your Friends", "Mutual", "Friends & Feed"],
		note: "The word is consistent. The accepted check is copied on 16 lines (F74), and block is a write-side rule only (F55)." },
	{ name: "A notification", stores: ["notification"],
		words: ["Notifications", "No notifications", "Delete all notifications"],
		note: "16 declared types, 3 never emitted and 1 emitted only by a dead procedure (F46). notification.data is the sole record of a recommendation answer (F49)." },
	{ name: "An achievement", stores: ["earnedAchievement"],
		words: ["Achievements", "Achievement Unlocked", "Compare Achievements", "Achievements Unlocked"],
		note: "45 defined and 9 impossible through the live UI (F16, F40). Rule data reads watchlist_item, not the log (F39)." },
	{ name: "A companion", stores: ["watchEventCompanion", "watchEvent.originEventId"],
		words: ["Watched With", "Watched with…", "Companion", "Watching With", "Shared"],
		note: "A companion row and a reciprocal watch_event are two records for one person (F10, F12, F14)." },
	{ name: "Visibility or privacy", stores: ["watchEvent.visibility", "journalEntry.isPublic", "watchlist.isPublic"],
		words: ["Public", "Private", "Only visible to you", "Visible to all your friends", "Only you & who you watched with", "Who can see this?", "Make private", "Make public"],
		note: "Three models. 'Public' means friends in the selector and any signed-in user in the code (F54). 'Hidden' means shuffle exclusion, not privacy (F68)." },
	{ name: "A shuffle or match", stores: ["shuffleSwipe"],
		words: ["Showtime Shuffle", "Shuffle", "MATCH!", "Match", "Curtain Call", "Hidden from Shuffle"],
		note: "Three names for one feature area. A match has no table of its own and is derived from swipes when the last member says yes (F67)." },
];

const short = (file: string) =>
	file.replace("src/integrations/trpc/routers/", "routers/").replace("src/components/", "").replace("src/routes/", "routes/");

const matches = (entries: { table: string; columns: string[]; wildcard: boolean }[], store: string) => {
	const [table, column] = store.split(".");
	return entries.some(
		(e) => e.table === table && (!column || e.wildcard || e.columns.includes(column)),
	);
};

const schemaLine = (store: string) => {
	const [table, column] = store.split(".");
	const entry = report.tables.find((t: { table: string }) => t.table === table);
	if (!entry) throw new Error(`unknown table ${table}`);
	if (column && !entry.columns.some((c: { column: string }) => c.column === column)) {
		throw new Error(`unknown column ${store}`);
	}
	return `\`${entry.sql}${column ? `.${column}` : ""}\` (schema.ts:${entry.line})`;
};

const UNIMPORTED = /(review-dialog|season-picker-modal|tracker-reel-card|season-row|episode-card|mode-switcher|mode-pill|hero-trailer|Footer|Header)\.tsx/;
const allHits = Object.values(vocab.hits).flat() as { text: string; at: string }[];
const wordCell = (word: string) => {
	const hits = allHits.filter((h) => h.text === word);
	const unique = [...new Set(hits.map((h) => h.at))].sort(
		(a, b) => Number(UNIMPORTED.test(a)) - Number(UNIMPORTED.test(b)),
	);
	if (unique.length === 0) throw new Error(`word not found in UI strings: ${word}`);
	const display = word.replace("&amp;", "&");
	return `"${display}" (${short(unique[0])}${unique.length > 1 ? `, ${unique.length} sites` : ""})`;
};

const rows: string[] = [];
const details: string[] = [];
for (const concept of CONCEPTS) {
	const procs = report.procedures as any[];
	const writers = procs.filter((p) => concept.stores.some((s) => matches(p.tablesWritten, s)));
	const live = writers.filter((p) => !p.zeroUiCallers).map((p) => p.path).sort();
	const dead = writers.filter((p) => p.zeroUiCallers).map((p) => p.path).sort();
	const readers = procs.filter(
		(p) => p.kind === "query" && !p.zeroUiCallers && concept.stores.some((s) => matches(p.tablesRead, s)),
	);
	const screens = new Map<string, string>();
	for (const reader of readers) {
		for (const caller of reader.uiCallers) {
			if (!screens.has(caller.file)) screens.set(caller.file, `${short(caller.file)}:${caller.line}`);
		}
	}
	const tables = new Set(concept.stores.map((s) => s.split(".")[0]));
	rows.push(`| ${concept.name} | ${tables.size} | ${concept.stores.length} | ${live.length} | ${dead.length} | ${screens.size} | ${concept.words.length} |`);
	details.push(
		[
			`### ${concept.name}`,
			"",
			`Stored in: ${concept.stores.map(schemaLine).join(", ")}.`,
			"",
			`Live writers (${live.length}): ${live.map((p) => `\`${p}\``).join(", ") || "none"}.`,
			"",
			`Writers with no UI caller (${dead.length}): ${dead.map((p) => `\`${p}\``).join(", ") || "none"}.`,
			"",
			`Read on (${screens.size}): ${[...screens.values()].sort().map((s) => `\`${s}\``).join(", ") || "none"}.`,
			"",
			`UI words: ${concept.words.map(wordCell).join(", ")}.`,
			"",
			concept.note,
			"",
		].join("\n"),
	);
}

const block = [
	"| Concept | Tables | Stores | Live writers | Dead writers | Screens reading | UI words listed |",
	"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
	...rows,
	"",
	...details,
].join("\n");

const path = join(phase, "03-concept-map.md");
const text = readFileSync(path, "utf8");
writeFileSync(
	path,
	text.replace(/(<!-- matrix:start -->)[\s\S]*?(<!-- matrix:end -->)/, (_, open, close) => `${open}\n${block}\n${close}`),
);
console.log(rows.join("\n"));
