# Concept map, data side

Popcorn is a film and TV diary that grew by accretion. This document lists what a user would call each thing, where the code stores it, which procedures write it, which screens read it, and which words the UI uses for it.

## How to read this

- Paths are relative to `src/`, and `routers/` means `src/integrations/trpc/routers/`.
- Measured means a script or a direct read of the working tree produced it. The matrix below is all measured.
- Inferred means reasoning across code paths without running them.
- Guess means unverified.
- Notes under each concept are measured unless they say otherwise. F numbers refer to `04-logic-audit.md`.
- The audit ran on the working tree at commit 0562c26 with the owner's 10 uncommitted files.
- "Read on" means the file calls a query that reads the store. That proves the data reaches the file, not that the screen displays it. For example, `friend.list` computes an average rating, and the friend picker in `create-watchlist-dialog.tsx` calls it without showing the rating.
- "Dead writers" have no UI caller. Reads through achievement evaluation are left out, because every mutation would otherwise count as a reader.

Regenerate with these commands.

```
bun docs/redesign/phase-1/tools/extract-procedures.ts
bun docs/redesign/phase-1/tools/extract-ui-vocab.ts
bun docs/redesign/phase-1/tools/concept-matrix.ts
```

## What the map shows

All measured unless labelled.

- "What I watched" has three stores. `watch_event` and `episode_watch` hold occurrences, and `watchlist_item.watched` holds a separate flag that `watchEvent.create` does not update (`routers/watch-event.ts:111`, `routers/watchlist.ts:804`).
- "What I thought" has four text columns, and the live UI uses two. `watch_event.note` and `journal_entry.note` are live. `watch_event.review_text` and `review.text` have no live writer.
- The word "note" names two different columns. The word "review" names the column called `note`.
- Visibility has three models with different defaults (`db/schema.ts:287`, `db/schema.ts:545`, `db/schema.ts:149`).
- The concepts that stay clean are friend, notification, achievement and shuffle. Each has one main table. Their problems are rules and privacy, not storage.

## Matrix

<!-- matrix:start -->
| Concept | Tables | Stores | Live writers | Dead writers | Screens reading | UI words listed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A watch or log | 2 | 2 | 7 | 5 | 10 | 6 |
| A rating | 2 | 2 | 2 | 2 | 8 | 4 |
| A review or thoughts | 3 | 4 | 4 | 2 | 5 | 8 |
| A note | 2 | 2 | 4 | 0 | 5 | 6 |
| A diary entry | 2 | 2 | 7 | 5 | 10 | 6 |
| A show's progress | 3 | 4 | 7 | 0 | 8 | 8 |
| A rewatch | 4 | 4 | 5 | 0 | 5 | 5 |
| A watchlist | 2 | 2 | 11 | 1 | 16 | 4 |
| A saved title | 2 | 2 | 19 | 0 | 10 | 4 |
| Watched status | 1 | 3 | 6 | 0 | 8 | 4 |
| A recommendation | 2 | 3 | 2 | 0 | 4 | 6 |
| A friend | 2 | 2 | 7 | 0 | 8 | 6 |
| A notification | 1 | 1 | 16 | 2 | 1 | 3 |
| An achievement | 1 | 1 | 14 | 1 | 3 | 4 |
| A companion | 2 | 2 | 2 | 0 | 4 | 5 |
| Visibility or privacy | 3 | 3 | 8 | 0 | 12 | 8 |
| A shuffle or match | 1 | 1 | 4 | 0 | 4 | 6 |

### A watch or log

Stored in: `watch_event` (schema.ts:273), `episode_watch` (schema.ts:497).

Live writers (7): `episodeTracker.markEpisodes`, `episodeTracker.markFromNotification`, `episodeTracker.removeShow`, `episodeTracker.unmarkEpisode`, `watchEvent.create`, `watchEvent.delete`, `watchEvent.update`.

Writers with no UI caller (5): `watchEvent.backfillGenres`, `watched.create`, `watched.delete`, `watched.setReminder`, `watched.updateReview`.

Read on (10): `recommend/recommend-modal.tsx:44`, `routes/app/feed.tsx:33`, `routes/app/friends.tsx:509`, `routes/app/profile.$userId.tsx:140`, `routes/app/tracker.$tmdbId.tsx:94`, `routes/app/tracker.index.tsx:65`, `shuffle/card-stack.tsx:40`, `title/title-actions.tsx:101`, `watched/watched-with-modal.tsx:28`, `watchlist/create-watchlist-dialog.tsx:81`.

