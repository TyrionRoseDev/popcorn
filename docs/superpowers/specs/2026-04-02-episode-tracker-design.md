# Episode & Season Tracker

## Overview

A progress tracking system for TV shows. Users track which episodes they've watched, see their progress across all shows, and write notes or reviews — all from a dedicated tracker page. Watch time accumulates from marked episodes and contributes to the same unified watch time stat as films.

## Core Concepts

### Episode Tracker
- Users mark individual episodes as watched via a tracker UI
- Each marked episode adds its runtime to the user's total watch time
- Progress is visible per-season and per-show
- The tracker is the single source of truth for TV watch progress

### Journal Entries (Notes)
- Casual notes about a specific episode, season, or show (e.g., "S3E9 was heartbreaking")
- No rating, no structured fields — just text
- Can be public (shown on feed + profile activity) or private (tracker only)
- Do NOT affect watch time or watched status
- Viewable per-show on the tracker and across all shows via a Journal tab

### Reviews
- Structured feedback with a star rating (1-5), using the existing review modal UI (marquee header, star rating, review text, date, companions)
- Scoped to an episode, season, or full show
- Completion check: if the user hasn't finished the scope they're reviewing, they get a warning ("You haven't completed this yet — are you sure?") with the option to mark as complete or continue anyway
- Full show review is prompted when a finished show (status: Ended/Canceled) has all episodes marked
- Can be public or private

### Films Are Unchanged
- Films keep the current watch event / review system exactly as-is
- No journal entries for films — you watch the whole thing, you review the whole thing

## Data Model

### New Table: `episodeWatch`

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (CUID) | Primary key |
| `userId` | text | References user |
| `tmdbId` | integer | The TV show's TMDB ID |
| `seasonNumber` | integer | Season number |
| `episodeNumber` | integer | Episode number |
| `runtime` | integer | Episode runtime in minutes (from TMDB) |
| `watchedAt` | timestamp | When the user marked it |
| `watchEventId` | text (nullable) | References watchEvent if created via a review/log |
| `createdAt` | timestamp | Row creation time |

**Unique constraint:** `(userId, tmdbId, seasonNumber, episodeNumber)` — one row per episode per user.

### New Table: `journalEntry`

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (CUID) | Primary key |
| `userId` | text | References user |
| `tmdbId` | integer | The TV show's TMDB ID |
| `scope` | text | `"episode"`, `"season"`, or `"show"` |
| `seasonNumber` | integer (nullable) | If scope is episode or season |
| `episodeNumber` | integer (nullable) | If scope is episode |
| `note` | text | The journal entry text |
| `isPublic` | boolean | Whether it shows on feed/activity |
| `createdAt` | timestamp | Entry creation time |
| `updatedAt` | timestamp | Last edit time |

### Changes to Existing Tables

- **`watchlistItem`**: `watchedSeasons` column removed for TV. `runtime` column used for films only. The `watched` boolean for TV is derived from tracker state: `true` when show is "Ended"/"Canceled" and all episodes are marked, `false` otherwise.
- **`watchEvent`**: Stays as-is. TV watch events can still be created (reviews with rating use the existing modal). A new optional `scope` field and `seasonNumber`/`episodeNumber` fields are added so reviews can target a specific episode/season.

### Watch Time Calculation

- **Film watch time**: `SUM(watchlistItem.runtime)` where `mediaType = 'movie'` (unchanged)
- **TV watch time**: `SUM(episodeWatch.runtime)` for that user
- **Total profile watch time**: Film + TV combined, unified stat

## Pages & Routes

### Tracker Dashboard — `/app/tracker`

The hub for all TV show tracking.

**Two main sections:**
1. **Watching** — shows with at least 1 marked episode that aren't fully complete. Sorted by most recently updated (`watchedAt`). Each show displays:
   - Poster thumbnail
   - Title
   - Progress bar with episode count (e.g., "23/62 episodes")
   - Status indicator:
     - In progress (partially watched)
     - "More episodes coming soon" or next air date (all available episodes watched, show is "Returning Series")

2. **Completed** — shows where status is "Ended"/"Canceled" and all episodes are marked. Each show displays:
   - Poster thumbnail
   - Title
   - "Completed" badge
   - Star rating if reviewed

**Journal tab:**
- Accessible from the dashboard
- Shows all journal entries across all shows, sorted chronologically
- Filterable by show

### Show Tracker — `/app/tracker/:tmdbId`

Detailed episode tracking for a single show.

**Layout:**
- Show title, poster, and overall progress at top
- Status indicator (in progress / caught up / completed)
- Horizontal scrollable episode cards grouped by season
- Each season has:
  - Season header with name and episode count (e.g., "Season 1 — 8/10 episodes")
  - "Mark season" bulk action button
  - Horizontally scrollable episode cards
- "Mark all" button for the full show
- Each episode card shows:
  - Episode number
  - Episode name
  - Runtime
  - Watched/unwatched visual state (filled/highlighted when watched)

**Actions on the tracker page:**
- "Write about this" button → choose Note or Review (see flow below)
- "Log a watch" button → for users who want to create a feed entry about a recent watch

