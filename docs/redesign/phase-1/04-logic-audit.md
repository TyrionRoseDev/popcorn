# Logic audit

Popcorn's owner wants one coherent app, and this audit tests one explanation for why it is not one today. The explanation is that "watched it and what I thought" is split across `user_title`, `watch_event`, `episode_watch`, `review` and `journal_entry`, and that this split causes much of the incoherence.

Paths are relative to `src/`, and `routers/` means `src/integrations/trpc/routers/`. Audited tree: commit 0562c26 plus the owner's 10 uncommitted files. Each finding is labelled measured (read directly from code, or produced by a script or test), inferred (reasoned across code paths without running them) or guess (unverified). No browser or production data was used, so row counts are unknown.

Severity scale. Critical means a privacy promise broken in normal use, or a cross-account write. High means a core flow is wrong in ordinary use. Medium means a narrower real path. Low means edge, API-only or cosmetic.

## Verdict

The hypothesis holds in part. The split is real and it causes some of the worst user-facing problems, but it is not the dominant cause. It explains 12.3% of user-noticeable findings by primary tag and 17.8% counting secondary tags (measured from the tags). Unifying the five tables alone resolves 8 of 73 noticeable findings and 5 of the 25 that are high or critical (inferred).

No tag dominates. The largest is DENORM at 19.2%, and the distribution is flat. The audit points to three causes that work together.

1. The hypothesis names the wrong set of tables. Its shape is right, one concept in several stores, but it leaves out the most damaging store, `watchlist_item`. Add that table and "one concept, several stores" covers 23 of 73 noticeable findings (31.5%) and 13 of 25 high or critical ones (52.0%). The DENORM half is larger than the SPLIT half.
2. There is no shared domain layer. Each router and component re-implements its rules, including what watched means, who may see a row and when a show is complete. This is the second-largest tag among findings a user notices, after DENORM (12 of 73 primary), and it is the mechanism behind most privacy gaps. A shared layer alone resolves 26 and partly helps 30 (inferred). That score is high partly by definition, because the intervention is broad.
3. Privacy is the worst by severity, not by count. Both critical findings and 6 of the 25 high or critical noticeable ones are PRIVACY. None comes from the split.

The tags and the fix columns are one reviewer's judgement (inferred). The counts are measured from those labels by `tools/audit-findings.ts`. Finding sizes differ, so treat shares as direction, not precision. The sensitivity table shows the conclusion survives the generous readings.

## Counts

Findings by primary tag and severity.

<!-- matrix:start -->
| Tag | critical | high | medium | low | total | user-noticeable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| SPLIT | 0 | 6 | 3 | 2 | 11 | 9 |
| DENORM | 0 | 7 | 6 | 1 | 14 | 14 |
| NO-DOMAIN-LAYER | 0 | 1 | 9 | 6 | 16 | 12 |
| PRIVACY | 2 | 5 | 2 | 1 | 10 | 8 |
| FEATURE-OVERLAP | 0 | 1 | 4 | 2 | 7 | 5 |
| MISSING-STATE | 0 | 3 | 5 | 1 | 9 | 9 |
| BUG | 0 | 1 | 8 | 5 | 14 | 11 |
| VOCAB | 0 | 0 | 3 | 2 | 5 | 4 |
| OTHER | 0 | 0 | 2 | 1 | 3 | 1 |
| All | 2 | 24 | 42 | 21 | 89 | 73 |
<!-- matrix:end -->

Share of the 73 user-noticeable findings. Severity-weighted uses critical 4, high 3, medium 2, low 1.

<!-- share:start -->
| Tag | Primary, of noticeable | Primary or secondary | Severity-weighted share |
| --- | ---: | ---: | ---: |
| SPLIT | 9 (12.3%) | 13 (17.8%) | 14.7% |
| DENORM | 14 (19.2%) | 15 (20.5%) | 20.9% |
| NO-DOMAIN-LAYER | 12 (16.4%) | 13 (17.8%) | 12.9% |
| PRIVACY | 8 (11.0%) | 9 (12.3%) | 14.1% |
| FEATURE-OVERLAP | 5 (6.8%) | 5 (6.8%) | 6.7% |
| MISSING-STATE | 9 (12.3%) | 9 (12.3%) | 12.3% |
| BUG | 11 (15.1%) | 11 (15.1%) | 12.9% |
| VOCAB | 4 (5.5%) | 4 (5.5%) | 4.3% |
| OTHER | 1 (1.4%) | 1 (1.4%) | 1.2% |
<!-- share:end -->

Sensitivity of the verdict to how "traces to SPLIT" is read.

<!-- sensitivity:start -->
| Reading of 'traces to SPLIT' | Noticeable findings | Share |
| --- | ---: | ---: |
| Primary tag SPLIT | 9 of 73 | 12.3% |
| Primary or secondary SPLIT | 13 of 73 | 17.8% |
| Any finding unifying the five would at least partly help | 18 of 73 | 24.7% |
| SPLIT primary, high or critical only | 6 of 25 | 24.0% |
| SPLIT plus DENORM, the hypothesis widened to six stores | 23 of 73 | 31.5% |
| SPLIT plus DENORM, high or critical only | 13 of 25 | 52.0% |
| For comparison, DENORM plus NO-DOMAIN-LAYER | 26 of 73 | 35.6% |
| For comparison, PRIVACY, high or critical only | 6 of 25 | 24.0% |
<!-- sensitivity:end -->

Counterfactuals over the noticeable findings. Each row asks what would go away if only that change happened. These are inferred. They constrain later design and are not a proposal.

<!-- counterfactual:start -->
| Intervention | Resolves | Partly | Untouched | Resolves, high or critical only |
| --- | ---: | ---: | ---: | ---: |
| Unify the five tables only | 8 | 10 | 55 | 5 of 25 |
| Derive watched from the log, drop watchlist_item state | 15 | 6 | 52 | 7 of 25 |
| One shared domain layer only | 26 | 30 | 17 | 9 of 25 |
| Unify the five and derive watched | 23 | 12 | 38 | 12 of 25 |
| All three | 46 | 18 | 9 | 19 of 25 |
<!-- counterfactual:end -->

## Strongest argument against the hypothesis

Suppose the five tables merged perfectly tomorrow and nothing else changed. Most of what the user sees would stay wrong, because the wrong answers do not come from those tables.

