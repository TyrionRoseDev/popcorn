# Task flows

This document maps what it takes to do each core job in Popcorn on a phone. Every job was driven on the real UI at 390x844, once per entry point I could find. It also tests half of one hypothesis, that splitting "watched it and what I thought" across five tables causes much of the incoherence. The row-level evidence for that test is in `02-row-delta-matrix.md`.

## How to read this

- **Measured** means a run produced it. **Inferred** means reasoning from measured results or source. **Guess** means unverified.
- Everything in the generated tables is measured.
- Tree under test is HEAD 0562c26 plus the owner's uncommitted changes.
- An action is one tap, one field filled, one key press or one navigation tap. Characters are not counted.
- Counts start from the landing screen, `/app/search`, unless the entry point says otherwise.
- Achievement popups that interrupt a flow count as actions, because the user has to clear them.
- A decision is a choice the screen forces. Decisions are only recorded where a flow script declares them, so a 0 means none was declared, not that none exists.
- Evidence paths are relative to `~/.cache/verify-popcorn/evidence/vp-20261106-214913/`. Flow records live in `flows/<id>.json`. `vp down` does not delete evidence.

## What limits these numbers

- Fixture users skip onboarding, so they lack the default list and the first achievements a real user would hold. Only the two sign-up flows use real onboarding.
- Fixture users earn achievements on first contact, so popup counts run higher than they would for an established user.
- Time-to-settle is left out. Load reached 58 on 10 cores during the run, so timings mean nothing here.
- The app ran in dev mode. Production behaviour is not verified.
- Reader results in the generated tables test DOM text, not visibility. A DOM hit on the profile does not mean a person can see it at 390 wide. See the visibility table below.

## Main results

1. **The review offer is unreachable on a first finish (measured).** Finishing a show that earns an achievement opens Show Complete and the achievement popup within 1 to 2 ms of each other. The popup is on top but inert. The user's tap on its Continue button lands on Show Complete underneath and closes it. Leave a Review and Remind Me Later are never seen. Result is 0 `watch_event` rows, 0 reminders, and no offer after reload. It reproduces with and without reduced motion, and a tap at 0.5 s misses too. Evidence is `probe-finish-race/`, `probe-stacked-modals/` and `flows/finish-show-first-finish-achievements-earned-top-mark-all.json`.
2. **The profile's tabs are invisible at phone width (measured).** At 390 wide the tab panel has `clientHeight` 0 and `scrollHeight` 78, and it is 1090 px wide inside a 358 px clipped container. At 1280 it is 194 px tall and works. Recent Activity, Journal and a friend's activity cannot be seen. Edit and Delete cannot be reached from the profile. Evidence is `probe-profile-offscreen/panel-390.png`, `panel-1280.png` and `probe-reader-visibility/`.
3. **The feed is the only working diary on a phone (measured).** It is the one place that shows both film logs and public journal notes in a visible way. It hides private notes even in Just Me (`flows/review-own-history-feed-just-me.json`).
4. **A rated film cannot be rewatched from its title page (measured).** Pressing Watched twice opens no modal and changes no rows. The only observed route is to put the film on a custom list and toggle its eye off and on, 9 actions.
5. **Same job, wide spread (measured).** Logging a film takes 4 to 9 actions over 12 entry points. Writing about an episode takes 9 to 13. Logging a past date takes 13.

## Summary per job

Only completed flows count toward min and max. Failed and blocked flows are in the Not completed column.

<!-- gen:summary -->
| Job | Entry points driven | Completed | Not completed | Min actions | Max actions | Min screens | Max screens | Max decisions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sign-up | 2 | 2 | 0 | 18 | 21 | 12 | 12 | 7 |
| log-film-now | 12 | 12 | 0 | 4 | 9 | 3 | 6 | 8 |
| log-film-past-date | 1 | 1 | 0 | 13 | 13 | 5 | 5 | 8 |
| log-film-rewatch | 3 | 2 | 1 | 8 | 9 | 3 | 5 | 7 |
| watched-with | 4 | 4 | 0 | 8 | 12 | 4 | 5 | 8 |
| change-log | 4 | 3 | 1 | 6 | 9 | 4 | 5 | 0 |
| delete-log | 10 | 9 | 1 | 3 | 5 | 2 | 4 | 1 |
| change-privacy | 4 | 4 | 0 | 6 | 8 | 4 | 5 | 7 |
| track-show | 2 | 2 | 0 | 4 | 7 | 4 | 7 | 0 |
| mark-next-episode | 2 | 2 | 0 | 3 | 5 | 3 | 4 | 1 |
| mark-season | 2 | 2 | 0 | 4 | 5 | 4 | 5 | 0 |
| finish-show | 5 | 5 | 0 | 5 | 10 | 5 | 7 | 1 |
| rewatch-show | 2 | 2 | 0 | 5 | 7 | 5 | 6 | 1 |
| write-about-episode | 5 | 5 | 0 | 9 | 13 | 5 | 10 | 5 |
| log-tv-from-watchlist | 1 | 1 | 0 | 9 | 9 | 6 | 6 | 0 |
| save-for-later | 2 | 1 | 1 | 4 | 4 | 3 | 3 | 1 |
| decide-what-to-watch | 3 | 3 | 0 | 4 | 13 | 3 | 10 | 1 |
| recommend | 2 | 2 | 0 | 8 | 12 | 4 | 5 | 2 |
| act-on-recommendation | 4 | 4 | 0 | 2 | 12 | 2 | 7 | 1 |
| add-friend | 2 | 2 | 0 | 5 | 8 | 5 | 6 | 1 |
| see-friends-watched | 2 | 2 | 0 | 2 | 3 | 3 | 4 | 0 |
| review-own-history | 4 | 4 | 0 | 3 | 4 | 3 | 4 | 1 |
| find-what-i-thought | 2 | 2 | 0 | 2 | 3 | 2 | 3 | 0 |
| delete-account | 1 | 1 | 0 | 5 | 5 | 4 | 4 | 1 |
<!-- /gen:summary -->

