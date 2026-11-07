# Make Popcorn work: program plan

Popcorn becomes one coherent, fully working film and TV diary. The drive-in theme stays, but it is used where it means something and kept out of the way of tasks. The owner asked for the whole app to be fixed and delegated product calls. This plan records those calls and the order of work.

## Done means evidence

Each item needs an artifact. Nobody declares it done on judgement.

1. Playwright journeys pass for every core job on a disposable instance, and the DB rows match what the UI shows.
2. CI fails on raw colours or arbitrary sizes outside the tokens.
3. axe reports no serious or critical issues on any route or modal, and colour contrast is checked by hand where axe cannot decide.
4. Lighthouse Accessibility reaches 100 on every route, and SEO reaches 100 on public pages.
5. Migrations pass on a scrubbed production copy, with row counts and invariants checked.
6. A before and after report covers every Phase 1 baseline in `docs/redesign/phase-1/06-baselines.md`.
7. An unmoderated test script for first-time users exists, and its failures are fixed as bugs.
8. Production is healthy after the owner merges.

## Decisions the owner delegated

Recorded as decision records in `docs/redesign/decisions/`. The short form:

- **Who it is for.** One person who watches films and TV, plus a small circle of friends. The diary is the spine. The friends feed shows friends' diaries. The tracker shows the shows in progress in your diary.
- **Features.** Follow the keep, merge and cut table in `docs/redesign/phase-1/00-gate-1.md`.
- **Schema.** Go to one log model, through expand then contract, one step at a time.
- **Production data.** Counts first, then a scrubbed copy for rehearsal. Never full private text.
- **Theme.** Decided in `docs/redesign/decisions/` after the mock-ups, with the reasoning shown to the owner.

## How the work flows

- `main` is production. Merging to `main` deploys, so only the owner merges to `main`.
- `next` is the integration branch. Every slice is a PR into `next`.
- A slice is one user journey or one cross-cutting fix that ships alone.
- Each slice records the current behaviour with a verify-popcorn journey before it changes it, then proves the new behaviour with the same journey.
- Each slice PR gets a review from an agent that did not write it before it merges into `next`.
- Workers follow `docs/redesign/program/WORKER.md`.

## Waves

Wave 0 is safety and foundations. Waves 1 to 3 can overlap where files do not collide.

### Wave 0. Safety and foundations

- Privacy fixes F52 and F57, as a PR to `main`.
- The owner's saved work on `chore/owner-wip`, as a PR to `main`.
- Production health. The live site returns 503 with no TLS certificate, which needs diagnosis.
- CI on `next`, the stale unit test fixed, and an end-to-end job that runs journeys against recorded TMDB responses.
- A design-token gate that fails CI when raw colours or arbitrary sizes grow. Its budget only goes down, to zero by the end.

### Wave 1. Make what exists work

- Server render crashes on shuffle, settings and title pages. Not-found and bad-URL pages. Sign-in returns you to where you were going.
- Global CSS that overrides every link and transition. Phone layout, including profile tabs, overflow at 390 and 320 wide, and hover-only controls.
- Speed. Query caching defaults, route loaders so pages render with data, a TMDB cache on the server, compression, and loading the HEIC converter only when needed.
- Celebrations never cover a task. One queue, no stacked dialogs, and the Show Complete review offer is reachable.
- Every query shows a designed loading, error and empty state.

### Wave 2. One set of rules

- One server module owns visibility, friendship and blocks, and every read path uses it.
- One logging function writes a diary entry from every entry point, so the title page, list cards, tracker, recommendations and shuffle all behave the same.
- Watched status comes from the diary, not from a list flag.
- The feed is rebuilt on the diary. It sorts by watch date, pages correctly, and renders with data on first load.

### Wave 3. One log model

- Expand. Diary entries can hold episode, season and show notes. Journal notes migrate into entries with their privacy kept.
- Backfill. Watches that exist only as a list flag become real entries, marked as backfilled.
- Contract. Drop `review`, `watch_event.review_text`, `journal_entry` and the list watched flags, but only after the rehearsal on a production copy passes.

### Wave 4. One app, not many pages

- Navigation is Diary, Watching, Watchlist, Friends and Search.
- A Diary screen exists, and profile becomes a summary of it.
- The theme grammar, semantic tokens, type and spacing scale, one pattern per component role, and a motion spec are written, mocked up in the running app, then rolled out screen by screen.

### Wave 5. Prove it

- Journeys for every core job, axe and Lighthouse on every route, and the before and after report.
- The unmoderated test script for the owner to run.
