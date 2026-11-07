# Glossary and decision records

These records define what Popcorn's core objects are. Code, UI copy and migrations follow them. Each record names the evidence behind it. Finding ids such as F01 refer to `docs/redesign/phase-1/04-logic-audit.md`.

## Glossary

Use these words in UI copy and in code. The right column lists words to retire.

| Word | Meaning | Retire |
| --- | --- | --- |
| Title | A film or a TV show, identified by TMDB id and media type | |
| Entry | One time you watched something, with optional rating, note and companions. The diary is the list of your entries | log, watch event, review, journal entry, note card |
| Watched on | The calendar date of an entry, in the viewer's own day. It never shifts with time zones | |
| Rating | 1 to 5 stars on one entry. A title has no rating of its own, and the latest entry's rating is shown as "your rating" | review score |
| Note | The text on an entry | review, thoughts, journal, Dear Diary |
| Rewatch | Any entry after the first for the same title and scope. Its number comes from the order of entries | Watch 2, Rewatch 2 |
| Scope | What an entry covers: a film, a whole show, a season or an episode | General, Full Show |
| Progress | Which episodes of a show you have seen. Progress is a checklist, not a diary | |
| Watching | Shows with progress that are not finished | tracker, series tracker, episode tracker |
| Want to watch | Your queue of titles to watch | My Picks, default watchlist |
| List | A named collection of titles you make, alone or shared with friends | custom watchlist |
| Friend | Someone who accepted your request. Blocking removes the friendship and hides both people from each other everywhere | |
| Visibility | Who sees an entry: Friends or Only me. People tagged on an entry always see it | public, companion |
| Watched with | Friends you tag on an entry. They get an invitation to add it to their own diary | companion, reciprocal event |
| Recommendation | A title a friend sends you. Accepting it adds it to Want to watch, marked "from" them | invite (for recommending) |
| Feed | Your friends' entries and lists, newest watch first | |
| Achievement | A badge for a diary milestone. It never interrupts a task | |

## Decision records

### DR-1. The entry is the one record of watching something

**Decision.** "I watched it, and here is what I thought" is one object, the entry. It holds the title, scope, watched-on date, an optional rating, an optional note, visibility, and companions. Every place a user can say "I watched this" creates an entry through the same function.

**Evidence.** Watching and logging are separate today, so Skip leaves a film watched with no diary trace (F03), and TV thoughts live in two unlinked stores (`02-row-delta-matrix.md`, the "dreadful" and "wonderful" probe). Logging a film has 12 entry points with different side effects (`02-row-delta-matrix.md`, rows 1 to 6).

**Consequences.** `watch_event` becomes the entry table. `journal_entry` rows become entries (DR-5). `review` and `watch_event.review_text` are dropped (DR-7). Marking a film watched without saying anything still creates an entry, with no rating and no note.

### DR-2. Progress is separate from the diary, and the diary shows it

**Decision.** Episode checkmarks are progress, stored in `episode_watch`. Ticking episodes does not create one entry per episode. The diary shows each day's progress as one line, such as "Watched 5 episodes of Breaking Bad", derived from progress. Finishing a show offers an optional show entry for the rating and note.

**Evidence.** Mark All wrote 5 progress rows and nothing the diary or feed could show, while watch time rose to 5h 31m (`02-row-delta-matrix.md`, probe "Does marking all episodes create a show-level watch_event").

**Consequences.** Event and progress stay distinct, which the audit found sound (`04-logic-audit.md`, "What the split does correctly"). The diary reads two sources through one query.

### DR-3. Watched status is derived, never stored

**Decision.** A film is watched when you have an entry for it. A show is not started, watching or finished according to its progress, or an entry with scope show. Lists store only intent.

**Evidence.** The `watchlist_item.watched` flag disagrees with entries in several flows. A film marked from a custom list shows unwatched on its title page (F01). Deleting one of two entries leaves the flag set, and toggling it off keeps the entry (`02-row-delta-matrix.md`, row 10).

**Consequences.** `watched`, `watched_at`, `watched_seasons` and `kept_in_watchlist` on `watchlist_item` go away after backfill (DR-6). Logging a film no longer removes it from a list. Lists show a watched mark derived from your entries.