UI words: "Mark watched" (watchlist/watchlist-item-card.tsx:241), "Watch History" (routes/app/profile.$userId.tsx:1224, 2 sites), "Your Watch History" (title/title-actions.tsx:434), "logged" (watched/watch-event-card.tsx:245), "Mark in tracker" (notifications/notification-item.tsx:418), "Watch event deleted" (watched/watch-event-card.tsx:140).

Two row types mean 'I watched this'. Films and whole shows get a watch_event. Episodes get an episode_watch. The two never link in practice, because the UI never passes watchEventId (F07, F08). 'Logged' appears only on the watch event card (watch-event-card.tsx:245).

### A rating

Stored in: `watch_event.rating` (schema.ts:273), `review.rating` (schema.ts:455).

Live writers (2): `watchEvent.create`, `watchEvent.update`.

Writers with no UI caller (2): `review.upsert`, `watched.updateReview`.

Read on (8): `recommend/recommend-modal.tsx:44`, `routes/app/feed.tsx:33`, `routes/app/friends.tsx:509`, `routes/app/profile.$userId.tsx:140`, `routes/app/tracker.$tmdbId.tsx:94`, `title/title-actions.tsx:101`, `watched/watched-with-modal.tsx:28`, `watchlist/create-watchlist-dialog.tsx:81`.

UI words: "Your Rating" (watchlist/review-dialog.tsx:105), "Rating" (search/search-results.tsx:24, 2 sites), "Star Ratings" (routes/app/profile.$userId.tsx:1416, 2 sites), "Rate & Review" (watchlist/review-dialog.tsx:47, 2 sites).

Rating lives on each event, so a title has no rating of its own (F89). review.rating has no live writer, yet six achievements read it (F16).

### A review or thoughts

Stored in: `watch_event.note` (schema.ts:273), `watch_event.reviewText` (schema.ts:273), `review.text` (schema.ts:455), `journal_entry.note` (schema.ts:530).

Live writers (4): `journalEntry.create`, `journalEntry.update`, `watchEvent.create`, `watchEvent.update`.

Writers with no UI caller (2): `review.upsert`, `watched.updateReview`.

Read on (5): `routes/app/feed.tsx:59`, `routes/app/profile.$userId.tsx:1329`, `routes/app/tracker.$tmdbId.tsx:94`, `routes/app/tracker.index.tsx:140`, `title/title-actions.tsx:101`.

UI words: "Your Review" (watched/review-modal.tsx:258, 2 sites), "Leave a Review" (tracker/completion-celebration.tsx:175), "Submit Review" (watchlist/review-dialog.tsx:186), "Rate & Review" (watchlist/review-dialog.tsx:47, 2 sites), "Share your thoughts…" (watched/review-modal.tsx:263), "Add thoughts on" (routes/app/tracker.$tmdbId.tsx:1306), "Notes & Reviews" (routes/app/tracker.$tmdbId.tsx:1545), "Reviewed" (notifications/notification-item.tsx:425).

The label says review and the column is note. The live review box writes watch_event.note. watch_event.review_text is read by the ratings drill-down and nothing live writes it (F17).

### A note

Stored in: `journal_entry.note` (schema.ts:530), `watch_event.note` (schema.ts:273).

Live writers (4): `journalEntry.create`, `journalEntry.update`, `watchEvent.create`, `watchEvent.update`.

Writers with no UI caller (0): none.

Read on (5): `routes/app/feed.tsx:59`, `routes/app/profile.$userId.tsx:1800`, `routes/app/tracker.$tmdbId.tsx:94`, `routes/app/tracker.index.tsx:140`, `title/title-actions.tsx:101`.

UI words: "Your Note" (tracker/edit-note-modal.tsx:125, 2 sites), "Edit Note" (tracker/edit-note-modal.tsx:86, 2 sites), "Save Note" (tracker/write-about-modal.tsx:631), "Note" (tracker/write-about-modal.tsx:429), "Delete this note?" (routes/app/tracker.$tmdbId.tsx:1517), "Note saved" (tracker/write-about-modal.tsx:166).