- The title page Watched button reads the default list's `watchlist_item.watched` (`routers/watchlist.ts:721`).
- The First Watch to 1000 ladder counts `watchlist_item` rows (`lib/evaluate-achievements.ts:124`).
- Film watch time sums `watchlist_item.runtime` (`routers/friend.ts:717`).
- Private titles would still reach friends through the heatmap (`routers/friend.ts:921`).
- `getFeed` would still accept any user id (`routers/watch-event.ts:703`).
- Six completion rules would still disagree (F33).

Two of the five tables also weaken the framing. `review` has no live writer and likely no rows, so it is dead code, not a live split (inferred; a production count would settle it). `user_title` holds no opinion and is tracked-show state. The live "what I thought" split is `watch_event.note` against `journal_entry.note`, and the live "watched it" split is `watch_event` against `episode_watch`.

## Strongest argument for it

The hypothesis should not be dismissed on share alone. Six of the 25 high or critical noticeable findings are SPLIT, which ties PRIVACY and sits one behind DENORM. Those six are the product's core promise. F07 means finishing a show leaves no diary trace. F25 means no screen answers "what have I watched and what did I think". F77 means tidying the tracker deletes the diary. Rules work alone cannot fix F25, because a diary needs one queryable history. A domain layer could present a union, but the data model has to supply it.

## What the split does correctly

Keep these properties, whatever happens next. All measured from `db/schema.ts`, and the judgements are inferred.

- `watch_event` models a repeatable occurrence, with its own date, rating, note, companions and visibility (`db/schema.ts:273`). A film watched twice should be two rows. A state column could not hold that.
- `user_title` models per-title state, which is different from an occurrence (`db/schema.ts:112`). "I am on rewatch 3 of this show" is current state.
- `episode_watch` models progress at a grain no other row can hold. Its unique index includes `watch_number`, which is what makes a rewatch possible (`db/schema.ts:497`).
- `journal_entry` allows a thought not tied to a viewing, such as a note halfway through a season (`db/schema.ts:530`).
- `watch_event.rating` has a database check constraint, and visibility is per event, so one log can be private and another public.

The event versus state versus progress distinction is sound. The fault lies in the missing links between these tables and in `watchlist_item` holding a fourth copy.

## Inventory

All measured, from `procedures.json`. Regenerate with `bun docs/redesign/phase-1/tools/extract-procedures.ts`.

- 16 routers, 113 procedures, 55 queries, 58 mutations, 10 public procedures, 21 tables.
- Per router: achievement 4, episodeTracker 13, friend 15, journalEntry 5, notification 7, recommendation 4, review 3, search 4, shuffle 10, tasteProfile 10, title 1, todos 2, user 1, watchEvent 8, watched 7, watchlist 19.
- 20 procedures have no UI caller: `todos.list`, `todos.add`, `review.upsert`, `review.get`, `review.userReviews`, `recommendation.searchFriends`, `watched.create`, `watched.updateReview`, `watched.setReminder`, `watched.getForTitle`, `watched.getCount`, `watched.delete`, `watched.getById`, `watchEvent.getUserEvents` (cache references only), `watchEvent.backfillGenres`, `watchlist.recommendTitle`, `watchlist.removeMember`, `episodeTracker.getTvWatchTime`, `episodeTracker.hasTracked`, `episodeTracker.getSeasonEpisodes`.
- Routers `review`, `todos` and `watched` are fully dead.
- No table lacks a static writer or reader. Counting only procedures with a UI caller, `review` has no writer.
- Columns with no live writer: `watchEvent.reviewText`, and `review.userId`, `tmdbId`, `mediaType`, `rating`, `text`.
- Columns that only ever hold their default: 20, including `recommendation.status` and `episodeWatch.watchedAt`.
- 20 multi-table mutations write outside a transaction, and 13 procedures read another user's data with no block check. `procedures.json` lists both.
- 10 components are never imported: Footer, Header, `shuffle/mode-switcher`, `shuffle/mode-pill`, `title/hero-trailer`, `tracker/tracker-reel-card`, `tracker/season-row`, `tracker/episode-card`, `watched/season-picker-modal`, `watchlist/review-dialog`.
- 45 achievements exist, and 9 cannot be earned through the live UI: opening-review, five-star-critic, seasoned-critic, review-machine, genre-critic, good-taste, genre-hopper, well-rounded, hall-of-fame.

## Coverage of the requested checks

| Check | Findings |
| --- | --- |
| Rewatch numbering | F12, F36 |
| Watched status | F01, F02, F05, F06, F09, F69 |
| Visibility filters | F15, F52, F53, F75 |
| Block filters | F55, F57 |
| Achievement triggers | F18, F37, F41, F42 |
| Notification creation | F44, F45, F46, F47 |
| Feed assembly | F31, F81 |
| Stats | F26, F27, F28, F29, F53 |
| Season completion | F33, F34 |
| Dead ends | F11, F21, F63, F76 |
| Film vs TV | F04, F08, F09, F23 |
| Watchlist vs title page | F02, F03, F69, F70 |
| Owner vs friend | F06, F15, F64, F90 |
| Orphaned states | F13, F49, F99, F100 |
| Missing transactions | F77, F78 |
| Authorisation | F51, F54, F57, F61 |
| Races | F43, F66, F78, F79 |

## Migration constraints

This section records constraints only and does not design a target. Key caveat: there is no title table, and every record keys on `tmdb_id` plus `media_type`. Drizzle has 5 migrations, and 0002 converted `review_public` into `visibility` (measured). Production row counts are needed before any plan. The runtime agent or owner should collect them.

