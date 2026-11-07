# Row-delta matrix

This document records which rows each user action writes, which screens then show it, and what the probes found. Its key question is whether the same intent writes the same rows from every entry point. It also gives the runtime verdict on the hypothesis that splitting "watched it and what I thought" across `user_title`, `watch_event`, `episode_watch`, `review` and `journal_entry` causes much of the incoherence.

## How to read this

- **Measured**, **inferred** and **guess** mean what they mean in `02-task-flows.md`.
- Each flow snapshots 12 tables before and after, diffs by row id, and keeps only rows owned by that flow's users.
- A cell reads `+1` inserted, `-1` deleted, `~1` updated.
- Column keys are `ut` user_title, `we` watch_event, `wec` watch_event_companion, `ew` episode_watch, `rev` review, `je` journal_entry, `wi` watchlist_item, `wl` watchlist, `ntf` notification, `rec` recommendation, `sw` shuffle_swipe, `ach` earned_achievement.
- Evidence paths are relative to `~/.cache/verify-popcorn/evidence/vp-20261106-214913/`.
- `ach` deltas are inflated by fixture users, who earn first-contact achievements. `wl +1` is the lazily created default list, also a fixture effect.
- Reader columns test DOM text. Profile columns are DOM only and are not visible at 390 wide. See the visibility table in `02-task-flows.md`.
- `watchlist.addItem` left over from a flow's setup is filtered from mutation lists. The row delta is the authority.

## Verdict on the hypothesis

**Partly supported. The split is real but it is not the main cause (inferred, from the measured results below).**

Evidence for.

- TV thoughts live in two unlinked stores. One episode held a public 2-star review saying "dreadful" and a public journal note saying "wonderful" at the same time, with no link between them (`flows/probe-one-episode-public-journal-and-a-contradicting-public-review.json`).
- Each store has its own surfaces. The title page shows the review but not the journal note. The Journal tabs show the journal note but not the review. Only feed and tracker detail show both.
- Watching and logging are separate for TV. Marking every episode writes 5 `episode_watch` rows and no `watch_event`, so the show stays out of feed and title page while watch time rises to 5h 31m.
- Finding your own TV thoughts fails at the obvious place, the title page.
- Visibility has opposite defaults and different controls per store.

Evidence against.

- **`review` is not a live part of the split.** It held 0 rows after 85 flows and 106 `watch_event` rows, and `review_text` was set on 0 of them. It is dead code, so "five tables" overstates the live problem.
- **`user_title` holds no thoughts.** It is a tracking pointer. Films get a row only from onboarding.
- **Films are not split.** A film's thoughts live in one place, `watch_event`, and every surface reads it. Most film inconsistencies happen with a single store.
- **The worst store is not on the list.** `watchlist_item.watched` drives the title page Watched state and disagrees with logs in several flows below.
- **The two worst failures have nothing to do with storage.** The stacked modals and the zero-height profile panel are layout and layering bugs. They would survive any data model.
- **The private leak is a rule, not a split.** One procedure sends the notification regardless of visibility.
- **Step counts do not track the split.** Most actions go on forced choices, popups and navigation.

My classification of the 12 main inconsistencies below by root cause is 3 storage split, 4 entry points composing mutations themselves, 3 the separate watched flag, 2 UI layer. Row 8 has two causes and is counted under UI layer. The line between the first three groups is a judgement call (inferred). A redesign that only merges tables would leave most of them standing (inferred).

## Same intent, different rows

| # | Intent | What differs | Root cause (inferred) | Evidence (`flows/`) |
| --- | --- | --- | --- | --- |
| 1 | Log a film | Title page gives 2h 16m watched, list eye gives 0h 0m, same `we +1` | Entry points compose mutations | `log-film-now-title-page-rate-note-public.json`, `log-film-now-my-picks-card-eye-rate-note-public.json` |
| 2 | Log a film | Custom list eye leaves title page unlit though history exists | Watched flag | `log-film-now-custom-list-card-eye-rate-note-public.json` |
| 3 | Mark watched, Skip | Title page writes no `ach`, list eye writes `ach +2`. Neither writes `we` | Entry points compose mutations | `log-film-now-title-page-skip.json`, `log-film-now-my-picks-card-eye-skip.json` |
| 4 | Decline to review | Skip writes no log. Remind Me Later writes a public unrated `we` that appears in feed | Entry points compose mutations | `log-film-now-title-page-skip.json`, `log-film-now-title-page-remind-me-later.json` |
| 5 | Log a film on a list | One custom list, item silently removed `wi +1 -1`. My Picks, item kept `wi ~1` | Entry points compose mutations | `log-film-now-title-page-film-in-one-custom-list.json`, `log-film-now-title-page-film-in-my-picks.json` |
| 6 | Log again | Rated film, no rows. Unrated, `we +1`. List eye, `we +1` | Watched flag | `log-film-rewatch-*.json` |
| 7 | Rewatch | TV bumps `current_watch_number` 1 to 2. Film stays at watch number 1 on all 89 rows, including second logs | Storage split | `rewatch-show-tracker-detail-rewatch.json`, `log-film-rewatch-custom-list-eye-off-then-on.json` |
| 8 | Finish a show | Review gives `we +1`, dismissal gives `ew` only, first finish gives `ew` only and loses the offer | UI layer, with storage split behind it | `finish-show-*.json` |
| 9 | Say I watched a TV show | Title page writes `ut`, list eye writes `we` and `wi` with no `ut`, bell Mark in tracker writes `ut` and `ew` with no `we` | Storage split | `track-show-title-page-watched.json`, `log-tv-from-watchlist-my-picks-card-eye-on-a-tv-show-rate-note.json`, `mark-next-episode-friend-s-episode-review-bell-mark-in-tracker.json` |
| 10 | Undo a log | Delete only log resets `wi`. Delete one of two does not. Toggle off changes `wi` only and keeps the log | Watched flag | `delete-log-title-page-card-only-log.json`, `delete-log-title-page-card-one-of-two-logs.json`, `delete-log-title-page-watched-toggle-off.json` |
| 11 | Remove a show | Delete a review, `we -1`, watch time stays 5h 31m. Remove from tracker, `ut -1 we -1 ew -5`, all gone | Storage split | `delete-log-tracker-notes-reviews-delete-a-review.json`, `delete-log-remove-show-from-tracker.json` |
| 12 | Edit or delete from profile | Works at 1280, unreachable at 390 | UI layer | `change-log-profile-activity-card.json`, `delete-log-profile-activity-card-only-log.json` |