'Note' in the UI means journal_entry. 'note' in the schema also means the review text on watch_event. Same word, different rows (F84). Films have no journal entry at all (F23).

### A diary entry

Stored in: `watch_event` (schema.ts:273), `journal_entry` (schema.ts:530).

Live writers (7): `episodeTracker.removeShow`, `journalEntry.create`, `journalEntry.delete`, `journalEntry.update`, `watchEvent.create`, `watchEvent.delete`, `watchEvent.update`.

Writers with no UI caller (5): `watchEvent.backfillGenres`, `watched.create`, `watched.delete`, `watched.setReminder`, `watched.updateReview`.

Read on (10): `recommend/recommend-modal.tsx:44`, `routes/app/feed.tsx:33`, `routes/app/friends.tsx:509`, `routes/app/profile.$userId.tsx:140`, `routes/app/tracker.$tmdbId.tsx:94`, `routes/app/tracker.index.tsx:65`, `shuffle/card-stack.tsx:40`, `title/title-actions.tsx:101`, `watched/watched-with-modal.tsx:28`, `watchlist/create-watchlist-dialog.tsx:81`.

UI words: "Film Diary" (routes/index.tsx:23), "Journal" (routes/app/profile.$userId.tsx:72, 3 sites), "Journal Entry" (tracker/journal-entry-card.tsx:163), "Journal your thoughts" (tracker/write-about-modal.tsx:432), "Watch History" (routes/app/profile.$userId.tsx:1224, 2 sites), "Notes & Reviews" (routes/app/tracker.$tmdbId.tsx:1545).

No table is called diary. The landing page says Film Diary (routes/index.tsx:23), the profile tab says Journal (profile.$userId.tsx:72), and that tab's component is DiaryTab (profile.$userId.tsx:1685). Five surfaces each show a subset (F25).

### A show's progress

Stored in: `episode_watch` (schema.ts:497), `user_title.currentWatchNumber` (schema.ts:112), `user_title.seasonEpisodeCounts` (schema.ts:112), `watchlist_item.watchedSeasons` (schema.ts:160).

Live writers (7): `episodeTracker.addShow`, `episodeTracker.markEpisodes`, `episodeTracker.markFromNotification`, `episodeTracker.removeShow`, `episodeTracker.startRewatch`, `episodeTracker.unmarkEpisode`, `watchlist.quickMarkWatched`.

Writers with no UI caller (0): none.

Read on (8): `routes/app/feed.tsx:33`, `routes/app/profile.$userId.tsx:140`, `routes/app/tracker.$tmdbId.tsx:62`, `routes/app/tracker.index.tsx:65`, `routes/app/watchlists/$watchlistId.tsx:39`, `shuffle/card-stack.tsx:156`, `title/title-actions.tsx:89`, `watchlist/add-to-watchlist-dropdown.tsx:32`.

UI words: "Progress" (routes/app/tracker.$tmdbId.tsx:627), "Episode Tracker" (routes/index.tsx:24), "Series Tracker" (routes/app/tracker.index.tsx:229), "Tracker" (routes/app/route.tsx:146, 3 sites), "Completed" (routes/app/tracker.index.tsx:483), "Show Complete" (tracker/completion-celebration.tsx:69, 2 sites), "Mark as Complete" (tracker/write-about-modal.tsx:671), "Seasons Watched" (watched/season-picker-modal.tsx:79, 2 sites).

Tracker and Progress are used for one thing. watched_seasons is a legacy second copy, and six rules decide 'complete' (F33).

### A rewatch

Stored in: `user_title.currentWatchNumber` (schema.ts:112), `episode_watch.watchNumber` (schema.ts:497), `watch_event.watchNumber` (schema.ts:273), `journal_entry.watchNumber` (schema.ts:530).

Live writers (5): `episodeTracker.markFromNotification`, `episodeTracker.startRewatch`, `journalEntry.create`, `watchEvent.create`, `watchEvent.update`.

Writers with no UI caller (0): none.

Read on (5): `routes/app/feed.tsx:59`, `routes/app/profile.$userId.tsx:1800`, `routes/app/tracker.$tmdbId.tsx:94`, `routes/app/tracker.index.tsx:65`, `title/title-actions.tsx:101`.