| Table | Derivable | Exists nowhere else | Data-loss risk |
| --- | --- | --- | --- |
| `user_title` (`db/schema.ts:112`) | Tracked state, partly, from `episode_watch` | `current_watch_number` when no episode exists at that number, `created_at`, film taste picks. `season_episode_counts` can be refetched from TMDB | Medium. Film rows have one other trace, the default list (F99) |
| `watch_event` (`db/schema.ts:273`) | Almost nothing | Rating, note, visibility, `watched_at`, companions, origin link, reminder, scope | High. Primary record. `title_name` may be empty, film `watch_number` is always 1, a null `watched_at` falls back to `created_at`, and a reciprocal looks like a self-log after its origin is deleted (F13) |
| `episode_watch` (`db/schema.ts:497`) | Not derivable | Each episode, runtime snapshot, `watch_number` | High. `watched_at` is click time (F32). Rows with runtime 0 and Season 0 exist (F34). `watch_event_id` is effectively always null |
| `review` (`db/schema.ts:455`) | Not applicable | Any rows that exist | Low if empty, which is inferred. `review.upsert` never reached mainline. No visibility column, so a merge must default to private. Can conflict with `watch_event.rating`. No link to an event |
| `journal_entry` (`db/schema.ts:530`) | Not derivable | Note, `is_public`, scope, `watch_number` | High. No `media_type`, no `watch_event` link, and opposite default privacy (F24) |
| `watchlist_item` (`db/schema.ts:160`), outside the five | Queue membership stays | `watched = true` with no event is the only evidence of a skip-path watch (F03). Film runtime lives only here. `watched_seasons`, `recommended_by` and `recommendation_message` | High. Dropping the flag loses those watches unless synthetic events are created. On shared lists the watcher is unknown, because `added_by` is not the watcher (F06) |

Other constraints (measured unless labelled).

- `watch_event.review_text` rows are possible only from the ac0bf37 window on 2026-04-01, when `trpc.watched.updateReview` was on mainline (inferred from history).
- `earned_achievement` must be preserved on its own terms. Re-evaluating against a new model would both remove and add badges (F39, F41).
- `notification.data` holds `watchEventId` and scope deep links, plus accept state (F49). Old notifications may point at rows a migration replaces.
- `exportData` is not a backup. It omits the diary (F58).

## Working tree versus HEAD

Measured by running the extractor on a HEAD export. At procedure level only `tasteProfile.saveTasteProfile` differs. Finding F91 exists only in the working tree. All other findings exist at both. Three behaviours exist only at HEAD and the working tree removes them: seeded My Picks items with blank titles, new empty lists hidden from the index, and the onboarding flag set at step 3. `uncommitted-review.md` has the per-file detail. `bun run test` gives 145 of 146 passing on the working tree, and the single failure, in `watchlist.list`, also fails at HEAD.

## Limits

- Code reading only. No scenario was run in a browser. F30 was reproduced as arithmetic under bun, not in the UI.
- Runtime confirmation of the two critical findings is the first thing to do next.
- The scheduler question in F76 depends on Coolify settings outside the repo (guess).
- Finding ids are not contiguous, because candidates that failed checking were dropped. Re-reading the code during this audit corrected several draft claims and disproved one, that auto-removal could delete the flag row. `routers/watchlist.ts:914` limits it to unwatched rows.

## Findings

Anchors are validated by `bun docs/redesign/phase-1/tools/audit-findings.ts --anchors`.

<!-- findings:start -->
### Critical (2)

#### F52. Private titles appear in the heatmap hover to friends

critical, PRIVACY, user-noticeable, measured.

A user marks a film private, and the selector promises 'Only visible to you'. watchActivity has no visibility filter and returns titles, and the profile hover shows them to any friend who opens the page.

`routers/friend.ts:918`, `routers/friend.ts:921`, `routes/app/profile.$userId.tsx:1126`, `components/watched/visibility-selector.tsx:35`

#### F57. companion friendId is not validated, so any user can write into another account

critical, PRIVACY, not user-noticeable, measured.

A crafted watchEvent.create with any user id inserts a reciprocal event into that account and sends a notification, even if that user blocked the caller. The list path validates friendship and this one does not.

`routers/watch-event.ts:24`, `routers/watch-event.ts:136`, `routers/watch-event.ts:185`, `routers/watchlist.ts:98`

### High (24)

#### F01. No single answer to 'have I watched this'

high, DENORM, user-noticeable, measured.

Four readers can give different answers for one title. The title page reads the default list flag, a list page reads that list's own flag, profile counts read watch_event, and the tracker reads episode_watch. A film marked from a custom list card still shows unwatched on its title page.

`routers/watchlist.ts:721`, `routers/watchlist.ts:548`, `components/title/title-actions.tsx:85`, `routers/friend.ts:744`, `routers/episode-tracker.ts:145`

#### F02. Logging and marking watched are two writes the UI glues together

high, DENORM, user-noticeable, measured.

watchEvent.create never sets watchlist_item.watched. markWatched and quickMarkWatched never insert a watch_event. Each component chains them itself and in a different order, so any failure or skip between the calls leaves the two halves disagreeing.

`routers/watch-event.ts:111`, `routers/watchlist.ts:804`, `components/title/title-actions.tsx:317`, `components/watchlist/watchlist-item-card.tsx:290`

#### F03. Skipping the review on the title page leaves a watched film with no diary entry

high, DENORM, user-noticeable, inferred.

A user taps Watched, the flag flips, the review modal opens, and the user closes it. No onSkip is wired on this page, so no watch_event exists. The film shows Watched but is absent from history and earns no achievement.

`components/title/title-actions.tsx:469`, `components/watched/review-modal.tsx:404`, `routers/watchlist.ts:820`

#### F04. A rated film cannot be logged again from the title page

high, DENORM (also SPLIT), user-noticeable, inferred.

Once a film has a rating, tapping Watched only toggles the flag. The review modal opens only when latestRating is null, so no new watch_event is created. The one route to a second log is to unmark on a list card and tick again, and film events always carry watch number 1.

`components/title/title-actions.tsx:168`, `routers/watchlist.ts:787`, `routers/watch-event.ts:58`, `components/watchlist/watchlist-item-card.tsx:225`

#### F07. Finishing a show in the tracker never reaches the diary

high, SPLIT, user-noticeable, measured.

episode_watch rows do not create a watch_event. Unless the user submits the completion review, a user who finishes 60 episodes has no feed entry, no Titles count, no heatmap day, no genre stat and no shuffle exclusion. First Watch also stays unearned, because it reads watchlist_item.

`routers/episode-tracker.ts:145`, `routers/friend.ts:744`, `routers/friend.ts:921`, `routers/shuffle.ts:231`, `lib/evaluate-achievements.ts:121`

#### F08. Marking TV watched from a list card leaves the tracker at zero

high, SPLIT, user-noticeable, inferred.

The card writes a watch_event and the list flag for a show. The tracker reads episode_watch and shows 0 of N. The same show is finished on one screen and untouched on another.