## Matrix

<!-- gen:matrix -->
| Job | Entry point | ut | we | wec | ew | rev | je | wi | wl | ntf | rec | sw | ach | Record |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sign-up | real onboarding, minimum path | +3 |  |  |  |  |  | +3 | +1 |  |  |  | +4 | `sign-up-real-onboarding-minimum-path.json` |
| sign-up | real onboarding, picks a TV show in the taste step | +3 |  |  |  |  |  | +3 | +1 |  |  |  | +4 | `sign-up-real-onboarding-picks-a-tv-show-in-the-taste-step.json` |
| log-film-now | custom list card eye, rate+note+public |  | +1 |  |  |  |  | ~1 |  |  |  |  | +2 | `log-film-now-custom-list-card-eye-rate-note-public.json` |
| log-film-now | My Picks card eye, rate+note+public |  | +1 |  |  |  |  | ~1 |  |  |  |  | +2 | `log-film-now-my-picks-card-eye-rate-note-public.json` |
| log-film-now | My Picks card eye, remind me later |  | +1 |  |  |  |  | ~1 |  |  |  |  | +2 | `log-film-now-my-picks-card-eye-remind-me-later.json` |
| log-film-now | My Picks card eye, Skip |  |  |  |  |  |  | ~1 |  |  |  |  | +2 | `log-film-now-my-picks-card-eye-skip.json` |
| log-film-now | review reminder notification, Review now |  | ~1 |  |  |  |  |  |  | ~1 |  |  |  | `log-film-now-review-reminder-notification-review-now.json` |
| log-film-now | shared list eye, Skip, by a member |  |  |  |  |  |  | ~1 |  | +4 |  |  | +3 | `log-film-now-shared-list-eye-skip-by-a-member.json` |
| log-film-now | title page, film in My Picks |  | +1 |  |  |  |  | ~1 |  |  |  |  | +1 | `log-film-now-title-page-film-in-my-picks.json` |
| log-film-now | title page, film in one custom list |  | +1 |  |  |  |  | +1 -1 |  |  |  |  | +1 | `log-film-now-title-page-film-in-one-custom-list.json` |
| log-film-now | title page, film in two custom lists |  | +1 |  |  |  |  | +1 |  |  |  |  | +1 | `log-film-now-title-page-film-in-two-custom-lists.json` |
| log-film-now | title page, rate+note+public |  | +1 |  |  |  |  | +1 | +1 |  |  |  | +1 | `log-film-now-title-page-rate-note-public.json` |
| log-film-now | title page, remind me later |  | +1 |  |  |  |  | +1 | +1 |  |  |  | +1 | `log-film-now-title-page-remind-me-later.json` |
| log-film-now | title page, Skip |  |  |  |  |  |  | +1 | +1 |  |  |  |  | `log-film-now-title-page-skip.json` |
| log-film-past-date | title page, Add date 2024-03-15 |  | +1 |  |  |  |  | +1 | +1 |  |  |  | +1 | `log-film-past-date-title-page-add-date-2024-03-15.json` |
| log-film-rewatch | custom list eye off then on |  | +1 |  |  |  |  | ~1 |  |  |  |  |  | `log-film-rewatch-custom-list-eye-off-then-on.json` |
| log-film-rewatch | title page Watched toggle, film already rated |  |  |  |  |  |  |  |  |  |  |  |  | `log-film-rewatch-title-page-watched-toggle-film-already-rated.json` |
| log-film-rewatch | title page Watched toggle, first log has no rating |  | +1 |  |  |  |  |  |  |  |  |  |  | `log-film-rewatch-title-page-watched-toggle-first-log-has-no-rating.json` |
| watched-with | edit existing log, add friend |  | +1 ~1 |  |  |  |  |  |  | +1 |  |  |  | `watched-with-edit-existing-log-add-friend.json` |
| watched-with | friend: bell Add yours, title page Watched |  | +1 -1 |  |  |  |  | +1 | +1 | ~1 |  |  | +1 | `watched-with-friend-bell-add-yours-title-page-watched.json` |
| watched-with | review modal, free-text name |  | +1 |  |  |  |  | +1 | +1 |  |  |  | +2 | `watched-with-review-modal-free-text-name.json` |
| watched-with | review modal, friend |  | +2 |  |  |  |  | +1 | +1 | +1 |  |  | +1 | `watched-with-review-modal-friend.json` |
| change-log | feed card |  | ~1 |  |  |  |  |  |  |  |  |  |  | `change-log-feed-card.json` |
| change-log | profile activity card |  |  |  |  |  |  |  |  |  |  |  | +3 | `change-log-profile-activity-card.json` |
| change-log | title page card |  | ~1 |  |  |  |  |  |  |  |  |  |  | `change-log-title-page-card.json` |
| change-log | title page Skip, then add a rating later |  | +1 |  |  |  |  |  |  |  |  |  | +2 | `change-log-title-page-skip-then-add-a-rating-later.json` |
| delete-log | feed card, only log |  | -1 |  |  |  |  | ~1 |  |  |  |  |  | `delete-log-feed-card-only-log.json` |
| delete-log | profile activity card, only log |  |  |  |  |  |  |  |  |  |  |  | +3 | `delete-log-profile-activity-card-only-log.json` |
| delete-log | remove show from tracker | -1 | -1 |  | -5 |  |  |  |  |  |  |  |  | `delete-log-remove-show-from-tracker.json` |
| delete-log | title page card, log has a reciprocal friend event |  | -1 ~1 |  |  |  |  | ~1 |  |  |  |  |  | `delete-log-title-page-card-log-has-a-reciprocal-friend-event.json` |
| delete-log | title page card, log made through custom list eye |  | -1 |  |  |  |  | ~1 |  |  |  |  |  | `delete-log-title-page-card-log-made-through-custom-list-eye.json` |
| delete-log | title page card, one of two logs |  | -1 |  |  |  |  |  |  |  |  |  |  | `delete-log-title-page-card-one-of-two-logs.json` |
| delete-log | title page card, only log |  | -1 |  |  |  |  | ~1 |  |  |  |  |  | `delete-log-title-page-card-only-log.json` |
| delete-log | title page Watched toggle off |  |  |  |  |  |  | ~1 |  |  |  |  |  | `delete-log-title-page-watched-toggle-off.json` |
| delete-log | tracker Notes & Reviews: delete a review |  | -1 |  |  |  |  |  |  |  |  |  |  | `delete-log-tracker-notes-reviews-delete-a-review.json` |
| delete-log | tracker: unmark episode |  |  |  | -1 |  |  |  |  |  |  |  |  | `delete-log-tracker-unmark-episode.json` |
| change-privacy | edit log, public to private |  | ~1 |  |  |  |  |  |  |  |  |  |  | `change-privacy-edit-log-public-to-private.json` |
| change-privacy | journal note: edit toggle |  |  |  |  |  | ~1 |  |  |  |  |  |  | `change-privacy-journal-note-edit-toggle.json` |
| change-privacy | log private from the start |  | +1 |  |  |  |  | +1 | +1 |  |  |  | +1 | `change-privacy-log-private-from-the-start.json` |
| change-privacy | private log of a title on a shared list |  | +1 |  |  |  |  | +1 -1 |  | +1 |  |  | +1 | `change-privacy-private-log-of-a-title-on-a-shared-list.json` |
| track-show | title page Watched | +1 |  |  |  |  |  |  | +1 |  |  |  | +1 | `track-show-title-page-watched.json` |
| track-show | tracker index, Browse TV Shows | +1 |  |  |  |  |  |  | +1 |  |  |  | +1 | `track-show-tracker-index-browse-tv-shows.json` |
| mark-next-episode | friend's episode review, bell Mark in tracker | +1 |  |  | +1 |  |  |  |  | ~1 |  |  | +1 | `mark-next-episode-friend-s-episode-review-bell-mark-in-tracker.json` |
| mark-next-episode | tracker detail row, dismiss prompt |  |  |  | +1 |  |  |  |  |  |  |  |  | `mark-next-episode-tracker-detail-row-dismiss-prompt.json` |
| mark-season | season row Mark All |  |  |  | +7 |  |  |  |  |  |  |  | +1 | `mark-season-season-row-mark-all.json` |
| mark-season | top Mark All, show still has more seasons |  |  |  | +62 |  |  |  |  |  |  |  | +3 | `mark-season-top-mark-all-show-still-has-more-seasons.json` |
| finish-show | first finish, achievements earned, top Mark All |  |  |  | +5 |  |  |  |  |  |  |  | +2 | `finish-show-first-finish-achievements-earned-top-mark-all.json` |
| finish-show | tap the last episode row |  | +1 |  | +1 |  |  |  |  |  |  |  | +1 | `finish-show-tap-the-last-episode-row.json` |
| finish-show | top Mark All, dismiss celebration |  |  |  | +5 |  |  |  |  |  |  |  |  | `finish-show-top-mark-all-dismiss-celebration.json` |
| finish-show | top Mark All, Leave a Review |  | +1 |  | +5 |  |  |  |  |  |  |  | +1 | `finish-show-top-mark-all-leave-a-review.json` |
| finish-show | top Mark All, Remind Me Later |  | +1 |  | +5 |  |  |  |  |  |  |  | +1 | `finish-show-top-mark-all-remind-me-later.json` |
| rewatch-show | tracker detail Rewatch | ~1 |  |  | +1 |  |  |  |  |  |  |  | +1 | `rewatch-show-tracker-detail-rewatch.json` |
| rewatch-show | tracker index card Rewatch | ~1 |  |  |  |  |  |  |  |  |  |  | +1 | `rewatch-show-tracker-index-card-rewatch.json` |
| write-about-episode | prompt after marking, Yes, review modal |  | +1 |  | +1 |  |  |  |  |  |  |  |  | `write-about-episode-prompt-after-marking-yes-review-modal.json` |
| write-about-episode | Write, Note, episode (private default) |  |  |  |  |  | +1 |  |  |  |  |  | +1 | `write-about-episode-write-note-episode-private-default.json` |
| write-about-episode | Write, Note, episode, Public |  |  |  |  |  | +1 |  |  |  |  |  | +1 | `write-about-episode-write-note-episode-public.json` |
| write-about-episode | Write, Review, episode |  | +1 |  |  |  |  |  |  |  |  |  |  | `write-about-episode-write-review-episode.json` |
| write-about-episode | Write, Review, unwatched episode |  | +1 |  | +1 |  |  |  |  |  |  |  |  | `write-about-episode-write-review-unwatched-episode.json` |
| log-tv-from-watchlist | My Picks card eye on a TV show, rate+note |  | +1 |  |  |  |  | ~1 |  |  |  |  | +2 | `log-tv-from-watchlist-my-picks-card-eye-on-a-tv-show-rate-note.json` |
| save-for-later | search poster card bookmark |  |  |  |  |  |  |  |  |  |  |  |  | `save-for-later-search-poster-card-bookmark.json` |
| save-for-later | title page Watchlist popover, My Picks |  |  |  |  |  |  | +1 |  |  |  |  |  | `save-for-later-title-page-watchlist-popover-my-picks.json` |
| decide-what-to-watch | shuffle alone, one No then Hide |  |  |  |  |  |  |  | +1 |  |  | +2 |  | `decide-what-to-watch-shuffle-alone-one-no-then-hide.json` |
| decide-what-to-watch | shuffle alone, one Yes |  |  |  |  |  |  | +1 | +1 |  |  | +1 | +1 | `decide-what-to-watch-shuffle-alone-one-yes.json` |
| decide-what-to-watch | shuffle with a friend until a match |  |  |  |  |  |  | +1 | +2 | +1 |  | +5 | +1 | `decide-what-to-watch-shuffle-with-a-friend-until-a-match.json` |
| recommend | review modal, Recommend to a friend |  | +1 |  |  |  |  | +1 | +1 | +1 | +1 |  | +2 | `recommend-review-modal-recommend-to-a-friend.json` |
| recommend | title page Invite |  |  |  |  |  |  |  | +1 | +1 | +1 |  | +1 | `recommend-title-page-invite.json` |
| act-on-recommendation | bell Accept, then Recommendations list eye |  | +1 |  |  |  |  | +1 | +1 | +3 ~1 |  |  | +2 | `act-on-recommendation-bell-accept-then-recommendations-list-eye.json` |
| act-on-recommendation | bell Accept, then title page Watched |  | +1 |  |  |  |  | +1 | +2 | ~1 |  |  | +1 | `act-on-recommendation-bell-accept-then-title-page-watched.json` |
| act-on-recommendation | bell Decline |  |  |  |  |  |  |  |  | ~1 |  |  |  | `act-on-recommendation-bell-decline.json` |
| act-on-recommendation | tap row without Accept, title page Watched |  | +1 |  |  |  |  | +1 | +1 | ~1 |  |  | +1 | `act-on-recommendation-tap-row-without-accept-title-page-watched.json` |
| add-friend | friends search, other accepts on friends page |  |  |  |  |  |  |  |  | +4 |  |  | +2 | `add-friend-friends-search-other-accepts-on-friends-page.json` |
| add-friend | profile Add Friend, other accepts via bell and profile |  |  |  |  |  |  |  |  | +4 |  |  | +2 | `add-friend-profile-add-friend-other-accepts-via-bell-and-profile.json` |
| see-friends-watched | feed |  |  |  |  |  |  |  |  |  |  |  |  | `see-friends-watched-feed.json` |
| see-friends-watched | friends page, friend profile, activity |  |  |  |  |  |  |  |  |  |  |  |  | `see-friends-watched-friends-page-friend-profile-activity.json` |
| review-own-history | feed, Just Me |  |  |  |  |  |  |  |  |  |  |  |  | `review-own-history-feed-just-me.json` |
| review-own-history | profile Activity tab |  |  |  |  |  |  |  |  |  |  |  | +3 | `review-own-history-profile-activity-tab.json` |
| review-own-history | profile Journal tab |  |  |  |  |  |  |  |  |  |  |  | +3 | `review-own-history-profile-journal-tab.json` |
| review-own-history | tracker Journal tab |  |  |  |  |  |  |  |  |  |  |  |  | `review-own-history-tracker-journal-tab.json` |
| find-what-i-thought | film: search to title page history |  |  |  |  |  |  |  |  |  |  |  |  | `find-what-i-thought-film-search-to-title-page-history.json` |
| find-what-i-thought | TV: search to title page, note absent |  |  |  |  |  |  |  |  |  |  |  |  | `find-what-i-thought-tv-search-to-title-page-note-absent.json` |
| delete-account | user menu, settings, Danger Zone |  | -1 ~1 |  |  |  |  | -2 | -2 | ~4 | -1 |  | -4 | `delete-account-user-menu-settings-danger-zone.json` |
| probe | finished show with a completion review, unmark and remark E1 |  |  |  |  |  |  |  |  |  |  |  |  | `probe-finished-show-with-a-completion-review-unmark-and-remark-e1.json` |
| probe | one episode, public journal and a contradicting public review |  | +1 |  |  |  | +1 |  |  |  |  |  | +2 | `probe-one-episode-public-journal-and-a-contradicting-public-review.json` |
| probe | private journal note, friend looks for it |  |  |  |  |  | +1 |  |  |  |  |  | +1 | `probe-private-journal-note-friend-looks-for-it.json` |
| probe | private log on a shared list, friend's view before and after |  | +1 |  |  |  |  | +1 | +2 | +2 |  |  | +3 | `probe-private-log-on-a-shared-list-friend-s-view-before-and-after.json` |
<!-- /gen:matrix -->