### DR-4. Two visibility levels, enforced in one place

**Decision.** An entry is visible to Friends or to Only me. People tagged on an entry always see it. One server module decides what a viewer may see. Every read path uses it, including feed, profile, stats, heatmap, notifications and shared lists. Blocking hides both people from each other on every read.

**Evidence.** "Public" promised friends but any signed-in user could read it (F54). Private titles reached friends through the heatmap (F52). Blocks were not enforced on 13 reads (F55). Notifications announced private entries (`02-task-flows.md`).

**Consequences.** Migration maps public to Friends, and private to Only me. Companion becomes Only me, and the tagged people keep access through the tagging rule.

**Amendment, 2026-11-07.** A show's progress also has Friends or Only me visibility, so progress lines in the feed respect privacy. Shows with existing progress start as Only me. New shows default to Friends. See `docs/redesign/architecture/DESIGN.md`.

### DR-5. Journal notes become entries

**Decision.** Each `journal_entry` becomes an entry with the same scope, season, episode, note and watch number. `is_public` true maps to Friends, otherwise Only me. The watched-on date is its creation date. If an entry already exists for the same person, title, scope and watch number, and has no note, the journal text becomes that entry's note instead.

**Evidence.** Journal notes are a second store for TV thoughts with the opposite default privacy (F24). The title page cannot show them, which makes "find what I thought months ago" fail for TV (`02-task-flows.md`).

**Consequences.** The table is dropped only after a rehearsal on a scrubbed production copy proves every row has a matching entry.

### DR-6. Watches that exist only as a list flag become entries

**Decision.** Each `watchlist_item` with `watched = true` and no entry for that person and title becomes an entry with no rating and no note. Its date is `watched_at`, and its origin is backfilled, so it can be told apart and audited. Runtime moves from the list item to the entry.

**Evidence.** A flag with no entry is the only trace of a skip-path watch, and film runtime lives only on the list item (`04-logic-audit.md`, "Migration constraints").

### DR-7. No separate review object

**Decision.** A review is an entry with a rating or a note. The `review` table and `watch_event.review_text` are dropped. If production holds rows, they become entries first.

**Evidence.** `review` held 0 rows after 85 flows, and no live UI writes it (`02-row-delta-matrix.md`). Production counts are still needed.

### DR-8. Logging again is always allowed

**Decision.** Logging a title you have logged before creates a new entry. It is a rewatch, numbered by date order. Films and shows behave the same.

**Evidence.** Pressing Watched on a rated film writes nothing, and every film entry has watch number 1 (`02-task-flows.md`, main result 4).

### DR-9. Watched with is an invitation

**Decision.** Tagging a friend sends them an invitation. If they accept, an entry is created in their own diary. Nobody writes into another person's diary.

**Evidence.** Tagging creates a row in the friend's diary with no consent, and the UI has no word for it (F13). An unvalidated companion id let a stranger write into any account (F57).

**Amendment, 2026-11-07.** This applies to new tags. Rows that tagging already created in a friend's diary stay as accepted entries, because the owner's rule is to lose no user data.

### DR-10. Celebrations never interrupt a task

**Decision.** Achievements and completions queue and show after the current task ends, one at a time, as a toast or banner unless the user opens them. Achievements count entries, not list rows. Ones that cannot be earned are removed.

**Evidence.** The achievement popup covered Show Complete, so its Continue button closed the hidden dialog and the review offer was lost (`02-task-flows.md`, main result 1). 9 of 45 achievements cannot be earned, and the watch ladder counts list rows (F39).

### DR-11. Navigation follows the objects

**Decision.** The primary navigation is Diary, Watching, Want to watch, Friends and Search. Diary is home. Profile is a summary page reached from your avatar. Shuffle becomes "Pick for me" inside Want to watch. Lists sit inside Want to watch.

**Evidence.** No diary screen exists, and the feed is the only working history on a phone (`02-task-flows.md`, main result 3).

### DR-12. The theme follows a grammar

**Decision.** Pending the mock-ups. It will state what each drive-in element means, where it may appear, and where it must stay out of a task. It uses real drive-in artefacts as reference (`docs/redesign/phase-1/05-drive-in-reference.md`).