`components/watchlist/watchlist-item-card.tsx:225`, `components/title/title-actions.tsx:290`, `routers/watch-event.ts:111`

#### F14. Removing a companion deletes the friend's edited log

high, MISSING-STATE, user-noticeable, measured.

B rates and writes a note on the reciprocal event. A edits the original and removes B. The code deletes B's row and B's note goes with it, with no warning to B. The upgrade path at create time loses edits the same way.

`routers/watch-event.ts:389`, `routers/watch-event.ts:105`

#### F16. The review table is dead and six achievements read it

high, SPLIT, user-noticeable, measured.

No live UI calls review.upsert. Opening Review, Five Star Critic, Seasoned Critic, Review Machine, Genre Critic and Good Taste read that table, so users who review through the live modal can never earn them.

`routers/review.ts:10`, `lib/evaluate-achievements.ts:327`, `lib/evaluate-achievements.ts:316`, `lib/evaluate-achievements.ts:511`, `routers/watch-event.ts:285`

#### F20. Remind me later forces a public diary entry and drops the scope

high, PRIVACY, user-noticeable, measured.

A user chooses remind me later because they are not ready to say anything. The modal hardcodes visibility public, so friends see the log at once, and it leaves out the episode or season scope. The tracker's own reminder sends scope show and no visibility, so it also lands public.

`components/watched/review-modal.tsx:186`, `routes/app/tracker.$tmdbId.tsx:1210`

#### F25. The diary is scattered over five surfaces and none is complete

high, SPLIT, user-noticeable, measured.

Profile Film Diary, profile Journal, tracker index journal, title page history and tracker detail each show a different subset. No screen answers 'what have I watched and what did I think'.

`routes/app/profile.$userId.tsx:1573`, `routes/app/profile.$userId.tsx:1688`, `routes/app/tracker.index.tsx:140`, `components/title/title-actions.tsx:433`, `routes/app/tracker.$tmdbId.tsx:1545`

#### F26. Watch time is wrong in three directions

high, DENORM, user-noticeable, measured.

Film time sums watchlist_item.runtime across every list the user belongs to. Only the title-page toggle writes runtime, so a film marked from a list card adds zero. On a shared My Picks another member's marks count as the user's time, and a film both members marked counts twice.

`routers/friend.ts:707`, `routers/friend.ts:717`, `routers/friend.ts:733`, `routers/watchlist.ts:809`, `routers/watchlist.ts:550`

#### F30. Each edit-save shifts the watch date by the UTC offset

high, BUG, user-noticeable, measured.

The modal slices an ISO UTC string into a local date-time field and parses it back as local time. In London during BST, repeated saves moved 20:49Z to 19:49Z, 18:49Z, then 17:49Z (reproduced with bun at TZ=Europe/London).

`components/watched/review-modal.tsx:85`, `components/watched/review-modal.tsx:154`

#### F33. Six separate rules for 'season or show complete'

high, NO-DOMAIN-LAYER, user-noticeable, measured.

The tracker detail, tracker index, show card, achievements and Write About each compute completion. A show can read complete on one and in progress on another, and celebrations fire or not by screen.

`routes/app/tracker.$tmdbId.tsx:174`, `routes/app/tracker.$tmdbId.tsx:400`, `routes/app/tracker.index.tsx:114`, `components/tracker/tracker-show-card.tsx:116`, `lib/evaluate-achievements.ts:404`, `components/tracker/write-about-modal.tsx:143`

#### F35. Onboarding picks become tracked shows with no episode counts

high, SPLIT, user-noticeable, measured.

A user names a show they love. saveTasteProfile writes a user_title row with no seasonEpisodeCounts. The show appears in the tracker at zero. When the user later taps Watched, addShow hits onConflictDoNothing and the counts stay null, so Series Finale skips that show for good.

`routers/taste-profile.ts:368`, `routers/episode-tracker.ts:35`, `routers/episode-tracker.ts:302`, `lib/evaluate-achievements.ts:403`

#### F39. The main watch ladder counts list rows, not logs

high, DENORM, user-noticeable, measured.

First Watch through the 1000 tier (thresholds 1, 10, 100, 250, 500, 1000, described as 'Log N watches') count watchlist_item rows the user added that are watched. A diary log of a title on no list does not count, rewatches do not count, and a row the user added counts when another member marks it.

`lib/evaluate-achievements.ts:124`

#### F53. Aggregates include private logs

high, PRIVACY, user-noticeable, measured.

avgRating, watch counts, genre stats and profile totals count private events, so friends can infer activity the user hid.

`routers/friend.ts:181`, `routers/friend.ts:854`, `routers/friend.ts:744`, `routes/app/friends.tsx:187`

#### F54. 'Public' promises friends but any signed-in user can read

high, PRIVACY, user-noticeable, measured.

The selector says 'Visible to all your friends'. getFeed takes any userId with no friendship check, and /app/feed?userId= exposes it. Public lists are readable by id the same way.

`components/watched/visibility-selector.tsx:21`, `routers/watch-event.ts:703`, `routes/app/feed.tsx:63`, `routes/app/profile.$userId.tsx:737`, `routers/watchlist.ts:247`

#### F55. Blocks are enforced on writes, not reads

high, PRIVACY, user-noticeable, measured.

A blocked user can still fetch the blocker's feed, journal and achievements by id. The profile sets a flag but does not stop the following queries.

`routers/friend.ts:690`, `routers/watch-event.ts:703`, `routers/journal-entry.ts:155`, `routers/achievement.ts:26`

#### F58. Export Data omits the diary

high, PRIVACY, user-noticeable, measured.

The export returns lists and user_title but no watch_event, episode_watch, journal_entry or rating. A user who exports before deleting loses every log and note.

`routers/user.ts:17`, `routes/app/settings.tsx:278`

#### F63. No way to leave a list, and invites need no consent

high, MISSING-STATE, user-noticeable, measured.

An owner adds a friend to a list directly. The friend is told afterwards, the watchlist_invite type is never emitted, and no accept step exists. removeMember has no UI caller, so the member cannot leave and the owner cannot remove them. Ending the friendship is the only exit.

`routers/watchlist.ts:963`, `routers/watchlist.ts:676`, `routers/notification.ts:13`, `components/watchlist/watchlist-detail-header.tsx:155`

