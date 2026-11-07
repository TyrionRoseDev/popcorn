# Gate 1: decisions for the owner

Popcorn should become one coherent, fully working, easy-to-use diary, with the drive-in theme kept. Phase 1 changed no product code. This page gives the five decisions only you can make, with options, evidence and trade-offs. Each option states what it costs.

Evidence labels are **measured** (a script or browser run produced it), **inferred** (reasoning from measured facts) or **judgement** (a person or agent classified it). All runs used disposable instances on HEAD `0562c26` plus your uncommitted changes. Nothing here touched production.

## The diagnosis in short

The product has no single answer to "what did I watch and what did I think". That sentence is the root of most of what follows, but the storage split is only part of the reason.

- **No diary exists.** `src/routes/app/` has no diary or history screen (measured). "Everything I've watched" has no screen or query (F25). The feed is the nearest thing, and it hides your own private notes even in Just Me (`02-task-flows.md`, main result 3).
- **Watching and logging are separate acts.** Skip on the review modal leaves a film marked Watched with no log (F03). Mark All on a show writes 5 `episode_watch` rows and no `watch_event`, so the show is missing from the feed and title page while watch time reads 5h 31m (`02-row-delta-matrix.md`).
- **Entry points each do their own thing.** Logging a film has 12 entry points and takes 4 to 9 actions (measured). The title page records 2h 16m of watch time, and a list card records 0h 0m for the same film.
- **Rewatching a film barely exists.** Pressing Watched on a rated film writes no rows. All 89 film rows in the flow run stayed at `watch_number` 1 (measured).
- **Failures look like emptiness.** A 500 reads as "you have nothing" on 9 screens, and only 4 of 30 query files read `isError` (measured).
- **Phone is broken in places.** At 390 wide the profile tab panel is 0 px tall, so Activity, Journal, Edit and Delete cannot be reached there (measured).

## The hypothesis holds only in part

You asked me to test whether the split across `user_title`, `watch_event`, `episode_watch`, `review` and `journal_entry` causes much of the incoherence. It is real, but it is not the main cause, and it names the wrong tables.

| If you did only this | Noticeable findings fixed (of 73) | High or critical fixed (of 25) |
| --- | ---: | ---: |
| Unify the five tables | 8 (11.0%) | 5 |
| Derive watched from logs, drop the `watchlist_item` flag | 15 (20.5%) | 7 |
| Unify the five and derive watched | 23 (31.5%) | 12 |
| One shared domain layer for the rules | 26 (35.6%) | 9 |
| All three | 46 (63.0%) | 19 |

Counting partial fixes, unifying the five reaches 18 of 73 (24.7%), and the domain layer reaches 56 of 73 (76.7%). These are judgement tags over measured findings, so treat them as sizes and not as exact shares. A second method agrees: the flows agent classified 12 main inconsistencies independently as 3 storage split, 4 entry points, 3 watched flag and 2 UI layer.

Evidence against the hypothesis:

- `review` is dead. It held 0 rows after 85 flows, and no live UI writes it.
- `user_title` holds no thoughts. It is a tracking pointer.
- Films are not split. Their thoughts live in one place.
- The most damaging store is `watchlist_item.watched`, which the hypothesis does not name.
- The two worst failures are layout and layering bugs that survive any data model.
- Both critical findings are missing rule checks.

Evidence for it: TV thoughts really do sit in two unlinked stores. One episode held a public "wonderful" journal note and a public 2-star "dreadful" review at once, and the title page shows only the review.

The split also gets something right. Event, state and progress are different things, so "merge everything into one table" is not the conclusion.

## Fix these two before anything else

Two critical findings reproduced at runtime (`privacy-repro` journey, `~/.cache/verify-popcorn/evidence/vp-20261106-234429/privacy-repro/db.log`). Whether production has them is unverified, though the code path is in committed HEAD.

- **F52.** A film logged as Private appears by title in `friend.watchActivity` for a friend.
- **F57.** A blocked stranger sent one crafted `watchEvent.create` and added a public entry and a notification to the blocker's account.

Both fixes are small and neither depends on any decision below. They are product code, so they wait for your go.

## Decision 1: who is it for, and what is its single primary job

Pick one as primary. The others can stay, but they stop setting priorities.

| Option | Primary job | Evidence for | Cost |
| --- | --- | --- | --- |
| **A. Personal diary** | "Remember what I watched and what I thought" | You call it a diary. Vocabulary already says Film Diary and Journal. The worst findings cluster here (F01, F03, F07, F25) | Needs a screen that does not exist. Social features become secondary |
| **B. Friends' film club** | "See and share what my friends watch, and pick something together" | Feed, shared lists, shuffle, recommendations, companions and notifications are about 8,800 lines | Privacy has to be right first. A club needs active friends, which production data must confirm |
| **C. Watch tracker** | "Know where I am and what's next" | Tracker is the largest feature at 5,884 lines. Episode actions take 3 to 5 steps | Films become second class. Thoughts become an add-on |