UI words: "Rewatch" (routes/app/tracker.$tmdbId.tsx:775, 2 sites), "Start Rewatch" (tracker/rewatch-confirm-modal.tsx:38, 2 sites), "Rewatch this show" (tracker/tracker-show-card.tsx:297), "Start rewatching" (tracker/rewatch-confirm-modal.tsx:68), "Watch 1" (routes/app/tracker.$tmdbId.tsx:878, 4 sites).

A rewatch exists for TV only. Films have no watch number above 1 (F04). 'Rewatch 2' and 'Watch 2' label the same state (F85).

### A watchlist

Stored in: `watchlist` (schema.ts:139), `watchlist_member` (schema.ts:198).

Live writers (11): `friend.block`, `friend.removeFriend`, `recommendation.accept`, `shuffle.getOrCreateShuffleWatchlist`, `tasteProfile.saveTasteProfile`, `watchlist.addMember`, `watchlist.create`, `watchlist.delete`, `watchlist.isWatched`, `watchlist.quickMarkWatched`, `watchlist.update`.

Writers with no UI caller (1): `watchlist.removeMember`.

Read on (16): `recommend/recommend-modal.tsx:44`, `routes/app/feed.tsx:33`, `routes/app/friends.tsx:509`, `routes/app/profile.$userId.tsx:140`, `routes/app/shuffle/index.tsx:27`, `routes/app/tracker.$tmdbId.tsx:244`, `routes/app/watchlists/$watchlistId.tsx:39`, `routes/app/watchlists/index.tsx:20`, `shuffle/card-stack.tsx:40`, `shuffle/mode-pill.tsx:19`, `shuffle/mode-switcher.tsx:53`, `title/title-actions.tsx:89`, `watched/watched-with-modal.tsx:28`, `watchlist/add-to-watchlist-dropdown.tsx:32`, `watchlist/create-watchlist-dialog.tsx:81`, `watchlist/watchlist-item-card.tsx:123`.

UI words: "Watchlist" (title/title-actions.tsx:335), "Watchlists" (routes/app/profile.$userId.tsx:78, 4 sites), "My Watchlists" (routes/app/watchlists/index.tsx:33), "Create New Watchlist" (title/title-actions.tsx:384, 3 sites).

Four list types share the table: default, custom, shuffle and recommendations. The schema comment names three (F73).

### A saved title

Stored in: `watchlist_item` (schema.ts:160), `user_title` (schema.ts:112).

Live writers (19): `episodeTracker.addShow`, `episodeTracker.markFromNotification`, `episodeTracker.removeShow`, `episodeTracker.startRewatch`, `friend.block`, `friend.removeFriend`, `recommendation.accept`, `shuffle.recordSwipe`, `shuffle.undoSwipe`, `tasteProfile.saveTasteProfile`, `watchEvent.delete`, `watchlist.addItem`, `watchlist.get`, `watchlist.keepInWatchlist`, `watchlist.list`, `watchlist.markWatched`, `watchlist.quickMarkWatched`, `watchlist.removeFromMultipleWatchlists`, `watchlist.removeItem`.

Writers with no UI caller (0): none.

Read on (10): `routes/app/feed.tsx:33`, `routes/app/profile.$userId.tsx:140`, `routes/app/tracker.$tmdbId.tsx:244`, `routes/app/tracker.index.tsx:65`, `routes/app/watchlists/$watchlistId.tsx:39`, `routes/app/watchlists/index.tsx:20`, `shuffle/card-stack.tsx:40`, `title/title-actions.tsx:89`, `watchlist/add-to-watchlist-dropdown.tsx:32`, `watchlist/watchlist-item-card.tsx:123`.

UI words: "Add to Watchlist" (title/title-actions.tsx:347, 2 sites), "In watchlist" (watchlist/add-to-watchlist-dropdown.tsx:86), "Remove from watchlist" (watchlist/watchlist-item-card.tsx:263), "Pick" (settings/edit-genres-dialog.tsx:82).

user_title means 'tracked show' in the tracker and 'taste pick' in onboarding (F35, F99). 'Saved' itself never appears as a word for a title. My Picks is a server-side list name, written in three places (F66).

### Watched status

Stored in: `watchlist_item.watched` (schema.ts:160), `watchlist_item.watchedAt` (schema.ts:160), `watchlist_item.keptInWatchlist` (schema.ts:160).