## Visibility at 390 wide

Hit-tested with `elementFromPoint` after scrolling the text into view (measured). Evidence is `probe-reader-visibility/<surface>.png`.

| Surface | Film note or journal note | Visible to a person |
| --- | --- | --- |
| Title page history | film note | yes |
| Feed, own | film note | yes |
| Feed, friend | film note | yes |
| Tracker index, Journal tab | journal note | yes |
| Tracker detail | journal note | yes |
| Profile, Recent Activity, own | film note | no, 1030 px wide in a 0 height panel |
| Profile, Journal tab, own | journal note | no, 0 by 0 box |
| Profile, Recent Activity, friend's view | film note | no, same panel |

## Notes per job

Counts for every entry point are in the table after this section.

### Sign up and reach a useful first screen

18 actions and 12 screens on the minimum path. 21 when the user searches for a title (measured). The taste step needs 3 genres and 3 titles before Continue works. The first screen is Search, which is not the diary. A TV pick in the taste step lands in the tracker as "In progress" with nothing watched (`flows/sign-up-real-onboarding-minimum-path.json`). In the search variant the top Chernobyl hit was a film, so that flow's TV title came from the poster grid, not the search.

### Log a film just watched

8 actions from the title page, 9 from a list eye (measured). Visibility has no default, so the user must choose it on every log. The title page path records 2h 16m watched. The eye path records 0h 0m for the same film (`flows/log-film-now-title-page-rate-note-public.json`, `flows/log-film-now-my-picks-card-eye-rate-note-public.json`). Logging from a custom list leaves the title page Watched button unlit even though history exists.

Skip has no diary effect. After Skip the title is lit but appears nowhere else. There is no visible way to add a rating later. The user must toggle Watched off and on, 9 actions (`flows/change-log-title-page-skip-then-add-a-rating-later.json`).

### Log a film on a past date

13 actions, 5 screens and 8 declared decisions, the most of any single film job (measured). The date picker is reached from inside the review modal.

### Log a rewatch

Blocked for a rated film (`flows/log-film-rewatch-title-page-watched-toggle-film-already-rated.json`). If the first log had no rating, the modal opens again, 8 actions. Through a custom list eye it works, 9 actions. No entry point says "rewatch" for a film. Films never get a watch number above 1.

### Say who I watched with

12 actions with a friend, 10 with a free-text name, 9 to add to an existing log (measured). Adding a friend writes a second `watch_event` for that friend. The friend then gets a notification with Add yours, 8 actions.

### Change or delete a log

6 actions to edit, 5 to delete, from the title page or the feed (measured). The profile route fails at 390 because the menu is off-screen, 3 of 3 attempts with fresh users. This is a product failure. Toggling Watched off takes 3 actions but leaves the log in place, so the title goes unlit while history, feed and profile still show it (`flows/delete-log-title-page-watched-toggle-off.json`).

### Track a show and mark the next episode

4 actions from the title page, 7 from the tracker index, 5 to mark an episode from landing (measured). The prompt after marking an episode expires after 8 seconds. Marking episodes writes nothing a friend or the diary can see.

### Mark a whole season

5 actions from the season row, 4 with the top Mark All (measured). Top Mark All on Breaking Bad marks all 62 episodes in one tap with no confirmation (measured). There is no bulk undo. Unmarking is per episode behind a confirm toast (inferred from `tracker.$tmdbId.tsx`).

### Finish a show

Depends on whether the finish earns an achievement.

- First finish, 6 actions, review offer lost as described above (measured).
- Later finish, 10 actions to review, 6 for Remind Me Later, 5 to dismiss (measured, using a user who already holds the achievements).

A finish with no review leaves the show out of feed, title page and profile Titles, while watch time rises to 5h 31m.

### Rewatch a show

7 actions from tracker detail, 5 from the tracker index card (measured). The index card's Rewatch and Remove buttons have opacity 0 at rest on touch, so they are present but unseen (`rewatchButtonOpacity`, `removeButtonOpacity` in the flow records).

### Write about an episode

9 actions through the prompt after marking, 11 to 13 through Write (measured). Write asks type, scope, season and episode in sequence. Note and Review are separate paths with different defaults. A note is private by default. A review forces a choice.

### Save to watch later

4 actions from the title page (measured). The bookmark on a search card is blocked at touch width. Its opacity is 0 and the tap opens the title page instead (`flows/save-for-later-search-poster-card-bookmark.json`).

### Decide what to watch

4 to 5 actions alone. Yes adds the title to a hidden shuffle list, not My Picks (measured). With a friend it took 13 actions across two people to reach a match. Group shuffle has no entry on the Shuffle page. It starts only from Showtime Shuffle in a shared list's header. The match screen offers no action, only the text "Added to Together" (`flows/decide-what-to-watch-shuffle-with-a-friend-until-a-match.json`).

### Recommend, and act on a recommendation

8 actions from Invite, 12 from the review modal (measured). Receiving takes 2 actions to decline and 8 to 12 to act on. `recommendation.status` stayed `pending` on all 7 rows, including accepted and declined ones (measured).

### Add a friend

5 to 8 actions across both people (measured).