#### F64. The person unfriended can lose their own list, including My Picks

high, MISSING-STATE, user-noticeable, measured.

A unfriends or blocks B, and B owns a list they share. B is removed from B's own list, and ownership passes to another member with no copy for B. If that list is B's default My Picks, B loses it and the new owner holds two defaults. A regular member gets a fork, so the owner gets the worse outcome.

`routers/friend.ts:542`, `routers/friend.ts:57`, `routers/friend.ts:92`, `components/watchlist/watchlist-detail-header.tsx:155`, `routers/watchlist.ts:668`

#### F69. Tapping Watched adds the film to My Picks and lights Watchlist

high, DENORM, user-noticeable, measured.

The default list row is the store for the watched flag, so marking creates a row. A user who only logged a film now has it on a list they never added it to.

`routers/watchlist.ts:759`, `routers/watchlist.ts:275`, `components/title/title-actions.tsx:337`

#### F70. A film silently leaves a single owned list

high, FEATURE-OVERLAP, user-noticeable, inferred.

After watching, the code finds owned lists where the title is still unwatched. With exactly one it removes the title with no question and shows a toast. With two or more it asks. If that list is shared, every member loses the title.

`components/title/title-actions.tsx:229`, `components/watchlist/watchlist-item-card.tsx:132`, `routers/watchlist.ts:914`

#### F77. 'Remove from tracker?' wipes logs, reviews and journal

high, SPLIT, user-noticeable, measured.

The toast says 'All episode progress and notes will be deleted'. removeShow also deletes every watch_event for the show, with ratings, reviews and dates, across four tables with no transaction. A user tidying the tracker loses their diary for that show.

`routes/app/tracker.index.tsx:200`, `routers/episode-tracker.ts:378`

### Medium (42)

#### F05. Unwatch and delete disagree about the diary

medium, DENORM, user-noticeable, inferred.

Unwatching keeps every watch_event, so the film stays in history and stats. Deleting the last event does the reverse and clears the flag on every list.

`routers/watchlist.ts:810`, `routers/watch-event.ts:527`, `components/watchlist/watchlist-item-card.tsx:227`

#### F06. Watched is per list item, not per person, on shared lists

medium, DENORM, user-noticeable, measured.

On a shared list one member marks a film and it shows watched for every member. If that member later deletes their event, the flag clears for everyone.

`db/schema.ts:176`, `routers/watch-event.ts:532`

#### F09. The title page Watched button never lights for TV

medium, DENORM, user-noticeable, inferred.

The button branches to the tracker for TV and reads a flag the tracker path never sets. A finished show still offers an unlit Watched control.

`components/title/title-actions.tsx:394`, `components/title/title-actions.tsx:299`

#### F10. A companion log does not update the friend's own state

medium, DENORM (also SPLIT), user-noticeable, inferred.

When A logs a watch with B, B gets a reciprocal watch_event but no list flag and no episode rows. B's diary says watched while B's list and tracker do not.

`routers/watch-event.ts:185`, `routers/watch-event.ts:201`

#### F11. Mark from notification fails for scope show and misreports null scope

medium, BUG, user-noticeable, inferred.

The notification button sends scope 'show', which the procedure rejects, so the user sees a failure. With null scope the UI reports success and nothing is marked. watched_with notifications have no action at all.

`routers/episode-tracker.ts:419`, `components/notifications/notification-item.tsx:400`, `routers/watch-event.ts:225`, `components/notifications/notification-item.tsx:370`

#### F13. Deleting the original leaves an unattributed reciprocal

medium, MISSING-STATE, user-noticeable, inferred.

When A deletes the origin, B's reciprocal keeps its row with origin set to null. It then looks like B's own log, and the upgrade logic can no longer find it.

`db/schema.ts:291`, `routers/watch-event.ts:84`

#### F15. Visibility does not follow to reciprocals, and origin notes ship in the payload

medium, PRIVACY, user-noticeable, measured.

A changes a log to private. B's reciprocal stays public. originEvent data, including a private note, reaches the client and only the component hides it.

`routers/watch-event.ts:347`, `routers/watch-event.ts:575`, `components/watched/watch-event-card.tsx:387`

#### F17. Written thoughts have three homes

medium, SPLIT, user-noticeable, measured.

review.text, watch_event.review_text and watch_event.note all claim to hold what the user wrote. The ratings drill-down reads reviewText, which no live path writes, so written reviews never appear there.

`routers/friend.ts:962`, `routes/app/profile.$userId.tsx:1464`, `routers/watch-event.ts:119`, `routers/watched.ts:75`

#### F19. A later review does not clear the reminder

medium, FEATURE-OVERLAP, user-noticeable, measured.

watched.updateReview clears the reminder, but that path is dead. The live path is watchEvent.update, which leaves it set, so the cron job nags about a film the user already reviewed.

`routers/watched.ts:76`, `routers/watch-event.ts:332`, `routes/api/cron/review-reminders.ts:20`

#### F21. A completion review has no scope, so the tracker treats the show as unreviewed

medium, BUG, user-noticeable, inferred.

hasShowReview looks for scope show. The completion ReviewModal passes no scope, so a review written there does not count. Only Write About and the reminder path produce scope show, so the same act gives a different result by entry point.

`routes/app/tracker.$tmdbId.tsx:96`, `routes/app/tracker.$tmdbId.tsx:1235`, `routes/app/tracker.$tmdbId.tsx:1217`, `components/watched/review-modal.tsx:175`

#### F22. Delete this review deletes the watch itself

medium, VOCAB (also SPLIT), user-noticeable, measured.

The prompt says review. The action removes the whole watch_event with its date, rating and companions. A user who wanted to clear their words loses the log and any watched-flag state tied to it.

`routes/app/tracker.$tmdbId.tsx:1527`, `components/watched/watch-event-card.tsx:140`

#### F23. Notes exist for TV but not films

medium, SPLIT, user-noticeable, measured.

journal_entry has no media_type and the Write About flow only exists in the tracker. A film has one text box inside the review modal. A show has that box and a separate journal.

`components/tracker/write-about-modal.tsx:20`, `routers/journal-entry.ts:52`, `components/watched/review-modal.tsx:258`, `db/schema.ts:296`, `db/schema.ts:539`

#### F24. Two privacy models with opposite defaults for the same words

medium, SPLIT (also PRIVACY), user-noticeable, measured.