Live writers (6): `friend.block`, `friend.removeFriend`, `watchEvent.delete`, `watchlist.keepInWatchlist`, `watchlist.markWatched`, `watchlist.quickMarkWatched`.

Writers with no UI caller (0): none.

Read on (8): `routes/app/feed.tsx:33`, `routes/app/profile.$userId.tsx:140`, `routes/app/tracker.$tmdbId.tsx:244`, `routes/app/watchlists/$watchlistId.tsx:39`, `shuffle/card-stack.tsx:156`, `title/title-actions.tsx:89`, `watchlist/add-to-watchlist-dropdown.tsx:32`, `watchlist/watchlist-item-card.tsx:123`.

UI words: "Watched" (routes/app/friends.tsx:179, 4 sites), "Mark watched" (watchlist/watchlist-item-card.tsx:241), "Marked as watched" (title/title-actions.tsx:167), "Removed from watched" (title/title-actions.tsx:175).

Stored per list row, so a person has no watched status. Every other meaning is derived differently by each screen (F01, F06, F27).

### A recommendation

Stored in: `recommendation` (schema.ts:326), `watchlist_item.recommendedBy` (schema.ts:160), `watchlist_item.recommendationMessage` (schema.ts:160).

Live writers (2): `recommendation.accept`, `recommendation.send`.

Writers with no UI caller (0): none.

Read on (4): `routes/app/watchlists/$watchlistId.tsx:39`, `shuffle/card-stack.tsx:156`, `title/title-actions.tsx:89`, `watchlist/add-to-watchlist-dropdown.tsx:32`.

UI words: "Recommend" (recommend/recommend-modal.tsx:143, 4 sites), "Recommend to a friend" (watched/review-modal.tsx:360), "Send Recommendation" (recommend/recommend-modal.tsx:266), "Recommendation sent!" (recommend/recommend-modal.tsx:61), "Invite" (title/title-actions.tsx:401, 3 sites), "Recommended by @" (watchlist/watchlist-item-card.tsx:275).

The title page button says Invite and opens the recommend form (F83). status is never written (F49).

### A friend

Stored in: `friendship` (schema.ts:351), `block` (schema.ts:386).

Live writers (7): `friend.acceptRequest`, `friend.block`, `friend.cancelRequest`, `friend.declineRequest`, `friend.removeFriend`, `friend.sendRequest`, `friend.unblock`.

Writers with no UI caller (0): none.

Read on (8): `recommend/recommend-modal.tsx:44`, `routes/app/feed.tsx:33`, `routes/app/friends.tsx:509`, `routes/app/profile.$userId.tsx:143`, `routes/app/settings/blocked.tsx:42`, `watched/watched-with-modal.tsx:28`, `watchlist/create-watchlist-dialog.tsx:81`, `watchlist/invite-member-modal.tsx:49`.

UI words: "Friends" (routes/app/friends.tsx:476, 5 sites), "Add Friend" (routes/app/friends.tsx:491, 2 sites), "Friend Requests" (routes/app/friends.tsx:604), "Your Friends" (routes/app/friends.tsx:634), "Mutual" (routes/app/profile.$userId.tsx:680), "Friends & Feed" (routes/index.tsx:28).

The word is consistent. The accepted check is copied on 16 lines (F74), and block is a write-side rule only (F55).

### A notification

Stored in: `notification` (schema.ts:249).

Live writers (16): `friend.acceptRequest`, `friend.sendRequest`, `notification.delete`, `notification.deleteAll`, `notification.markAllAsRead`, `notification.markAsRead`, `notification.setActionTaken`, `recommendation.accept`, `recommendation.decline`, `recommendation.send`, `shuffle.recordSwipe`, `watchEvent.create`, `watchEvent.update`, `watchlist.addItem`, `watchlist.addMember`, `watchlist.markWatched`.

Writers with no UI caller (2): `watched.updateReview`, `watchlist.recommendTitle`.

Read on (1): `notifications/notification-bell.tsx:23`.

UI words: "Notifications" (notifications/notification-bell.tsx:71), "No notifications" (notifications/notification-bell.tsx:92), "Delete all notifications" (notifications/notification-bell.tsx:109).

16 declared types, 3 never emitted and 1 emitted only by a dead procedure (F46). notification.data is the sole record of a recommendation answer (F49).