**Notes & Reviews section:**
- Below the episode cards
- Shows all journal entries and reviews for this show
- Chronologically ordered
- Edit/delete available on own entries

**Ongoing show info:**
- If show status is "Returning Series" and all available episodes are marked: display "More episodes coming soon" or next episode air date if available from TMDB

**Completion flow:**
- When show status is "Ended"/"Canceled" and user marks the last episode → prompt for a full show review (if they haven't already left one)
- Show moves to the Completed section on the dashboard

### Title Page Changes (TV Only)

- **"Watched" button behavior changes:**
  - If user has no episodes marked for this show → adds show to tracker → redirects to `/app/tracker/:tmdbId` → the tracker page itself serves as the episode picker (user starts marking episodes directly on the page)
  - If user already has episodes marked → redirects to `/app/tracker/:tmdbId`
- **Season picker modal removed** for TV
- **"Edit Seasons Watched" link removed**
- **"Your Watch History" section** stays but shows watch events / journal entries for this show
- **Watchlist and Invite buttons** unchanged

## User Flows

### Marking Episodes as Watched

1. User navigates to tracker show page (via title page "Watched" button or tracker dashboard)
2. Taps individual episode cards to toggle watched/unwatched
3. Or taps "Mark season" / "Mark all" for bulk actions
4. Each mark creates an `episodeWatch` row with runtime from TMDB
5. Watch time accumulates automatically
6. No feed entry is created — this is quiet progress tracking

### Unmarking Episodes

1. User taps a watched episode card
2. Confirmation prompt: "Unmark this episode? This will remove Xm from your watch time."
3. On confirm: `episodeWatch` row deleted, watch time decreases

### Writing a Note (Journal Entry)

1. User clicks "Write about this" on tracker show page
2. Selects "Note"
3. Optionally picks scope: episode / season / show (with episode/season selector if applicable)
4. Writes text in a text box
5. Toggles public/private
6. Submits
7. Note saved to `journalEntry` table
8. If public: appears on feed and profile activity, labeled as "Journal Entry" (e.g., "Tyrion wrote about Breaking Bad - S3E9")
9. Note appears in the show's "Notes & Reviews" section and the Journal tab on the dashboard
10. Does NOT affect watch time or watched status

### Writing a Review

1. User clicks "Write about this" on tracker show page
2. Selects "Review"
3. Picks scope: episode / season / full show
4. Completion check:
   - If user hasn't finished the selected scope → warning: "You haven't finished [this episode / Season 3 / this show] yet. Would you like to mark as complete, or continue anyway?"
   - User can mark as complete (creates `episodeWatch` rows) or continue with the review anyway
5. Existing review modal opens (same UI as current: marquee header, star rating, review text, date, companions) with scope context in the header (e.g., "Season 3" or "S3E9 - Ozymandias")
6. Submits → creates `watchEvent` with scope fields
7. Appears on feed and profile activity

### Completion Review Prompt

1. User marks the last episode of a show with status "Ended" or "Canceled"
2. System prompts: "You've finished [show name]! Want to leave a review?"
3. If yes → review modal opens for full show scope
4. If no → show moves to Completed section without review
5. This prompt only appears if the user hasn't already left a full show review

### Logging a Watch (TV)

1. User clicks "Log a watch" on tracker show page
2. Episode picker opens — same horizontal card UI from the tracker
3. User selects individual episodes, whole seasons, or full show
4. Selected episodes get marked in the tracker (creates `episodeWatch` rows if not already marked)
5. Review modal opens for the feed entry (rating, note, companions, date)
6. Creates a `watchEvent` linked to the marked episodes (the watch event is for the feed only — watch time comes from the `episodeWatch` rows, not the event)

## Feed Display

### Journal Entry Card
- Labeled "Journal Entry" (not "watched")
- Shows: user avatar, "wrote about [show name]", scope if applicable ("S3E9"), timestamp
- Displays the note text
- No star rating
- Edit/delete available on own entries

### Review Card (TV)
- Same as current watch event card design
- Shows scope in the title area (e.g., "Breaking Bad - Season 3")
- Star rating displayed
- Review text displayed
- Companions shown if present

## Migration

### Existing `watchedSeasons` Data
- For each user with `watchlistItem.watchedSeasons` on TV shows:
  - Fetch episode details from TMDB for each watched season
  - Create `episodeWatch` rows for every episode in those seasons with correct runtimes
  - Remove the `watchedSeasons` value from the watchlist item
- Recalculate TV watch time from new `episodeWatch` rows
- Remove old TV runtime from `watchlistItem.runtime`
- Net result: same watch time, new source of truth

### Existing TV Watch Events
- Existing `watchEvent` entries for TV shows stay as-is in the feed
- They are historical records and don't need migration

## TMDB API

### New Endpoint Needed
- `GET /tv/{id}/season/{season_number}` — fetches season details including individual episode info (name, number, runtime, air date)
- Called when user opens a show's tracker page
- Episode data can be cached/stored to avoid repeated API calls

### Existing Endpoints Used
- `GET /tv/{id}` — already fetched for title details, includes `status` field ("Returning Series", "Ended", "Canceled") and `seasonList`

## Navigation

- New "Tracker" link in the app navigation menu
- Links to `/app/tracker` dashboard