## Readers after each write

<!-- gen:readers -->
| Job | Entry point | titleWatchedLit | titleHistorySection | titleNoteVisible | feedOwn | feedNote | profileActivity | profileNote | profileJournalTab | myPicksHasTitle | myPicksTick | trackerJournalTab | trackerDetailNote | trackerDetailProgress |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| log-film-now | custom list card eye, rate+note+public | no | yes | yes | yes | yes | yes | yes | yes | no | 0 |  |  |  |
| log-film-now | My Picks card eye, rate+note+public | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| log-film-now | My Picks card eye, remind me later | yes | yes | no | yes | no | yes | no | no | yes | 1 |  |  |  |
| log-film-now | My Picks card eye, Skip | yes | no | no | no | no | no | no | no | yes | 1 |  |  |  |
| log-film-now | review reminder notification, Review now | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| log-film-now | shared list eye, Skip, by a member | no | no | no | no | no | no | no | no | no | 0 |  |  |  |
| log-film-now | title page, film in My Picks | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| log-film-now | title page, film in one custom list | yes | yes | yes | yes | yes | yes | yes | no | no | 0 |  |  |  |
| log-film-now | title page, film in two custom lists | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| log-film-now | title page, rate+note+public | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| log-film-now | title page, remind me later | yes | yes | no | yes | no | yes | no | no | yes | 1 |  |  |  |
| log-film-now | title page, Skip | yes | no | no | no | no | no | no | no | yes | 1 |  |  |  |
| log-film-past-date | title page, Add date 2024-03-15 | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| log-film-rewatch | custom list eye off then on | no | yes | yes | yes | yes | yes | yes | no | no | 0 |  |  |  |
| log-film-rewatch | title page Watched toggle, film already rated | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| log-film-rewatch | title page Watched toggle, first log has no rating | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| watched-with | edit existing log, add friend | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| watched-with | friend: bell Add yours, title page Watched | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| watched-with | review modal, free-text name | yes | yes | no | yes | no | yes | no | no | yes | 1 |  |  |  |
| watched-with | review modal, friend | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| change-log | feed card | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| change-log | profile activity card | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| change-log | title page card | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| change-log | title page Skip, then add a rating later | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| delete-log | feed card, only log | no | no | no | no | no | no | no | no | yes | 0 |  |  |  |
| delete-log | profile activity card, only log | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| delete-log | remove show from tracker | no | no | no | no | no | no | no | no | no | 0 | no | no | 0/5 |
| delete-log | title page card, log has a reciprocal friend event | no | no | no | yes | no | no | no | no | yes | 0 |  |  |  |
| delete-log | title page card, log made through custom list eye | no | no | no | no | no | no | no | no | no | 0 |  |  |  |
| delete-log | title page card, one of two logs | no | yes | yes | yes | yes | yes | yes | no | no | 0 |  |  |  |
| delete-log | title page card, only log | no | no | no | no | no | no | no | no | yes | 0 |  |  |  |
| delete-log | title page Watched toggle off | no | yes | yes | yes | yes | yes | yes | no | yes | 0 |  |  |  |
| delete-log | tracker Notes & Reviews: delete a review | no | no | no | no | no | no | no | no | no | 0 | no | no | 5/5 |
| delete-log | tracker: unmark episode | no | no | no | no | no | no | no | no | no | 0 | no | no | 0/5 |
| change-privacy | edit log, public to private | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| change-privacy | journal note: edit toggle | no | no | no | yes | yes | yes | yes | yes | no | 0 | yes | yes | 1/5 |
| change-privacy | log private from the start | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| change-privacy | private log of a title on a shared list | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| track-show | title page Watched | no | no | no | no | no | no | no | no | no | 0 | no | no | 0/5 |
| track-show | tracker index, Browse TV Shows | no | no | no | no | no | no | no | no | no | 0 | no | no | 0/5 |
| mark-next-episode | friend's episode review, bell Mark in tracker | no | yes | no | yes | no | yes | no | no | no | 0 | no | no | 1/5 |
| mark-next-episode | tracker detail row, dismiss prompt | no | no | no | no | no | no | no | no | no | 0 | no | no | 1/5 |
| mark-season | season row Mark All | no | no | no | no | no | no | no | no | no | 0 | no | no | 7/62 |
| mark-season | top Mark All, show still has more seasons | no | no | no | no | no | no | no | no | no | 0 | no | no | 62/62 |
| finish-show | first finish, achievements earned, top Mark All | no | no | no | no | no | no | no | no | no | 0 | no | no | 5/5 |
| finish-show | tap the last episode row | no | yes | yes | yes | yes | yes | yes | no | no | 0 | no | yes | 5/5 |
| finish-show | top Mark All, dismiss celebration | no | no | no | no | no | no | no | no | no | 0 | no | no | 5/5 |
| finish-show | top Mark All, Leave a Review | no | yes | yes | yes | yes | yes | yes | no | no | 0 | no | yes | 5/5 |
| finish-show | top Mark All, Remind Me Later | no | yes | no | yes | no | yes | no | no | no | 0 | no | no | 5/5 |
| rewatch-show | tracker detail Rewatch | no | no | no | no | no | no | no | no | no | 0 | no | no | 1/5 |
| rewatch-show | tracker index card Rewatch | no | no | no | no | no | no | no | no | no | 0 | no | no | 0/5 |
| write-about-episode | prompt after marking, Yes, review modal | no | yes | yes | yes | yes | yes | yes | yes | no | 0 | no | yes | 1/5 |
| write-about-episode | Write, Note, episode (private default) | no | no | no | no | no | no | no | no | no | 0 | yes | yes | 1/5 |
| write-about-episode | Write, Note, episode, Public | no | no | no | yes | yes | yes | yes | yes | no | 0 | yes | yes | 1/5 |
| write-about-episode | Write, Review, episode | no | yes | yes | yes | yes | yes | yes | no | no | 0 | no | yes | 1/5 |
| write-about-episode | Write, Review, unwatched episode | no | yes | yes | yes | yes | yes | yes | no | no | 0 | no | yes | 1/5 |
| log-tv-from-watchlist | My Picks card eye on a TV show, rate+note | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 | no | yes | 0/5 |
| save-for-later | search poster card bookmark | no | no | no | no | no | no | no | no | no | 0 |  |  |  |
| save-for-later | title page Watchlist popover, My Picks | no | no | no | no | no | no | no | no | yes | 0 |  |  |  |
| decide-what-to-watch | shuffle alone, one No then Hide | no | no | no | no | no | no | no | no | no | 0 |  |  |  |
| decide-what-to-watch | shuffle alone, one Yes | no | no | no | no | no | no | no | no | no | 0 |  |  |  |
| decide-what-to-watch | shuffle with a friend until a match | no | no | no | no | no | no | no | no | no | 0 |  |  |  |
| recommend | review modal, Recommend to a friend | yes | yes | no | yes | no | yes | no | no | yes | 1 |  |  |  |
| recommend | title page Invite | no | no | no | no | no | no | no | no | no | 0 |  |  |  |
| act-on-recommendation | bell Accept, then Recommendations list eye | no | yes | yes | yes | yes | yes | yes | no | no | 0 |  |  |  |
| act-on-recommendation | bell Accept, then title page Watched | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| act-on-recommendation | bell Decline | no | no | no | no | no | no | no | no | no | 0 |  |  |  |
| act-on-recommendation | tap row without Accept, title page Watched | yes | yes | yes | yes | yes | yes | yes | no | yes | 1 |  |  |  |
| add-friend | friends search, other accepts on friends page | no | no | no | no | no | no | no | no | no | 0 |  |  |  |
| add-friend | profile Add Friend, other accepts via bell and profile | no | no | no | no | no | no | no | no | no | 0 |  |  |  |
| see-friends-watched | feed | no | no | no | yes | yes | no | no | no | no | 0 |  |  |  |
| see-friends-watched | friends page, friend profile, activity | no | no | no | yes | yes | no | no | no | no | 0 |  |  |  |
| review-own-history | feed, Just Me | yes | yes | yes | yes | yes | yes | yes | yes | yes | 1 |  |  |  |
| review-own-history | profile Activity tab | yes | yes | yes | yes | yes | yes | yes | yes | yes | 1 |  |  |  |
| review-own-history | profile Journal tab | yes | yes | yes | yes | yes | yes | yes | yes | yes | 1 |  |  |  |
| review-own-history | tracker Journal tab | no | no | no | no | yes | no | yes | yes | no | 1 | yes | yes | 1/5 |
| find-what-i-thought | film: search to title page history | yes | yes | yes | yes | yes | yes | yes | yes | yes | 1 |  |  |  |
| find-what-i-thought | TV: search to title page, note absent | no | no | no | no | yes | no | yes | yes | no | 1 | yes | yes | 1/5 |
| probe | finished show with a completion review, unmark and remark E1 | no | yes | yes | yes | yes | yes | yes | no | no | 0 | no | yes | 5/5 |
| probe | one episode, public journal and a contradicting public review | no | yes | yes | yes | yes | yes | yes | no | no | 0 | no | yes | 1/5 |
| probe | private journal note, friend looks for it | no | no | no | no | no | no | no | yes | no | 0 | yes | yes | 1/5 |
<!-- /gen:readers -->

