# Domain and data design

This is the design the build follows. It synthesises two sketches: `sketch-a-evolve.md`, which reshapes the existing tables, and `sketch-b-new-model.md`, which creates new ones. Sketch A is the base. Where this page and a sketch disagree, this page wins. Read sketch A for the types, module signatures and migration SQL. Read the sections of sketch B named below for the parts grafted from it.

## Why sketch A is the base

- **No dual-write window.** Sketch B's riskiest step is a release where old and new tables are both live and a mirror keeps them in step. Sketch A has no mirror, because there is one table.
- **Ids survive.** Every `watch_event` id, and so every deep link in `notification.data`, stays valid without a remapping step.
- **Each release matches production.** The schema at every release is the production schema plus added columns, so a rollback is a redeploy.
- **The data is small.** Popcorn is one person and a few friends (inferred, counts pending). B's structural gains, such as a database-enforced title cache and per-run progress, help most at a scale this app does not have.

## What is grafted from sketch B

1. **Time zone capture first** (sketch B, PR order item 1). Add `user.time_zone`, written from the browser on each session, before the backfill that turns timestamps into `watched_on` dates. Users without a zone use Europe/London, and the backfill reports how many rows used the default.
2. **Database checks for scope shape** (sketch B, section 4). The `entry_scope_shape` check rejects an episode entry without season and episode numbers, and a film with any non-film scope. A test inserts every legal shape and one illegal shape of each kind.
3. **A parity test for visibility** (both sketches). The SQL visibility predicate and the in-memory one run over one fixture of owners, viewers, tags, friendships and blocks, and must agree on every pair.

Not grafted, and recorded as possible later work: the `title` cache table and `show_run`. The server-side TMDB cache from the speed slice covers the speed problem without a write-path dependency on TMDB.

## Decisions the sketches left open

- **Existing tagged copies stay.** The owner's rule is to lose no user data. Rows that tagging created in a friend's diary stay as accepted entries. DR-9 applies to new tags only. Sketch A's migration 0007 therefore removes nothing. It only marks existing companion rows as accepted.
- **Private notes stay private.** A private journal note never merges into an entry friends can see. It becomes its own Only me entry (sketch A).
- **List-flag watches become Only me entries,** origin backfilled. Flags on lists with more than one member are reported, not guessed (sketch A).
- **Progress has visibility.** DR-4 is amended so a show's progress has Friends or Only me visibility. Shows that already have progress start as Only me, because friends never saw them in the feed. New shows default to Friends. The Watching screen shows the setting per show.
- **Time-of-day achievements** use the time the entry was logged, `created_at`, because `watched_on` has no time.

## Build order

Each step is one PR into `next`. Each leaves the app working, moves every caller of the procedures it replaces, and deletes those procedures in the same PR. The migrations are numbered in this order.

1. **Audience and expand.** Create the `src/server/domain/` skeleton, the types, `audience.ts` with the parity test, and the import lint rule. Add `user.time_zone` and its client write. Migration 0005 adds the new columns, and 0006 backfills `watched_on`, `scope` and `origin`. Every read of another person's entries, notes, achievements, stats, heatmap and lists goes through the audience module (F52, F53, F54, F55, F75). This includes two leaks the PR 21 verifier found: a reciprocal copy carries the original entry's note and rating to any viewer even after the original turns private, and the profile `totalWatched`, `genreStats`, and `friend.list` `watchCount` and `avgRating` count private entries. Writers fill the new columns from here on.
2. **Dates.** Readers order by `watched_on`, and the date input becomes date only (F30).
3. **Invitations.** New tags create pending invitations after the friend check, not rows in a friend's diary. Existing tagged copies are marked accepted. The reciprocal write and `markFromNotification` are deleted (F11).
4. **One log.** `logEntry`, `updateEntry`, `deleteEntry` and `status.ts`. The title page, list card, review sheet, remind-later and completion review move to them. Migration 0008 turns list-flag watches into entries. The old watch procedures are deleted.
5. **Notes.** Write About writes entries. Migration 0009 turns journal notes into entries. The journal router is deleted.
6. **Diary and feed.** `diary.ts`, progress visibility, and the Diary screen. The old feed and history procedures are deleted. Export Data gains entries and progress (F58).
7. **Progress.** One completion rule. Remove from Watching keeps entries (F77).
8. **Achievements.** Counted from entries. Unearnable badges are removed. Awards from migrated rows are silent.
9. **Contract.** Constraints in their own release. Then the rehearsal on the scrubbed production copy, then the drops and the rename. The audit tables are dropped a month later.

Steps 1 to 8 can merge into `next` without production data. No step from 1 onward reaches `main` until the rehearsal on a scrubbed production copy passes for every migration in it.