watch_event uses a three-value visibility that defaults public. journal_entry uses a boolean that defaults private. A user sees different choices and different defaults depending on which box they typed in.

`db/schema.ts:545`, `db/schema.ts:287`, `components/tracker/write-about-modal.tsx:611`, `components/watched/visibility-selector.tsx:21`

#### F27. Three different watched counts

medium, NO-DOMAIN-LAYER, user-noticeable, measured.

Profile stats, achievement thresholds and friend cards use three queries. A user can see 40 titles on the profile and a badge counting a different number.

`routers/friend.ts:744`, `lib/evaluate-achievements.ts:121`, `routers/friend.ts:181`

#### F28. Rating distribution and its drill-down use different rules

medium, NO-DOMAIN-LAYER, user-noticeable, measured.

On your own profile the bar counts private logs and repeat logs. The drill-down shows public logs only, one per title. A bar reading 5 can open a list of 3.

`routers/friend.ts:760`, `routers/friend.ts:969`, `routers/friend.ts:976`

#### F32. Episode dates are always click time

medium, MISSING-STATE, user-noticeable, measured.

A user backfills a whole season in one evening. Every row carries that timestamp, so the binge-watch rule, which groups by day, fires for a season that took months. Any future timeline built on these rows would be false.

`db/schema.ts:510`, `routers/episode-tracker.ts:136`, `lib/evaluate-achievements.ts:474`

#### F34. Season 0 and runtime 0 skew progress

medium, BUG, user-noticeable, inferred.

A user who finished every regular episode opens Write About for the full show. It loops seasonList, which keeps specials, and says the show is unfinished. Mark as Complete then writes those specials with runtime 0. The tracker counts every watched row against a total that excludes specials, so it can read complete with a regular episode unwatched.

`lib/tmdb-title.ts:275`, `lib/tmdb-title.ts:314`, `components/tracker/write-about-modal.tsx:143`, `components/tracker/write-about-modal.tsx:269`, `routes/app/tracker.$tmdbId.tsx:393`

#### F36. Rewatch numbering is copied three times and defined twice for achievements

medium, NO-DOMAIN-LAYER (also SPLIT), user-noticeable, measured.

watch-event, episode-tracker and journal-entry each resolve the current watch number. The achievement code has two definitions of a rewatch, one for films and one for shows.

`routers/watch-event.ts:58`, `routers/episode-tracker.ts:117`, `routers/journal-entry.ts:56`, `lib/evaluate-achievements.ts:281`, `lib/evaluate-achievements.ts:419`

#### F37. Encore can be awarded on a first watch from a list card

medium, BUG (also DENORM), user-noticeable, inferred.

markWatched sets watchedAt and then evaluates. The rule asks whether a watched row has watchedAt set, so the first mark passes it. A first watch from a list card earns Encore, if the same user added the row.

`lib/evaluate-achievements.ts:290`, `routers/watchlist.ts:552`

#### F38. quickMarkWatched sets no watchedAt, so date achievements cannot see it

medium, DENORM, user-noticeable, measured.

Back to Back and In Sync read watchedAt. Films marked by the quick path have none, so a real double feature does not count.

`lib/evaluate-achievements.ts:171`, `lib/evaluate-achievements.ts:225`, `routers/watchlist.ts:804`

#### F40. Placeholder rules leave Genre Hopper, Well Rounded and Hall of Fame unreachable

medium, BUG, user-noticeable, measured.

genreCount counts distinct mediaType values and needs 5, and only 2 exist. genreCountAll returns false. Hall of Fame needs 44 of 45, so these and the six in F16 put it out of reach.

`lib/evaluate-achievements.ts:132`, `lib/evaluate-achievements.ts:147`, `lib/evaluate-achievements.ts:354`

#### F41. Sync gives Shared Popcorn and Coming Attractions to everyone

medium, BUG, user-noticeable, inferred.

joinedCollabWatchlist counts any watchlist_member row. watchlistCount counts any owned list. Every user owns a default list and holds an owner member row. Opening your own profile runs sync, so everyone gets Shared Popcorn and Coming Attractions without doing anything.

`lib/evaluate-achievements.ts:191`, `lib/evaluate-achievements.ts:253`, `routes/app/profile.$userId.tsx:786`

#### F42. Achievement evaluation and announcement differ by write path

medium, NO-DOMAIN-LAYER, user-noticeable, measured.

18 call sites evaluate achievements. quickMarkWatched and watchEvent.update have none. Only markWatched and acceptRequest tell friends about a new badge. recWatched is evaluated for the viewer but checks the sender, so the sender earns it only on their own next watch.

`routers/watchlist.ts:626`, `routers/watchlist.ts:820`, `routers/watch-event.ts:273`, `routers/watch-event.ts:493`, `routers/friend.ts:429`, `lib/evaluate-achievements.ts:308`

#### F44. The card flow sends item_watched twice, the second without a title

medium, NO-DOMAIN-LAYER, user-noticeable, inferred.

watchEvent.create and markWatched each notify list members. A member gets two notifications for one film. The card's call passes no titleName, so the second reads 'marked a title as watched'.

`routers/watch-event.ts:254`, `routers/watchlist.ts:573`, `components/watchlist/watchlist-item-card.tsx:86`, `components/notifications/notification-item.tsx:61`

#### F45. A private log still notifies list members

medium, PRIVACY, user-noticeable, measured.

A user logs a film as private. The create path notifies every member of each list holding the title, so they learn what the user watched.

`routers/watch-event.ts:233`

#### F46. Notification types overlap and five are half-wired

medium, FEATURE-OVERLAP, user-noticeable, measured.

recommendation_reviewed reads 'reviewed' when the friend only watched. recommendation_watched is rendered but dead. watchlist_invite, title_reviewed and recommendation are declared and never emitted.

`routers/notification.ts:13`, `routers/notification.ts:16`, `routers/notification.ts:17`, `routers/watchlist.ts:603`, `components/notifications/notification-item.tsx:103`, `routers/watched.ts:105`

#### F49. Recommendation status is never written

medium, MISSING-STATE, user-noticeable, measured.

Accept and decline live only in notification.data, and the status column stays at its default. After 20 days or a dismiss, the app has no record of the answer.