## What a friend sees

<!-- gen:friend -->
| Job | Entry point | friendFeed | friendFeedNote | friendProfile | friendProfileNote | friendTitlePageMentionsOwner | friend's bell (first 200 chars) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| log-film-now | shared list eye, Skip, by a member | no | no | no | no | no | POPCORN 5 F NOW SHOWING FEED Everyone Just Me TODAY F filmj4x earned an achievement 3m ago 🎫 Ticket Holder Complete onboarding F filmj4x earned an achievement 3m ago 🍿 Shared Popcorn Join a collabor |
| watched-with | edit existing log, add friend | yes | yes | yes | yes | yes | POPCORN 1 F NOW SHOWING FEED Everyone Just Me TODAY F filmg3x earned an achievement Just now 🎫 Ticket Holder Complete onboarding F filmg3x earned an achievement Just now 📋 Coming Attractions Create  |
| watched-with | friend: bell Add yours, title page Watched |  |  |  |  |  | POPCORN S NOW SHOWING FEED Everyone Just Me TODAY S socc1x earned an achievement Just now 🎫 Ticket Holder Complete onboarding S socc1x earned an achievement Just now 📋 Coming Attractions Create your |
| watched-with | review modal, friend | yes | yes | yes | yes | yes | POPCORN 1 F NOW SHOWING FEED Everyone Just Me TODAY F filmg1x earned an achievement Just now 🎫 Ticket Holder Complete onboarding F filmg1x earned an achievement Just now 📋 Coming Attractions Create  |
| delete-log | title page card, log has a reciprocal friend event | yes | no | no | no | yes | Notifications Mark all read S socc2x shared their thoughts on The Matrix that you watch |
| change-privacy | edit log, public to private | no | no | no | no | no | Notifications No notifications |
| change-privacy | log private from the start | no | no | no | no | no | Notifications No notifications |
| change-privacy | private log of a title on a shared list | no | no | no | no | no | Notifications Mark all read Loading... |
| mark-next-episode | friend's episode review, bell Mark in tracker |  |  |  |  |  | POPCORN P NOW SHOWING FEED Everyone Just Me TODAY P prbp3s earned an achievement Just now 🎫 Ticket Holder Complete onboarding P prbp3s earned an achievement Just now 📋 Coming Attractions Create your |
| write-about-episode | Write, Note, episode, Public | yes | yes | yes | yes | no | POPCORN T NOW SHOWING FEED Everyone Just Me TODAY T tvt6x earned an achievement Just now 🎫 Ticket Holder Complete onboarding T tvt6x earned an achievement Just now 📋 Coming Attractions Create your f |
| decide-what-to-watch | shuffle with a friend until a match |  |  |  |  |  | Notifications Load |
| recommend | review modal, Recommend to a friend |  |  |  |  |  | POPCORN 1 S NOW SHOWING FEED Everyone Just Me TODAY S socr2x earned an achievement Just now 🎫 Ticket Holder Complete onboarding S socr2x earned an achievement Just now 📋 Coming Attractions Create yo |
| recommend | title page Invite |  |  |  |  |  | Notifications Mark all read Loading... |
| act-on-recommendation | bell Accept, then Recommendations list eye |  |  |  |  |  | POPCORN 3 S NOW SHOWING FEED Everyone Just Me TODAY S socr3x earned an achievement Just now 🎫 Ticket Holder Complete onboarding S socr3x earned an achievement Just now 📋 Coming Attractions Create yo |
| act-on-recommendation | bell Accept, then title page Watched |  |  |  |  |  | POPCORN S NOW SHOWING FEED Everyone Just Me TODAY S socr4x earned an achievement Just now 🎫 Ticket Holder Complete onboarding S socr4x earned an achievement Just now 📋 Coming Attractions Create your |
| act-on-recommendation | bell Decline |  |  |  |  |  | Notifications No notifications |
| act-on-recommendation | tap row without Accept, title page Watched |  |  |  |  |  | POPCORN S NOW SHOWING FEED Everyone Just Me TODAY S socr5x earned an achievement Just now 🎫 Ticket Holder Complete onboarding S socr5x earned an achievement Just now 📋 Coming Attractions Create your |
| add-friend | friends search, other accepts on friends page |  |  |  |  |  | Notifications Mark all read S socf1x earned the Plus One achievement Just now S socf1x sent you a friend request Just now Delete all notifications |
| add-friend | profile Add Friend, other accepts via bell and profile |  |  |  |  |  | Notifications Mark all read Loading... |
| see-friends-watched | feed |  |  |  |  |  | POPCORN S NOW SHOWING FEED Everyone Just Me TODAY S socv1x earned an achievement Just now 🎫 Ticket Holder Complete onboarding S socv1x earned an achievement Just now 📋 Coming Attractions Create your |
| see-friends-watched | friends page, friend profile, activity |  |  |  |  |  | POPCORN S NOW SHOWING FEED Everyone Just Me TODAY S socv2x earned an achievement Just now 🎫 Ticket Holder Complete onboarding S socv2x earned an achievement Just now 📋 Coming Attractions Create your |
| probe | private journal note, friend looks for it | no | no | no | no | no | Notifications Loading... |
<!-- /gen:friend -->