### See what friends watched

2 actions through the feed. 3 through the friends page, but the friend's activity is then invisible at 390 (measured).

### Review my history

3 actions to the feed (Just Me) or tracker Journal, 3 to 4 to the profile tabs (measured). No single screen holds both films and TV notes in a visible form. The feed hides private notes and the tracker Journal shows no films (`showsFilm: false`).

### Find what I thought months ago

Film, 2 actions, title page shows the note. TV note, title page does not show it. The user has to know to go to the tracker (`flows/find-what-i-thought-tv-search-to-title-page-note-absent.json`).

### Change the privacy of a log

6 actions for a log, 6 for a journal note, through different controls (measured). Log uses Public and Private buttons, a note uses a switch. See the leak probes in `02-row-delta-matrix.md`.

### Delete my account

5 actions, 4 screens, one typed confirmation (measured). The friend's reciprocal log survives and still names the deleted user in its "with" line (`observations.friendFeedAfter` in `flows/delete-account-user-menu-settings-danger-zone.json`). The reader phase errors on this flow because the account no longer exists. That is expected.

## Entry points found to have no direct log

- Feed cards offer no way to log the same title (inferred from the feed screenshots and `routes/app/feed.tsx`).
- The shuffle match screen offers no action (measured).
- The profile has none that work at 390 (measured).

## Counts for every entry point