`db/schema.ts:342`, `routers/recommendation.ts:172`, `routers/recommendation.ts:187`, `routers/watched.ts:97`, `routers/notification.ts:50`

#### F62. A public todos mutation grows server memory without limit

medium, OTHER, not user-noticeable, measured.

Template code remains in the router. Anyone can call todos.add repeatedly and fill an in-memory array.

`integrations/trpc/router.ts:27`

#### F65. The fork on unfriend drops title, poster, watchedAt and runtime

medium, BUG, user-noticeable, measured.

The fork copies only some columns. The forked list shows blank titles and loses watched dates.

`routers/friend.ts:115`

#### F66. Default list get-or-create exists three times with no unique index

medium, NO-DOMAIN-LAYER, user-noticeable, measured.

watchlist, shuffle and taste-profile each create defaults. Two parallel calls create two My Picks. Some queries write as a side effect, and recommendation relies on onConflict with no matching unique index.

`db/schema.ts:150`, `db/schema.ts:157`, `routers/watchlist.ts:126`, `routers/watchlist.ts:717`, `routers/shuffle.ts:48`, `routers/shuffle.ts:610`, `routers/taste-profile.ts:379`, `routers/recommendation.ts:38`

#### F67. Solo and group shuffle follow different rules

medium, NO-DOMAIN-LAYER, user-noticeable, measured.

getFeed treats a list as group when it has more than one member. recordSwipe treats it as solo when its type is default or shuffle. A shared My Picks gets the group feed, but a yes skips Curtain Call and adds the title directly.

`routers/shuffle.ts:112`, `routers/shuffle.ts:323`

#### F68. Hide reads as global but is stored per scope

medium, FEATURE-OVERLAP, user-noticeable, measured.

toggleHide stores the hide against the default list, and isHidden checks any list. The title page therefore shows Hidden. The shuffle feed excludes only swipes for the list being shuffled, so the title comes back in a custom list. toggleHide also throws if no default list exists yet.

`routers/shuffle.ts:216`, `routers/shuffle.ts:556`, `routers/shuffle.ts:603`, `routers/shuffle.ts:610`

#### F71. 'Shows you love' are saved to an unwatched queue

medium, FEATURE-OVERLAP, user-noticeable, measured.

Onboarding asks what the user loves and stores those picks as unwatched My Picks items, so the app offers them again as things to watch.

`components/onboarding/taste-profile-step.tsx:192`, `routers/taste-profile.ts:394`

#### F72. title and titleName columns hold the same thing

medium, DENORM, user-noticeable, measured.

Tables disagree on the column name, and some writers leave it empty. That is why several notifications fall back to 'a title'.

`db/schema.ts:171`, `db/schema.ts:182`, `db/schema.ts:284`, `db/schema.ts:295`, `routers/recommendation.ts:167`, `components/watchlist/watchlist-item-card.tsx:288`, `routers/watch-event.ts:117`

#### F75. The visibility filter is copied five times, and two masks cannot be reached

medium, NO-DOMAIN-LAYER, not user-noticeable, measured.

Each site writes its own condition, which is how F52 and F53 happened. The masks in getUserEvents and getFeed run after a filter that already removed those rows. A visibility change needs five edits.

`routers/watch-event.ts:562`, `routers/watch-event.ts:616`, `routers/watch-event.ts:730`, `routers/watch-event.ts:650`, `routers/watch-event.ts:767`, `routers/friend.ts:760`, `routers/friend.ts:969`

#### F76. Reminders are claimed before sending, and no scheduler is in the repo

medium, OTHER, user-noticeable, measured.

If the send fails the reminder is already consumed. Dockerfile, compose and workflows hold no cron, so 'We'll remind you' depends on a scheduler outside the repo, if one exists.

`routes/api/cron/review-reminders.ts:20`

#### F78. 20 multi-table writes run outside a transaction

medium, NO-DOMAIN-LAYER, not user-noticeable, measured.

watchEvent.create deletes the reciprocal and then inserts. A failure between the two loses the row. procedures.json lists all 20.

`routers/watch-event.ts:105`

#### F83. 'Invite' means recommend in one place and add a member in another

medium, VOCAB, user-noticeable, measured.

The same word opens a recommendation form on the title page and a member picker on a list.

`components/title/title-actions.tsx:401`, `components/watchlist/watchlist-detail-header.tsx:164`, `components/watched/review-modal.tsx:360`

#### F84. review, thoughts, note, journal and diary overlap

medium, VOCAB, user-noticeable, measured.

The same text box is called Your Review, Your Note, and Share your thoughts by screen. The list is in 03-concept-map.md.

`components/watched/review-modal.tsx:258`, `components/watched/review-modal.tsx:263`, `routes/app/tracker.$tmdbId.tsx:1306`, `routes/app/tracker.$tmdbId.tsx:1545`, `components/notifications/notification-item.tsx:117`, `routes/app/profile.$userId.tsx:72`, `routes/app/profile.$userId.tsx:1685`

#### F89. No title-level rating

medium, MISSING-STATE, user-noticeable, measured.

Rating lives on each event. Episode, season and show scoped ratings are averaged together, so 'your rating' for a show has no defined meaning.

`routers/friend.ts:184`, `routers/watch-event.ts:681`

#### F90. Account deletion cascades shared lists while unfriending forks them

medium, MISSING-STATE, user-noticeable, inferred.

When an owner deletes their account, the FK cascade removes the list and every member's items. Rows a departed member added also vanish from lists they never owned. Unfriending goes out of its way to keep lists.

`db/schema.ts:146`, `db/schema.ts:173`

#### F91. saveTasteProfile is not idempotent now completion moved to step 6

medium, BUG (also NO-DOMAIN-LAYER), user-noticeable, inferred, working tree only.

Working tree only. A user who leaves between steps 4 and 6 restarts at step 1 and saves again. The procedure inserts a second default list and can exceed the genre limit. HEAD avoids this because it sets the flag at step 3.

`routers/taste-profile.ts:379`

### Low (21)

#### F12. Reciprocal copies the creator's watch number

low, SPLIT, not user-noticeable, measured.

A is on watch 3 and logs with B, who has never seen the show. B's reciprocal event says watch 3.

`routers/watch-event.ts:201`

#### F18. Adding a rating or note later tells nobody and evaluates nothing

low, NO-DOMAIN-LAYER, user-noticeable, measured.