## Probes

### Is `review` ever written or read by a user-facing path

No (measured). 0 rows after every flow. `review_text` was set on 0 of 106 events. The six achievements that read the table were earned 0 times, so they could not be earned through anything driven here. No screen reads it. Query run on the disposable database at the end of the run.

### Does a journal entry appear where a watch_event note appears

Only partly (measured). `flows/probe-one-episode-public-journal-and-a-contradicting-public-review.json` with screenshots `flows-probes/*-reader-*.png`.

| Surface | Journal note | Review note |
| --- | --- | --- |
| Title page | no | yes |
| Feed | yes | yes |
| Profile Recent Activity | in DOM, not visible at 390 | in DOM, not visible at 390 |
| Profile Journal tab | in DOM, not visible at 390 | no |
| Tracker Journal tab | yes | no |
| Tracker detail | yes | yes |

Rows held at once for the same episode.

```
journal_entry  episode S1E1  is_public=t  "probe journal says it was wonderful"
watch_event    episode S1E1  rating=2  public  "probe review says it was dreadful"
```

So one title can hold a rating in one place and different thoughts in another. Films cannot, because films have no journal.

### Does marking all episodes create a show-level watch_event

No (measured). `ew +5`, no `we`. The show is absent from the feed, the title page history and profile Titles, while watch time shows 5h 31m. A `we` appears only if the user reaches the review offer, and a first finish cannot reach it. Evidence is `flows/finish-show-top-mark-all-dismiss-celebration.json` and `flows/finish-show-first-finish-achievements-earned-top-mark-all.json`. The completion review is stored with `scope` NULL, while the Write path stores `episode`. The tracker's check looks for `scope = 'show'` (`tracker.$tmdbId.tsx:96`). Unmarking and remarking E1 after a NULL-scope review did not re-prompt in the one path driven (`flows/probe-finished-show-with-a-completion-review-unmark-and-remark-e1.json`), which source alone would not predict. Unresolved.