<!-- gen:counts -->
| Job | Entry point | Result | Attempts | Actions (nav+task) | Fields | Screens | Decisions | Mutations | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sign-up | real onboarding, minimum path | pass | 1 | 18 (2+16) | 2 | 12 | 7 | auth/sign-in/magic-link, auth/update-user, tasteProfile.saveTasteProfile, tasteProfile.saveProfileExtras, achievement.sync | `sign-up-real-onboarding-minimum-path.json`, `flows-social/001-sign-up-real-onboarding-minimum-path-taste-empty.png` |
| sign-up | real onboarding, picks a TV show in the taste step | pass | 4 | 21 (2+19) | 4 | 12 | 7 | auth/sign-in/magic-link, auth/update-user, tasteProfile.saveTasteProfile, tasteProfile.saveProfileExtras, achievement.sync | `sign-up-real-onboarding-picks-a-tv-show-in-the-taste-step.json`, `flows-social/019-sign-up-real-onboarding-picks-a-tv-show-in-the-taste-step-taste-empty.png` |
| log-film-now | custom list card eye, rate+note+public | pass | 1 | 9 (3+6) | 1 | 6 | 7 | watchEvent.create, watchlist.markWatched | `log-film-now-custom-list-card-eye-rate-note-public.json`, `flows-film/019-log-film-now-custom-list-card-eye-rate-note-public-end.png` |
| log-film-now | My Picks card eye, rate+note+public | pass | 1 | 9 (3+6) | 1 | 6 | 7 | watchEvent.create, watchlist.markWatched | `log-film-now-my-picks-card-eye-rate-note-public.json`, `flows-film/013-log-film-now-my-picks-card-eye-rate-note-public-end.png` |
| log-film-now | My Picks card eye, remind me later | pass | 1 | 6 (3+3) | 0 | 6 | 7 | watchEvent.create, watchlist.markWatched | `log-film-now-my-picks-card-eye-remind-me-later.json`, `flows-film/031-log-film-now-my-picks-card-eye-remind-me-later-end.png` |
| log-film-now | My Picks card eye, Skip | pass | 1 | 6 (3+3) | 0 | 6 | 7 | watchlist.markWatched | `log-film-now-my-picks-card-eye-skip.json`, `flows-film/025-log-film-now-my-picks-card-eye-skip-end.png` |
| log-film-now | review reminder notification, Review now | pass | 1 | 5 (2+3) | 1 | 3 | 1 | notification.setActionTaken, watchEvent.update | `log-film-now-review-reminder-notification-review-now.json`, `flows-film/024-log-film-now-review-reminder-notification-review-now-end.png` |
| log-film-now | shared list eye, Skip, by a member | pass | 1 | 6 (3+3) | 0 | 6 | 7 | watchlist.markWatched | `log-film-now-shared-list-eye-skip-by-a-member.json`, `flows-film/196-log-film-now-shared-list-eye-skip-by-a-member-end.png` |
| log-film-now | title page, film in My Picks | pass | 2 | 8 (1+7) | 2 | 4 | 7 | watchlist.quickMarkWatched, watchEvent.create | `log-film-now-title-page-film-in-my-picks.json`, `flows-film/044-log-film-now-title-page-film-in-my-picks-end.png` |
| log-film-now | title page, film in one custom list | pass | 1 | 8 (1+7) | 2 | 4 | 7 | watchlist.addItem, watchlist.quickMarkWatched, watchEvent.create, watchlist.removeItem | `log-film-now-title-page-film-in-one-custom-list.json`, `flows-film/037-log-film-now-title-page-film-in-one-custom-list-end.png` |
| log-film-now | title page, film in two custom lists | pass | 1 | 7 (1+6) | 2 | 3 | 8 | watchlist.quickMarkWatched, watchEvent.create | `log-film-now-title-page-film-in-two-custom-lists.json`, `flows-film/051-log-film-now-title-page-film-in-two-custom-lists-end.png` |
| log-film-now | title page, rate+note+public | pass | 2 | 8 (1+7) | 2 | 4 | 7 | watchlist.quickMarkWatched, watchEvent.create | `log-film-now-title-page-rate-note-public.json`, `flows-film/002-log-film-now-title-page-rate-note-public-end.png` |
| log-film-now | title page, remind me later | pass | 2 | 5 (1+4) | 1 | 4 | 7 | watchlist.quickMarkWatched, watchEvent.create | `log-film-now-title-page-remind-me-later.json`, `flows-film/007-log-film-now-title-page-remind-me-later-end.png` |
| log-film-now | title page, Skip | pass | 1 | 4 (1+3) | 1 | 3 | 7 | watchlist.quickMarkWatched | `log-film-now-title-page-skip.json`, `flows-film/001-log-film-now-title-page-skip-end.png` |
| log-film-past-date | title page, Add date 2024-03-15 | pass | 1 | 13 (1+12) | 2 | 5 | 8 | watchlist.quickMarkWatched, watchEvent.create | `log-film-past-date-title-page-add-date-2024-03-15.json`, `flows-film/059-log-film-past-date-title-page-add-date-2024-03-15-end.png` |
| log-film-rewatch | custom list eye off then on | pass | 1 | 9 (3+6) | 1 | 5 | 7 | watchlist.markWatched, watchEvent.create | `log-film-rewatch-custom-list-eye-off-then-on.json`, `flows-film/079-log-film-rewatch-custom-list-eye-off-then-on-end.png` |
| log-film-rewatch | title page Watched toggle, film already rated | blocked | 1 | 4 (1+3) | 1 | 2 | 0 | watchlist.quickMarkWatched | `log-film-rewatch-title-page-watched-toggle-film-already-rated.json`, `flows-film/067-log-film-rewatch-title-page-watched-toggle-film-already-rated-end.png` |
| log-film-rewatch | title page Watched toggle, first log has no rating | pass | 1 | 8 (1+7) | 2 | 3 | 7 | watchlist.quickMarkWatched, watchEvent.create | `log-film-rewatch-title-page-watched-toggle-first-log-has-no-rating.json`, `flows-film/073-log-film-rewatch-title-page-watched-toggle-first-log-has-no-rating-end.png` |
| watched-with | edit existing log, add friend | pass | 1 | 9 (1+8) | 2 | 4 | 1 | watchEvent.update | `watched-with-edit-existing-log-add-friend.json`, `flows-film/102-watched-with-edit-existing-log-add-friend-end.png` |
| watched-with | friend: bell Add yours, title page Watched | pass | 1 | 8 (2+6) | 1 | 5 | 1 | notification.setActionTaken, watchlist.quickMarkWatched, watchEvent.create, socc1xpal:watchlist.quickMarkWatched, socc1xpal:watchEvent.create | `watched-with-friend-bell-add-yours-title-page-watched.json`, `flows-social/077-watched-with-friend-bell-add-yours-title-page-watched-end.png` |
| watched-with | review modal, free-text name | pass | 1 | 10 (1+9) | 2 | 5 | 8 | watchlist.quickMarkWatched, watchEvent.create | `watched-with-review-modal-free-text-name.json`, `flows-film/001-watched-with-review-modal-free-text-name-end.png` |
| watched-with | review modal, friend | pass | 1 | 12 (1+11) | 3 | 5 | 8 | watchlist.quickMarkWatched, watchEvent.create | `watched-with-review-modal-friend.json`, `flows-film/085-watched-with-review-modal-friend-end.png` |
| change-log | feed card | pass | 1 | 6 (2+4) | 0 | 5 | 0 | watchEvent.update | `change-log-feed-card.json`, `flows-film/117-change-log-feed-card-end.png` |
| change-log | profile activity card | fail | 3 | 4 (2+2) | 0 | 4 | 0 | achievement.sync | `change-log-profile-activity-card.json`, `flows-film/009-change-log-profile-activity-card-failure.png` |
| change-log | title page card | pass | 1 | 6 (1+5) | 1 | 4 | 0 | watchEvent.update | `change-log-title-page-card.json`, `flows-film/111-change-log-title-page-card-end.png` |
| change-log | title page Skip, then add a rating later | pass | 1 | 9 (1+8) | 2 | 4 | 0 | watchlist.quickMarkWatched, watchEvent.create | `change-log-title-page-skip-then-add-a-rating-later.json`, `flows-probes/027-change-log-title-page-skip-then-add-a-rating-later-end.png` |
| delete-log | feed card, only log | pass | 1 | 5 (2+3) | 0 | 4 | 0 | watchEvent.delete | `delete-log-feed-card-only-log.json`, `flows-film/137-delete-log-feed-card-only-log-end.png` |
| delete-log | profile activity card, only log | fail | 3 | 4 (2+2) | 0 | 4 | 0 | achievement.sync | `delete-log-profile-activity-card-only-log.json`, `flows-film/017-delete-log-profile-activity-card-only-log-failure.png` |
| delete-log | remove show from tracker | pass | 1 | 4 (2+2) | 0 | 3 | 1 | episodeTracker.removeShow | `delete-log-remove-show-from-tracker.json`, `flows-tv/001-delete-log-remove-show-from-tracker-end.png` |
| delete-log | title page card, log has a reciprocal friend event | pass | 1 | 5 (1+4) | 1 | 2 | 0 | watchEvent.create, watchEvent.delete | `delete-log-title-page-card-log-has-a-reciprocal-friend-event.json`, `flows-social/083-delete-log-title-page-card-log-has-a-reciprocal-friend-event-end.png` |
| delete-log | title page card, log made through custom list eye | pass | 1 | 5 (1+4) | 1 | 3 | 0 | watchEvent.delete | `delete-log-title-page-card-log-made-through-custom-list-eye.json`, `flows-film/163-delete-log-title-page-card-log-made-through-custom-list-eye-end.png` |
| delete-log | title page card, one of two logs | pass | 1 | 5 (1+4) | 1 | 3 | 0 | watchEvent.delete | `delete-log-title-page-card-one-of-two-logs.json`, `flows-film/151-delete-log-title-page-card-one-of-two-logs-end.png` |
| delete-log | title page card, only log | pass | 1 | 5 (1+4) | 1 | 3 | 0 | watchEvent.delete | `delete-log-title-page-card-only-log.json`, `flows-film/131-delete-log-title-page-card-only-log-end.png` |
| delete-log | title page Watched toggle off | pass | 1 | 3 (1+2) | 1 | 2 | 0 | watchlist.quickMarkWatched | `delete-log-title-page-watched-toggle-off.json`, `flows-film/157-delete-log-title-page-watched-toggle-off-end.png` |
| delete-log | tracker Notes & Reviews: delete a review | pass | 1 | 5 (3+2) | 0 | 4 | 0 | watchEvent.delete | `delete-log-tracker-notes-reviews-delete-a-review.json`, `flows-tv/051-delete-log-tracker-notes-reviews-delete-a-review-end.png` |
| delete-log | tracker: unmark episode | pass | 1 | 5 (3+2) | 0 | 4 | 0 | episodeTracker.unmarkEpisode | `delete-log-tracker-unmark-episode.json`, `flows-tv/138-delete-log-tracker-unmark-episode-end.png` |
| change-privacy | edit log, public to private | pass | 1 | 6 (1+5) | 1 | 4 | 0 | watchEvent.update | `change-privacy-edit-log-public-to-private.json`, `flows-film/169-change-privacy-edit-log-public-to-private-end.png` |
| change-privacy | journal note: edit toggle | pass | 1 | 6 (3+3) | 0 | 5 | 0 | journalEntry.create, journalEntry.update | `change-privacy-journal-note-edit-toggle.json`, `flows-tv/179-change-privacy-journal-note-edit-toggle-end.png` |
| change-privacy | log private from the start | pass | 1 | 8 (1+7) | 2 | 4 | 7 | watchlist.quickMarkWatched, watchEvent.create | `change-privacy-log-private-from-the-start.json`, `flows-film/178-change-privacy-log-private-from-the-start-end.png` |
| change-privacy | private log of a title on a shared list | pass | 1 | 8 (1+7) | 2 | 4 | 7 | watchlist.quickMarkWatched, watchEvent.create, watchlist.removeItem | `change-privacy-private-log-of-a-title-on-a-shared-list.json`, `flows-film/187-change-privacy-private-log-of-a-title-on-a-shared-list-end.png` |
| track-show | title page Watched | pass | 1 | 4 (1+3) | 1 | 4 | 0 | episodeTracker.addShow | `track-show-title-page-watched.json`, `flows-tv/001-track-show-title-page-watched-end.png` |
| track-show | tracker index, Browse TV Shows | pass | 1 | 7 (4+3) | 1 | 7 | 0 | episodeTracker.addShow | `track-show-tracker-index-browse-tv-shows.json`, `flows-tv/008-track-show-tracker-index-browse-tv-shows-end.png` |
| mark-next-episode | friend's episode review, bell Mark in tracker | pass | 1 | 3 (1+2) | 0 | 3 | 1 | episodeTracker.markFromNotification, notification.setActionTaken, prbp3spal:episodeTracker.addShow, prbp3spal:episodeTracker.markEpisodes, prbp3spal:watchEvent.create | `mark-next-episode-friend-s-episode-review-bell-mark-in-tracker.json`, `flows-probes/015-mark-next-episode-friend-s-episode-review-bell-mark-in-tracker-end.png` |
| mark-next-episode | tracker detail row, dismiss prompt | pass | 1 | 5 (3+2) | 0 | 4 | 1 | episodeTracker.markEpisodes | `mark-next-episode-tracker-detail-row-dismiss-prompt.json`, `flows-tv/018-mark-next-episode-tracker-detail-row-dismiss-prompt-end.png` |
| mark-season | season row Mark All | pass | 1 | 5 (3+2) | 0 | 5 | 0 | episodeTracker.markEpisodes | `mark-season-season-row-mark-all.json`, `flows-tv/051-mark-season-season-row-mark-all-end.png` |
| mark-season | top Mark All, show still has more seasons | pass | 1 | 4 (3+1) | 0 | 4 | 0 | episodeTracker.markEpisodes | `mark-season-top-mark-all-show-still-has-more-seasons.json`, `flows-tv/061-mark-season-top-mark-all-show-still-has-more-seasons-end.png` |
| finish-show | first finish, achievements earned, top Mark All | pass | 1 | 6 (3+3) | 0 | 6 | 1 | episodeTracker.markEpisodes | `finish-show-first-finish-achievements-earned-top-mark-all.json`, `flows-tv/003-finish-show-first-finish-achievements-earned-top-mark-all-end.png` |
| finish-show | tap the last episode row | pass | 1 | 10 (3+7) | 1 | 7 | 1 | episodeTracker.markEpisodes, watchEvent.create | `finish-show-tap-the-last-episode-row.json`, `flows-tv/041-finish-show-tap-the-last-episode-row-end.png` |
| finish-show | top Mark All, dismiss celebration | pass | 1 | 5 (3+2) | 0 | 5 | 0 | episodeTracker.markEpisodes | `finish-show-top-mark-all-dismiss-celebration.json`, `flows-tv/031-finish-show-top-mark-all-dismiss-celebration-end.png` |
| finish-show | top Mark All, Leave a Review | pass | 1 | 10 (3+7) | 1 | 7 | 1 | episodeTracker.markEpisodes, watchEvent.create | `finish-show-top-mark-all-leave-a-review.json`, `flows-tv/013-finish-show-top-mark-all-leave-a-review-end.png` |
| finish-show | top Mark All, Remind Me Later | pass | 1 | 6 (3+3) | 0 | 6 | 1 | episodeTracker.markEpisodes, watchEvent.create | `finish-show-top-mark-all-remind-me-later.json`, `flows-tv/022-finish-show-top-mark-all-remind-me-later-end.png` |
| rewatch-show | tracker detail Rewatch | pass | 1 | 7 (3+4) | 0 | 6 | 1 | episodeTracker.startRewatch, episodeTracker.markEpisodes | `rewatch-show-tracker-detail-rewatch.json`, `flows-tv/119-rewatch-show-tracker-detail-rewatch-end.png` |
| rewatch-show | tracker index card Rewatch | pass | 1 | 5 (2+3) | 0 | 5 | 1 | episodeTracker.startRewatch | `rewatch-show-tracker-index-card-rewatch.json`, `flows-tv/129-rewatch-show-tracker-index-card-rewatch-end.png` |
| write-about-episode | prompt after marking, Yes, review modal | pass | 2 | 9 (3+6) | 1 | 5 | 1 | episodeTracker.markEpisodes, watchEvent.create | `write-about-episode-prompt-after-marking-yes-review-modal.json`, `flows-tv/002-write-about-episode-prompt-after-marking-yes-review-modal-end.png` |
| write-about-episode | Write, Note, episode (private default) | pass | 1 | 11 (3+8) | 1 | 10 | 5 | episodeTracker.markEpisodes, journalEntry.create | `write-about-episode-write-note-episode-private-default.json`, `flows-tv/011-write-about-episode-write-note-episode-private-default-end.png` |
| write-about-episode | Write, Note, episode, Public | pass | 1 | 12 (3+9) | 1 | 10 | 5 | episodeTracker.markEpisodes, journalEntry.create | `write-about-episode-write-note-episode-public.json`, `flows-tv/020-write-about-episode-write-note-episode-public-end.png` |
| write-about-episode | Write, Review, episode | pass | 1 | 12 (3+9) | 1 | 9 | 4 | episodeTracker.markEpisodes, watchEvent.create | `write-about-episode-write-review-episode.json`, `flows-tv/032-write-about-episode-write-review-episode-end.png` |
| write-about-episode | Write, Review, unwatched episode | pass | 1 | 13 (3+10) | 1 | 10 | 5 | episodeTracker.markEpisodes, watchEvent.create | `write-about-episode-write-review-unwatched-episode.json`, `flows-tv/042-write-about-episode-write-review-unwatched-episode-end.png` |
| log-tv-from-watchlist | My Picks card eye on a TV show, rate+note | pass | 1 | 9 (3+6) | 1 | 6 | 0 | watchEvent.create, watchlist.markWatched | `log-tv-from-watchlist-my-picks-card-eye-on-a-tv-show-rate-note.json`, `flows-tv/169-log-tv-from-watchlist-my-picks-card-eye-on-a-tv-show-rate-note-end.png` |
| save-for-later | search poster card bookmark | blocked | 1 | 2 (0+2) | 1 | 1 | 0 | none | `save-for-later-search-poster-card-bookmark.json`, `flows-social/009-save-for-later-search-poster-card-bookmark-end.png` |
| save-for-later | title page Watchlist popover, My Picks | pass | 1 | 4 (1+3) | 1 | 3 | 1 | watchlist.addItem | `save-for-later-title-page-watchlist-popover-my-picks.json`, `flows-social/001-save-for-later-title-page-watchlist-popover-my-picks-end.png` |
| decide-what-to-watch | shuffle alone, one No then Hide | pass | 1 | 5 (2+3) | 0 | 3 | 1 | shuffle.recordSwipe | `decide-what-to-watch-shuffle-alone-one-no-then-hide.json`, `flows-social/023-decide-what-to-watch-shuffle-alone-one-no-then-hide-end.png` |
| decide-what-to-watch | shuffle alone, one Yes | pass | 1 | 4 (2+2) | 0 | 4 | 1 | shuffle.recordSwipe | `decide-what-to-watch-shuffle-alone-one-yes.json`, `flows-social/016-decide-what-to-watch-shuffle-alone-one-yes-end.png` |
| decide-what-to-watch | shuffle with a friend until a match | pass | 1 | 13 (8+5) | 0 | 10 | 0 | watchlist.create, shuffle.recordSwipe, socsh3spal:shuffle.recordSwipe | `decide-what-to-watch-shuffle-with-a-friend-until-a-match.json`, `flows-social/003-decide-what-to-watch-shuffle-with-a-friend-until-a-match-end.png` |
| recommend | review modal, Recommend to a friend | pass | 1 | 12 (1+11) | 3 | 5 | 2 | watchlist.quickMarkWatched, recommendation.send, watchEvent.create | `recommend-review-modal-recommend-to-a-friend.json`, `flows-social/043-recommend-review-modal-recommend-to-a-friend-end.png` |
| recommend | title page Invite | pass | 1 | 8 (1+7) | 3 | 4 | 2 | recommendation.send | `recommend-title-page-invite.json`, `flows-social/037-recommend-title-page-invite-end.png` |
| act-on-recommendation | bell Accept, then Recommendations list eye | pass | 1 | 12 (4+8) | 1 | 7 | 1 | recommendation.accept, watchEvent.create, watchlist.markWatched, socr3xpal:recommendation.send | `act-on-recommendation-bell-accept-then-recommendations-list-eye.json`, `flows-social/050-act-on-recommendation-bell-accept-then-recommendations-list-eye-end.png` |
| act-on-recommendation | bell Accept, then title page Watched | pass | 1 | 9 (2+7) | 1 | 5 | 0 | recommendation.accept, watchlist.quickMarkWatched, watchEvent.create, watchlist.removeItem, socr4xpal:recommendation.send | `act-on-recommendation-bell-accept-then-title-page-watched.json`, `flows-social/056-act-on-recommendation-bell-accept-then-title-page-watched-end.png` |
| act-on-recommendation | bell Decline | pass | 1 | 2 (1+1) | 0 | 2 | 0 | recommendation.decline, socr6xpal:recommendation.send | `act-on-recommendation-bell-decline.json`, `flows-social/068-act-on-recommendation-bell-decline-end.png` |
| act-on-recommendation | tap row without Accept, title page Watched | pass | 1 | 8 (2+6) | 1 | 5 | 0 | notification.markAsRead, watchlist.quickMarkWatched, watchEvent.create, socr5xpal:recommendation.send | `act-on-recommendation-tap-row-without-accept-title-page-watched.json`, `flows-social/062-act-on-recommendation-tap-row-without-accept-title-page-watched-end.png` |
| add-friend | friends search, other accepts on friends page | pass | 1 | 8 (4+4) | 1 | 6 | 0 | friend.sendRequest, socf1xpal:friend.acceptRequest | `add-friend-friends-search-other-accepts-on-friends-page.json`, `flows-social/094-add-friend-friends-search-other-accepts-on-friends-page-end.png` |
| add-friend | profile Add Friend, other accepts via bell and profile | pass | 1 | 5 (2+3) | 0 | 5 | 1 | friend.sendRequest, socf2xpal:notification.markAsRead, socf2xpal:friend.acceptRequest | `add-friend-profile-add-friend-other-accepts-via-bell-and-profile.json`, `flows-social/102-add-friend-profile-add-friend-other-accepts-via-bell-and-profile-end.png` |
| see-friends-watched | feed | pass | 1 | 2 (2+0) | 0 | 3 | 0 | socv1xpal:watchlist.quickMarkWatched, socv1xpal:watchEvent.create | `see-friends-watched-feed.json`, `flows-social/109-see-friends-watched-feed-end.png` |
| see-friends-watched | friends page, friend profile, activity | pass | 1 | 3 (3+0) | 0 | 4 | 0 | socv2xpal:watchlist.quickMarkWatched, socv2xpal:watchEvent.create | `see-friends-watched-friends-page-friend-profile-activity.json`, `flows-social/116-see-friends-watched-friends-page-friend-profile-activity-end.png` |
| review-own-history | feed, Just Me | pass | 1 | 3 (2+1) | 0 | 3 | 1 | journalEntry.create | `review-own-history-feed-just-me.json`, `flows-social/130-review-own-history-feed-just-me-end.png` |
| review-own-history | profile Activity tab | pass | 1 | 3 (2+1) | 0 | 4 | 0 | journalEntry.create, achievement.sync | `review-own-history-profile-activity-tab.json`, `flows-social/123-review-own-history-profile-activity-tab-end.png` |
| review-own-history | profile Journal tab | pass | 1 | 4 (2+2) | 0 | 4 | 0 | journalEntry.create, achievement.sync | `review-own-history-profile-journal-tab.json`, `flows-social/010-review-own-history-profile-journal-tab-end.png` |
| review-own-history | tracker Journal tab | pass | 1 | 3 (2+1) | 0 | 3 | 0 | journalEntry.create | `review-own-history-tracker-journal-tab.json`, `flows-social/137-review-own-history-tracker-journal-tab-end.png` |
| find-what-i-thought | film: search to title page history | pass | 1 | 2 (1+1) | 1 | 2 | 0 | journalEntry.create | `find-what-i-thought-film-search-to-title-page-history.json`, `flows-social/017-find-what-i-thought-film-search-to-title-page-history-end.png` |
| find-what-i-thought | TV: search to title page, note absent | pass | 1 | 3 (1+2) | 1 | 3 | 0 | journalEntry.create, episodeTracker.addShow | `find-what-i-thought-tv-search-to-title-page-note-absent.json`, `flows-social/025-find-what-i-thought-tv-search-to-title-page-note-absent-end.png` |
| delete-account | user menu, settings, Danger Zone | pass | 1 | 5 (2+3) | 1 | 4 | 1 | recommendation.send, auth/delete-user | `delete-account-user-menu-settings-danger-zone.json`, `flows-social/037-delete-account-user-menu-settings-danger-zone-end.png` |
| probe | finished show with a completion review, unmark and remark E1 | pass | 1 | 2 (0+2) | 0 | 1 | 0 | none | `probe-finished-show-with-a-completion-review-unmark-and-remark-e1.json`, `flows-probes/034-probe-finished-show-with-a-completion-review-unmark-and-remark-e1-end.png` |
| probe | one episode, public journal and a contradicting public review | pass | 1 | 1 (0+1) | 0 | 2 | 0 | journalEntry.create, watchEvent.create | `probe-one-episode-public-journal-and-a-contradicting-public-review.json`, `flows-probes/001-probe-one-episode-public-journal-and-a-contradicting-public-review-end.png` |
| probe | private journal note, friend looks for it | pass | 1 | 1 (0+1) | 0 | 2 | 0 | journalEntry.create | `probe-private-journal-note-friend-looks-for-it.json`, `flows-probes/001-probe-private-journal-note-friend-looks-for-it-end.png` |
| probe | private log on a shared list, friend's view before and after | pass | 1 | 1 (0+1) | 0 | 1 | 0 | watchlist.create, watchlist.addItem, watchlist.quickMarkWatched, watchEvent.create, watchlist.removeItem | `probe-private-log-on-a-shared-list-friend-s-view-before-and-after.json`, `probe-private-shared-list/001-friend-list-before.png` |
<!-- /gen:counts -->