create runs achievement evaluation and notifies companions. update runs no evaluation and notifies only newly added companions, so a friend you watched with never hears that you added thoughts later. The badge gap has no effect today because review achievements read the dead table (F16).

`routers/watch-event.ts:284`, `routers/watch-event.ts:476`, `routers/watch-event.ts:493`

#### F29. Day boundaries use UTC

low, BUG, user-noticeable, measured.

A film logged at 00:30 in a UTC+2 zone lands on the previous heatmap day. Time-of-day achievements use the server clock in the same way.

`routers/friend.ts:916`, `lib/evaluate-achievements.ts:153`

#### F31. Feed sorts by createdAt, history by watchedAt

low, NO-DOMAIN-LAYER, user-noticeable, measured.

A film backdated to last year jumps to the top of the feed but sits in place in history.

`routers/watch-event.ts:762`, `routers/watch-event.ts:589`, `routes/app/tracker.$tmdbId.tsx:1507`

#### F43. A concurrent double award pushes without returning

low, BUG, not user-noticeable, inferred.

Two evaluations race. The loser's insert is a no-op, but the id is still pushed, so a second popup or notification can fire.

`lib/evaluate-achievements.ts:61`

#### F47. shuffle_match never names the title

low, BUG, user-noticeable, measured.

The match path writes titleName as an empty string, so every match notification reads 'Everyone wants to watch a title!'.

`routers/shuffle.ts:389`, `components/notifications/notification-item.tsx:54`

#### F50. Two recommend paths with different limits

low, FEATURE-OVERLAP, not user-noticeable, measured.

recommendation.send allows 150 characters. watchlist.recommendTitle allows 280 but has no UI caller.

`routers/recommendation.ts:70`, `routers/watchlist.ts:857`

#### F51. Accept trusts recommendedBy and can be replayed

low, BUG, not user-noticeable, inferred.

Accept takes the sender id from the client and has no guard against a second call, where decline does. A crafted call credits the wrong person or repeats the side effect.

`routers/recommendation.ts:146`, `routers/recommendation.ts:165`, `routers/recommendation.ts:194`

#### F56. review.get and userReviews have no restrictions

low, PRIVACY, not user-noticeable, measured.

Any caller can read any user's review rows. The router has no UI caller, so this is API-only.

`routers/review.ts:51`, `routers/review.ts:64`

#### F61. Auth fields accept client input and username rules live on the client

low, OTHER, not user-noticeable, measured.

Better Auth additional fields are marked input true, and the username pattern is enforced only in the onboarding form. A direct API call can bypass it.

`lib/auth.ts:54`

#### F73. List-type guards are inconsistent

low, NO-DOMAIN-LAYER, user-noticeable, measured.

Recommendations and shuffle lists are protected in some procedures and not others. Legacy shuffle lists are hidden from the index but still offered in the add dropdown.

`routers/watchlist.ts:301`, `routers/watchlist.ts:412`, `db/schema.ts:150`

#### F74. Friendship and search checks are copied with differences

low, NO-DOMAIN-LAYER, not user-noticeable, measured.

16 lines repeat the accepted check. Duplicate ids trigger a false FORBIDDEN at one site. searchUsers leaves LIKE wildcards unescaped and searchFriends escapes them.

`routers/watchlist.ts:118`, `routers/watchlist.ts:339`, `routers/recommendation.ts:202`

#### F79. The watched toggle is not idempotent and the button stays live

low, DENORM, user-noticeable, inferred.

A double tap flips the flag twice and sends two notifications.

`routers/watchlist.ts:787`, `components/title/title-actions.tsx:390`

#### F81. 'Feed' names three different things

low, VOCAB, not user-noticeable, measured.

watchEvent.getFeed is activity. shuffle.getFeed and tasteProfile.getFeed are candidate titles. Only the first reaches the user as 'feed'.

`routers/watch-event.ts:691`, `routers/shuffle.ts:96`, `routers/taste-profile.ts:240`

#### F85. Rewatch 2 vs Watch 2, General vs Full Show

low, VOCAB, user-noticeable, measured.

One state has two labels on one screen.

`routes/app/tracker.$tmdbId.tsx:1575`, `routes/app/tracker.$tmdbId.tsx:300`, `routes/app/tracker.$tmdbId.tsx:1399`, `components/tracker/write-about-modal.tsx:56`

#### F87. Dead code mass

low, FEATURE-OVERLAP, not user-noticeable, measured.

20 procedures and 10 components have no caller. Three routers are fully dead. Each one misleads the next reader about which path is live.

`routers/review.ts:10`, `routers/watched.ts:75`, `integrations/trpc/router.ts:27`, `routes/app/title.$mediaType.$tmdbId.tsx:69`

#### F95. Removal prompt logic copied three times

low, NO-DOMAIN-LAYER, not user-noticeable, measured.

Title page, card and tracker each decide when to prompt. F70 follows from this copying.

`components/title/title-actions.tsx:213`, `components/watchlist/watchlist-item-card.tsx:109`, `routes/app/tracker.$tmdbId.tsx:241`

#### F96. Cache invalidation lists drift

low, NO-DOMAIN-LAYER, user-noticeable, measured.

Each caller invalidates its own set of queries, so a screen can show stale watched state until reload.

`components/watchlist/watchlist-item-card.tsx:75`, `components/title/title-actions.tsx:150`, `routes/app/tracker.$tmdbId.tsx:1442`, `components/watched/watch-event-card.tsx:120`

#### F98. A re-swipe keeps the old createdAt

low, BUG, not user-noticeable, inferred.

The upsert updates action only. A title swiped no today, after a no three weeks ago, is outside the 14-day window at once and returns to the feed.

`routers/shuffle.ts:312`, `routers/shuffle.ts:252`

#### F99. Film user_title rows have no reader but exportData

low, SPLIT, not user-noticeable, inferred.

Onboarding writes film rows to user_title. The tracker is TV only and removeShow cannot reach them, so they persist with no screen.

`routers/taste-profile.ts:368`, `routers/episode-tracker.ts:378`, `routers/user.ts:17`

#### F100. Notifications older than 20 days vanish but are never purged

low, MISSING-STATE, user-noticeable, measured.

The list filters by age and nothing deletes rows. Unread counts and pending accept actions disappear without resolution.

`routers/notification.ts:50`

<!-- findings:end -->