### An achievement

Stored in: `earned_achievement` (schema.ts:434).

Live writers (14): `achievement.sync`, `episodeTracker.addShow`, `episodeTracker.markEpisodes`, `episodeTracker.markFromNotification`, `episodeTracker.startRewatch`, `friend.acceptRequest`, `journalEntry.create`, `recommendation.send`, `shuffle.recordSwipe`, `tasteProfile.saveProfileExtras`, `watchEvent.create`, `watchlist.addMember`, `watchlist.create`, `watchlist.markWatched`.

Writers with no UI caller (1): `review.upsert`.

Read on (3): `achievements/achievement-celebration-provider.tsx:38`, `routes/app/feed.tsx:59`, `routes/app/profile.$userId.tsx:766`.

UI words: "Achievements" (routes/app/profile.$userId.tsx:857, 5 sites), "Achievement Unlocked" (achievements/achievement-popup.tsx:98, 2 sites), "Compare Achievements" (achievements/achievement-grid.tsx:107, 2 sites), "Achievements Unlocked" (achievements/achievement-popup.tsx:98, 2 sites).

45 defined and 9 impossible through the live UI (F16, F40). Rule data reads watchlist_item, not the log (F39).

### A companion

Stored in: `watch_event_companion` (schema.ts:480), `watch_event.originEventId` (schema.ts:273).

Live writers (2): `watchEvent.create`, `watchEvent.update`.

Writers with no UI caller (0): none.

Read on (4): `routes/app/feed.tsx:59`, `routes/app/profile.$userId.tsx:1800`, `routes/app/tracker.$tmdbId.tsx:94`, `title/title-actions.tsx:101`.

UI words: "Watched With" (watched/watched-with-modal.tsx:67, 2 sites), "Watched with…" (watched/review-modal.tsx:377), "Companion" (watched/visibility-selector.tsx:27), "Watching With" (watched/watched-with-modal.tsx:178), "Shared" (achievements/achievement-grid.tsx:87, 3 sites).

A companion row and a reciprocal watch_event are two records for one person (F10, F12, F14).

### Visibility or privacy

Stored in: `watch_event.visibility` (schema.ts:273), `journal_entry.isPublic` (schema.ts:530), `watchlist.isPublic` (schema.ts:139).

Live writers (8): `friend.block`, `friend.removeFriend`, `journalEntry.create`, `journalEntry.update`, `watchEvent.create`, `watchEvent.update`, `watchlist.create`, `watchlist.update`.

Writers with no UI caller (0): none.

Read on (12): `recommend/recommend-modal.tsx:44`, `routes/app/feed.tsx:33`, `routes/app/friends.tsx:509`, `routes/app/profile.$userId.tsx:140`, `routes/app/shuffle/index.tsx:27`, `routes/app/tracker.$tmdbId.tsx:94`, `routes/app/tracker.index.tsx:140`, `routes/app/watchlists/$watchlistId.tsx:39`, `routes/app/watchlists/index.tsx:20`, `title/title-actions.tsx:101`, `watched/watched-with-modal.tsx:28`, `watchlist/create-watchlist-dialog.tsx:81`.

UI words: "Public" (tracker/edit-note-modal.tsx:149, 5 sites), "Private" (tracker/edit-note-modal.tsx:149, 6 sites), "Only visible to you" (watched/visibility-selector.tsx:35), "Visible to all your friends" (watched/visibility-selector.tsx:21), "Only you & who you watched with" (watched/visibility-selector.tsx:28), "Who can see this?" (watched/visibility-selector.tsx:53), "Make private" (watchlist/watchlist-detail-header.tsx:173), "Make public" (watchlist/watchlist-detail-header.tsx:173).

Three models. 'Public' means friends in the selector and any signed-in user in the code (F54). 'Hidden' means shuffle exclusion, not privacy (F68).

### A shuffle or match

Stored in: `shuffle_swipe` (schema.ts:220).

Live writers (4): `shuffle.recordSwipe`, `shuffle.toggleHide`, `shuffle.undoSwipe`, `shuffle.unhideTitle`.

Writers with no UI caller (0): none.

Read on (4): `routes/app/shuffle/hidden.tsx:16`, `routes/app/tracker.$tmdbId.tsx:107`, `shuffle/card-stack.tsx:40`, `title/title-actions.tsx:93`.