## Friction and failures recorded per flow

<!-- gen:notes -->
| Job | Entry point | Friction recorded during the run | Failure after all attempts |
| --- | --- | --- | --- |
| log-film-rewatch | title page Watched toggle, film already rated | two presses of Watched, no review modal, no new log: the rewatch never gets recorded |  |
| change-log | profile activity card |  | click: Timeout 12000ms exceeded. / Call log: / - waiting for locator('button:has(svg.lucide-ellipsis)').first() |
| change-log | title page Skip, then add a rating later | No visible way to add a rating after Skip other than toggling Watched |  |
| delete-log | profile activity card, only log |  | click: Timeout 12000ms exceeded. / Call log: / - waiting for locator('button:has(svg.lucide-ellipsis)').first() |
| delete-log | title page Watched toggle off | toast says Removed from watched; watch history stays on the same page |  |
| track-show | title page Watched | button is labelled Watched and the intent recorded is 'tracking'; no log exists yet |  |
| finish-show | first finish, achievements earned, top Mark All | Show Complete and the popup open together. The first Continue tap lands on Show Complete underneath and closes it, so Leave a Review and Remind Me Later are never seen. |  |
| save-for-later | search poster card bookmark | bookmark has opacity 0 at touch width and tapping it follows the card link to the title page |  |
| decide-what-to-watch | shuffle with a friend until a match | Group shuffle has no entry on the Shuffle page. It starts only from the Showtime Shuffle link in a shared watchlist's header. |  |
| find-what-i-thought | TV: search to title page, note absent | the only link from a TV title page to my notes is the button labelled Watched |  |
<!-- /gen:notes -->