My lean is A, with friends as a layer on top, for one person who watches a lot and shares with a small circle. It is the only option that matches the product's name for itself, and its biggest gap is the one most findings point at. Usage data could overturn this.

## Decision 2: keep, merge or cut each feature

Line counts are measured. Recommendations assume option A and are provisional until usage data exists. If you pick B or C, the rows marked with an asterisk change.

| Feature | Lines | Evidence | Options | My lean |
| --- | ---: | --- | --- | --- |
| Film log and review | 2,658 | Core. 12 entry points, Skip writes no log | Keep | Keep, one logging flow everywhere |
| Series tracker | 5,884 | Works, but finishing a show leaves no diary trace (F07). "Remove from tracker" also deletes logs and reviews (F77) | Keep, or merge into the log model | Merge progress into the diary, keep the screen |
| Journal notes | 1,520 | Second store for TV thoughts, opposite default privacy (F24), missing from title page | Keep, merge, cut | Merge into the log |
| `review` table and router, `watched` and `todos` routers | n/a | No UI callers, 20 dead procedures in all | Cut | Cut, after checking production rows |
| `watchlist_item.watched` flag | n/a | Causes the most damage (F01). Sole evidence of skip-path watches | Keep, derive | Derive, backfill first |
| Watchlists and My Picks | 3,572 | Logging silently removes a film from a custom list but keeps it on My Picks | Keep, simplify | Keep as "want to watch" only |
| Shared lists | in above | Private log removes the item from a shared list for both people | Keep, cut | Keep if used* |
| Shuffle, solo and with a friend | 3,080 | 4 to 5 actions solo, 13 with a friend. Throws during server render. Match moment hidden by an achievement popup | Keep, cut solo or group, cut | Keep solo, decide group from usage* |
| Recommendations | 748 | 8 to 12 actions, labelled both Invite and Recommend | Keep, merge | Merge into "want to watch" with a "from" note |
| Friends and blocking | 1,742 | Blocks not enforced on 13 reads (F55) | Keep | Keep, enforce once |
| Feed | 682 | Currently the only working diary on a phone | Keep | Keep as friends' activity* |
| Companions and reciprocal logs | in log | Writes a row into a friend's diary with no consent, and the UI has no word for it (F13) | Keep, change to an invitation, cut | Change to an invitation |
| Notifications | 747 | Announces private logs to friends | Keep | Keep, rule fixed |
| Review reminders | small | Remind Later writes a public unrated log (F20) | Keep, cut | Keep, as a draft with no public log |
| Achievements | 2,108 | 45 defined, 9 unearnable, ladder counts list rows (F39), popups cover the first post-onboarding screen, the Match moment and Show Complete | Keep, shrink, cut | Shrink, and never interrupt a task |
| Onboarding | 1,802 | 18 to 21 actions to finish. A failed read at step 3 is a dead end | Keep, shorten | Shorten, first log within a minute |
| Profile stats and heatmap | 1,944 | Tabs unreachable at 390. Source of F52 | Keep | Keep, rebuild around the diary |
| Light theme and toggle | small | No user can reach the toggle, and 5 of 1,832 token uses respond to it | Cut, or build properly | Cut |
| 11 orphaned components, 3 unreached modals | small | No route imports them | Cut | Cut |

## Decision 3: how far may the schema change

No option needs a title table, and all three keep every row through expand-then-contract.

| Option | What changes | Fixed outright, of 73 noticeable | Fixed outright, of 25 high or critical | Risk |
| --- | --- | ---: | ---: | --- |
| **A. Rules only** | No table changes. One domain layer owns every write and read rule | 26 | 9 | Lowest. Two stores for TV thoughts remain, and the watched flag still needs syncing |
| **B. One truth for "watched"** | A, plus derive watched from logs, drop dead `review` and `review_text`, turn skip-path watches into real logs | 38 | 14 | Medium. Synthetic logs must be marked as such |
| **C. One log model** | B, plus journal notes become logs, with one visibility model and scope on every log. `episode_watch` stays as progress | 46 | 19 | Highest. `journal_entry` has no `media_type`, no event link and opposite default privacy |

Keep these constraints in view whichever you pick:

- `watch_event`, `episode_watch` and `journal_entry` hold data that exists nowhere else.
- `watched = true` with no event is the only trace of a skip-path watch, so dropping the flag without a backfill loses watches.
- Film runtime lives only on `watchlist_item`.
- `earned_achievement` must keep its rows. Re-evaluating against a new model would add and remove badges (F39, F41).
- `exportData` omits the diary (F58), so it is not a backup.

My lean is C, delivered in the order A, B, C so each step ships alone. B is a sensible place to stop if production rows show journal notes are rare.

## Decision 4: may I read production data, and how

Your done criteria need a production copy for the migration rehearsal, so "no access" has to change before Phase 3 migrations.