UI words: "Showtime Shuffle" (routes/index.tsx:26, 2 sites), "Shuffle" (routes/app/route.tsx:131, 2 sites), "MATCH!" (shuffle/match-celebration.tsx:70), "Match" (shuffle/match-celebration.tsx:44), "Curtain Call" (shuffle/match-celebration.tsx:58), "Hidden from Shuffle" (routes/app/tracker.$tmdbId.tsx:277, 2 sites).

Three names for one feature area. A match has no table of its own and is derived from swipes when the last member says yes (F67).

<!-- matrix:end -->

## Synonyms and collisions

One label covering two things is worse than two labels for one thing, because the user cannot tell which happened. Both kinds are below.

| Words | Same thing? | Where | Effect |
| --- | --- | --- | --- |
| Your Review, Share your thoughts, Rate & Review | Same box, writes `watch_event.note` | `watched/review-modal.tsx:258`, `:263` | Label and column disagree |
| Add thoughts on, Notes & Reviews | One section mixing `journal_entry` and `watch_event` | `routes/app/tracker.$tmdbId.tsx:1306`, `:1545` | Two records look like one list (F84) |
| Your Note, Journal Entry, Journal | Same record, `journal_entry` | `tracker/write-about-modal.tsx:20`, `routes/app/tracker.index.tsx:212` | Three names |
| Film Diary, Journal, DiaryTab, Dear Diary | Different scopes | `routes/index.tsx:23`, `routes/app/profile.$userId.tsx:72`, `:1685`, `lib/achievements.ts:456` | Film Diary promises films, and the Journal tab holds TV notes only (F23) |
| Delete this review?, Watch event deleted | Same action, deletes the whole log | `routes/app/tracker.$tmdbId.tsx:1527`, `watched/watch-event-card.tsx:140` | User expects to delete words and loses the watch (F22) |
| Invite (title page), Invite (list header) | Different actions | `title/title-actions.tsx:401`, `watchlist/watchlist-detail-header.tsx:164` | Recommend form vs add member (F83) |
| Recommend, Recommend to a friend, Invite | Same action | `title/title-actions.tsx:401`, `watched/review-modal.tsx:360` | Two names for one action |
| Rewatch 2, Watch 2 | Same state | `routes/app/tracker.$tmdbId.tsx:1575`, `:300` | F85 |
| General, Full Show | Same scope value `show` | `routes/app/tracker.$tmdbId.tsx:1399`, `tracker/write-about-modal.tsx:56` | Label depends on note or review (F85) |
| Series Tracker, Episode Tracker, Tracker, Progress | Same feature | `routes/app/tracker.index.tsx:229`, `routes/index.tsx:24` | Harmless but adds up |
| Public | Different audiences | `watched/visibility-selector.tsx:21`, `routers/watch-event.ts:703` | Says friends, means any signed-in user (F54) |
| Shared | Three senses | `watched/watch-event-card.tsx:216`, `watchlist/watchlist-reel-header.tsx:33`, `achievements/achievement-grid.tsx:87` | Log visibility badge, shared list, achievement filter |
| Hidden | Shuffle exclusion only | `title/title-actions.tsx:427`, `routes/app/tracker.$tmdbId.tsx:816` | Reads like privacy next to a privacy selector (F68) |
| Feed | Three procedures | `routers/watch-event.ts:691`, `routers/shuffle.ts:96`, `routers/taste-profile.ts:240` | Activity vs candidates (F81) |

## Concepts the code has and the user has no word for

Measured from the schema, inferred as a gap.

- A reciprocal log. `watch_event.origin_event_id` (`db/schema.ts:291`) creates a row in a friend's diary. The UI has no name for it and no way to tell it from the friend's own log after the origin is deleted (F13).
- Kept in watchlist. `watchlist_item.kept_in_watchlist` records "I watched it and want it to stay". The word appears only in error toasts ("Failed to keep in watchlists").
- Scope. `episode`, `season` and `show` on `watch_event` and `journal_entry` drive labels, but the user only sees them as a wizard step in Write About.

## Words the user would use that the code lacks

Inferred.

- "My rating of this film". No title-level rating exists (F89).
- "Have I seen this". No per-person watched record exists (F01, F06).
- "Everything I've watched". No screen or query returns it (F25).