## What failed, and whose fault it was

Two flows fail and two are blocked after retries. All four are product findings.

| Flow | Result | Attempts | Cause |
| --- | --- | --- | --- |
| `change-log-profile-activity-card` | fail | 3 | Product. Menu at x=1090 on a 390 viewport |
| `delete-log-profile-activity-card-only-log` | fail | 3 | Product. Same menu |
| `log-film-rewatch-title-page-watched-toggle-film-already-rated` | blocked | 1 | Product. No modal, no rows |
| `save-for-later-search-poster-card-bookmark` | blocked | 1 | Product. Hover-only control at touch |

Failures that turned out to be mine, fixed and not reported as findings.

- Stale selectors for the free-text companion button, `Rate 1 stars`, `Remove` and `Review now`.
- A group shuffle script that assumed a mode switcher. That component is dead code.
- A leak in my in-flight request counter that made every settle cost 30 seconds.
- Four parallel browsers at 2x device scale. Moving to 1x, reduced motion and two lanes removed most timeouts, and load fell from 58 to about 3. Other runs on the machine may have finished in the same window, so I cannot say how much of that drop was mine. Viewport stayed 390x844, and reduced motion in this app is CSS only (`styles.css:653`), so counts and rows are unaffected.

Claims I withdrew during the run.