### Does deleting a log update the rest

Partly (measured).

| Store | After deleting the only log | Evidence |
| --- | --- | --- |
| `watchlist_item.watched` | reset, `wi ~1` | `flows/delete-log-title-page-card-only-log.json` |
| `watchlist_item.watched`, one of two logs | unchanged | `flows/delete-log-title-page-card-one-of-two-logs.json` |
| `episode_watch` | unchanged, deleting a TV review leaves 5 rows | `flows/delete-log-tracker-notes-reviews-delete-a-review.json` |
| Achievements | never revoked, no `ach -` in any delete flow | all `delete-log-*.json` |
| Stats | film returns to 0h 0m. TV stays at 5h 31m | same |
| Friend's reciprocal log | survives, `we ~1` clears its link | `flows/delete-log-title-page-card-log-has-a-reciprocal-friend-event.json` |

### Does rewatching bump the count consistently

No (measured). TV rewatch moves `user_title.current_watch_number` from 1 to 2. A film has no `user_title` row outside onboarding, and a second log keeps `watch_number` 1. All 89 film events in the run have `watch_number` 1. All 17 TV events also have 1, but no TV flow logged a review after a rewatch, so that second number proves nothing about TV.

### Private visibility

Direct surfaces hold. Three side channels leak (measured).