| Option | What I see | How | Trade-off |
| --- | --- | --- | --- |
| **A. None for now** | Nothing | Decide from the local evidence | Decisions 1 to 3 stay provisional. Migrations cannot be rehearsed |
| **B. Aggregates only** | Counts, no people or text | I write read-only SQL, you run it and paste the output | Safe and fast. Answers usage questions, but not data-shape edge cases |
| **C. Scrubbed copy** | Real shapes, with emails, names and text replaced | You dump with a read-only role, a script scrubs it, it loads into a disposable local container | Enough for rehearsal. Scrubbing must be checked before I touch it |
| **D. Full copy, local only** | Everything, including private notes | Same as C with no scrub | Most faithful, but exposes private diary text to this session |

My lean is B now and C before Phase 3. I would avoid D, because scrubbed text still proves row counts and invariants. With B, I would first ask about active users, rows per table, `review` and `review_text` counts, skip-path watches, journal notes per user, shuffle and shared-list use, and friendship counts.

## Decision 5: what to do with the 10 uncommitted files

The diagnosis measured these changes as part of the tree, so they affect the baselines. Details are in `uncommitted-review.md`.

| File or group | Verdict |
| --- | --- |
| `taste-profile.ts` and `taste-profile-step.tsx` | **Not safe as is.** Re-running step 3 can insert a second My Picks (`routers/taste-profile.ts:379`), and only the working tree can reach that path (F91) |
| `watchlist.ts` | Safe in code, but it reverses part of `14d3db4` by showing empty lists. Is that deliberate? |
| `achievement-celebration-provider.tsx` | Safe, with one caveat. It polls every 30 seconds, likely also on logged-out pages (inferred) |
| `calendar.tsx` and `review-modal.tsx` | Safe, commit together. They do not fix the date drift in F30 |
| `CLAUDE.md`, `tracker.$tmdbId.tsx`, `completion-celebration.tsx`, `profile.$userId.tsx` | Safe |

| Option | What happens | Trade-off |
| --- | --- | --- |
| **A. Commit in groups, fix taste-profile first** | I split them into reviewed commits on a branch and fix F91 | Cleanest base. Needs your answer on `watchlist.ts` |
| **B. Commit the safe groups, park taste-profile** | Safe groups land, the risky pair goes to a stash or branch | Fast, but onboarding keeps its HEAD behaviour |
| **C. You handle them** | I wait for a clean tree | You stay in control, and work waits on you |
| **D. Set all aside** | Stash everything and work from HEAD | Loses the fixes for now, and the baselines would need re-running |

My lean is A. Separately, `.claude/` and `docs/redesign/` are untracked. I suggest committing the verify-popcorn skill and these reports, and keeping `settings.local.json` out.

## Corrections to the done criteria

Three criteria need a change before Phase 3, and they are yours to accept or reject.

- **"Stay at 100" is not true today.** Accessibility medians run 82 to 100, and only `/` is at 100 on both Accessibility and SEO. It should say "reach". SEO on signed-in pages is of limited value, so I suggest gating SEO on public pages only.
- **"axe reports no serious issues" cannot prove contrast alone.** Baseline is 122 critical and 432 serious on routes, plus 14 and 91 in modals. axe could not decide 1,908 further contrast nodes, mostly over gradients. The criterion needs a manual contrast check too.
- **CI needs extending.** CI runs on pull requests only, has no end-to-end test, and one unit test already fails at HEAD (`watchlist.list`, a stale mock).

## Baselines at a glance

The full table is in `06-baselines.md`.

| Measure | Today |
| --- | --- |
| Screen and state cells | 456: 229 designed, 125 generic, 10 blank, 66 broken, 24 not applicable, 2 not reached |
| Flows driven | 85: 81 pass, 2 fail, 2 blocked |
| Logic findings | 89, of which 2 critical, 24 high, 42 medium, 21 low |
| tRPC procedures with no UI caller | 20 of 113 |
| Multi-table writes outside a transaction | 20 |
| Distinct colours, off-token | 312, 168 |
| Raw colour literals | 987 |
| Font size hits below 12px | 259 |
| Raw buttons, distinct signatures | 202, 145 |
| Client JS gzip | 845,505 B (`heic2any` is 46% of raw JS) |
| Tests | 145 of 146 pass |
| Lighthouse Performance, mobile as served | 52 to 59, limited by uncompressed transfer. With gzip, 61 to 90 on the 3 routes sampled |
| Lighthouse Performance, desktop | 69 to 88 |
| Cold title page, slowest tRPC call | 466.1 ms, 200.1 ms (localhost, quiet machine) |

## Where the deliverables are

All paths are under `docs/redesign/phase-1/`.

1. Screen and state inventory: `01-screen-state-inventory.md`, `01-inventory.json`.
2. Task-flow map: `02-task-flows.md`, `02-row-delta-matrix.md`, `02-flows.json`.
3. Concept map: `03-concept-map.md`, `procedures.json`.
4. Logic audit: `04-logic-audit.md`.
5. Design drift: `05-design-drift.md`, `05-drive-in-reference.md`.
6. Baselines: `06-baselines.md`, `06-baselines.json`.

Scripts that regenerate the numbers are in `tools/`, and journeys are in `.claude/skills/verify-popcorn/journeys/`.