- "The review dialog vanished." Failure snapshots do not reliably include open dialogs, so this was a misread (measured).
- "Polling closes the review modal." The modal survived 82 seconds and three poll ticks with text intact (`probe-review-modal-poll/`). This holds when no new achievement arrives. I did not test a popup arriving from another client while the modal is open.

Still unresolved.

- Full page reloads on `/onboarding` about every 30 seconds appeared in early exploration under heavy load. Writing a file under the repo did not trigger one (`explore5/`). The final sign-up flows saw 0 reloads (`devReloadsDuringOnboarding`). Onboarding keeps its step in `useState(0)`, so a real reload would drop the user back to Username (inferred). The trigger is unknown.
- A film on two custom lists showed no removal dialog (`removalDialogText: "no dialog"`), though `title-actions.tsx` says one should open. I did not resolve this.
- Direct loads of the title page throw a React hydration error, 111 times in the film pass alone. Dev mode only so far. Production unverified.
- `/app/shuffle` throws `sessionStorage is not defined` during server render (`runs/.../app.log`, `shuffle/index.tsx:31`). Production unverified.

## Stale documentation noted

`.claude/skills/verify-popcorn/features/tracker.md` describes episode row labels that no longer match the UI. I did not edit it. Treat it as past intent.

## Re-running

```
export VP_RUN_ID=<run>
verify-popcorn drive flows-film
verify-popcorn drive flows-tv
verify-popcorn drive flows-social
verify-popcorn drive flows-probes
verify-popcorn drive probe-finish-race
verify-popcorn drive probe-stacked-modals
verify-popcorn drive probe-profile-offscreen
verify-popcorn drive probe-reader-visibility
verify-popcorn drive probe-private-shared-list
verify-popcorn drive probe-review-modal-poll
bun docs/redesign/phase-1/gen-02-tables.ts ~/.cache/verify-popcorn/evidence/<run>
```

Set `FLOW_SUFFIX` to a new value for fresh users, and `FLOW_RESUME=1` to skip flows that already passed. A flow filter is the first argument, a regex on the flow key. The generator rewrites `02-flows.json` and the marked tables, so before and after numbers can be recomputed from any two runs.