| Channel | Result | Evidence |
| --- | --- | --- |
| Friend's feed | no leak | `flows/change-privacy-log-private-from-the-start.json` |
| Friend's title page | no leak | same, `friendTitlePageMentionsOwner: false` |
| Friend's view of a private journal note | no leak | `flows/probe-private-journal-note-friend-looks-for-it.json` |
| Friend's profile aggregates | **leak**. `2h 16m Watched, 1 Titles`, `Top Genres Action 1` after the only log went private | `flows-film/176-change-privacy-edit-log-public-to-private-friend-profile.aria.yml` |
| Shared list notification | **leak**. Friend's bell reads "marked The Matrix as watched in Together" for a private log | `probe-private-shared-list/003-friend-bell.png`, `flows/probe-private-log-on-a-shared-list-friend-s-view-before-and-after.json` |
| Shared list contents | **leak, and data loss**. The private log removes the item from the shared list for both people. Friend saw it before, not after | `probe-private-shared-list/001-friend-list-before.png`, `002-friend-list-after.png` |

The removal happens in the client after a log, when the title is on exactly one list (`components/title/title-actions.tsx:229`). It does not check whether that list is shared.

### Dead ends and one-way states

| State | Way back | Evidence |
| --- | --- | --- |
| Review offer on a first finish | None. Write, Review still works, but the prompt is gone for good | `probe-finish-race/` |
| Rated film, want to log again | None on the title page | `flows/log-film-rewatch-title-page-watched-toggle-film-already-rated.json` |
| Edit or delete from profile at 390 | Use title page or feed | `probe-profile-offscreen/` |
| Skip, want to rate later | Toggle off and on, 9 actions, nothing suggests it | `flows/change-log-title-page-skip-then-add-a-rating-later.json` |
| Top Mark All on a long show | No bulk undo (inferred from source), 62 rows written in one tap (measured) | `flows/mark-season-top-mark-all-show-still-has-more-seasons.json` |
| Declined recommendation | Notification consumed, no way to reopen it (inferred) | `flows/act-on-recommendation-bell-decline.json` |

### Other things noticed

- Reading writes rows. Visiting a profile inserts `earned_achievement` through `achievement.sync`, and 77 of 85 flows recorded writes during their read phase (measured, inflated by fixtures).
- The title page query creates the default list and the shuffle page creates the shuffle list, so reads create watchlists (measured).
- `recommendation.status` is `pending` on all 7 rows, including accepted and declined (measured).
- `watchlist_item.watched_at` is empty on 86 of 102 watched rows, because `quickMarkWatched` never sets it (measured).
- `watchlist_item.watched` is one flag per item, not per person, so one member's mark applies to the whole shared list (inferred from schema, consistent with `flows/log-film-now-shared-list-eye-skip-by-a-member.json`).
- The achievement popup is `aria-hidden` while on screen under a live modal, so a screen reader gets no sign of it (measured, `flows-tv/*finish-show*failure.aria.yml`).
